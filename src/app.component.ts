import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from './services/user.service';
import { LoginComponent } from './components/login/login.component';
import { NotificationComponent } from './components/shared/notification/notification.component';
import { AuthService } from './services/auth.service';
import { DashboardComponent } from './components/dashboard/dashboard.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    LoginComponent,
    NotificationComponent,
    DashboardComponent,
  ],
})
export class AppComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  
  currentUser = this.userService.currentUser;

  handleLogout() {
    this.authService.logout();
  }
}
