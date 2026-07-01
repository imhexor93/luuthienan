import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getCommunicationsByEngagement,
  getCommunicationById,
  createCommunication,
  updateCommunication,
  deleteCommunication,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

// -------------------------
// Zod Schemas
// -------------------------
const ActionItemSchema = z.object({
  who: z.string(),
  what: z.string(),
  due: z.string().nullable().optional().default(null),
  done: z.boolean().optional().default(false),
});

const CreateCommunicationSchema = z.object({
  contactId: z.string().nullable().optional().default(null),
  channel: z.enum(['email', 'phone-call', 'zalo', 'wechat', 'wechat-video', 'in-person-visit', 'other']).optional().default('other'),
  direction: z.enum(['outgoing', 'incoming']).optional().default('outgoing'),
  loggedBy: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  summary: z.string().optional().default(''),
  actionItems: z.array(ActionItemSchema).optional().default([]),
});

const UpdateCommunicationSchema = CreateCommunicationSchema.partial();

// -------------------------
// Routes
// -------------------------

// GET /api/engagements/:engagementId/communications
router.get('/engagements/:engagementId/communications', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getCommunicationsByEngagement(req.params.engagementId));
  } catch (err) {
    next(err);
  }
});

// POST /api/engagements/:engagementId/communications
router.post('/engagements/:engagementId/communications', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateCommunicationSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const comm = createCommunication({
      id: uuidv4(),
      engagementId: req.params.engagementId,
      contactId: data.contactId ?? null,
      channel: data.channel,
      direction: data.direction,
      loggedBy: data.loggedBy,
      subject: data.subject,
      summary: data.summary,
      actionItems: data.actionItems.map((item) => ({
        who: item.who,
        what: item.what,
        due: item.due ?? null,
        done: item.done,
      })),
    });

    return res.status(201).json(comm);
  } catch (err) {
    next(err);
  }
});

// PUT /api/communications/:id
router.put('/communications/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getCommunicationById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy giao tiếp', 404));

    const parsed = UpdateCommunicationSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateCommunication(req.params.id, {
      contactId: data.contactId,
      channel: data.channel,
      direction: data.direction,
      loggedBy: data.loggedBy,
      subject: data.subject,
      summary: data.summary,
      actionItems: data.actionItems?.map((item) => ({
        who: item.who,
        what: item.what,
        due: item.due ?? null,
        done: item.done,
      })),
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/communications/:id
router.delete('/communications/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getCommunicationById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy giao tiếp', 404));

    deleteCommunication(req.params.id);
    return res.json({ message: 'Đã xóa giao tiếp thành công' });
  } catch (err) {
    next(err);
  }
});

export default router;
