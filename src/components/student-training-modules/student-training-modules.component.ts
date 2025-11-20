import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { TrainingModule } from '../../types';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-student-training-modules',
  templateUrl: './student-training-modules.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentTrainingModulesComponent {
  private userService = inject(UserService);
  modules = this.userService.trainingModules;

  selectedModule = signal<TrainingModule | null>(null);

  selectModule(module: TrainingModule): void {
    this.selectedModule.set(module);
  }

  goBack(): void {
    this.selectedModule.set(null);
  }
}