import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDocumentsByProject, createDocument, deleteDocument, logActivity } from '../db/helpers';
import { createError } from '../middleware/errorHandler';
import { db } from '../db/schema';

const router = Router();

const DocumentSchema = z.object({
  stageId: z.string().nullable().optional(),
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  type: z.enum(['market-research', 'technical-spec', 'design', 'test-report', 'business-case', 'other']),
  url: z.string().url('URL không hợp lệ'),
  uploadedBy: z.string().optional().default(''),
});

// GET /api/projects/:projectId/documents
router.get('/projects/:projectId/documents', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getDocumentsByProject(req.params.projectId));
  } catch (err) { next(err); }
});

// POST /api/projects/:projectId/documents
router.post('/projects/:projectId/documents', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = DocumentSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const id = uuidv4();
    const doc = createDocument({
      id, projectId: req.params.projectId,
      stageId: data.stageId ?? null,
      title: data.title, type: data.type,
      url: data.url, uploadedBy: data.uploadedBy,
    });

    logActivity(req.params.projectId, `Thêm tài liệu "${doc.title}"`, 'document', id);
    return res.status(201).json(doc);
  } catch (err) { next(err); }
});

// DELETE /api/documents/:id
router.delete('/documents/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return next(createError('Không tìm thấy tài liệu', 404));

    deleteDocument(req.params.id);
    logActivity(row.project_id as string, `Xóa tài liệu "${row.title}"`, 'document', req.params.id);
    return res.json({ message: 'Đã xóa tài liệu thành công' });
  } catch (err) { next(err); }
});

export default router;
