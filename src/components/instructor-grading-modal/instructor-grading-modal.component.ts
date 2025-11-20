

import { Component, ChangeDetectionStrategy, input, output, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
// FIX: Add FormBuilder to imports
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PendingSubmission } from '../../types';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-instructor-grading-modal',
  templateUrl: './instructor-grading-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, ConfirmationModalComponent],
})
export class InstructorGradingModalComponent {
  submission = input.required<PendingSubmission>();
  close = output<void>();
  saveGrade = output<{ score: string; feedback: string }>();

  private userService = inject(UserService);
  private readonly fb: FormBuilder = inject(FormBuilder);

  isConfirmOpen = signal(false);
  private pendingAction: (() => void) | null = null;

  gradingForm = this.fb.group({
    score: ['', Validators.required],
    feedback: [''],
  });

  onSubmit(): void {
    if (this.gradingForm.invalid) return;
    this.gradingForm.markAsPristine();
    this.saveGrade.emit(this.gradingForm.getRawValue());
  }

  async downloadSubmissionFile(): Promise<void> {
    const sub = this.submission();
    if (sub.submission.filePath && sub.submission.fileName) {
      const blob = await this.userService.downloadPrivateFile(sub.submission.filePath);
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sub.submission.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  requestCloseModal(): void {
    if (this.gradingForm.dirty) {
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