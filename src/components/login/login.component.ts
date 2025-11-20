
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
// FIX: Add FormBuilder to imports
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Role } from '../../types';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  // FIX: Explicitly type FormBuilder to avoid type inference issues.
  private readonly fb: FormBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  activeView = signal<'login' | 'register'>('login');
  isLoading = signal(false);

  loginForm = this.fb.group({
    email: ['student@applicant.com', [Validators.required, Validators.email]],
    password: ['password123', Validators.required],
  });

  registerForm = this.fb.group({
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: this.passwordMatchValidator });
  
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  toggleView(view: 'login' | 'register'): void {
    this.activeView.set(view);
  }

  async onLoginSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      return;
    }
    this.isLoading.set(true);

    const { email, password } = this.loginForm.getRawValue();
    const success = await this.authService.login(email!, password!);

    if (!success) {
      this.notificationService.showError('Invalid email or password.');
      this.loginForm.get('password')?.reset();
    }
    this.isLoading.set(false);
  }

  async onRegisterSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      return;
    }
    this.isLoading.set(true);

    const { firstName, middleName, lastName, email, password } = this.registerForm.getRawValue();

    try {
      await this.authService.register({
        firstName: firstName!,
        middleName: middleName || '',
        lastName: lastName!,
        email: email!,
        password: password!,
      });
      // On success, the auth service automatically logs the user in.
      this.notificationService.showSuccess('Registration successful! Welcome.');
    } catch (error: any) {
      this.notificationService.showError(error.message);
    } finally {
      this.isLoading.set(false);
    }
  }
}
