



import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
// FIX: Add FormBuilder to imports
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormGroup } from '@angular/forms';
import { TrainingModule, Lesson } from '../../types';
import { CommonModule } from '@angular/common';
import { ConfirmationModalComponent } from '../shared/confirmation-modal/confirmation-modal.component';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { InstructorAssignModuleModalComponent } from '../instructor-assign-module-modal/instructor-assign-module-modal.component';

@Component({
  selector: 'app-instructor-training-modules',
  templateUrl: './instructor-training-modules.component.html',
  imports: [ReactiveFormsModule, CommonModule, ConfirmationModalComponent, InstructorAssignModuleModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorTrainingModulesComponent {
  // FIX: Explicitly type FormBuilder to avoid type inference issues.
  private readonly fb: FormBuilder = inject(FormBuilder);
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);
  
  modules = this.userService.trainingModules;

  isModalOpen = signal(false);
  editingModule = signal<TrainingModule | null>(null);
  draggingIndex = signal<number | null>(null);

  isAssignModalOpen = signal(false);
  moduleToAssign = signal<TrainingModule | null>(null);

  isConfirmOpen = signal(false);
  confirmTitle = signal('');
  confirmMessage = signal('');
  confirmActionText = signal('Confirm');
  private pendingAction: (() => void) | null = null;

  moduleForm = this.fb.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    durationDays: [1, [Validators.required, Validators.min(1)]],
    lessons: this.fb.array([]),
  });

  get lessons() {
    return this.moduleForm.get('lessons') as FormArray;
  }

  createLessonGroup(lesson: Partial<Lesson> = {}): FormGroup {
    const isVideo = lesson.type === 'video' || !lesson.type; // Default to video
    const group = this.fb.group({
      title: [lesson.title || '', Validators.required],
      type: [lesson.type || 'video', Validators.required],
      url: [lesson.url || '', isVideo ? Validators.required : []],
      duration: [lesson.duration || '', Validators.required],
      file: [null as File | null],
      fileName: [lesson.fileName || ''],
    });

    // Add dynamic validation based on type changes
    group.get('type')?.valueChanges.subscribe(type => {
      const urlControl = group.get('url');
      if (type === 'video') {
        urlControl?.setValidators(Validators.required);
      } else {
        urlControl?.setValue(''); // Clear value to avoid validation errors on hidden field
        urlControl?.clearValidators();
      }
      urlControl?.updateValueAndValidity();
    });

    return group;
  }

  addLesson() {
    this.lessons.push(this.createLessonGroup());
  }

  removeLesson(index: number) {
    this.lessons.removeAt(index);
  }

  openModal(module: TrainingModule | null = null): void {
    this.lessons.clear();
    if (module) {
      this.editingModule.set(module);
      this.moduleForm.patchValue({
        title: module.title,
        description: module.description,
        durationDays: module.durationDays
      });
      module.lessons.forEach(lesson => {
        this.lessons.push(this.createLessonGroup(lesson));
      });
    } else {
      this.editingModule.set(null);
      this.moduleForm.reset({ title: '', description: '', durationDays: 1, lessons: [] });
    }
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.draggingIndex.set(null);
    this.moduleForm.reset();
    this.editingModule.set(null);
  }

  requestCloseModal(): void {
    if (this.moduleForm.dirty) {
      this.confirmTitle.set('Discard Changes?');
      this.confirmMessage.set('You have unsaved changes. Are you sure you want to discard them?');
      this.confirmActionText.set('Discard');
      this.pendingAction = () => this.closeModal();
      this.isConfirmOpen.set(true);
    } else {
      this.closeModal();
    }
  }

  async saveModule(): Promise<void> {
    if (this.moduleForm.invalid) return;

    try {
      await this.userService.saveTrainingModule(this.moduleForm.getRawValue(), this.editingModule());
      this.notificationService.showSuccess('Module saved successfully!');
      this.moduleForm.markAsPristine();
      this.closeModal();
    } catch (error: any) {
      this.notificationService.showError(error.message || 'Failed to save module.');
    }
  }

  deleteModule(module: TrainingModule): void {
    this.confirmTitle.set('Confirm Deletion');
    this.confirmMessage.set(`Are you sure you want to delete the module "${module.title}"? This cannot be undone.`);
    this.confirmActionText.set('Delete');
    this.pendingAction = async () => {
      try {
        await this.userService.deleteTrainingModule(module.id);
        this.notificationService.showSuccess('Module deleted successfully.');
      } catch (error: any) {
        this.notificationService.showError(error.message || 'Failed to delete module.');
      }
    };
    this.isConfirmOpen.set(true);
  }

  openAssignModal(module: TrainingModule): void {
    this.moduleToAssign.set(module);
    this.isAssignModalOpen.set(true);
  }

  closeAssignModal(): void {
    this.isAssignModalOpen.set(false);
    this.moduleToAssign.set(null);
  }

  async handleAssignModuleToBatches(event: { moduleId: string; batchIds: string[] }): Promise<void> {
    try {
      await this.userService.assignModuleToBatches(event.moduleId, event.batchIds);
      this.notificationService.showSuccess('Module batch assignments updated successfully!');
      this.closeAssignModal();
    } catch (error: any) {
      this.notificationService.showError(error.message || 'Failed to assign module to batches.');
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

  // Drag and drop handlers
  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    this.draggingIndex.set(index);
  }
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.draggingIndex.set(null);
  }
  onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    this.draggingIndex.set(null);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const lesson = this.lessons.at(index);
      lesson.patchValue({ file: files[0], fileName: files[0].name });
    }
  }

  onFileSelected(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const lesson = this.lessons.at(index);
      lesson.patchValue({ file: input.files[0], fileName: input.files[0].name });
    }
    input.value = ''; // Reset for re-uploading same file
  }

  removeFile(index: number) {
    const lesson = this.lessons.at(index);
    lesson.patchValue({ file: null, fileName: '' });
  }
}