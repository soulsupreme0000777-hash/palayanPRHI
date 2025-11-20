
import { Component, ChangeDetectionStrategy, inject, signal, output, computed } from '@angular/core';
import { StudentPreAssessmentComponent } from '../student-pre-assessment/student-pre-assessment.component';
import { UserService } from '../../services/user.service';
import { Applicant } from '../../types';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StudentPreAssessmentComponent],
})
export class StudentDashboardComponent {
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);
  assessmentStatus = this.userService.assessmentStatus;
  navigate = output<string>();

  quizState = signal<'intro' | 'taking' | 'result'>('intro');
  lastScore = signal<{ score: number; total: number } | null>(null);
  readonly passingScore = 7; // 70% passing grade

  trainingProgress = 0;
  expectedCompletionDate = '-';
  
  currentUserBatch = computed(() => {
    const user = this.userService.currentUser();
    return user && 'batch' in user ? (user as Applicant).batch : 'N/A';
  });

  modules: any[] = [];
  assignments: any[] = [];

  startQuiz(): void {
    this.quizState.set('taking');
  }

  retryQuiz(): void {
    this.quizState.set('intro'); // Go back to intro before retaking
  }

  continueToDashboard(): void {
    this.quizState.set('intro'); // This will hide the quiz view and let the parent view take over.
  }

  navigateToDocuments(): void {
    this.navigate.emit('My Documents');
  }
  
  async handleQuizSubmission(result: { score: number; total: number }): Promise<void> {
    this.lastScore.set(result);
    const user = this.userService.currentUser();
    if (user && user.id) {
      const passed = result.score >= this.passingScore;
      try {
        await this.userService.submitAssessment(user.id, result.score, result.total, passed);
        this.quizState.set('result');
      } catch (error: any) {
        this.notificationService.showError(error.message || 'There was a problem submitting your quiz results.');
      }
    } else {
        this.notificationService.showError('Could not identify user. Please try logging in again.');
        this.quizState.set('result');
    }
  }
}
