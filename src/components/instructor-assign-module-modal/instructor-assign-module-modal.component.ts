import { Component, ChangeDetectionStrategy, input, output, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { TrainingModule, TrainingBatch, Role } from '../../types';

@Component({
  selector: 'app-instructor-assign-module-modal',
  templateUrl: './instructor-assign-module-modal.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorAssignModuleModalComponent implements OnInit {
  moduleToAssign = input.required<TrainingModule>();
  close = output<void>();
  saveAssignments = output<{ moduleId: string; batchIds: string[] }>();

  private userService = inject(UserService);
  private currentUser = this.userService.currentUser;

  // Local state for checkbox selections
  selectedBatchIds = signal<Set<string>>(new Set());

  availableBatches = computed<TrainingBatch[]>(() => {
    const user = this.currentUser();
    if (user?.role !== Role.Instructor) return [];
    
    return this.userService.getBatchesForInstructor(user.name)
      .filter(b => b.status === 'Upcoming' || b.status === 'In Progress');
  });

  ngOnInit(): void {
    // Pre-populate selections based on existing assignments
    const initialBatchIds = this.moduleToAssign().assignedBatchIds || [];
    this.selectedBatchIds.set(new Set(initialBatchIds));
  }

  handleBatchSelection(event: Event, batchId: string): void {
    const input = event.target as HTMLInputElement;
    this.selectedBatchIds.update(currentSet => {
      if (input.checked) {
        currentSet.add(batchId);
      } else {
        currentSet.delete(batchId);
      }
      return new Set(currentSet);
    });
  }

  isBatchSelected(batchId: string): boolean {
    return this.selectedBatchIds().has(batchId);
  }

  onSave(): void {
    this.saveAssignments.emit({ 
      moduleId: this.moduleToAssign().id, 
      batchIds: Array.from(this.selectedBatchIds()) 
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
