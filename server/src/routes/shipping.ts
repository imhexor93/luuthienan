import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getShippingLegsByEngagement, createShippingLeg, updateShippingLeg, deleteShippingLeg } from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

const LegSchema = z.object({
  productionExecutionId: z.string().nullable().optional(),
  legType: z.enum(['factory-to-port-china', 'china-to-vietnam-sea', 'china-to-vietnam-air', 'vietnam-port-to-warehouse', 'custom']).optional().default('custom'),
  origin: z.string().optional().default(''),
  destination: z.string().optional().default(''),
  plannedStartDate: z.string().nullable().optional(),
  plannedEndDate: z.string().nullable().optional(),
  actualStartDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
  mode: z.enum(['sea', 'air', 'road', 'rail']).optional().default('sea'),
  cost: z.number().optional().default(0),
  costCurrency: z.enum(['VND', 'USD', 'CNY']).optional().default('USD'),
  trackingNumber: z.string().optional().default(''),
  carrier: z.string().optional().default(''),
  status: z.enum(['not-booked', 'booked', 'in-transit', 'customs-clearance', 'delivered', 'delayed']).optional().default('not-booked'),
  notes: z.string().optional().default(''),
  order: z.number().int().optional().default(1),
});

// GET /api/engagements/:engagementId/shipping
router.get('/engagements/:engagementId/shipping', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getShippingLegsByEngagement(req.params.engagementId));
  } catch (err) { next(err); }
});

// POST /api/engagements/:engagementId/shipping
router.post('/engagements/:engagementId/shipping', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = LegSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const data = parsed.data;
    const leg = createShippingLeg({
      id: uuidv4(), engagementId: req.params.engagementId,
      productionExecutionId: data.productionExecutionId ?? null,
      legType: data.legType, origin: data.origin, destination: data.destination,
      plannedStartDate: data.plannedStartDate ?? null, plannedEndDate: data.plannedEndDate ?? null,
      actualStartDate: data.actualStartDate ?? null, actualEndDate: data.actualEndDate ?? null,
      mode: data.mode, cost: data.cost, costCurrency: data.costCurrency,
      trackingNumber: data.trackingNumber, carrier: data.carrier,
      status: data.status, notes: data.notes, order: data.order,
    });
    return res.status(201).json(leg);
  } catch (err) { next(err); }
});

// PUT /api/shipping-legs/:id
router.put('/shipping-legs/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = LegSchema.partial().safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const updated = updateShippingLeg(req.params.id, parsed.data as Parameters<typeof updateShippingLeg>[1]);
    if (!updated) return next(createError('Không tìm thấy chặng vận chuyển', 404));
    return res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/shipping-legs/:id
router.delete('/shipping-legs/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    deleteShippingLeg(req.params.id);
    return res.json({ message: 'Đã xóa' });
  } catch (err) { next(err); }
});

export default router;
