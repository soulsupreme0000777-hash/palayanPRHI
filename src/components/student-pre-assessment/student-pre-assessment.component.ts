
import { Component, ChangeDetectionStrategy, inject, OnInit, output } from '@angular/core';
// FIX: Add FormBuilder to imports
import { FormBuilder, FormControl, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { QuizQuestion } from '../../types';

@Component({
  selector: 'app-student-pre-assessment',
  templateUrl: './student-pre-assessment.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class StudentPreAssessmentComponent implements OnInit {
  // FIX: Explicitly type FormBuilder to avoid type inference issues.
  private readonly fb: FormBuilder = inject(FormBuilder);
  quizSubmitted = output<{ score: number; total: number }>();

  questions: QuizQuestion[] = [
    {
      question: 'She ___ to the store every day.',
      options: ['go', 'goes', 'went', 'is going'],
      answer: 'goes',
    },
    {
      question: 'Choose the correct preposition: "He is interested ___ learning Spanish."',
      options: ['in', 'on', 'at', 'for'],
      answer: 'in',
    },
    {
      question: 'What is the past tense of "begin"?',
      options: ['begun', 'began', 'beginned', 'begin'],
      answer: 'began',
    },
     {
      question: '"I have ___ apple for lunch."',
      options: ['a', 'an', 'the', 'no article'],
      answer: 'an',
    },
    {
      question: '"There isn\'t ___ milk left in the fridge."',
      options: ['some', 'any', 'no', 'much'],
      answer: 'any',
    },
    {
      question: 'Which sentence is grammatically correct?',
      options: [
        'They is going to the park.', 
        'She don\'t like ice cream.', 
        'He and I are good friends.', 
        'Her and me went shopping.'
      ],
      answer: 'He and I are good friends.',
    },
    {
      question: '"If I ___ you, I would study harder."',
      options: ['was', 'were', 'am', 'be'],
      answer: 'were',
    },
    {
      question: '"They have lived here ___ 2010."',
      options: ['since', 'for', 'from', 'at'],
      answer: 'since',
    },
    {
      question: '"The book is on the table, ___ it?"',
      options: ['is', 'isn\'t', 'does', 'doesn\'t'],
      answer: 'isn\'t',
    },
    {
      question: 'My brother is taller ___ me.',
      options: ['then', 'than', 'as', 'from'],
      answer: 'than',
    }
  ];

  quizForm = this.fb.group({
    answers: this.fb.array([]),
  });

  get answers(): FormArray {
    return this.quizForm.get('answers') as FormArray;
  }

  ngOnInit(): void {
    this.questions.forEach(() => {
      this.answers.push(new FormControl('', Validators.required));
    });
  }

  onSubmit(): void {
    if (this.quizForm.invalid) {
      return;
    }
    
    let score = 0;
    const userAnswers = this.quizForm.value.answers as string[];
    this.questions.forEach((q, index) => {
      if (q.answer === userAnswers[index]) {
        score++;
      }
    });

    this.quizSubmitted.emit({ score, total: this.questions.length });
  }
}
