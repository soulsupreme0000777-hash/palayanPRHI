
import { Component, ChangeDetectionStrategy, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { Applicant } from '../../types';

@Component({
  selector: 'app-admin-analytics',
  templateUrl: './admin-analytics.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class AdminAnalyticsComponent implements OnInit {
  private userService = inject(UserService);

  applicants = this.userService.applicants;

  ngOnInit(): void {
    this.userService.loadInitialData();
  }

  applicantStats = computed(() => {
    const apps = this.applicants();
    if (apps.length === 0) {
      return { total: 0, pending: 0, passed: 0, failed: 0, enrolled: 0 };
    }
    const total = apps.length;
    return {
      total: total,
      pending: apps.filter(a => a.assessmentStatus === 'pending').length,
      passed: apps.filter(a => a.assessmentStatus === 'passed').length,
      failed: apps.filter(a => a.assessmentStatus === 'failed').length,
      enrolled: apps.filter(a => a.assessmentStatus === 'enrolled').length,
    };
  });

  assessmentPerformance = computed(() => {
    const assessedApps = this.applicants().filter(a => a.assessmentStatus === 'passed' || a.assessmentStatus === 'failed');
    if (assessedApps.length === 0) {
      return { passRate: 0, averageScore: 0, totalAssessed: 0 };
    }
    const passedCount = assessedApps.filter(a => a.assessmentStatus === 'passed').length;
    const totalScore = assessedApps.reduce((sum, app) => sum + (app.assessmentScore || 0), 0);
    const totalPossible = assessedApps.reduce((sum, app) => sum + (app.assessmentTotal || 0), 0);

    return {
      passRate: Math.round((passedCount / assessedApps.length) * 100),
      averageScore: totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0,
      totalAssessed: assessedApps.length,
    };
  });
}