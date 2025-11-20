import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Assignment, TrainingModule, Applicant, StudentSubmission, PendingSubmission } from '../../types';
import { InstructorAssignmentSubmissionsComponent } from '../instructor-assignment-submissions/instructor-assignment-submissions.component';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { DatePipe } from '@angular/common';
import { InstructorGradingModalComponent } from '../instructor-grading-modal/instructor-grading-modal.component';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';


@Component({
  selector: 'app-instructor-assignments',
  templateUrl: './instructor-assignments.component.html',
  imports: [ReactiveFormsModule, InstructorAssignmentSubmissionsComponent, FormsModule, DatePipe, InstructorGradingModalComponent, ConfirmationModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorAssignmentsComponent {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);

  assignments = this.userService.assignments;
  pendingSubmissions = this.userService.pendingSubmissions;
  
  selectedSubmissionForGrading = signal<PendingSubmission | null>(null);

  availableModules = this.userService.trainingModules;

  isModalOpen = signal(false);
  editingAssignment = signal<Assignment | null>(null);
  viewingSubmissionsFor = signal<Assignment | null>(null);
  
  isConfirmOpen = signal(false);
  confirmTitle = signal('Confirm Action');
  confirmMessage = signal('Are you sure?');
  confirmActionText = signal('Confirm');
  private pendingAction: (() => void) | null = null;

  assignmentFiles = signal<File[]>([]);
  assignmentFileNames = signal<string[]>([]);

  isAssignModalOpen = signal(false);
  assignmentToAssign = signal<Assignment | null>(null);
  assignStudentSearchTerm = signal('');
  private selectedStudents = signal<Set<string>>(new Set());

  enrolledStudents = computed<Applicant[]>(() => 
    this.userService.applicants().filter(a => a.assessmentStatus === 'enrolled')
  );

  filteredEnrolledStudents = computed(() => {
    const searchTerm = this.assignStudentSearchTerm().toLowerCase();
    const students = this.enrolledStudents();
    if (!searchTerm) {
      return students;
    }
    return students.filter(student => {
      const name = student.name || '';
      return name.toLowerCase().includes(searchTerm);
    });
  });

  assignmentForm = this.fb.group({
    title: ['', Validators.required],
    module: ['', Validators.required],
    dueDate: ['', Validators.required],
    files: [[], [Validators.required, Validators.minLength(1)]],
  });

  openModal(assignment: Assignment | null = null): void {
    this.assignmentFiles.set([]);
    this.assignmentFileNames.set([]);
    
    if (assignment) {
      this.editingAssignment.set(assignment);
      const fileNames = assignment.fileNames || [];
      this.assignmentForm.setValue({
          title: assignment.title,
          module: assignment.module || '',
          dueDate: assignment.dueDate,
          files: fileNames,
      });
      this.assignmentFileNames.set(fileNames);
    } else {
      this.editingAssignment.set(null);
      this.assignmentForm.reset({
          title: '',
          module: '',
          dueDate: '',
          files: [],
      });
    }
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  requestCloseModal(): void {
    if (this.assignmentForm.dirty) {
      this.confirmTitle.set('Discard Changes?');
      this.confirmMessage.set('You have unsaved changes. Are you sure you want to discard them?');
      this.confirmActionText.set('Discard');
      this.pendingAction = () => this.closeModal();
      this.isConfirmOpen.set(true);
    } else {
      this.closeModal();
    }
  }

  async saveAssignment(): Promise<void> {
    this.assignmentForm.markAllAsTouched();
    if (this.assignmentForm.invalid) return;

    try {
      const formValue = this.assignmentForm.getRawValue();
      const assignmentData = { ...formValue, files: this.assignmentFileNames() };
      await this.userService.saveAssignment(assignmentData, this.editingAssignment(), this.assignmentFiles());
      this.notificationService.showSuccess('Assignment saved successfully!');
      this.assignmentForm.markAsPristine();
      this.closeModal();
    } catch (error: any) {
      this.notificationService.showError(error.message || 'Failed to save assignment.');
    }
  }
  
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      
      const currentNames = this.assignmentFileNames();
      const uniqueNewFiles = newFiles.filter(f => !currentNames.includes(f.name));

      this.assignmentFiles.update(files => [...files, ...uniqueNewFiles]);
      this.assignmentFileNames.update(names => [...names, ...uniqueNewFiles.map(f => f.name)]);
      
      this.assignmentForm.controls.files.setValue(this.assignmentFileNames());
      this.assignmentForm.markAsDirty();
    }
    input.value = '';
  }

  removeFile(indexToRemove: number): void {
    const fileNameToRemove = this.assignmentFileNames()[indexToRemove];
    this.assignmentFiles.update(files => files.filter(f => f.name !== fileNameToRemove));
    this.assignmentFileNames.update(names => names.filter((_, index) => index !== indexToRemove));
    this.assignmentForm.controls.files.setValue(this.assignmentFileNames());
    this.assignmentForm.markAsDirty();
  }

  openSubmissionsModal(assignment: Assignment): void {
    this.viewingSubmissionsFor.set(assignment);
  }

  closeSubmissionsModal(): void {
    this.viewingSubmissionsFor.set(null);
  }

  deleteAssignment(assignment: Assignment): void {
    this.confirmTitle.set('Confirm Deletion');
    this.confirmMessage.set(`Are you sure you want to delete "${assignment.title}"? This cannot be undone.`);
    this.confirmActionText.set('Delete');
    this.pendingAction = async () => {
      try {
        await this.userService.deleteAssignment(assignment.id);
        this.notificationService.showSuccess('Assignment deleted.');
      } catch (error: any) {
        this.notificationService.showError(error.message || 'Failed to delete assignment.');
      }
    };
    this.isConfirmOpen.set(true);
  }

  openAssignModal(assignment: Assignment): void {
    this.assignmentToAssign.set(assignment);
    this.selectedStudents.set(new Set(assignment.assignedTo || []));
    this.assignStudentSearchTerm.set('');
    this.isAssignModalOpen.set(true);
  }

  closeAssignModal(): void {
    this.isAssignModalOpen.set(false);
    this.assignmentToAssign.set(null);
  }

  handleStudentSelection(event: Event, studentEmail: string): void {
    const input = event.target as HTMLInputElement;
    this.selectedStudents.update(currentSet => {
      if (input.checked) {
        currentSet.add(studentEmail);
      } else {
        currentSet.delete(studentEmail);
      }
      return new Set(currentSet);
    });
  }

  isStudentSelected(studentEmail: string): boolean {
    return this.selectedStudents().has(studentEmail);
  }

  isStudentAlreadyAssigned(studentEmail: string): boolean {
    return !!this.assignmentToAssign()?.assignedTo?.includes(studentEmail);
  }

  async confirmAssignment(): Promise<void> {
    const assignment = this.assignmentToAssign();
    if (!assignment) return;

    try {
      const updatedAssignedTo = Array.from(this.selectedStudents());
      await this.userService.assignStudentsToAssignment(assignment.id, updatedAssignedTo);
      this.notificationService.showSuccess(`Assignment updated for ${updatedAssignedTo.length} students.`);
      this.closeAssignModal();
    } catch (error: any) {
      this.notificationService.showError(error.message || 'Failed to assign students.');
    }
  }

  openGradingModal(submission: PendingSubmission): void {
    this.selectedSubmissionForGrading.set(submission);
  }

  closeGradingModal(): void {
    this.selectedSubmissionForGrading.set(null);
  }

  async handleSaveGrade(grade: { score: string; feedback: string }): Promise<void> {
    const submission = this.selectedSubmissionForGrading();
    if (submission) {
      try {
        await this.userService.gradeSubmission(submission.submissionId, grade.score, grade.feedback);
        this.notificationService.showSuccess(`Grade saved for ${submission.studentName}.`);
        this.closeGradingModal();
      } catch (error: any) {
        this.notificationService.showError(error.message || 'Failed to save grade.');
      }
    }
  }

  handleConfirm(): void {
    this.pendingAction?.();
    this.closeConfirm();
  }

  closeConfirm(): void {
    this.isConfirmOpen.set(false);
    this.pendingAction = null;
  }
}