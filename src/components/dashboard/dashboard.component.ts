import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { User, Role } from '../../types';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

// Admin Components
import { AdminDashboardComponent } from '../admin-dashboard/admin-dashboard.component';
import { AdminUsersComponent } from '../admin-users/admin-users.component';
import { AdminTrainingBatchesComponent } from '../admin-training-batches/admin-training-batches.component';
import { AdminAnalyticsComponent } from '../admin-analytics/admin-analytics.component';

// Instructor Components
import { InstructorDashboardComponent } from '../instructor-dashboard/instructor-dashboard.component';
import { InstructorBatchesComponent } from '../instructor-batches/instructor-batches.component';
import { InstructorTrainingModulesComponent } from '../instructor-training-modules/instructor-training-modules.component';
import { InstructorAssignmentsComponent } from '../instructor-assignments/instructor-assignments.component';
import { InstructorStudentProgressComponent } from '../instructor-student-progress/instructor-student-progress.component';
import { InstructorProfileComponent } from '../instructor-profile/instructor-profile.component';

// Student Components
import { StudentDashboardComponent } from '../student-dashboard/student-dashboard.component';
import { StudentTrainingModulesComponent } from '../student-training-modules/student-training-modules.component';
import { StudentAssignmentsComponent } from '../student-assignments/student-assignments.component';
import { StudentDocumentsComponent } from '../student-documents/student-documents.component';
import { StudentReferralStatusComponent } from '../student-referral-status/student-referral-status.component';
import { StudentProfileComponent } from '../student-profile/student-profile.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [
    CommonModule,
    SidebarComponent,
    HeaderComponent,
    // Admin
    AdminDashboardComponent,
    AdminUsersComponent,
    AdminTrainingBatchesComponent,
    AdminAnalyticsComponent,
    // Instructor
    InstructorDashboardComponent,
    InstructorBatchesComponent,
    InstructorTrainingModulesComponent,
    InstructorAssignmentsComponent,
    InstructorStudentProgressComponent,
    InstructorProfileComponent,
    // Student
    StudentDashboardComponent,
    StudentTrainingModulesComponent,
    StudentAssignmentsComponent,
    StudentDocumentsComponent,
    StudentReferralStatusComponent,
    StudentProfileComponent,
  ],
})
export class DashboardComponent {
  user = input.required<User>();
  logout = output<void>();
  Role = Role;

  activeView = signal('Dashboard');

  handleNavigation(view: string): void {
    this.activeView.set(view);
  }

  onLogout(): void {
    this.logout.emit();
  }
}