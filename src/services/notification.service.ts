import { Injectable, signal } from '@angular/core';
import { Notification } from '../types';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<Notification[]>([]);
  private lastId = 0;

  show(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const newNotification: Notification = {
      id: ++this.lastId,
      message,
      type,
    };

    this.notifications.update(notifications => [...notifications, newNotification]);

    setTimeout(() => {
      this.remove(newNotification.id);
    }, 5000); // Auto-dismiss after 5 seconds
  }
  
  showSuccess(message: string) {
      this.show(message, 'success');
  }

  showError(message: string) {
      this.show(message, 'error');
  }

  remove(id: number) {
    this.notifications.update(notifications =>
      notifications.filter(n => n.id !== id)
    );
  }
}
