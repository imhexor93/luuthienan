import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getProductionsByEngagement, getProductionById,
  createProductionExecution, updateProductionExecution,
  createProductionPhase, updateProductionPhase, deleteProductionPhase,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

const CreateExecutionSchema = z.object({
  quoteId: z.string(),
  productionOrderNumber: z.string().optional().default(''),
  orderConfirmedAt: z.string().optional(),
  depositPaidAt: z.string().nullable().optional(),
  status: z.enum(['not-started', 'in-progress', 'delayed', 'completed', 'on-hold']).optional().default('not-started'),
  overallNotes: z.string().optional().default(''),
});

const UpdateExecutionSchema = CreateExecutionSchema.partial().omit({ quoteId: true });

const PhaseSchema = z.object({
  phaseType: z.enum(['bottle-production', 'packaging-production', 'material-production', 'filling', 'shipping-internal', 'other']).optional().default('other'),
  phaseName: z.string().min(1),
  plannedStartDate: z.string().nullable().optional(),
  plannedEndDate: z.string().nullable().optional(),
  actualStartDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
  status: z.enum(['not-started', 'in-progress', 'completed', 'delayed', 'blocked']).optional().default('not-started'),
  delayReason: z.string().nullable().optional(),
  dependsOn: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(''),
  order: z.number().int().optional().default(1),
});

// GET /api/engagements/:engagementId/production
router.get('/engagements/:engagementId/production', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getProductionsByEngagement(req.params.engagementId));
  } catch (err) { next(err); }
});

// POST /api/engagements/:engagementId/production
router.post('/engagements/:engagementId/production', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateExecutionSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const data = parsed.data;
    const exec = createProductionExecution({
      id: uuidv4(), engagementId: req.params.engagementId,
      quoteId: data.quoteId, productionOrderNumber: data.productionOrderNumber,
      orderConfirmedAt: data.orderConfirmedAt, depositPaidAt: data.depositPaidAt ?? null,
      status: data.status, overallNotes: data.overallNotes,
    });
    return res.status(201).json(exec);
  } catch (err) { next(err); }
});

// GET /api/production/:id
router.get('/production/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const exec = getProductionById(req.params.id);
    if (!exec) return next(createError('Không tìm thấy production execution', 404));
    return res.json(exec);
  } catch (err) { next(err); }
});

// PUT /api/production/:id
router.put('/production/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateExecutionSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const updated = updateProductionExecution(req.params.id, parsed.data);
    if (!updated) return next(createError('Không tìm thấy production execution', 404));
    return res.json(updated);
  } catch (err) { next(err); }
});

// POST /api/production/:executionId/phases
router.post('/production/:executionId/phases', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = PhaseSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const data = parsed.data;
    const phase = createProductionPhase({
      id: uuidv4(), productionExecutionId: req.params.executionId,
      phaseType: data.phaseType, phaseName: data.phaseName,
      plannedStartDate: data.plannedStartDate ?? null, plannedEndDate: data.plannedEndDate ?? null,
      actualStartDate: data.actualStartDate ?? null, actualEndDate: data.actualEndDate ?? null,
      status: data.status, delayReason: data.delayReason ?? null,
      dependsOn: data.dependsOn, notes: data.notes, order: data.order,
    });
    return res.status(201).json(phase);
  } catch (err) { next(err); }
});

// PUT /api/production-phases/:id
router.put('/production-phases/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = PhaseSchema.partial().safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const updated = updateProductionPhase(req.params.id, parsed.data);
    if (!updated) return next(createError('Không tìm thấy phase', 404));
    return res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/production-phases/:id
router.delete('/production-phases/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    deleteProductionPhase(req.params.id);
    return res.json({ message: 'Đã xóa phase' });
  } catch (err) { next(err); }
});

export default router;
