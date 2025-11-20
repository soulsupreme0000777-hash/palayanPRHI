

import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { Role, User, Applicant, StudentProgress } from '../../types';
import { AdminCreateUserModalComponent } from '../admin-create-user-modal/admin-create-user-modal.component';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, AdminCreateUserModalComponent, ConfirmationModalComponent],
})
export class AdminUsersComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  
  users = this.userService.users;
  RoleEnum = Role;

  searchTerm = signal('');
  roleFilter = signal<Role | 'All'>('All');
  isUserModalOpen = signal(false);
  userForModal = signal<User | Applicant | null>(null);
  expandedInstructorEmail = signal<string | null>(null);

  isConfirmOpen = signal(false);
  confirmTitle = signal('');
  confirmMessage = signal('');
  private pendingAction: (() => void) | null = null;

  ngOnInit(): void {
    this.userService.loadInitialData();
  }

  filteredUsers = computed(() => {
    const searchTerm = this.searchTerm().toLowerCase();
    const roleFilter = this.roleFilter();

    return this.users().filter(user => {
      const name = user.name || '';
      const email = user.email || '';
      
      const termMatch = name.toLowerCase().includes(searchTerm) || email.toLowerCase().includes(searchTerm);
      const roleMatch = roleFilter === 'All' || user.role === roleFilter;

      return termMatch && roleMatch;
    });
  });

  studentsForExpandedInstructor = computed<StudentProgress[]>(() => {
    // This needs to be implemented with real data fetching
    return [];
  });

  getApplicantStatus(user: User | Applicant): string {
    if (user.role === Role.Student) {
      return (user as Applicant).assessmentStatus;
    }
    return 'Active';
  }

  toggleInstructorDetails(email: string): void {
    this.expandedInstructorEmail.update(current => current === email ? null : email);
  }

  openCreateModal(): void {
    this.userForModal.set(null);
    this.isUserModalOpen.set(true);
  }

  openEditModal(user: User | Applicant): void {
    this.userForModal.set(user);
    this.isUserModalOpen.set(true);
  }

  closeUserModal(): void {
    this.isUserModalOpen.set(false);
  }

  async handleSaveUser(event: { data: { name: string, email?: string, role?: Role, password?: string }, originalEmail?: string }): Promise<void> {
    const isEdit = !!event.originalEmail;
    
    try {
      if (isEdit) {
        // Handle update
        const user = this.userForModal();
        if (!user || !user.id) return;
        
        await this.authService.updateUser(user.id, { name: event.data.name });
        
        if (event.data.password) {
          this.notificationService.show('Password update functionality requires a secure server environment.');
        }

        this.notificationService.showSuccess(`User ${event.data.name} updated successfully.`);
      } else {
        await this.authService.createInstructor(event.data);
        this.notificationService.showSuccess(`Instructor ${event.data.name} created successfully.`);
      }
      this.userService.loadInitialData();
      this.closeUserModal();
    } catch (error: any) {
      this.notificationService.showError(error.message || 'An unexpected error occurred.');
    }
  }

  handleDeleteUser(user: User | Applicant): void {
    if (!user.id) return;
    this.confirmTitle.set('Confirm Deletion');
    this.confirmMessage.set(`Are you sure you want to delete the user "${user.name}"? This action is permanent.`);
    this.pendingAction = async () => {
      try {
        await this.authService.deleteUser(user.id!);
        this.notificationService.showSuccess(`User "${user.name}" has been deleted.`);
        this.userService.loadInitialData();
      } catch (error: any) {
         this.notificationService.showError(error.message || 'Failed to delete user.');
      }
    };
    this.isConfirmOpen.set(true);
  }

  handleConfirm() {
    this.pendingAction?.();
    this.closeConfirm();
  }

  closeConfirm() {
    this.isConfirmOpen.set(false);
    this.pendingAction = null;
  }
}