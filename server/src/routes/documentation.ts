import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getDocumentationWorkflowByEngagement,
  createDocumentationWorkflow, updateDocumentationWorkflow,
  createDocumentationStep, updateDocumentationStep, deleteDocumentationStep,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

const StepSchema = z.object({
  documentType: z.enum(['loa-china', 'cfs-china', 'product-declaration-vn', 'iso-cert', 'halal-cert', 'quality-cert', 'import-permit', 'customs-clearance', 'other']).optional().default('other'),
  documentTypeCustom: z.string().nullable().optional(),
  issuingCountry: z.enum(['china', 'vietnam', 'other']).optional().default('china'),
  estimatedMinDays: z.number().int().optional().default(0),
  estimatedMaxDays: z.number().int().optional().default(0),
  estimatedCost: z.number().optional().default(0),
  estimatedCostCurrency: z.enum(['VND', 'USD', 'CNY']).optional().default('CNY'),
  plannedStartDate: z.string().nullable().optional(),
  plannedEndDate: z.string().nullable().optional(),
  actualStartDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
  actualCost: z.number().nullable().optional(),
  status: z.enum(['not-started', 'preparing', 'submitted', 'under-review', 'approved', 'rejected', 'expired']).optional().default('not-started'),
  documentNumber: z.string().optional().default(''),
  issueDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  handlerName: z.string().optional().default(''),
  handlerContact: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  order: z.number().int().optional().default(1),
});

// GET /api/engagements/:engagementId/documentation
router.get('/engagements/:engagementId/documentation', (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflow = getDocumentationWorkflowByEngagement(req.params.engagementId);
    return res.json(workflow);
  } catch (err) { next(err); }
});

// POST /api/engagements/:engagementId/documentation  (create workflow if not exists)
router.post('/engagements/:engagementId/documentation', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getDocumentationWorkflowByEngagement(req.params.engagementId);
    if (existing) return res.json(existing);
    const workflow = createDocumentationWorkflow({ id: uuidv4(), engagementId: req.params.engagementId });
    return res.status(201).json({ ...workflow, steps: [] });
  } catch (err) { next(err); }
});

// PUT /api/documentation/:id
router.put('/documentation/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = updateDocumentationWorkflow(req.params.id, req.body);
    if (!updated) return next(createError('Không tìm thấy workflow', 404));
    return res.json(updated);
  } catch (err) { next(err); }
});

// POST /api/documentation/:workflowId/steps
router.post('/documentation/:workflowId/steps', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = StepSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const data = parsed.data;
    const step = createDocumentationStep({
      id: uuidv4(), documentationWorkflowId: req.params.workflowId,
      documentType: data.documentType, documentTypeCustom: data.documentTypeCustom ?? null,
      issuingCountry: data.issuingCountry,
      estimatedMinDays: data.estimatedMinDays, estimatedMaxDays: data.estimatedMaxDays,
      estimatedCost: data.estimatedCost, estimatedCostCurrency: data.estimatedCostCurrency,
      plannedStartDate: data.plannedStartDate ?? null, plannedEndDate: data.plannedEndDate ?? null,
      handlerName: data.handlerName, handlerContact: data.handlerContact,
      status: data.status, notes: data.notes, order: data.order,
    });
    return res.status(201).json(step);
  } catch (err) { next(err); }
});

// PUT /api/documentation-steps/:id
router.put('/documentation-steps/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = StepSchema.partial().safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const updated = updateDocumentationStep(req.params.id, parsed.data as Parameters<typeof updateDocumentationStep>[1]);
    if (!updated) return next(createError('Không tìm thấy step', 404));
    return res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/documentation-steps/:id
router.delete('/documentation-steps/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    deleteDocumentationStep(req.params.id);
    return res.json({ message: 'Đã xóa' });
  } catch (err) { next(err); }
});

export default router;
