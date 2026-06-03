import mongoose, { Schema, type Document } from 'mongoose';
import type {
  AssignmentInput,
  GeneratedPaper,
  JobStatus,
} from '@vedaai/shared';

// ─── TypeScript Interface ────────────────────────────────────────────────────

export interface AssignmentDocument extends Document {
  input: AssignmentInput;
  status: JobStatus;
  jobId?: string;
  result?: GeneratedPaper;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const questionConfigSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'true_false'],
      required: true,
    },
    count: { type: Number, required: true, min: 1 },
    marksPerQuestion: { type: Number, required: true, min: 1 },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
  },
  { _id: false },
);

const assignmentInputSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    subject: { type: String, required: true, maxlength: 100 },
    grade: { type: String, required: true, maxlength: 20 },
    schoolName: { type: String, required: true, maxlength: 200 },
    dueDate: { type: String, required: true },
    totalMarks: { type: Number, required: true, min: 1 },
    duration: { type: Number, required: true, min: 1 },
    questionConfigs: {
      type: [questionConfigSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => v.length >= 1,
        message: 'At least one question configuration is required',
      },
    },
    additionalInstructions: { type: String, maxlength: 2000 },
    uploadedFileContent: { type: String },
  },
  { _id: false },
);

// Embedded question sub-schema for result
const questionSubSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'true_false'],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    marks: { type: Number, required: true },
    options: { type: [String] },
    answerKey: { type: String, required: true },
  },
  { _id: false },
);

const sectionSubSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    instruction: { type: String, required: true },
    questionType: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'true_false'],
      required: true,
    },
    questions: { type: [questionSubSchema], required: true },
    totalMarks: { type: Number, required: true },
  },
  { _id: false },
);

const generatedPaperSubSchema = new Schema(
  {
    id: { type: String, required: true },
    assignmentId: { type: String, required: true },
    schoolName: { type: String, required: true },
    subject: { type: String, required: true },
    grade: { type: String, required: true },
    duration: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    sections: { type: [sectionSubSchema], required: true },
    createdAt: { type: String, required: true },
  },
  { _id: false },
);

// ─── Main Schema ─────────────────────────────────────────────────────────────

const assignmentSchema = new Schema<AssignmentDocument>(
  {
    input: { type: assignmentInputSchema, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      required: true,
    },
    jobId: { type: String },
    result: { type: generatedPaperSubSchema },
    error: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        const r = ret as any;
        r.id = r._id.toString();
        delete r._id;
        delete r.__v;
        return r;
      },
    },
  },
);

export const Assignment = mongoose.model<AssignmentDocument>(
  'Assignment',
  assignmentSchema,
);
