import { Injectable, signal, computed } from '@angular/core';
import { InAppNotification } from '../types';

@Injectable({ providedIn: 'root' })
export class InAppNotificationService {
  private allNotifications = signal<InAppNotification[]>([]);
  private currentUserEmail = signal<string | null>(null);

  setCurrentUser(email: string | null): void {
    this.currentUserEmail.set(email);
  }

  currentUserNotifications = computed(() => {
    const email = this.currentUserEmail();
    if (!email) return [];
    return this.allNotifications()
      .filter(n => n.userEmail === email)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  });

  hasUnreadNotifications = computed(() => {
    return this.currentUserNotifications().some(n => !n.isRead);
  });

  addNotification(userEmail: string, message: string): void {
    const newNotification: InAppNotification = {
      id: Date.now() + Math.random(),
      userEmail,
      message,
      isRead: false,
      timestamp: new Date(),
    };
    this.allNotifications.update(notifications => [newNotification, ...notifications]);
  }

  markAllAsRead(): void {
    const email = this.currentUserEmail();
    if (!email) return;

    this.allNotifications.update(notifications =>
      notifications.map(n =>
        (n.userEmail === email && !n.isRead) ? { ...n, isRead: true } : n
      )
    );
  }
}