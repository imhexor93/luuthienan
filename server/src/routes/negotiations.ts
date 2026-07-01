import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getNegotiationsByEngagement,
  getNegotiationById,
  createNegotiationLog,
  updateNegotiationLog,
  deleteNegotiationLog,
  addNegotiationUpdate,
  addNegotiationAttachment,
  removeNegotiationAttachment,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

// -------------------------
// Multer for negotiation file uploads
// -------------------------
const UPLOAD_DIR = path.join(__dirname, '../../../data/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Định dạng file không được hỗ trợ'));
    }
  },
});

// -------------------------
// Zod Schemas
// -------------------------
const CreateNegotiationSchema = z.object({
  quoteId: z.string().nullable().optional().default(null),
  loggedBy: z.string().optional().default(''),
  type: z.enum(['price-negotiation', 'terms-negotiation', 'spec-clarification', 'timeline-negotiation', 'other']).optional().default('other'),
  subject: z.string().optional().default(''),
  ourPosition: z.string().optional().default(''),
  theirPosition: z.string().optional().default(''),
  outcome: z.string().optional().default(''),
  nextSteps: z.string().optional().default(''),
  // v2 fields
  assignedTo: z.string().optional().default(''),
  status: z.enum(['open', 'in-progress', 'closed-win', 'closed-loss', 'on-hold']).optional().default('open'),
  targetObjective: z.string().optional().default(''),
  deadline: z.string().nullable().optional().default(null),
});

const UpdateNegotiationSchema = CreateNegotiationSchema.partial();

const AddUpdateSchema = z.object({
  updatedBy: z.string().min(1, 'Cần điền tên người cập nhật'),
  factoryResponseAt: z.string().nullable().optional().default(null),
  ourPosition: z.string().optional().default(''),
  theirPosition: z.string().optional().default(''),
  outcome: z.string().optional().default(''),
  nextSteps: z.string().optional().default(''),
});

// -------------------------
// Routes
// -------------------------

// GET /api/engagements/:engagementId/negotiations
router.get('/engagements/:engagementId/negotiations', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getNegotiationsByEngagement(req.params.engagementId));
  } catch (err) {
    next(err);
  }
});

// POST /api/engagements/:engagementId/negotiations
router.post('/engagements/:engagementId/negotiations', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateNegotiationSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const log = createNegotiationLog({
      id: uuidv4(),
      engagementId: req.params.engagementId,
      quoteId: data.quoteId ?? null,
      loggedBy: data.loggedBy,
      type: data.type,
      subject: data.subject,
      ourPosition: data.ourPosition,
      theirPosition: data.theirPosition,
      outcome: data.outcome,
      nextSteps: data.nextSteps,
      assignedTo: data.assignedTo,
      status: data.status,
      targetObjective: data.targetObjective,
      deadline: data.deadline,
    });

    return res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

// PUT /api/negotiations/:id
router.put('/negotiations/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getNegotiationById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy yêu cầu đàm phán', 404));

    const parsed = UpdateNegotiationSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateNegotiationLog(req.params.id, {
      quoteId: data.quoteId,
      loggedBy: data.loggedBy,
      type: data.type,
      subject: data.subject,
      ourPosition: data.ourPosition,
      theirPosition: data.theirPosition,
      outcome: data.outcome,
      nextSteps: data.nextSteps,
      assignedTo: data.assignedTo,
      status: data.status,
      targetObjective: data.targetObjective,
      deadline: data.deadline,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/negotiations/:id
router.delete('/negotiations/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getNegotiationById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy yêu cầu đàm phán', 404));
    deleteNegotiationLog(req.params.id);
    return res.json({ message: 'Đã xóa yêu cầu đàm phán' });
  } catch (err) {
    next(err);
  }
});

// POST /api/negotiations/:id/updates
router.post('/negotiations/:id/updates', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getNegotiationById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy yêu cầu đàm phán', 404));

    const parsed = AddUpdateSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = addNegotiationUpdate(req.params.id, {
      id: uuidv4(),
      date: new Date().toISOString(),
      factoryResponseAt: data.factoryResponseAt ?? null,
      updatedBy: data.updatedBy,
      ourPosition: data.ourPosition,
      theirPosition: data.theirPosition,
      outcome: data.outcome,
      nextSteps: data.nextSteps,
      attachments: [],
    });

    return res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/negotiations/:id/updates/:updateId/attachments
router.post(
  '/negotiations/:id/updates/:updateId/attachments',
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return next(createError('Không có file được upload'));

      const existing = getNegotiationById(req.params.id);
      if (!existing) {
        fs.unlinkSync(req.file.path);
        return next(createError('Không tìm thấy yêu cầu đàm phán', 404));
      }

      const attachment = {
        id: uuidv4(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: (req.body.uploadedBy as string) || 'Ẩn danh',
      };

      const updated = addNegotiationAttachment(req.params.id, req.params.updateId, attachment);
      if (!updated) {
        fs.unlinkSync(req.file.path);
        return next(createError('Không tìm thấy cập nhật đàm phán', 404));
      }

      return res.status(201).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/negotiations/:id/updates/:updateId/attachments/:attachmentId
router.delete(
  '/negotiations/:id/updates/:updateId/attachments/:attachmentId',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { log, filename } = removeNegotiationAttachment(
        req.params.id,
        req.params.updateId,
        req.params.attachmentId
      );

      if (!log) return next(createError('Không tìm thấy', 404));

      if (filename) {
        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      return res.json(log);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
