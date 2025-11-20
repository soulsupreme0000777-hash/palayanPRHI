
import { Component, ChangeDetectionStrategy, inject, input, output, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { Applicant, TrainingBatch, RequiredDoc, Role } from '../../types';

@Component({
  selector: 'app-instructor-review-modal',
  templateUrl: './instructor-review-modal.component.html',
  imports: [CommonModule, FormsModule],
})
export class InstructorReviewModalComponent implements OnInit {
  applicant = input.required<Applicant>();
  close = output<void>();
  enroll = output<{ applicantEmail: string; batchId: string }>();
  
  private userService = inject(UserService);
  private currentUser = this.userService.currentUser;
  
  selectedBatchId: string = '';
  docPreviewUrls = signal<Map<string, string>>(new Map());
  zoomedImageUrl = signal<string | null>(null);

  availableBatches = computed<TrainingBatch[]>(() => {
      const user = this.currentUser();
      if (user?.role !== Role.Instructor) return [];
      
      // FIX: Call the now-existing getBatchesForInstructor method.
      return this.userService.getBatchesForInstructor(user.name)
        .filter(b => b.status === 'Upcoming' || b.status === 'In Progress');
  });

  studentDocuments = computed<RequiredDoc[]>(() => {
    // FIX: Call the now-existing getDocumentsForStudent method.
    return this.userService.getDocumentsForStudent(this.applicant().email);
  });
  
  ngOnInit(): void {
    this.loadPreviewUrls();
  }
  
  isImageDoc(doc: RequiredDoc): boolean {
    const name = doc.name.toLowerCase();
    const fileName = doc.fileName?.toLowerCase() || '';
    const imageKeywords = ['photo', 'id'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    return imageKeywords.some(kw => name.includes(kw)) || imageExtensions.some(ext => fileName.endsWith(ext));
  }

  private async loadPreviewUrls(): Promise<void> {
    const imageDocs = this.studentDocuments().filter(doc => this.isImageDoc(doc) && doc.filePath);
    const newUrls = new Map(this.docPreviewUrls());
    for (const doc of imageDocs) {
      if (doc.filePath && !newUrls.has(doc.filePath)) {
        const url = await this.userService.getSignedDocumentUrl(doc.filePath);
        if (url) {
          newUrls.set(doc.filePath, url);
        }
      }
    }
    this.docPreviewUrls.set(newUrls);
  }

  onEnroll(): void {
    if (this.selectedBatchId) {
        this.enroll.emit({ applicantEmail: this.applicant().email, batchId: this.selectedBatchId });
    }
  }

  onClose(): void {
    this.close.emit();
  }
  
  async zoomImage(doc: RequiredDoc): Promise<void> {
    if (!doc.filePath) return;
    const url = this.docPreviewUrls().get(doc.filePath) || await this.userService.getSignedDocumentUrl(doc.filePath);
    if (url) {
      this.zoomedImageUrl.set(url);
    }
  }

  closeZoom(): void {
    this.zoomedImageUrl.set(null);
  }

  async downloadDocument(doc: RequiredDoc): Promise<void> {
    if (doc.filePath) {
      const url = await this.userService.getSignedDocumentUrl(doc.filePath);
      if (url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok.');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = doc.fileName || doc.name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            a.remove();
        } catch (error) {
            console.error("Download failed, falling back to new tab:", error);
            window.open(url, '_blank');
        }
      }
    }
  }
}
