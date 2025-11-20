

import { Component, ChangeDetectionStrategy, computed, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StudentProgress, Applicant } from '../../types';
import { InstructorStudentDetailComponent } from '../instructor-student-detail/instructor-student-detail.component';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';

type SortKey = keyof StudentProgress;

@Component({
  selector: 'app-instructor-student-progress',
  templateUrl: './instructor-student-progress.component.html',
  imports: [FormsModule, InstructorStudentDetailComponent, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorStudentProgressComponent {
  private userService = inject(UserService);

  students = computed<StudentProgress[]>(() => {
    // FIX: Correctly call applicants signal and getStudentProgressDetails method.
    return this.userService.applicants()
      .filter(a => a.assessmentStatus === 'enrolled')
      .map(applicant => this.userService.getStudentProgressDetails(applicant));
  });

  searchTerm = signal('');
  sortKey = signal<SortKey>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');
  selectedStudent = signal<StudentProgress | null>(null);

  filteredAndSortedStudents = computed(() => {
    const searchTerm = this.searchTerm().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDirection();
    const students = this.students();

    let filtered = students.filter(student => {
      const name = student.name || '';
      const batch = student.batch || '';
      return name.toLowerCase().includes(searchTerm) || 
             batch.toLowerCase().includes(searchTerm);
    });

    return filtered.sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      
      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return dir === 'asc' ? comparison : -comparison;
    });
  });

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  viewStudentDetails(student: StudentProgress): void {
    this.selectedStudent.set(student);
  }

  closeStudentDetails(): void {
    this.selectedStudent.set(null);
  }
}