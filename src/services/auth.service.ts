

import { Injectable, inject, signal } from '@angular/core';
import { UserService } from './user.service';
import { Role, User, Applicant, RequiredDoc } from '../types';
import { SupabaseService } from './supabase.service';
import type { AuthChangeEvent, Session, User as SupabaseUser, RealtimeChannel } from '@supabase/supabase-js';
import { NotificationService } from './notification.service';

const defaultDocs: RequiredDoc[] = [
    { name: 'Valid ID (Front)', status: 'Pending' },
    { name: 'Valid ID (Back)', status: 'Pending' },
    { name: '2x2 Photo', status: 'Pending' },
    { name: 'Proof of Address (Optional)', status: 'Pending' },
    { name: 'Certificates (Optional)', status: 'Pending' },
];

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userService = inject(UserService);
  private supabase = inject(SupabaseService);
  private notificationService = inject(NotificationService);
  private profileChannel: RealtimeChannel | null = null;

  constructor() {
    this.supabase.client.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        this.handleAuthStateChange(event, session);
      }
    );
  }

  private async handleAuthStateChange(event: AuthChangeEvent, session: Session | null) {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session?.user) {
        await this.fetchAndSetCurrentUserProfile(session.user.id);
        this.userService.initializeRealtimeListeners(); // Initialize listeners after user is confirmed
        this.userService.loadInitialData();
      }
    } else if (event === 'SIGNED_OUT') {
      if (this.profileChannel) {
        this.supabase.client.removeChannel(this.profileChannel);
        this.profileChannel = null;
      }
      this.userService.cleanupRealtimeListeners(); // Clean up listeners on logout
      this.userService.currentUser.set(null);
    }
  }

  private async fetchAndSetCurrentUserProfile(userId: string) {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user profile:', error.message, error);
      if (error.message.includes('infinite recursion')) {
          this.notificationService.showError('DATABASE FIX REQUIRED: Your Supabase security rules are causing an infinite loop. The app cannot work until you run the provided SQL fix in your Supabase dashboard.');
      } else {
          this.notificationService.showError(`Failed to fetch profile: ${error.message}`);
      }
      await this.logout();
      this.userService.currentUser.set(null);
      return;
    }

    if (data) {
      let userProfile: User | Applicant;

      if (data.role === Role.Student) {
        userProfile = {
          id: data.id,
          name: data.full_name,
          email: data.email,
          role: Role.Student,
          avatarUrl: data.avatar_url,
          assessmentStatus: data.assessment_status,
          assessmentScore: data.assessment_score,
          assessmentTotal: data.assessment_total,
          batchId: data.batch_id,
          batch: 'N/A',
          documents: data.documents || defaultDocs,
        };
      } else {
        userProfile = {
          id: data.id,
          name: data.full_name,
          email: data.email,
          role: data.role,
          avatarUrl: data.avatar_url,
        };
      }
      
      this.userService.currentUser.set(userProfile);

      if (this.profileChannel) {
        this.supabase.client.removeChannel(this.profileChannel);
        this.profileChannel = null;
      }

      this.profileChannel = this.supabase.client
        .channel(`profile-changes-${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => {
            console.log('User profile updated in real-time. Re-fetching.', payload);
            this.fetchAndSetCurrentUserProfile(userId);
          }
        )
        .subscribe();
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    const { error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error('Login error:', error.message);
      return false;
    }
    return true;
  }

  async register(data: {
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<SupabaseUser | null> {
    const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');

    const { data: authData, error } = await this.supabase.client.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      console.error('Registration error:', error.message);
      throw new Error(error.message);
    }
    
    return authData.user;
  }

  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.userService.currentUser();
    if (!user) {
        throw new Error('User not authenticated.');
    }
    const { error: signInError } = await this.supabase.client.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
    });

    if (signInError) {
        throw new Error('Incorrect current password.');
    }

    const { error: updateError } = await this.supabase.client.auth.updateUser({
        password: newPassword,
    });

    if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
    }
  }

  async updateUser(userId: string, data: { name: string }): Promise<void> {
    const { error } = await this.supabase.client.from('profiles').update({ full_name: data.name }).eq('id', userId);
    if (error) {
      this.notificationService.showError(`Failed to update user: ${error.message}`);
      throw error;
    }
  }

  async createInstructor(data: { name: string, email?: string, role?: Role, password?: string }): Promise<SupabaseUser | null> {
    if (!data.email || !data.password) {
        throw new Error("Email and password are required to create an instructor.");
    }

    const { data: { session: adminSession }, error: sessionError } = await this.supabase.client.auth.getSession();
    if (sessionError || !adminSession) {
        throw new Error('Could not get current admin session. Cannot create user.');
    }

    const { data: authData, error: signUpError } = await this.supabase.client.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                full_name: data.name,
            }
        }
    });

    if (signUpError) {
        throw new Error(signUpError.message);
    }
    
    if (!authData.user) {
        await this.supabase.client.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token,
        });
        throw new Error("User creation failed unexpectedly.");
    }
    
    const newUser = authData.user;

    const { error: setSessionError } = await this.supabase.client.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
    });

    if (setSessionError) {
        console.error('CRITICAL: Failed to restore admin session:', setSessionError);
        this.notificationService.showError('User created, but failed to restore your session. Please log in again.');
        await this.logout(); 
        throw new Error("Failed to restore admin session.");
    }

    const { error: profileError } = await this.supabase.client.from('profiles').update({ role: Role.Instructor }).eq('id', newUser.id);
    
    if (profileError) {
        console.error("Failed to set instructor role. Deleting user.", profileError.message);
        await this.deleteUser(newUser.id);
        throw new Error(`Failed to set instructor role: ${profileError.message}. The new user has been deleted.`);
    }

    return newUser;
  }

  async deleteUser(userId: string): Promise<void> {
    console.warn(`Attempting to delete user ${userId}. This is an admin action and requires a backend RPC function.`);
    const { error } = await this.supabase.client.rpc('delete_user_by_id', { user_id_to_delete: userId });
     if (error) {
        throw new Error(`Could not delete user. The required backend function 'delete_user_by_id' is missing. Please create it in your Supabase SQL Editor. Original error: ${error.message}`);
     }
  }
}