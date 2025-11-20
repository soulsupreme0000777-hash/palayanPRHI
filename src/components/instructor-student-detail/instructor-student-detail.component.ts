

import { Component, ChangeDetectionStrategy, input, output, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentProgress, RequiredDoc } from '../../types';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-instructor-student-detail',
  templateUrl: './instructor-student-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class InstructorStudentDetailComponent {
  student = input.required<StudentProgress>();
  close = output<void>();

  private userService = inject(UserService);

  activeTab = signal<'assignments' | 'attendance' | 'documents'>('assignments');

  studentDocuments = computed<RequiredDoc[]>(() => {
    // FIX: Correctly call getDocumentsForStudent method.
    return this.userService.getDocumentsForStudent(this.student().email);
  });

  setActiveTab(tab: 'assignments' | 'attendance' | 'documents'): void {
    this.activeTab.set(tab);
  }

  onClose(): void {
    this.close.emit();
  }

  async viewDownloadDocument(doc: RequiredDoc): Promise<void> {
    if (doc.filePath) {
      const blob = await this.userService.downloadPrivateFile(doc.filePath);
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = doc.fileName || doc.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    }
  }
}