
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { TrainingBatch, User, Applicant, Role } from '../../types';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-admin-training-batches',
  templateUrl: './admin-training-batches.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent],
})
export class AdminTrainingBatchesComponent implements OnInit {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);

  isModalOpen = signal(false);
  editingBatch = signal<TrainingBatch | null>(null);
  
  private allBatches = this.userService.trainingBatches;
  instructors = this.userService.instructors;
  
  activeBatches = computed(() => 
    this.allBatches().filter(b => b.status === 'Upcoming' || b.status === 'In Progress')
  );
  
  completedBatches = computed(() => 
    this.allBatches().filter(b => b.status === 'Completed')
  );

  isConfirmOpen = signal(false);
  confirmTitle = signal('');
  confirmMessage = signal('');
  confirmActionText = signal('Confirm');
  private pendingAction: (() => void) | null = null;

  expandedBatchId = signal<string | null>(null);

  studentsForExpandedBatch = computed<(User | Applicant)[]>(() => {
    const batchId = this.expandedBatchId();
    if (!batchId) return [];

    const batch = this.allBatches().find(b => b.id === batchId);
    if (!batch) return [];
    
    const studentEmails = new Set(batch.studentEmails);
    return this.userService.users().filter(u => studentEmails.has(u.email));
  });

  batchForm = this.fb.group({
    instructorName: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
  });

  ngOnInit(): void {
    this.userService.loadInitialData();
  }

  openModal(batch: TrainingBatch | null = null): void {
    if (batch) {
      this.editingBatch.set(batch);
      this.batchForm.patchValue({
        instructorName: batch.instructorName,
        startDate: batch.startDate,
        endDate: batch.endDate,
      });
    } else {
      this.editingBatch.set(null);
      this.batchForm.reset({
        instructorName: '',
        startDate: '',
        endDate: '',
      });
    }
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.batchForm.reset();
    this.editingBatch.set(null);
  }

  requestCloseModal(): void {
    if (this.batchForm.dirty) {
      this.confirmTitle.set('Discard Changes?');
      this.confirmMessage.set('You have unsaved changes. Are you sure you want to discard them?');
      this.confirmActionText.set('Discard');
      this.pendingAction = () => this.closeModal();
      this.isConfirmOpen.set(true);
    } else {
      this.closeModal();
    }
  }

  saveBatch(): void {
    if (this.batchForm.invalid) {
      this.notificationService.showError('Please fill out all required fields.');
      return;
    }

    this.confirmTitle.set('Confirm Save');
    this.confirmMessage.set('Are you sure you want to save this batch?');
    this.confirmActionText.set('Save');
    
    this.pendingAction = async () => {
      try {
        await this.userService.saveBatch(this.batchForm.getRawValue() as any, this.editingBatch());
        this.notificationService.showSuccess('Batch saved successfully.');
        this.batchForm.markAsPristine();
        this.closeModal();
      } catch (error: any) {
        this.notificationService.showError(`Failed to save batch: ${error.message}`);
      }
    };

    this.isConfirmOpen.set(true);
  }

  deleteBatch(batch: TrainingBatch): void {
    this.confirmTitle.set('Confirm Deletion');
    this.confirmMessage.set(`Are you sure you want to delete "${batch.name}"? This action cannot be undone.`);
    this.confirmActionText.set('Delete');
    this.pendingAction = async () => {
      try {
        await this.userService.deleteBatch(batch.id);
        this.notificationService.showSuccess(`Batch "${batch.name}" deleted successfully.`);
      } catch (error: any) {
        this.notificationService.showError(`Failed to delete batch: ${error.message}`);
      }
    };
    this.isConfirmOpen.set(true);
  }

  toggleBatchDetails(batchId: string): void {
    this.expandedBatchId.update(currentId => currentId === batchId ? null : batchId);
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