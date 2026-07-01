import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.statusCode ?? 500;
  console.error(`[Error] ${status}:`, err.message);
  res.status(status).json({
    error: err.message ?? 'Lỗi máy chủ nội bộ',
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Không tìm thấy endpoint' });
}

export function createError(message: string, statusCode = 400): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  return err;
}
