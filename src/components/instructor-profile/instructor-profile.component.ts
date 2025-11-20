
import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed } from '@angular/core';
// FIX: Add FormBuilder to imports
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { User } from '../../types';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-instructor-profile',
  templateUrl: './instructor-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class InstructorProfileComponent implements OnInit {
  // FIX: Explicitly type FormBuilder to avoid type inference issues.
  private readonly fb: FormBuilder = inject(FormBuilder);
  private userService = inject(UserService);
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

    this.profileForm = this.fb.group({
      name: [user.name, Validators.required],
      email: [{ value: user.email, disabled: true }],
      title: ['Senior Instructor', Validators.required], // Mock data
      bio: ['Specializing in communication skills and workplace professionalism.', Validators.required], // Mock data
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

  async saveProfile(): Promise<void> {
    const user = this.currentUser();
    if (this.profileForm.invalid || !user || !user.id) return;

    this.isUploading.set(true);

    try {
      // 1. Upload new avatar if one was selected
      if (this.avatarFile) {
        // FIX: Call the now-existing uploadAvatar method.
        const avatarUrl = await this.userService.uploadAvatar(user.id, this.avatarFile);
        if (avatarUrl) {
          // FIX: Call the now-existing updateUserAvatar method.
          await this.userService.updateUserAvatar(user.id, avatarUrl);
          this.avatarPreview.set(null);
        }
      }

      // 2. Update other profile details (if any were editable and changed)
      // This is currently just mock data, so no update call is made.

      this.notificationService.showSuccess('Profile updated successfully!');
      this.avatarFile = null;
    } catch (error) {
      this.notificationService.showError('Failed to update profile.');
    } finally {
      this.isUploading.set(false);
    }
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;
    // Supabase password change logic is needed here
    this.notificationService.show('Password change is not yet implemented.');
    this.passwordForm.reset();
  }
}
