
import { Component, ChangeDetectionStrategy, output, inject, input, OnInit, computed, signal } from '@angular/core';
// FIX: Add FormBuilder to imports
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Role, User, Applicant } from '../../types';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-admin-create-user-modal',
  templateUrl: './admin-create-user-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent],
})
export class AdminCreateUserModalComponent implements OnInit {
  userToEdit = input<User | Applicant | null>(null);
  close = output<void>();
  saveUser = output<{ data: any, originalEmail?: string }>();

  // FIX: Explicitly type FormBuilder to avoid type inference issues.
  private readonly fb: FormBuilder = inject(FormBuilder);

  isEditMode = computed(() => !!this.userToEdit());
  RoleEnum = Role;
  
  isConfirmOpen = signal(false);
  private pendingAction: (() => void) | null = null;

  userForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: [Role.Instructor, Validators.required],
    password: ['', [Validators.minLength(8)]],
    confirmPassword: ['']
  }, { validators: this.passwordMatchValidator });

  ngOnInit(): void {
    const user = this.userToEdit();
    if (this.isEditMode() && user) {
      // Edit mode configuration
      this.userForm.patchValue({
        name: user.name,
        email: user.email,
        role: user.role
      });
      this.userForm.get('email')?.disable();
      this.userForm.get('role')?.disable();
    } else {
      // Create mode (default is for Instructor)
      this.userForm.get('role')?.setValue(Role.Instructor);
      this.userForm.get('role')?.disable();
      this.userForm.get('password')?.addValidators(Validators.required);
      this.userForm.get('confirmPassword')?.addValidators(Validators.required);
    }
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    // Don't validate if password field is empty (optional update)
    if (!password) {
        return null;
    }

    return password === confirmPassword ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.userForm.invalid) return;
    
    this.userForm.markAsPristine(); // Prevent confirmation prompt after saving

    const formValue = this.userForm.getRawValue();
    const user = this.userToEdit();
    
    if (this.isEditMode() && user) {
       const dataToSave: { name: string, password?: string } = {
          name: formValue.name,
      };
      if (formValue.password) {
          dataToSave.password = formValue.password;
      }
      this.saveUser.emit({
        data: dataToSave,
        originalEmail: user.email
      });
    } else {
      // Re-enable role to get the value for creation
      this.userForm.get('role')?.enable();
      this.saveUser.emit({ data: this.userForm.getRawValue() });
      this.userForm.get('role')?.disable();
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  requestCloseModal(): void {
    if (this.userForm.dirty) {
      this.pendingAction = () => this.closeModal();
      this.isConfirmOpen.set(true);
    } else {
      this.closeModal();
    }
  }

  handleConfirm(): void {
    this.pendingAction?.();
    this.closeConfirm();
  }

  closeConfirm(): void {
    this.isConfirmOpen.set(false);
    this.pendingAction = null;
  }
}
