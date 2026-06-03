import { z } from 'zod';

// ─── Literal Schemas ─────────────────────────────────────────────────────────

export const difficultyLevelSchema = z.enum(['easy', 'medium', 'hard']);

export const questionTypeSchema = z.enum(['mcq', 'short_answer', 'long_answer', 'true_false']);

export const jobStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

// ─── Question Config Schema ─────────────────────────────────────────────────

export const questionConfigSchema = z.object({
  type: questionTypeSchema,
  count: z.number().int().positive('Count must be at least 1'),
  marksPerQuestion: z.number().int().positive('Marks must be at least 1'),
  difficulty: difficultyLevelSchema,
});

// ─── Assignment Input Schema ─────────────────────────────────────────────────

export const assignmentInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  subject: z.string().min(1, 'Subject is required').max(100),
  grade: z.string().min(1, 'Grade is required').max(20),
  schoolName: z.string().min(1, 'School name is required').max(200),
  dueDate: z.string().min(1, 'Due date is required'),
  totalMarks: z.number().int().positive('Total marks must be positive'),
  duration: z.number().int().positive('Duration must be positive'),
  questionConfigs: z
    .array(questionConfigSchema)
    .min(1, 'At least one question configuration is required'),
  additionalInstructions: z.string().max(2000).optional(),
  uploadedFileContent: z.string().optional(),
});

// ─── Question Schema ─────────────────────────────────────────────────────────

export const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  type: questionTypeSchema,
  difficulty: difficultyLevelSchema,
  marks: z.number().int().positive(),
  options: z.array(z.string()).length(4).optional(),
  answerKey: z.string().min(1),
});

// ─── Section Schema ──────────────────────────────────────────────────────────

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string().min(1),
  questionType: questionTypeSchema,
  questions: z.array(questionSchema).min(1),
  totalMarks: z.number().int().positive(),
});

// ─── Generated Paper Schema ──────────────────────────────────────────────────

export const generatedPaperSchema = z.object({
  id: z.string().min(1),
  assignmentId: z.string().min(1),
  schoolName: z.string().min(1),
  subject: z.string().min(1),
  grade: z.string().min(1),
  duration: z.number().int().positive(),
  totalMarks: z.number().int().positive(),
  sections: z.array(sectionSchema).min(1),
  createdAt: z.string().min(1),
});

// ─── WebSocket Message Schemas ───────────────────────────────────────────────

export const wsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('JOB_STARTED'),
    assignmentId: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('JOB_PROGRESS'),
    assignmentId: z.string(),
    progress: z.number().min(0).max(100),
    message: z.string(),
  }),
  z.object({
    type: z.literal('JOB_COMPLETED'),
    assignmentId: z.string(),
    paper: generatedPaperSchema,
  }),
  z.object({
    type: z.literal('JOB_FAILED'),
    assignmentId: z.string(),
    error: z.string(),
  }),
]);
