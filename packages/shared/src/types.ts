// ─── Enums & Literal Types ───────────────────────────────────────────────────

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type QuestionType = 'mcq' | 'short_answer' | 'long_answer' | 'true_false';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ─── Data Transfer Objects ───────────────────────────────────────────────────

export interface QuestionConfig {
  type: QuestionType;
  count: number;
  marksPerQuestion: number;
  difficulty: DifficultyLevel;
}

export interface AssignmentInput {
  title: string;
  subject: string;
  grade: string;
  schoolName: string;
  dueDate: string;
  totalMarks: number;
  duration: number; // minutes
  questionConfigs: QuestionConfig[];
  additionalInstructions?: string;
  uploadedFileContent?: string;
}

// ─── Generated Paper Types ───────────────────────────────────────────────────

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  marks: number;
  options?: string[]; // MCQ only — 4 options
  answerKey: string;
}

export interface Section {
  id: string;
  title: string; // "Section A", "Section B", etc.
  instruction: string;
  questionType: QuestionType;
  questions: Question[];
  totalMarks: number;
}

export interface GeneratedPaper {
  id: string;
  assignmentId: string;
  schoolName: string;
  subject: string;
  grade: string;
  duration: number;
  totalMarks: number;
  sections: Section[];
  createdAt: string;
}

// ─── Assignment ──────────────────────────────────────────────────────────────

export interface Assignment {
  id: string;
  input: AssignmentInput;
  status: JobStatus;
  jobId?: string;
  result?: GeneratedPaper;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── WebSocket Messages ──────────────────────────────────────────────────────

export type WSMessage =
  | { type: 'JOB_STARTED'; assignmentId: string; message: string }
  | { type: 'JOB_PROGRESS'; assignmentId: string; progress: number; message: string }
  | { type: 'JOB_COMPLETED'; assignmentId: string; paper: GeneratedPaper }
  | { type: 'JOB_FAILED'; assignmentId: string; error: string };
