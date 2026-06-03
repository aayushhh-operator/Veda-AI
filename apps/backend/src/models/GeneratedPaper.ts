import mongoose, { Schema, type Document } from 'mongoose';
import type { GeneratedPaper as GeneratedPaperType } from '@vedaai/shared';

// ─── TypeScript Interface ────────────────────────────────────────────────────

export interface GeneratedPaperDocument
  extends Omit<GeneratedPaperType, 'id'>,
    Document {
  createdAt: string;
}

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const questionSchema = new Schema(
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
    marks: { type: Number, required: true, min: 1 },
    options: { type: [String] },
    answerKey: { type: String, required: true },
  },
  { _id: false },
);

const sectionSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    instruction: { type: String, required: true },
    questionType: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'true_false'],
      required: true,
    },
    questions: {
      type: [questionSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => v.length >= 1,
        message: 'At least one question is required per section',
      },
    },
    totalMarks: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

// ─── Main Schema ─────────────────────────────────────────────────────────────

const generatedPaperSchema = new Schema<GeneratedPaperDocument>(
  {
    id: { type: String, required: true, unique: true },
    assignmentId: { type: String, required: true, index: true },
    schoolName: { type: String, required: true },
    subject: { type: String, required: true },
    grade: { type: String, required: true },
    duration: { type: Number, required: true, min: 1 },
    totalMarks: { type: Number, required: true, min: 1 },
    sections: {
      type: [sectionSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => v.length >= 1,
        message: 'At least one section is required',
      },
    },
    createdAt: { type: String, required: true },
  },
  {
    toJSON: {
      transform(_doc, ret) {
        const r = ret as any;
        delete r._id;
        delete r.__v;
        return r;
      },
    },
  },
);

// Index our custom id for fast lookups
generatedPaperSchema.index({ id: 1 }, { unique: true });

export const GeneratedPaper = mongoose.model<GeneratedPaperDocument>(
  'GeneratedPaper',
  generatedPaperSchema,
);
