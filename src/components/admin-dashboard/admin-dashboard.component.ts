
import { Component, ChangeDetectionStrategy, computed, inject, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Applicant } from '../../types';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent implements OnInit {
  private userService = inject(UserService);

  ngOnInit(): void {
    this.userService.loadInitialData();
  }

  stats = computed(() => {
    const applicants = this.userService.applicants();
    const enrolledCount = applicants.filter(a => a.assessmentStatus === 'enrolled').length;
    
    const assessed = applicants.filter(a => a.assessmentStatus === 'passed' || a.assessmentStatus === 'failed');
    const passed = assessed.filter(a => a.assessmentStatus === 'passed').length;
    const passRate = assessed.length > 0 ? Math.round((passed / assessed.length) * 100) : 0;
    const referredCount = 0; // Placeholder until referral data is available

    return [
      { label: 'Enrolled Applicants', value: `${enrolledCount}`, icon: 'users' },
      { label: 'Assessment Pass Rate', value: `${passRate}%`, icon: 'check' },
      { label: 'Avg. Training Time', value: '35 days', icon: 'clock' }, // Placeholder
      { label: 'Referred This Month', value: `${referredCount}`, icon: 'briefcase' }
    ];
  });

  recentApplicants = computed(() => {
    return this.userService.applicants()
      .filter(a => a.assessmentStatus === 'enrolled')
      .slice(0, 5)
      .map(app => {
        let status = 'In Training';
        // You could add more logic here if referral status is available on the applicant
        return {
          name: app.name,
          batch: app.batch || 'N/A',
          status: status,
        }
      });
  });
}