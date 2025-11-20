
import { Component, ChangeDetectionStrategy, inject, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { Applicant, TrainingBatch, Role } from '../../types';

@Component({
  selector: 'app-instructor-enroll-modal',
  templateUrl: './instructor-enroll-modal.component.html',
  imports: [CommonModule, FormsModule],
})
export class InstructorEnrollModalComponent {
  applicant = input.required<Applicant>();
  close = output<void>();
  enroll = output<{ applicantEmail: string; batchId: string }>();
  
  private userService = inject(UserService);
  private currentUser = this.userService.currentUser;
  
  selectedBatchId: string = '';

  availableBatches = computed<TrainingBatch[]>(() => {
      const user = this.currentUser();
      if (user?.role !== Role.Instructor) return [];
      
      // FIX: Call the now-existing getBatchesForInstructor method.
      return this.userService.getBatchesForInstructor(user.name)
        .filter(b => b.status === 'Upcoming' || b.status === 'In Progress');
  });

  onEnroll(): void {
    if (this.selectedBatchId) {
        this.enroll.emit({ applicantEmail: this.applicant().email, batchId: this.selectedBatchId });
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
