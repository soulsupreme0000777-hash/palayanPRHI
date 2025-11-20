

import { Component, ChangeDetectionStrategy, output, inject, computed, signal } from '@angular/core';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { Applicant } from '../../types';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';
import { InstructorReviewModalComponent } from '../instructor-review-modal/instructor-review-modal.component';

@Component({
  selector: 'app-instructor-dashboard',
  templateUrl: './instructor-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InstructorReviewModalComponent, ConfirmationModalComponent],
})
export class InstructorDashboardComponent {
  navigate = output<string>();
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);

  isReviewModalOpen = signal(false);
  applicantToReview = signal<Applicant | null>(null);

  isConfirmOpen = signal(false);
  confirmTitle = signal('');
  confirmMessage = signal('');
  private pendingAction: (() => void) | null = null;

  pendingReviewApplicants = computed(() => {
    // FIX: Correctly call the applicants signal from UserService.
    return this.userService.applicants().filter(
        a => a.assessmentStatus === 'passed' || a.assessmentStatus === 'failed'
    );
  });

  activeModules: any[] = [];

  navigateTo(view: string): void {
    this.navigate.emit(view);
  }

  openReviewModal(applicant: Applicant): void {
    this.applicantToReview.set(applicant);
    this.isReviewModalOpen.set(true);
  }

  closeReviewModal(): void {
    this.isReviewModalOpen.set(false);
    this.applicantToReview.set(null);
  }

  async handleEnroll(event: { applicantEmail: string; batchId: string }): Promise<void> {
    const applicant = this.applicantToReview();
    if (!applicant) return;

    try {
      await this.userService.enrollStudent(applicant.id, event.batchId);
      this.notificationService.showSuccess(`${applicant.name} has been enrolled successfully.`);
      this.closeReviewModal();
    } catch (error: any) {
      this.notificationService.showError(error.message || 'An error occurred during enrollment.');
    }
  }

  handleRemediate(applicant: Applicant): void {
    this.confirmTitle.set('Confirm Remediation');
    this.confirmMessage.set(`Are you sure you want to send ${applicant.name} for remediation? They will need to retake the assessment.`);
    this.pendingAction = () => {
      // Supabase logic needed here
      this.notificationService.showSuccess(`${applicant.name} has been sent for remediation.`);
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