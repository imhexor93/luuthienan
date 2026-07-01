import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createSession, deleteSession, getUserByEmail, validateSession, verifyPassword } from '../lib/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

const LoginSchema = z.object({
  email: z.string().min(1, 'Cần nhập email'),
  password: z.string().min(1, 'Cần nhập mật khẩu'),
});

// POST /api/auth/login
router.post('/auth/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message, 400));

    const { email, password } = parsed.data;
    const user = getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return next(createError('Email hoặc mật khẩu không đúng', 401));
    }

    const token = createSession(user.id);
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/auth/logout', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) deleteSession(token);
  return res.json({ message: 'Đã đăng xuất' });
});

// GET /api/auth/me
router.get('/auth/me', (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return next(createError('Chưa đăng nhập', 401));
    const user = validateSession(token);
    if (!user) return next(createError('Phiên đăng nhập hết hạn', 401));
    return res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
