import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getRisksByProject, createRisk, updateRisk, deleteRisk, logActivity } from '../db/helpers';
import { createError } from '../middleware/errorHandler';
import { db } from '../db/schema';

const router = Router();

const RiskSchema = z.object({
  stageId: z.string().nullable().optional(),
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  description: z.string().optional().default(''),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  likelihood: z.enum(['rare', 'possible', 'likely', 'certain']),
  mitigation: z.string().optional().default(''),
  status: z.enum(['open', 'monitoring', 'mitigated', 'occurred']).optional().default('open'),
});

// GET /api/projects/:projectId/risks
router.get('/projects/:projectId/risks', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getRisksByProject(req.params.projectId));
  } catch (err) { next(err); }
});

// POST /api/projects/:projectId/risks
router.post('/projects/:projectId/risks', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RiskSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const id = uuidv4();
    const risk = createRisk({
      id, projectId: req.params.projectId,
      stageId: data.stageId ?? null,
      title: data.title, description: data.description,
      severity: data.severity, likelihood: data.likelihood,
      mitigation: data.mitigation, status: data.status,
    });

    logActivity(req.params.projectId, `Thêm rủi ro "${risk.title}"`, 'risk', id);
    return res.status(201).json(risk);
  } catch (err) { next(err); }
});

// PUT /api/risks/:id
router.put('/risks/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
    if (!existing) return next(createError('Không tìm thấy rủi ro', 404));

    const parsed = RiskSchema.partial().safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const updated = updateRisk(req.params.id, parsed.data);
    if (!updated) return next(createError('Không có dữ liệu để cập nhật'));

    logActivity(updated.projectId, `Cập nhật rủi ro "${updated.title}"`, 'risk', updated.id);
    return res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/risks/:id
router.delete('/risks/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return next(createError('Không tìm thấy rủi ro', 404));

    deleteRisk(req.params.id);
    logActivity(row.project_id as string, `Xóa rủi ro "${row.title}"`, 'risk', req.params.id);
    return res.json({ message: 'Đã xóa rủi ro thành công' });
  } catch (err) { next(err); }
});

export default router;
