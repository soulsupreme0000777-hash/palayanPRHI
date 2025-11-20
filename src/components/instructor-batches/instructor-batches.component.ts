

import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { TrainingBatch, User, Applicant, Role } from '../../types';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-instructor-batches',
  templateUrl: './instructor-batches.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ConfirmationModalComponent],
})
export class InstructorBatchesComponent {
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);
  
  private currentUser = this.userService.currentUser;

  isConfirmOpen = signal(false);
  confirmTitle = signal('');
  confirmMessage = signal('');
  private pendingAction: (() => void) | null = null;

  batches = computed(() => {
    const user = this.currentUser();
    if (user?.role === Role.Instructor) {
      // FIX: Call the now-existing getBatchesForInstructor method.
      return this.userService.getBatchesForInstructor(user.name);
    }
    return [];
  });

  expandedBatchId = signal<string | null>(null);

  studentsForExpandedBatch = computed<(User | Applicant)[]>(() => {
    const batchId = this.expandedBatchId();
    if (!batchId) return [];

    const batch = this.batches().find(b => b.id === batchId);
    if (!batch) return [];
    
    const studentEmails = new Set(batch.studentEmails);
    // FIX: Correctly call the users signal from UserService.
    return this.userService.users().filter(u => studentEmails.has(u.email));
  });
  
  toggleBatchDetails(batchId: string): void {
    this.expandedBatchId.update(currentId => currentId === batchId ? null : batchId);
  }

  completeBatch(batch: TrainingBatch): void {
    this.confirmTitle.set('Confirm Completion');
    this.confirmMessage.set(`Are you sure you want to mark "${batch.name}" as complete? This will move it to the historical records and can't be undone.`);
    this.pendingAction = async () => {
      try {
        await this.userService.completeBatch(batch.id);
        this.notificationService.showSuccess(`Batch "${batch.name}" completed. The next batch is now active if available.`);
      } catch (error: any) {
        this.notificationService.showError(error.message || 'Failed to complete batch.');
      }
    };
    this.isConfirmOpen.set(true);
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
