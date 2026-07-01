import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/schema';
import { hashPassword } from '../lib/auth';
import { createError } from '../middleware/errorHandler';
import { User } from '@rd/shared';
import { requireAuth, requireRole } from '../middleware/authMiddleware';

const router = Router();

type Row = Record<string, unknown>;

function rowToUser(row: Row): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as User['role'],
    avatarColor: row.avatar_color as string,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

const CreateUserSchema = z.object({
  name: z.string().min(1, 'Cần nhập tên'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  role: z.enum(['admin', 'manager', 'employee']).default('employee'),
  avatarColor: z.string().default('#6366f1'),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  avatarColor: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/users — admin only
router.get('/users', requireAuth, requireRole('admin'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as Row[];
    return res.json(rows.map(rowToUser));
  } catch (err) { next(err); }
});

// GET /api/users/list — all authenticated users (for dropdowns)
router.get('/users/list', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY name ASC').all() as Row[];
    return res.json(rows.map(rowToUser));
  } catch (err) { next(err); }
});

// POST /api/users — admin only
router.post('/users', requireAuth, requireRole('admin'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message, 400));
    const data = parsed.data;

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existing) return next(createError('Email đã được sử dụng', 409));

    const id = uuidv4();
    db.prepare('INSERT INTO users (id, name, email, password_hash, role, avatar_color) VALUES (?,?,?,?,?,?)')
      .run(id, data.name, data.email, hashPassword(data.password), data.role, data.avatarColor);

    const user = rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row);
    return res.status(201).json(user);
  } catch (err) { next(err); }
});

// PUT /api/users/:id — admin only (or self for password change)
router.put('/users/:id', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUser = (req as Request & { user?: User }).user!;
    const isSelf = currentUser.id === req.params.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isAdmin && !isSelf) return next(createError('Không có quyền', 403));

    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message, 400));

    const data = parsed.data;
    // Non-admin cannot change role or isActive
    if (!isAdmin && (data.role !== undefined || data.isActive !== undefined)) {
      return next(createError('Không có quyền thay đổi vai trò hoặc trạng thái', 403));
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.email !== undefined) { sets.push('email = ?'); params.push(data.email); }
    if (data.password !== undefined) { sets.push('password_hash = ?'); params.push(hashPassword(data.password)); }
    if (data.role !== undefined) { sets.push('role = ?'); params.push(data.role); }
    if (data.avatarColor !== undefined) { sets.push('avatar_color = ?'); params.push(data.avatarColor); }
    if (data.isActive !== undefined) { sets.push('is_active = ?'); params.push(data.isActive ? 1 : 0); }

    if (sets.length > 0) {
      params.push(req.params.id);
      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Row | undefined;
    if (!user) return next(createError('Không tìm thấy người dùng', 404));
    return res.json(rowToUser(user));
  } catch (err) { next(err); }
});

// DELETE /api/users/:id — admin only, cannot delete self
router.delete('/users/:id', requireAuth, requireRole('admin'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUser = (req as Request & { user?: User }).user!;
    if (currentUser.id === req.params.id) return next(createError('Không thể xóa chính mình', 400));
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
    return res.json({ message: 'Đã vô hiệu hóa tài khoản' });
  } catch (err) { next(err); }
});

export default router;
