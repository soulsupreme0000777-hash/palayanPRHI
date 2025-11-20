import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { AssignmentModalComponent } from '../assignment-modal/assignment-modal.component';
import { StudentAssignment, Role } from '../../types';
import { ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-student-assignments',
  templateUrl: './student-assignments.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AssignmentModalComponent, ReactiveFormsModule],
})
export class StudentAssignmentsComponent {
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);

  assignments = this.userService.assignments;

  selectedAssignment = signal<StudentAssignment | null>(null);

  openModal(assignment: StudentAssignment): void {
    this.selectedAssignment.set(assignment);
  }

  closeModal(): void {
    this.selectedAssignment.set(null);
  }

  async handleSubmit(submission: { text: string; file?: File }): Promise<void> {
    const currentAssignment = this.selectedAssignment();
    if (!currentAssignment) return;

    try {
      await this.userService.submitAssignment(currentAssignment.id, submission);
      this.notificationService.showSuccess(`Successfully submitted "${currentAssignment.title}".`);
      this.closeModal();
    } catch (error: any) {
      this.notificationService.showError(error.message || 'Failed to submit assignment.');
    }
  }
}