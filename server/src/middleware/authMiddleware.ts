import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../lib/auth';
import { User, UserRole } from '@rd/shared';
import { createError } from './errorHandler';

// Extend Request type to carry user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(createError('Chưa đăng nhập', 401));

  const user = validateSession(token);
  if (!user) return next(createError('Phiên đăng nhập hết hạn hoặc không hợp lệ', 401));

  req.user = user;
  next();
}

const ROLE_LEVEL: Record<UserRole, number> = { employee: 1, manager: 2, admin: 3 };

export function requireRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(createError('Chưa đăng nhập', 401));
    if (ROLE_LEVEL[req.user.role] < ROLE_LEVEL[minRole]) {
      return next(createError('Không có quyền thực hiện thao tác này', 403));
    }
    next();
  };
}
