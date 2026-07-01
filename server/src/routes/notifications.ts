import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getNotifications, getUnreadNotificationCount, markNotificationsRead } from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

const UserIdSchema = z.object({ userId: z.string().min(1, 'userId không được để trống') });

// GET /api/notifications?userId=xxx
router.get('/notifications', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UserIdSchema.safeParse(req.query);
    if (!parsed.success) return next(createError('userId không hợp lệ', 400));
    return res.json(getNotifications(parsed.data.userId));
  } catch (err) { next(err); }
});

// GET /api/notifications/unread-count?userId=xxx
router.get('/notifications/unread-count', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UserIdSchema.safeParse(req.query);
    if (!parsed.success) return res.json({ count: 0 });
    return res.json({ count: getUnreadNotificationCount(parsed.data.userId) });
  } catch (err) { next(err); }
});

// PUT /api/notifications/read-all?userId=xxx
router.put('/notifications/read-all', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UserIdSchema.safeParse(req.query);
    if (!parsed.success) return next(createError('userId không hợp lệ', 400));
    markNotificationsRead(parsed.data.userId);
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
