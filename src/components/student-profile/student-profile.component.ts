import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { User } from '../../types';

@Component({
  selector: 'app-student-profile',
  templateUrl: './student-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class StudentProfileComponent implements OnInit {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  currentUser = this.userService.currentUser;
  
  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  avatarPreview = signal<string | null>(null);
  private avatarFile: File | null = null;
  isUploading = signal(false);

  ngOnInit(): void {
    const user = this.currentUser();
    if (!user) return;

    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

    this.profileForm = this.fb.group({
      firstName: [firstName, Validators.required],
      middleName: [middleName],
      lastName: [lastName, Validators.required],
      email: [{ value: user.email, disabled: true }],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.avatarFile = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview.set(reader.result as string);
      };
      reader.readAsDataURL(this.avatarFile);
    }
  }

  async saveAvatar(): Promise<void> {
    const user = this.currentUser();
    if (!this.avatarFile || !user || !user.id) return;

    this.isUploading.set(true);
    try {
      const avatarUrl = await this.userService.uploadAvatar(user.id, this.avatarFile);
      if (avatarUrl) {
        await this.userService.updateUserAvatar(user.id, avatarUrl);
        this.notificationService.showSuccess('Avatar updated successfully!');
        this.avatarFile = null;
        this.avatarPreview.set(null);
      }
    } catch (error) {
      this.notificationService.showError('Failed to update avatar.');
    } finally {
      this.isUploading.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    const user = this.currentUser();
    if (this.profileForm.invalid || !this.profileForm.dirty || !user || !user.id) return;

    this.isUploading.set(true);

    try {
      // Update name if it changed
      const { firstName, middleName, lastName } = this.profileForm.getRawValue();
      const newFullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      
      if (newFullName !== user.name) {
          await this.authService.updateUser(user.id, { name: newFullName });
      }

      this.notificationService.showSuccess('Profile details updated successfully!');
      this.profileForm.markAsPristine();
    } catch (error) {
      this.notificationService.showError('Failed to update profile details.');
    } finally {
      this.isUploading.set(false);
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    try {
      await this.authService.changePassword(currentPassword!, newPassword!);
      this.notificationService.showSuccess('Password changed successfully.');
      this.passwordForm.reset();
    } catch (error: any) {
        this.notificationService.showError(error.message);
    }
  }
}
