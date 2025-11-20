

import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { User, Applicant, Role, StudentProgress, RequiredDoc, StudentAssignment, TrainingBatch, PendingSubmission, Assignment, TrainingModule, StudentSubmission } from '../types';
import { SupabaseService } from './supabase.service';
import { NotificationService } from './notification.service';
import type { RealtimeChannel } from '@supabase/supabase-js';

const defaultDocs: RequiredDoc[] = [
    { name: 'Valid ID (Front)', status: 'Pending' },
    { name: 'Valid ID (Back)', status: 'Pending' },
    { name: '2x2 Photo', status: 'Pending' },
    { name: 'Proof of Address (Optional)', status: 'Pending' },
    { name: 'Certificates (Optional)', status: 'Pending' },
];

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private supabase = inject(SupabaseService);
  private notificationService = inject(NotificationService);
  private dataChannel: RealtimeChannel | null = null;

  // Current user state
  currentUser = signal<User | Applicant | null>(null);

  // State signals
  users = signal<(User | Applicant)[]>([]);
  applicants = signal<Applicant[]>([]);
  assignments = signal<Assignment[]>([]);
  pendingSubmissions = signal<PendingSubmission[]>([]);
  trainingBatches = signal<TrainingBatch[]>([]);
  trainingModules = signal<TrainingModule[]>([]);

  // Computed signals
  instructors = computed(() => this.users().filter(u => u.role === Role.Instructor));

  assessmentStatus = computed(() => {
    const user = this.currentUser();
    if (user && 'assessmentStatus' in user) {
      return (user as Applicant).assessmentStatus;
    }
    return null;
  });

  studentDocuments = computed<RequiredDoc[]>(() => {
    const user = this.currentUser();
    if (user && user.role === Role.Student) {
        return (user as Applicant).documents || defaultDocs;
    }
    return [];
  });

  constructor() {}

  public initializeRealtimeListeners(): void {
    this.cleanupRealtimeListeners(); // Clean up any existing channel
    const user = this.currentUser();
    if (!user) return;

    this.dataChannel = this.supabase.client
      .channel('prhi-data-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignments' },
        (payload) => {
          console.log('Assignments table change detected, reloading assignments.', payload);
          this.fetchAssignments();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        (payload) => {
          console.log('Submissions table change detected, reloading related data.', payload);
          this.fetchAssignments(); // For student status updates
          this.fetchPendingSubmissions(); // For instructor list
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'training_batches' },
        (payload) => {
          console.log('Training batches change detected, reloading batches and users.', payload);
          this.fetchTrainingBatches().then(() => this.fetchUsersAndApplicants());
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('Realtime subscription error:', err);
          this.notificationService.showError('Realtime connection failed. Some updates may not appear automatically.');
        }
        console.log('Realtime subscription status:', status);
      });
  }

  public cleanupRealtimeListeners(): void {
    if (this.dataChannel) {
      this.supabase.client.removeChannel(this.dataChannel).catch(console.error);
      this.dataChannel = null;
      console.log('Realtime listeners cleaned up.');
    }
  }

  async loadInitialData(): Promise<void> {
    await this.fetchTrainingBatches();
    await this.fetchUsersAndApplicants();
    await this.fetchTrainingModules();
    await this.fetchAssignments();
    await this.fetchPendingSubmissions();
  }

  async fetchUsersAndApplicants(): Promise<void> {
    const { data, error } = await this.supabase.client.from('profiles').select('*');
    if (error) {
      console.error('Error fetching profiles:', error.message);
      return;
    }

    const batches = this.trainingBatches();
    const batchMap = new Map(batches.map(b => [b.id, b.name]));

    const allProfiles: (User | Applicant)[] = data.map(profile => {
      const isStudent = profile.role === Role.Student;
      const applicantData = isStudent ? {
        assessmentStatus: profile.assessment_status,
        assessmentScore: profile.assessment_score,
        assessmentTotal: profile.assessment_total,
        batchId: profile.batch_id,
        batch: batchMap.get(profile.batch_id) || (profile.assessment_status === 'enrolled' ? 'Unassigned' : 'N/A'),
        documents: profile.documents || defaultDocs,
      } : {};

      return {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        avatarUrl: profile.avatar_url,
        ...applicantData,
      };
    });

    this.users.set(allProfiles);
    this.applicants.set(allProfiles.filter(p => p.role === Role.Student) as Applicant[]);
  }

  async fetchTrainingBatches(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('training_batches')
      .select(`
        id,
        name,
        start_date,
        end_date,
        status,
        instructor:profiles!instructor_id(id, full_name)
      `);

    if (error) {
      console.error('Error fetching training batches:', error.message);
      return;
    }

    const { data: profiles, error: profilesError } = await this.supabase.client.from('profiles').select('id, email, batch_id').eq('role', Role.Student);
    if(profilesError) {
      console.error('Error fetching student profiles for batch mapping:', profilesError.message);
      return;
    }

    const batches: TrainingBatch[] = data.map(batch => ({
      id: batch.id,
      name: batch.name,
      instructorName: (batch.instructor as any)?.full_name || 'Unassigned',
      startDate: batch.start_date,
      endDate: batch.end_date,
      status: batch.status,
      studentEmails: profiles.filter(p => p.batch_id === batch.id).map(p => p.email),
    }));

    this.trainingBatches.set(batches);
  }

    async fetchTrainingModules(): Promise<void> {
    const user = this.currentUser();
    if (!user) {
        this.trainingModules.set([]);
        return;
    }

    let modulesData: any[] | null = null;
    let modulesError: any = null;

    if (user.role === Role.Instructor) {
        const response = await this.supabase.client
            .from('training_modules')
            .select('*')
            .eq('instructor_id', user.id)
            .order('created_at', { ascending: true });
        modulesData = response.data;
        modulesError = response.error;
    } else if (user.role === Role.Student) {
        const applicant = user as Applicant;
        if (!applicant.batchId) {
            this.trainingModules.set([]);
            return;
        }

        const { data: assignmentData, error: assignmentError } = await this.supabase.client
            .from('module_batch_assignments')
            .select('module_id')
            .eq('batch_id', applicant.batchId);

        if (assignmentError) {
            console.error('Error fetching module assignments:', assignmentError.message);
            this.trainingModules.set([]);
            return;
        }

        const moduleIds = assignmentData.map(a => a.module_id);
        if (moduleIds.length === 0) {
            this.trainingModules.set([]);
            return;
        }

        const response = await this.supabase.client
            .from('training_modules')
            .select('*')
            .in('id', moduleIds);
        modulesData = response.data;
        modulesError = response.error;
    }

    if (modulesError) {
        console.error('Error fetching training modules:', modulesError.message);
        this.notificationService.showError(`Failed to load training modules: ${modulesError.message}`);
        return;
    }

    if (!modulesData || modulesData.length === 0) {
        this.trainingModules.set([]);
        return;
    }

    const moduleIds = modulesData.map((m: any) => m.id);

    const { data: assignmentsData, error: assignmentsError } = await this.supabase.client
        .from('module_batch_assignments')
        .select('module_id, batch_id')
        .in('module_id', moduleIds);

    if (assignmentsError) {
        console.error('Error fetching module batch assignments:', assignmentsError.message);
        // Not a fatal error, we can still show modules
    }

    const assignmentsByModuleId = new Map<string, string[]>();
    if (assignmentsData) {
        for (const assignment of assignmentsData) {
            if (!assignmentsByModuleId.has(assignment.module_id)) {
                assignmentsByModuleId.set(assignment.module_id, []);
            }
            assignmentsByModuleId.get(assignment.module_id)!.push(assignment.batch_id);
        }
    }

    const { data: lessonsData, error: lessonsError } = await this.supabase.client
        .from('lessons')
        .select('*')
        .in('module_id', moduleIds);

    if (lessonsError) {
        console.error('Error fetching lessons for modules:', lessonsError.message);
        this.notificationService.showError(`Failed to load lessons for modules: ${lessonsError.message}`);
    }

    const lessonsByModuleId = new Map<string, any[]>();
    if (lessonsData) {
        for (const lesson of lessonsData) {
            if (!lessonsByModuleId.has(lesson.module_id)) {
                lessonsByModuleId.set(lesson.module_id, []);
            }
            lessonsByModuleId.get(lesson.module_id)!.push(lesson);
        }
    }

    const modules: TrainingModule[] = modulesData.map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        durationDays: m.duration_days,
        lessons: (lessonsByModuleId.get(m.id) || []).map((l: any) => ({
            title: l.title,
            type: l.type,
            url: l.url,
            duration: l.duration,
            fileName: l.file_name,
            content: l.content
        })),
        progress: 0,
        status: 'Not Started',
        students: 0,
        assignedBatchIds: assignmentsByModuleId.get(m.id) || [],
    }));

    this.trainingModules.set(modules);
  }

  async fetchAssignments(): Promise<void> {
    const user = this.currentUser();
    if (!user) {
        this.assignments.set([]);
        return;
    }

    if (user.role === Role.Instructor) {
        const { data, error } = await this.supabase.client
            .from('assignments')
            .select(`
                id,
                title,
                due_date,
                file_urls,
                assigned_to_emails,
                module:training_modules!left(title)
            `)
            .eq('instructor_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching assignments:', error.message);
            return;
        }

        const instructorAssignments: Assignment[] = data.map((a: any) => ({
            id: a.id,
            title: a.title,
            module: a.module?.title || 'Uncategorized',
            dueDate: a.due_date,
            fileNames: a.file_urls?.map((f: any) => f.name) || [],
            status: 'Upcoming', 
            assignedTo: a.assigned_to_emails || [],
        }));
        this.assignments.set(instructorAssignments);

    } else if (user.role === Role.Student) {
        const { data: rpcData, error: rpcError } = await this.supabase.client
            .rpc('get_student_assignments');

        if (rpcError) {
            if (rpcError.message.includes('function get_student_assignments() does not exist')) {
                 this.notificationService.showError("DATABASE FIX REQUIRED: The function 'get_student_assignments' is missing. Please run the provided SQL in your Supabase SQL Editor to see your assignments.");
            } else {
                console.error('Error fetching student assignments via RPC:', rpcError.message);
                let friendlyMessage = `Failed to load assignments: ${rpcError.message}`;
                if (rpcError.message.includes('structure of query does not match function result type')) {
                    friendlyMessage = "DATABASE FIX REQUIRED: The 'get_student_assignments' function has a mismatch between its definition and its query. Please run the updated SQL fix provided in the instructions.";
                }
                this.notificationService.showError(friendlyMessage);
            }
            return;
        }

        // Adapt the RPC response to match the structure of the direct query
        const assignmentData = rpcData.map((a: any) => ({
            id: a.id,
            title: a.title,
            due_date: a.due_date,
            file_urls: a.file_urls,
            module: { title: a.module_title }
        }));

        if (assignmentData.length === 0) {
            this.assignments.set([]);
            return;
        }

        const assignmentIds = assignmentData.map(a => a.id);
        const { data: submissionData, error: submissionError } = await this.supabase.client
            .from('submissions')
            .select('*')
            .eq('student_id', user.id)
            .in('assignment_id', assignmentIds);
            
        if (submissionError) {
            console.error('Error fetching student submissions:', submissionError.message);
        }

        const submissionsMap = new Map(submissionData?.map(s => [s.assignment_id, s]) || []);

        const studentAssignments: StudentAssignment[] = assignmentData.map((a: any) => {
            // FIX: Explicitly type `submission` as `any` to resolve property access errors from Supabase's generic response.
            const submission: any = submissionsMap.get(a.id);
            let status: Assignment['status'] = 'Upcoming';
            if (submission) {
                status = submission.status === 'Graded' ? 'Graded' : 'Submitted';
            }

            return {
                id: a.id,
                title: a.title,
                module: a.module?.title || 'Uncategorized',
                dueDate: a.due_date,
                fileNames: a.file_urls?.map((f: any) => f.name) || [],
                status: status,
                submission: submission ? {
                    text: submission.text_content,
                    fileName: submission.file_name,
                    submittedAt: submission.submitted_at,
                } : undefined,
                score: submission?.score,
                feedback: submission?.feedback,
            };
        });
        this.assignments.set(studentAssignments);
    }
  }

  async fetchPendingSubmissions(): Promise<void> {
    const user = this.currentUser();
    if (!user || user.role !== Role.Instructor) {
        this.pendingSubmissions.set([]);
        return;
    }

    const { data, error } = await this.supabase.client
        .from('submissions')
        .select(`
            id,
            text_content,
            file_name,
            file_url,
            submitted_at,
            assignment:assignments!inner(id, title, due_date, instructor_id),
            student:profiles!inner(id, full_name, avatar_url, email)
        `)
        .eq('assignments.instructor_id', user.id)
        .eq('status', 'Pending Review');

    if (error) {
        console.error('Error fetching pending submissions:', error.message);
        return;
    }

    const submissions: PendingSubmission[] = data.map((s: any) => {
        const dueDate = new Date(s.assignment.due_date);
        const submissionDate = new Date(s.submitted_at);
        return {
            submissionId: s.id,
            studentName: s.student.full_name,
            studentEmail: s.student.email,
            studentAvatarUrl: s.student.avatar_url,
            assignmentTitle: s.assignment.title,
            submission: {
                text: s.text_content,
                fileName: s.file_name,
                filePath: s.file_url,
            },
            submissionTimestamp: s.submitted_at,
            onTimeStatus: submissionDate <= dueDate ? 'On Time' : 'Late'
        };
    });
    this.pendingSubmissions.set(submissions);
}

  async getSubmissionsForAssignment(assignmentId: string): Promise<StudentSubmission[]> {
    const { data, error } = await this.supabase.client
      .from('submissions')
      .select(`
        id,
        submitted_at,
        text_content,
        file_name,
        file_url,
        status,
        score,
        feedback,
        student:profiles!inner(full_name, avatar_url)
      `)
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching submissions for assignment:', error.message);
      throw new Error(`Failed to fetch submissions: ${error.message}`);
    }

    if (!data) return [];

    const submissions: StudentSubmission[] = data.map((s: any) => ({
      submissionId: s.id,
      studentName: s.student.full_name,
      studentAvatarUrl: s.student.avatar_url,
      submissionDate: s.submitted_at,
      submission: {
        text: s.text_content,
        fileName: s.file_name,
        filePath: s.file_url,
      },
      status: s.status as 'Pending Review' | 'Graded',
      score: s.score,
      feedback: s.feedback,
    }));
    return submissions;
  }

  async saveBatch(batchData: { instructorName: string, startDate: string, endDate: string }, editingBatch: TrainingBatch | null): Promise<void> {
    const instructor = this.instructors().find(i => i.name === batchData.instructorName);
    if (!instructor) {
      throw new Error('Instructor not found. Please ensure an instructor is selected.');
    }

    if (editingBatch) {
      // Logic for editing remains mostly the same. Status is not editable from this form.
      const { error } = await this.supabase.client.from('training_batches').update({
        instructor_id: instructor.id,
        start_date: batchData.startDate,
        end_date: batchData.endDate,
      }).eq('id', editingBatch.id);

      if (error) throw new Error(error.message);
    } else {
      // Logic for creating a new batch with automated status
      const { data: inProgressBatch, error: checkError } = await this.supabase.client
        .from('training_batches')
        .select('id')
        .eq('instructor_id', instructor.id)
        .eq('status', 'In Progress')
        .limit(1)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "exact one row not found", which is fine
        throw new Error(`Could not check for existing batches: ${checkError.message}`);
      }

      const newStatus = inProgressBatch ? 'Upcoming' : 'In Progress';

      const batchCount = this.trainingBatches().length;
      const nextBatchNumber = batchCount > 0 ? 
        Math.max(...this.trainingBatches().map(b => parseInt(b.name.split(' ')[1])).filter(Number.isFinite)) + 1 
        : 1;

      const newBatchName = `Batch ${nextBatchNumber} - ${new Date().getFullYear()}`;
      
      const { error } = await this.supabase.client.from('training_batches').insert({
        name: newBatchName,
        instructor_id: instructor.id,
        start_date: batchData.startDate,
        end_date: batchData.endDate,
        status: newStatus,
      });
      if (error) throw new Error(error.message);
    }
  }

  async deleteBatch(batchId: string): Promise<void> {
    const { error } = await this.supabase.client.from('training_batches').delete().eq('id', batchId);
    if (error) throw new Error(error.message);
  }

  async saveTrainingModule(moduleData: any, editingModule: TrainingModule | null): Promise<void> {
    const user = this.currentUser();
    if (!user || user.role !== Role.Instructor) {
        throw new Error('Only instructors can save modules.');
    }

    const modulePayload = {
        title: moduleData.title,
        description: moduleData.description,
        duration_days: moduleData.durationDays,
        instructor_id: user.id
    };

    let moduleId = editingModule?.id;

    if (editingModule) {
        const { data, error } = await this.supabase.client
            .from('training_modules')
            .update(modulePayload)
            .eq('id', editingModule.id)
            .select('id')
            .single();

        if (error) throw new Error(`Failed to update module: ${error.message}`);
        moduleId = data.id;
    } else {
        const { data, error } = await this.supabase.client
            .from('training_modules')
            .insert({ ...modulePayload })
            .select('id')
            .single();
        
        if (error) throw new Error(`Failed to create module: ${error.message}`);
        moduleId = data.id;
    }

    if (!moduleId) {
        throw new Error('Could not get module ID after saving.');
    }

    // When editing, we delete old lessons and re-insert them.
    if (editingModule) {
        const { error: deleteError } = await this.supabase.client
            .from('lessons')
            .delete()
            .eq('module_id', moduleId);
        if (deleteError) throw new Error(`Failed to clear old lessons: ${deleteError.message}`);
    }

    const lessonsPayload = await Promise.all(moduleData.lessons.map(async (lesson: any) => {
        let file_url: string | undefined = lesson.url;
        let file_name: string | undefined = lesson.fileName;

        // A `File` object on the form indicates a new file was selected for upload.
        if (lesson.type === 'file' && lesson.file instanceof File) {
            const file = lesson.file;
            const filePath = `modules/${moduleId}/lessons/${file.name}`;
            
            // Instructor content goes to the public 'prhi-files' bucket
            const { error: uploadError } = await this.supabase.client.storage
                .from('prhi-files')
                .upload(filePath, file, { upsert: true });
            
            if (uploadError) {
                throw new Error(`Failed to upload lesson file ${file.name}: ${uploadError.message}`);
            }

            const { data: { publicUrl } } = this.supabase.client.storage
                .from('prhi-files')
                .getPublicUrl(filePath);
            
            file_url = publicUrl;
            file_name = file.name;
        }

        return {
            module_id: moduleId,
            title: lesson.title,
            type: lesson.type,
            url: file_url, // For videos or the newly uploaded file
            duration: lesson.duration,
            file_name: file_name, // The name of the uploaded file
        };
    }));


    if (lessonsPayload.length > 0) {
        const { error: insertLessonsError } = await this.supabase.client
            .from('lessons')
            .insert(lessonsPayload);
        if (insertLessonsError) throw new Error(`Failed to save lessons: ${insertLessonsError.message}`);
    }
    
    await this.fetchTrainingModules();
  }

  async deleteTrainingModule(moduleId: string): Promise<void> {
    const { error } = await this.supabase.client
        .from('training_modules')
        .delete()
        .eq('id', moduleId);

    if (error) throw new Error(`Failed to delete module: ${error.message}`);
    
    await this.fetchTrainingModules();
  }

  async assignModuleToBatches(moduleId: string, batchIds: string[]): Promise<void> {
    const { error: deleteError } = await this.supabase.client
        .from('module_batch_assignments')
        .delete()
        .eq('module_id', moduleId);
    
    if (deleteError) {
        if (deleteError.message.includes('relation "module_batch_assignments" does not exist')) {
            throw new Error("DATABASE FIX REQUIRED: The 'module_batch_assignments' table is missing. Please create it with 'module_id' (uuid) and 'batch_id' (uuid) columns to assign modules.");
        }
        throw new Error(`Failed to clear old assignments: ${deleteError.message}`);
    }

    if (batchIds.length > 0) {
        const assignmentsPayload = batchIds.map(batchId => ({
            module_id: moduleId,
            batch_id: batchId,
        }));

        const { error: insertError } = await this.supabase.client
            .from('module_batch_assignments')
            .insert(assignmentsPayload);
        
        if (insertError) {
            throw new Error(`Failed to save new assignments: ${insertError.message}`);
        }
    }
    await this.fetchTrainingModules();
}

  async saveAssignment(assignmentData: any, editingAssignment: Assignment | null, newFiles: File[]): Promise<void> {
    const user = this.currentUser();
    if (!user || user.role !== Role.Instructor) throw new Error('Only instructors can save assignments.');

    const module = this.trainingModules().find(m => m.title === assignmentData.module);
    if (!module) throw new Error('Selected module not found.');

    const assignmentId = editingAssignment?.id || crypto.randomUUID();

    const uploadedFiles = await Promise.all(
      newFiles.map(async file => {
        const filePath = `assignments/${assignmentId}/${file.name}`;
        // Instructor content goes to the public 'prhi-files' bucket
        const { error } = await this.supabase.client.storage.from('prhi-files').upload(filePath, file, { upsert: true });
        if (error) throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        const { data: { publicUrl } } = this.supabase.client.storage.from('prhi-files').getPublicUrl(filePath);
        return { name: file.name, url: publicUrl };
      })
    );

    let finalFileUrls = uploadedFiles;
    if (editingAssignment) {
        const { data: current, error } = await this.supabase.client.from('assignments').select('file_urls').eq('id', editingAssignment.id).single();
        if (error) throw new Error('Could not fetch existing assignment files.');
        
        const existingFileUrls: {name: string, url: string}[] = current.file_urls || [];
        const filesToKeep = existingFileUrls.filter(f => assignmentData.files.includes(f.name));
        finalFileUrls = [...filesToKeep, ...uploadedFiles];
    }

    const payload = {
      title: assignmentData.title,
      module_id: module.id,
      due_date: assignmentData.dueDate,
      instructor_id: user.id,
      file_urls: finalFileUrls,
    };
    
    if (editingAssignment) {
      const { error } = await this.supabase.client.from('assignments').update(payload).eq('id', editingAssignment.id);
      if (error) throw new Error(`Failed to update assignment: ${error.message}`);
    } else {
      const { error } = await this.supabase.client.from('assignments').insert({ ...payload, id: assignmentId });
      if (error) throw new Error(`Failed to create assignment: ${error.message}`);
    }
  }

  async deleteAssignment(assignmentId: string): Promise<void> {
    const { error: submissionError } = await this.supabase.client
      .from('submissions')
      .delete()
      .eq('assignment_id', assignmentId);

    if (submissionError) {
      throw new Error(`Failed to delete associated submissions: ${submissionError.message}`);
    }

    const folderPath = `assignments/${assignmentId}`;
    const { data: files, error: listError } = await this.supabase.client.storage
      .from('prhi-files')
      .list(folderPath);

    if (listError) {
      console.warn(`Could not list files for assignment ${assignmentId} for deletion:`, listError.message);
    }
    
    const { error: assignmentError } = await this.supabase.client
      .from('assignments')
      .delete()
      .eq('id', assignmentId);

    if (assignmentError) {
      throw new Error(`Failed to delete assignment: ${assignmentError.message}`);
    }

    if (files && files.length > 0) {
        const filesToDelete = files.map(file => `${folderPath}/${file.name}`);
        const { error: removeError } = await this.supabase.client.storage
            .from('prhi-files')
            .remove(filesToDelete);

        if (removeError) {
            this.notificationService.show(`Assignment deleted, but failed to clean up some storage files.`, 'info');
            console.warn(`Failed to delete files from storage for assignment ${assignmentId}:`, removeError.message);
        }
    }
  }

  async assignStudentsToAssignment(assignmentId: string, studentEmails: string[]): Promise<void> {
    const { error } = await this.supabase.client.rpc('assign_students_to_assignment', {
        target_assignment_id: assignmentId,
        student_emails_to_assign: studentEmails
    });
    
    if (error) {
        if (error.message.includes('function assign_students_to_assignment')) {
            throw new Error("DATABASE FIX REQUIRED: The function 'assign_students_to_assignment' is missing. Please run the provided SQL in your Supabase SQL Editor to enable assigning students.");
        }
        throw new Error(`Failed to assign students: ${error.message}`);
    }
    
    await this.fetchAssignments();
  }

  async submitAssignment(assignmentId: string, submission: { text: string; file?: File }): Promise<void> {
    const user = this.currentUser();
    if (!user || user.role !== Role.Student) throw new Error('Only students can submit assignments.');

    let file_path: string | null = null;
    let file_name: string | null = null;
    
    if (submission.file) {
        const file = submission.file;
        const filePath = `submissions/${assignmentId}/${user.id}/${file.name}`;
        const { error } = await this.supabase.client.storage.from('documents').upload(filePath, file, { upsert: true });
        if (error) throw new Error(`Failed to upload submission file: ${error.message}`);
        
        file_path = filePath;
        file_name = file.name;
    }

    const payload = {
        assignment_id: assignmentId,
        student_id: user.id,
        text_content: submission.text,
        file_url: file_path, 
        file_name,
        status: 'Pending Review',
    };

    const { error } = await this.supabase.client.from('submissions').insert(payload);
    if (error) throw new Error(`Failed to submit assignment: ${error.message}`);
  }

  async gradeSubmission(submissionId: string, score: string, feedback: string): Promise<void> {
    const { error } = await this.supabase.client
        .from('submissions')
        .update({ score, feedback, status: 'Graded' })
        .eq('id', submissionId);
    if (error) throw new Error(`Failed to grade submission: ${error.message}`);
  }

  async submitAssessment(userId: string, score: number, total: number, passed: boolean): Promise<void> {
    const newStatus = passed ? 'passed' : 'failed';
    const updates = {
      assessment_status: newStatus,
      assessment_score: score,
      assessment_total: total,
    };

    const { error } = await this.supabase.client
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('Error updating assessment status:', error.message);
      throw new Error('Failed to save your quiz result. Please try again.');
    }

    const updateFn = (user: User | Applicant): User | Applicant => {
        if (user.id === userId && user.role === Role.Student) {
            return {
                ...(user as Applicant),
                assessmentStatus: newStatus,
                assessmentScore: score,
                assessmentTotal: total,
            };
        }
        return user;
    };

    this.users.update(users => users.map(updateFn));
    this.applicants.update(applicants => applicants.map(app => updateFn(app) as Applicant));
    
    if (this.currentUser()?.id === userId) {
        this.currentUser.update(currentUser => {
            if (currentUser) {
                return updateFn(currentUser);
            }
            return currentUser;
        });
    }
  }

  async enrollStudent(applicantId: string, batchId: string): Promise<void> {
    const applicant = this.applicants().find(a => a.id === applicantId);
    if (!applicant) {
      throw new Error('Applicant not found.');
    }

    const { error } = await this.supabase.client.rpc('enroll_student_in_batch', {
      student_id_to_enroll: applicantId,
      target_batch_id: batchId,
    });

    if (error) {
      if (error.message.includes('function enroll_student_in_batch')) {
        throw new Error("DATABASE FIX REQUIRED: The function 'enroll_student_in_batch' is missing. Please run the provided SQL in your Supabase SQL Editor to fix enrollment.");
      }
      throw new Error(`Failed to enroll student: ${error.message}`);
    }

    this.trainingBatches.update(batches => {
      return batches.map(batch => {
        if (batch.id === batchId) {
          const updatedEmails = Array.from(new Set([...batch.studentEmails, applicant.email]));
          return { ...batch, studentEmails: updatedEmails };
        }
        return batch;
      });
    });

    const batchName = this.trainingBatches().find(b => b.id === batchId)?.name || 'Unassigned';

    const updateUser = (user: User | Applicant): User | Applicant => {
      if (user.id === applicantId && user.role === Role.Student) {
        return {
          ...(user as Applicant),
          assessmentStatus: 'enrolled',
          batchId: batchId,
          batch: batchName,
        };
      }
      return user;
    };

    this.users.update(users => users.map(updateUser));
    this.applicants.update(applicants => applicants.map(app => updateUser(app) as Applicant));
  }

  getStudentProgressDetails(applicant: Applicant): StudentProgress {
    return {
      id: applicant.id,
      name: applicant.name,
      email: applicant.email,
      avatarUrl: applicant.avatarUrl,
      batch: applicant.batch || 'N/A',
      trainingProgress: Math.floor(Math.random() * 100),
      assignmentsCompleted: Math.floor(Math.random() * 5),
      assignmentsTotal: 5,
      attendance: Math.floor(Math.random() * (100 - 90 + 1) + 90),
    };
  }

  getDocumentsForStudent(email: string): RequiredDoc[] {
    const applicant = this.applicants().find(a => a.email === email);
    return applicant?.documents || defaultDocs;
  }

  async uploadDocument(docName: string, file: File): Promise<void> {
    const user = this.currentUser();
    if (!user || user.role !== Role.Student) {
      throw new Error('Only student applicants can upload documents.');
    }

    const safeDocName = docName.replace(/[^a-zA-Z0-9-]/g, '_');
    const filePath = `user-documents/${user.id}/${safeDocName}-${file.name}`;
    
    const { error: uploadError } = await this.supabase.client.storage
      .from('documents')
      .upload(filePath, file, { upsert: true });
      
    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    const currentDocs = (user as Applicant).documents || defaultDocs;
    const newDocsArray = currentDocs.map(doc => 
      doc.name === docName 
        ? { ...doc, status: 'Uploaded' as const, fileName: file.name, filePath: filePath }
        : doc
    );

    const { error: dbError } = await this.supabase.client
      .from('profiles')
      .update({ documents: newDocsArray })
      .eq('id', user.id);
      
    if (dbError) {
       if (dbError.message.includes("column") && dbError.message.includes("documents")) {
         throw new Error("DATABASE FIX REQUIRED: The 'documents' column is missing from the 'profiles' table. Please add a 'documents' column of type 'jsonb' in your Supabase dashboard.");
      }
      throw new Error(`Failed to update your profile: ${dbError.message}`);
    }

    const updatedApplicant: Applicant = { ...(user as Applicant), documents: newDocsArray };
    this.currentUser.set(updatedApplicant);
    this.users.update(users => users.map(u => u.id === user.id ? updatedApplicant : u));
    this.applicants.update(applicants => applicants.map(a => a.id === user.id ? updatedApplicant : a));
  }

  async downloadPrivateFile(filePath: string): Promise<Blob | null> {
    const { data, error } = await this.supabase.client.storage
      .from('documents')
      .download(filePath);

    if (error) {
      console.error('Error downloading document:', error.message);
      this.notificationService.showError(`Could not download document: ${error.message}`);
      return null;
    }
    return data;
  }

  async getSignedDocumentUrl(filePath: string): Promise<string | null> {
    const { data, error } = await this.supabase.client.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);
      
    if (error) {
      console.error('Error creating signed URL for document:', error.message);
      this.notificationService.showError(`Could not get document URL: ${error.message}`);
      return null;
    }
    return data.signedUrl;
  }

  async uploadAvatar(userId: string, file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const filePath = `avatars/${userId}.${fileExt}`;

    const { error } = await this.supabase.client.storage
      .from('profiles')
      .upload(filePath, file, { 
        upsert: true,
        cacheControl: '3600'
       });

    if (error) {
      console.error('Error uploading avatar:', error.message);
      throw new Error(`Failed to upload avatar: ${error.message}`);
    }

    const { data: { publicUrl } } = this.supabase.client.storage
      .from('profiles')
      .getPublicUrl(filePath);
    
    return publicUrl ? `${publicUrl}?t=${new Date().getTime()}` : null;
  }

  async updateUserAvatar(userId: string, avatarUrl: string): Promise<void> {
    const cleanAvatarUrl = avatarUrl.split('?')[0];

    const { error } = await this.supabase.client
      .from('profiles')
      .update({ avatar_url: cleanAvatarUrl })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user profile in database: ${error.message}`);
    }

    this.users.update(users => users.map(u => u.id === userId ? { ...u, avatarUrl } : u));
    this.applicants.update(applicants => applicants.map(a => a.id === userId ? { ...a, avatarUrl } : a));
    if (this.currentUser()?.id === userId) {
        const currentUser = this.currentUser();
        if (currentUser) {
            this.currentUser.set({ ...currentUser, avatarUrl });
        }
    }
  }

  getBatchesForInstructor(instructorName: string): TrainingBatch[] {
    return this.trainingBatches().filter(b => b.instructorName === instructorName);
  }

  async completeBatch(batchId: string): Promise<void> {
    const batchToComplete = this.trainingBatches().find(b => b.id === batchId);
    if (!batchToComplete) {
      throw new Error('Batch not found.');
    }
    const instructor = this.instructors().find(i => i.name === batchToComplete.instructorName);
    if (!instructor) {
      throw new Error('Instructor for the batch not found.');
    }

    const { error: completeError } = await this.supabase.client
      .from('training_batches')
      .update({ status: 'Completed' })
      .eq('id', batchId);
      
    if (completeError) {
      throw new Error(`Failed to complete batch: ${completeError.message}`);
    }

    const { data: nextBatch, error: findNextError } = await this.supabase.client
      .from('training_batches')
      .select('id')
      .eq('instructor_id', instructor.id)
      .eq('status', 'Upcoming')
      .order('start_date', { ascending: true })
      .limit(1)
      .single();

    if (findNextError && findNextError.code !== 'PGRST116') {
      console.error('Could not find next batch to promote:', findNextError.message);
    }

    if (nextBatch) {
      const { error: promoteError } = await this.supabase.client
        .from('training_batches')
        .update({ status: 'In Progress' })
        .eq('id', nextBatch.id);
        
      if (promoteError) {
        console.error(`Failed to promote next batch ${nextBatch.id}:`, promoteError.message);
        this.notificationService.showError('Batch completed, but failed to automatically start the next one.');
      }
    }
  }
}
