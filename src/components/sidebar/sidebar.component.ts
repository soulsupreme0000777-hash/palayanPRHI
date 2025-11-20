
import { Component, ChangeDetectionStrategy, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Role } from '../../types';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  userService = inject(UserService);
  userRole = input.required<Role>();
  activeView = input<string>('Dashboard');
  navigate = output<string>();
  logout = output<void>();

  Role = Role;
  // FIX: Correctly access the assessmentStatus signal from UserService.
  studentAssessmentStatus = this.userService.assessmentStatus;

  onNavigate(view: string) {
    this.navigate.emit(view);
  }

  onLogout() {
    this.logout.emit();
  }
}