
import { Component, ChangeDetectionStrategy, signal, inject, ViewChild, ElementRef } from '@angular/core';
// FIX: Add FormBuilder to imports
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { RequiredDoc } from '../../types';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';

// Declare external libraries to prevent TypeScript errors
declare var html2canvas: any;
declare var jspdf: any;

@Component({
  selector: 'app-student-documents',
  templateUrl: './student-documents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class StudentDocumentsComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('resumeContainer') resumeContainer!: ElementRef<HTMLDivElement>;

  // FIX: Explicitly type FormBuilder to avoid type inference issues.
  private readonly fb: FormBuilder = inject(FormBuilder);
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);

  requiredDocs = this.userService.studentDocuments;
  currentlyUploadingDoc = signal<string | null>(null);

  resumeForm: FormGroup = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    address: [''],
    skills: [''],
    workExperience: this.fb.array([this.createExperienceGroup()])
  });

  constructor() {
    const user = this.userService.currentUser();
    if(user) {
        this.resumeForm.patchValue({
            fullName: user.name,
            email: user.email
        });
    }
  }

  get workExperiences() {
    return this.resumeForm.get('workExperience') as FormArray;
  }

  createExperienceGroup(): FormGroup {
    return this.fb.group({
      jobTitle: [''],
      company: [''],
      description: ['']
    });
  }

  addExperience(): void {
    this.workExperiences.push(this.createExperienceGroup());
  }

  removeExperience(index: number): void {
    this.workExperiences.removeAt(index);
  }

  triggerFileUpload(docName: string): void {
    this.currentlyUploadingDoc.set(docName);
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const docName = this.currentlyUploadingDoc();
    
    if (input.files && input.files.length > 0 && docName) {
      const file = input.files[0];
      try {
        await this.userService.uploadDocument(docName, file);
        this.notificationService.showSuccess(`Uploaded ${file.name} for ${docName}.`);
      } catch (error: any) {
        this.notificationService.showError(error.message || 'File upload failed.');
      } finally {
        this.currentlyUploadingDoc.set(null);
      }
    } else {
      // If no file was selected (e.g., user cancelled), reset the state
      this.currentlyUploadingDoc.set(null);
    }
    input.value = ''; // Reset input to allow re-uploading the same file
  }

  exportAsPdf(): void {
    const resumeElement = this.resumeContainer.nativeElement;
    
    html2canvas(resumeElement, { 
        backgroundColor: '#1e293b',
        scale: 2
    }).then((canvas: any) => {
      const imageData = canvas.toDataURL('image/png');
      const { jsPDF } = jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imageData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('resume.pdf');
    });
  }
}