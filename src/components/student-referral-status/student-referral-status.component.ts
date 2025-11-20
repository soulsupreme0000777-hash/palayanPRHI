import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-student-referral-status',
  templateUrl: './student-referral-status.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentReferralStatusComponent {
  referralSteps: any[] = [];
}
