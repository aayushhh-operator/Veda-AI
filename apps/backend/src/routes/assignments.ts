import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { assignmentInputSchema } from '@vedaai/shared';
import type { AssignmentInput } from '@vedaai/shared';
import { Assignment } from '../models/Assignment';
import { GeneratedPaper } from '../models/GeneratedPaper';
import { generatePaper } from '../services/aiService';
import { broadcast } from '../services/wsService';
import { validate } from '../middleware/validate';

const router = Router();

// ─── Background Processor ────────────────────────────────────────────────────

async function generatePaperInBackground(
  assignmentId: string,
  input: AssignmentInput,
): Promise<void> {
  try {
    // 1. Update status to processing
    await Assignment.findByIdAndUpdate(assignmentId, { status: 'processing' });
    broadcast(assignmentId, {
      type: 'JOB_STARTED',
      assignmentId,
      message: 'Starting paper generation...',
    });

    // 2. Progress update: Analyzing criteria
    broadcast(assignmentId, {
      type: 'JOB_PROGRESS',
      assignmentId,
      progress: 20,
      message: 'Analyzing assessment criteria...',
    });

    // 3. Invoke LLM generation service
    const paper = await generatePaper(input, assignmentId);

    // 4. Progress update: Formatting outputs
    broadcast(assignmentId, {
      type: 'JOB_PROGRESS',
      assignmentId,
      progress: 70,
      message: 'Structuring exam sections...',
    });

    // 5. Save generated paper representation to database
    await GeneratedPaper.create(paper);

    // 6. Update main assignment document status
    await Assignment.findByIdAndUpdate(assignmentId, {
      status: 'completed',
      result: paper,
    });

    // 7. Progress update: Finalizing stream
    broadcast(assignmentId, {
      type: 'JOB_PROGRESS',
      assignmentId,
      progress: 90,
      message: 'Finalizing exam document...',
    });

    // 8. Stream completed message with payload
    broadcast(assignmentId, {
      type: 'JOB_COMPLETED',
      assignmentId,
      paper,
    });
  } catch (error: any) {
    console.error(`[AI Engine] Generation failed for assignment ${assignmentId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update assignment status to failed
    await Assignment.findByIdAndUpdate(assignmentId, {
      status: 'failed',
      error: errorMessage,
    });

    // Broadcast failure event
    broadcast(assignmentId, {
      type: 'JOB_FAILED',
      assignmentId,
      error: errorMessage,
    });
  }
}

// ─── POST /api/assignments ───────────────────────────────────────────────────
// Create a new assignment and trigger paper generation asynchronously

router.post(
  '/',
  validate(assignmentInputSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as AssignmentInput;

      // Save assignment to DB with pending status
      const assignment = await Assignment.create({
        input,
        status: 'pending',
      });

      const assignmentId = assignment._id.toString();

      // Trigger background generation loop asynchronously
      generatePaperInBackground(assignmentId, input);

      res.status(201).json({
        assignmentId,
        message: 'Assignment created and paper generation started',
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/assignments ────────────────────────────────────────────────────
// List all assignments (lightweight for dashboard)

router.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assignments = await Assignment.find()
        .select('input.title input.subject input.grade input.dueDate status createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const result = assignments.map((a) => ({
        id: a._id.toString(),
        status: a.status,
        createdAt: a.createdAt,
        input: {
          title: a.input.title,
          subject: a.input.subject,
          grade: a.input.grade,
          dueDate: a.input.dueDate,
        },
      }));

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/assignments/:id ────────────────────────────────────────────────
// Get full assignment details

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assignment = await Assignment.findById(req.params.id).lean();

      if (!assignment) {
        res.status(404).json({
          status: 'error',
          message: 'Assignment not found',
        });
        return;
      }

      res.json({
        id: assignment._id.toString(),
        input: assignment.input,
        status: assignment.status,
        jobId: assignment.jobId,
        result: assignment.result,
        error: assignment.error,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /api/assignments/:id ─────────────────────────────────────────────
// Delete an assignment and its associated generated paper
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;

      // 1. Delete the assignment
      const assignment = await Assignment.findByIdAndDelete(id);

      if (!assignment) {
        res.status(404).json({
          status: 'error',
          message: 'Assignment not found',
        });
        return;
      }

      // 2. Delete any associated generated paper in the collection
      await GeneratedPaper.deleteMany({ assignmentId: id });

      res.json({
        status: 'success',
        message: 'Assignment and associated paper deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
