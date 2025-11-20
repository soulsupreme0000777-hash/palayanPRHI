export enum Role {
  Admin = 'Admin',
  Instructor = 'Instructor',
  Student = 'Student Applicant',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
}

// FIX: Add missing type definitions
export type AssessmentStatus = 'pending' | 'passed' | 'failed' | 'enrolled' | 'remediation';

export interface Applicant extends User {
  role: Role.Student;
  assessmentStatus: AssessmentStatus;
  assessmentScore?: number;
  assessmentTotal?: number;
  batchId?: string;
  batch?: string;
  documents?: RequiredDoc[];
}

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface InAppNotification {
  id: number;
  userEmail: string;
  message: string;
  isRead: boolean;
  timestamp: Date;
}

export interface RequiredDoc {
  name: string;
  status: 'Pending' | 'Uploaded' | 'Approved' | 'Rejected';
  fileName?: string;
  filePath?: string;
  rejectionReason?: string;
}

export interface Lesson {
  title: string;
  type: 'video' | 'reading' | 'quiz';
  url?: string;
  duration: string;
  fileName?: string;
  content?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  lessons: Lesson[];
  order?: number;
  progress?: number;
  status?: 'Completed' | 'In Progress' | 'Not Started';
  students?: number;
  assignedBatchIds?: string[];
}

export interface TrainingBatch {
  id: string;
  name: string;
  instructorName: string;
  startDate: string;
  endDate: string;
  status: 'Upcoming' | 'In Progress' | 'Completed';
  studentEmails: string[];
}

export interface Submission {
  text: string;
  file?: File;
  fileName?: string;
  submittedAt?: string;
}

export interface Assignment {
  id: string;
  title: string;
  module: string;
  dueDate: string;
  fileNames: string[];
  status: 'Upcoming' | 'Submitted' | 'Graded' | 'Pending Review';
  submission?: Submission;
  score?: string;
  feedback?: string;
  assignedTo?: string[];
}

export type StudentAssignment = Assignment;

export interface StudentSubmission {
  submissionId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  submissionDate: string;
  submission: {
    text: string;
    fileName?: string;
    filePath?: string;
  };
  status: 'Pending Review' | 'Graded';
  score?: string;
  feedback?: string;
}

export interface PendingSubmission {
  submissionId: string;
  studentName: string;
  studentEmail: string;
  studentAvatarUrl: string | null;
  assignmentTitle: string;
  submission: {
    text: string;
    fileName?: string;
    filePath?: string;
  };
  submissionTimestamp?: string;
  onTimeStatus?: 'On Time' | 'Late';
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

export interface StudentProgress {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  batch: string;
  trainingProgress: number;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  attendance: number;
  averageScore?: string;
  assignments?: any[];
  attendanceRecords?: any[];
}