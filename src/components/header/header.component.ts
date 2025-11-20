import { Component, ChangeDetectionStrategy, input, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../types';
import { InAppNotificationService } from '../../services/in-app-notification.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class HeaderComponent {
  user = input.required<User>();
  activeView = input<string>('Dashboard');

  private inAppNotificationService = inject(InAppNotificationService);
  
  isNotificationPanelOpen = signal(false);
  currentUserNotifications = this.inAppNotificationService.currentUserNotifications;
  hasUnreadNotifications = this.inAppNotificationService.hasUnreadNotifications;

  toggleNotificationPanel(): void {
    const isOpen = this.isNotificationPanelOpen();
    this.isNotificationPanelOpen.set(!isOpen);
    
    // If opening the panel, mark notifications as read after a short delay
    if (!isOpen && this.hasUnreadNotifications()) {
      setTimeout(() => this.inAppNotificationService.markAllAsRead(), 1000);
    }
  }

  closeNotificationPanel(): void {
    this.isNotificationPanelOpen.set(false);
  }
}