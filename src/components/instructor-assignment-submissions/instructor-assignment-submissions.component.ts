

import { Component, ChangeDetectionStrategy, input, output, signal, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Assignment, StudentSubmission } from '../../types';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-instructor-assignment-submissions',
  templateUrl: './instructor-assignment-submissions.component.html',
  imports: [ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorAssignmentSubmissionsComponent implements OnInit {
  assignment = input.required<Assignment>();
  close = output<void>();

  private readonly fb: FormBuilder = inject(FormBuilder);
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);

  submissions = signal<StudentSubmission[]>([]);
  isLoading = signal(true);
  selectedSubmission = signal<StudentSubmission | null>(null);

  gradingForm = this.fb.group({
    score: ['', Validators.required],
    feedback: [''],
  });
  
  ngOnInit(): void {
    this.loadSubmissions();
  }

  async loadSubmissions(): Promise<void> {
    this.isLoading.set(true);
    try {
      const fetchedSubmissions = await this.userService.getSubmissionsForAssignment(this.assignment().id);
      this.submissions.set(fetchedSubmissions);
      if (fetchedSubmissions.length > 0) {
        // Try to select the first pending one, otherwise the first one
        const firstPending = fetchedSubmissions.find(s => s.status === 'Pending Review');
        this.selectSubmission(firstPending || fetchedSubmissions[0]);
      }
    } catch (error: any) {
      this.notificationService.showError(error.message || 'Failed to load submissions.');
    } finally {
      this.isLoading.set(false);
    }
  }

  selectSubmission(submission: StudentSubmission): void {
    this.selectedSubmission.set(submission);
    this.gradingForm.reset();
    if (submission.status === 'Graded') {
      this.gradingForm.patchValue({
        score: submission.score,
        feedback: submission.feedback
      });
      this.gradingForm.disable();
    } else {
      this.gradingForm.enable();
    }
  }

  async saveGrade(): Promise<void> {
    if (this.gradingForm.invalid) return;

    const currentSubmission = this.selectedSubmission();
    if (!currentSubmission) return;

    const { score, feedback } = this.gradingForm.value;

    try {
        await this.userService.gradeSubmission(currentSubmission.submissionId, score!, feedback!);
        this.notificationService.showSuccess('Grade saved successfully!');
        
        const subs = this.submissions();
        const currentIndex = subs.findIndex(s => s.submissionId === currentSubmission.submissionId);
        
        await this.loadSubmissions();
        
        const newSubs = this.submissions();
        const nextPending = newSubs.find((s, i) => i > currentIndex && s.status === 'Pending Review');
        
        if (nextPending) {
            this.selectSubmission(nextPending);
        } else {
            const newlyGraded = newSubs.find(s => s.submissionId === currentSubmission.submissionId);
            if (newlyGraded) {
                this.selectSubmission(newlyGraded);
            } else if (newSubs.length > 0) {
                this.selectSubmission(newSubs[0]);
            }
        }
    } catch (error: any) {
        this.notificationService.showError(error.message || 'Failed to save grade.');
    }
  }

  async downloadSubmissionFile(): Promise<void> {
    const sub = this.selectedSubmission();
    if (sub?.submission.filePath && sub.submission.fileName) {
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

  onClose(): void {
    this.close.emit();
  }
}