
import { Component, ChangeDetectionStrategy, computed, inject, input, OnInit, output, signal } from '@angular/core';
// FIX: Add FormBuilder to imports
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Assignment } from '../../types';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-assignment-modal',
  templateUrl: './assignment-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ConfirmationModalComponent],
})
export class AssignmentModalComponent implements OnInit {
  assignment = input.required<Assignment>();
  close = output<void>();
  submitAssignment = output<{ text:string; file?: File }>();

  // FIX: Explicitly type FormBuilder to avoid type inference issues.
  private readonly fb: FormBuilder = inject(FormBuilder);

  isConfirmOpen = signal(false);
  private pendingAction: (() => void) | null = null;
  
  submissionForm = this.fb.group({
    text: ['', Validators.required],
  });
  
  submissionFile: File | undefined;
  fileName = signal<string | undefined>(undefined);

  isSubmitMode = computed(() => this.assignment().status === 'Upcoming');
  isViewMode = computed(() => !this.isSubmitMode());

  ngOnInit(): void {
    if (this.isViewMode()) {
        this.submissionForm.patchValue({ text: this.assignment().submission?.text || '' });
        this.submissionForm.disable();
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.submissionFile = input.files[0];
      this.fileName.set(this.submissionFile.name);
    } else {
      this.submissionFile = undefined;
      this.fileName.set(undefined);
    }
    this.submissionForm.markAsDirty();
  }

  onSubmit(): void {
    if (this.isSubmitMode() && this.submissionForm.valid) {
      this.submissionForm.markAsPristine();
      this.submitAssignment.emit({
        text: this.submissionForm.value.text!,
        file: this.submissionFile,
      });
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  requestCloseModal(): void {
    if (this.isSubmitMode() && this.submissionForm.dirty) {
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
