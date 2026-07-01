import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getEngagementsByProject,
  getEngagementById,
  createEngagement,
  updateEngagement,
  deleteEngagement,
  logActivity,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

// -------------------------
// Zod Schemas
// -------------------------
const CreateEngagementSchema = z.object({
  factoryId: z.string().min(1, 'factoryId không được để trống'),
  scope: z.enum(['formula', 'packaging', 'filling', 'labeling', 'full-production', 'testing', 'other']).optional().default('other'),
  scopeDescription: z.string().optional().default(''),
  status: z.enum(['sourcing', 'quoting', 'negotiating', 'sampling', 'approved', 'in-production', 'completed', 'cancelled']).optional().default('sourcing'),
  primaryContactId: z.string().nullable().optional().default(null),
  internalOwner: z.string().optional().default(''),
  startDate: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  targetCompletionDate: z.string().nullable().optional().default(null),
  finalUnitPrice: z.number().nullable().optional().default(null),
  finalMOQ: z.number().nullable().optional().default(null),
  currency: z.enum(['VND', 'USD', 'CNY']).optional().default('VND'),
  linkedStageId: z.string().nullable().optional().default(null),
});

const UpdateEngagementSchema = CreateEngagementSchema.partial();

// -------------------------
// Routes
// -------------------------

// GET /api/projects/:projectId/engagements
router.get('/projects/:projectId/engagements', (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagements = getEngagementsByProject(req.params.projectId);
    return res.json(engagements);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/engagements
router.post('/projects/:projectId/engagements', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateEngagementSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const id = uuidv4();
    const engagement = createEngagement({
      id,
      projectId: req.params.projectId,
      factoryId: data.factoryId,
      scope: data.scope,
      scopeDescription: data.scopeDescription,
      status: data.status,
      primaryContactId: data.primaryContactId ?? null,
      internalOwner: data.internalOwner,
      startDate: data.startDate,
      targetCompletionDate: data.targetCompletionDate ?? null,
      finalUnitPrice: data.finalUnitPrice ?? null,
      finalMOQ: data.finalMOQ ?? null,
      currency: data.currency,
      linkedStageId: data.linkedStageId ?? null,
    });

    logActivity(req.params.projectId, `Tạo engagement với nhà máy "${engagement.factoryName}"`, 'engagement', id, 'System');

    return res.status(201).json(engagement);
  } catch (err) {
    next(err);
  }
});

// GET /api/engagements/:id
router.get('/engagements/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagement = getEngagementById(req.params.id);
    if (!engagement) return next(createError('Không tìm thấy engagement', 404));
    return res.json(engagement);
  } catch (err) {
    next(err);
  }
});

// PUT /api/engagements/:id
router.put('/engagements/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getEngagementById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy engagement', 404));

    const parsed = UpdateEngagementSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateEngagement(req.params.id, {
      factoryId: data.factoryId,
      scope: data.scope,
      scopeDescription: data.scopeDescription,
      status: data.status,
      primaryContactId: data.primaryContactId,
      internalOwner: data.internalOwner,
      startDate: data.startDate,
      targetCompletionDate: data.targetCompletionDate,
      finalUnitPrice: data.finalUnitPrice,
      finalMOQ: data.finalMOQ,
      currency: data.currency,
      linkedStageId: data.linkedStageId,
    });

    if (!updated) return next(createError('Không có dữ liệu để cập nhật'));

    logActivity(existing.projectId, `Cập nhật engagement với nhà máy "${updated.factoryName}"`, 'engagement', req.params.id, 'System');

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/engagements/:id
router.delete('/engagements/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getEngagementById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy engagement', 404));

    deleteEngagement(req.params.id);
    logActivity(existing.projectId, `Xóa engagement với nhà máy "${existing.factoryName}"`, 'engagement', req.params.id, 'System');

    return res.json({ message: 'Đã xóa engagement thành công' });
  } catch (err) {
    next(err);
  }
});

export default router;
