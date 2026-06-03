import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GeneratedPaper } from '../models/GeneratedPaper';
import { generatePDF } from '../services/pdfService';

const router = Router();

// ─── GET /api/papers/:id/download ────────────────────────────────────────────
// Download the generated paper as a PDF

router.get(
  '/:id/download',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paperId = req.params.id;

      const paper = await GeneratedPaper.findOne({ id: paperId }).lean();

      if (!paper) {
        res.status(404).json({
          status: 'error',
          message: 'Paper not found',
        });
        return;
      }

      // Build the paper data matching the GeneratedPaper type
      const paperData = {
        id: paper.id,
        assignmentId: paper.assignmentId,
        schoolName: paper.schoolName,
        subject: paper.subject,
        grade: paper.grade,
        duration: paper.duration,
        totalMarks: paper.totalMarks,
        sections: paper.sections,
        createdAt: paper.createdAt,
      };

      const pdfBuffer = await generatePDF(paperData);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=paper-${paperId}.pdf`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
