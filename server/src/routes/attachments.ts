import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/schema';
import { createAttachment, getAttachmentsByTask, getAttachmentById, deleteAttachment, getLinksByTask, createLink, deleteLink } from '../db/helpers';
import { createError } from '../middleware/errorHandler';

function detectLinkType(url: string): string {
  if (/docs\.google\.com\/spreadsheets/.test(url)) return 'google-sheet';
  if (/docs\.google\.com\/document/.test(url)) return 'google-doc';
  if (/docs\.google\.com\/presentation/.test(url)) return 'google-slides';
  if (/drive\.google\.com/.test(url)) return 'google-drive';
  if (/notion\.so|notion\.site/.test(url)) return 'notion';
  if (/figma\.com/.test(url)) return 'figma';
  if (/atlassian\.net|confluence/.test(url)) return 'confluence';
  if (/jira/.test(url)) return 'jira';
  if (/github\.com/.test(url)) return 'github';
  if (/gitlab\.com/.test(url)) return 'gitlab';
  if (/trello\.com/.test(url)) return 'trello';
  if (/miro\.com/.test(url)) return 'miro';
  return 'other';
}

const CreateLinkSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  url: z.string().url('URL không hợp lệ'),
  addedBy: z.string().optional().default('Ẩn danh'),
});

const router = Router();

// Thư mục lưu file
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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/csv',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Định dạng file không được hỗ trợ'));
    }
  },
});

// GET /api/tasks/:taskId/attachments
router.get('/tasks/:taskId/attachments', (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachments = getAttachmentsByTask(req.params.taskId);
    return res.json(attachments);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:taskId/attachments
router.post('/tasks/:taskId/attachments', upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return next(createError('Không có file được upload'));

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId) as Record<string, string> | undefined;
    if (!task) {
      fs.unlinkSync(req.file.path);
      return next(createError('Không tìm thấy công việc', 404));
    }

    const attachment = createAttachment({
      id: uuidv4(),
      taskId: req.params.taskId,
      projectId: task.project_id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedBy: (req.body.uploadedBy as string) || 'Ẩn danh',
    });

    return res.status(201).json(attachment);
  } catch (err) {
    next(err);
  }
});

// GET /api/attachments/:id/download
router.get('/attachments/:id/download', (req: Request, res: Response, next: NextFunction) => {
  try {
    const att = getAttachmentById(req.params.id);
    if (!att) return next(createError('Không tìm thấy file', 404));

    const filePath = path.join(UPLOAD_DIR, att.filename);
    if (!fs.existsSync(filePath)) return next(createError('File không tồn tại trên server', 404));

    res.download(filePath, att.originalName);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/attachments/:id
router.delete('/attachments/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const att = getAttachmentById(req.params.id);
    if (!att) return next(createError('Không tìm thấy file', 404));

    const filePath = path.join(UPLOAD_DIR, att.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    deleteAttachment(req.params.id);
    return res.json({ message: 'Đã xóa file' });
  } catch (err) {
    next(err);
  }
});

// GET /api/files/:filename  — serve any uploaded file (for inline image preview)
router.get('/files/:filename', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Prevent directory traversal
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return next(createError('File không tồn tại', 404));
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:taskId/links
router.get('/tasks/:taskId/links', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getLinksByTask(req.params.taskId));
  } catch (err) { next(err); }
});

// POST /api/tasks/:taskId/links
router.post('/tasks/:taskId/links', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateLinkSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId) as Record<string, string> | undefined;
    if (!task) return next(createError('Không tìm thấy công việc', 404));

    const link = createLink({
      id: uuidv4(),
      taskId: req.params.taskId,
      projectId: task.project_id,
      title: parsed.data.title,
      url: parsed.data.url,
      linkType: detectLinkType(parsed.data.url),
      addedBy: parsed.data.addedBy,
    });
    return res.status(201).json(link);
  } catch (err) { next(err); }
});

// DELETE /api/links/:id
router.delete('/links/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    deleteLink(req.params.id);
    return res.json({ message: 'Đã xóa link' });
  } catch (err) { next(err); }
});

export default router;
