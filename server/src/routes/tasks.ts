import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getTasksByProject, createTask, updateTask, deleteTask, logActivity,
  getPendingApprovals, requestTaskApproval, processApproval, getApprovalHistory,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';
import { db } from '../db/schema';

const router = Router();

const CreateTaskSchema = z.object({
  stageId: z.string().min(1, 'stageId không được để trống'),
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  description: z.string().optional().default(''),
  owner: z.string().optional().default(''),
  assigneeId: z.string().nullable().optional(),
  assigneeName: z.string().optional().default(''),
  dueDate: z.string().nullable().optional(),
  status: z.enum(['todo', 'doing', 'done', 'blocked']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  estimatedHours: z.number().nullable().optional(),
  actualHours: z.number().nullable().optional(),
  blockerReason: z.string().nullable().optional(),
  completionReport: z.string().nullable().optional(),
  issueNotes: z.string().nullable().optional(),
  approvalRequired: z.boolean().optional().default(false),
});

const UpdateTaskSchema = CreateTaskSchema.partial();
const PatchStatusSchema = z.object({
  status: z.enum(['todo', 'doing', 'done', 'blocked']),
});
const ApprovalActionSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  approvalBy: z.string().min(1, 'Người phê duyệt không được để trống'),
  approvalNotes: z.string().optional().default(''),
});

const RequestApprovalSchema = z.object({
  targetId: z.string().nullable().optional(),
  targetName: z.string().optional().default(''),
});

// GET /api/projects/:projectId/tasks
router.get('/projects/:projectId/tasks', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stageId, status, priority, owner } = req.query as Record<string, string>;
    const tasks = getTasksByProject(req.params.projectId, { stageId, status, priority, owner });
    return res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/tasks
router.post('/projects/:projectId/tasks', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const id = uuidv4();

    const task = createTask({
      id,
      projectId: req.params.projectId,
      stageId: data.stageId,
      title: data.title,
      description: data.description,
      owner: data.owner,
      assigneeId: data.assigneeId ?? null,
      assigneeName: data.assigneeName ?? '',
      dueDate: data.dueDate ?? null,
      status: data.status,
      priority: data.priority,
      estimatedHours: data.estimatedHours ?? null,
      actualHours: data.actualHours ?? null,
      blockerReason: data.blockerReason ?? null,
      completionReport: data.completionReport ?? null,
      issueNotes: data.issueNotes ?? null,
      approvalRequired: data.approvalRequired ?? false,
    });

    logActivity(req.params.projectId, `Tạo công việc "${task.title}"`, 'task', id, 'System');

    return res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id
router.put('/tasks/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return next(createError('Không tìm thấy công việc', 404));

    const parsed = UpdateTaskSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateTask(req.params.id, {
      stageId: data.stageId,
      title: data.title,
      description: data.description,
      owner: data.owner,
      assigneeId: data.assigneeId ?? null,
      assigneeName: data.assigneeName,
      dueDate: data.dueDate ?? null,
      status: data.status,
      priority: data.priority,
      estimatedHours: data.estimatedHours ?? null,
      actualHours: data.actualHours ?? null,
      blockerReason: data.blockerReason ?? null,
      completionReport: data.completionReport ?? null,
      issueNotes: data.issueNotes ?? null,
      approvalRequired: data.approvalRequired,
    });

    if (!updated) return next(createError('Không có dữ liệu để cập nhật'));

    logActivity(updated.projectId, `Cập nhật công việc "${updated.title}"`, 'task', updated.id, 'System');

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/status (dùng khi drag-drop)
router.patch('/tasks/:id/status', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = PatchStatusSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const updated = updateTask(req.params.id, { status: parsed.data.status });
    if (!updated) return next(createError('Không tìm thấy công việc', 404));

    logActivity(
      updated.projectId,
      `Chuyển công việc "${updated.title}" sang trạng thái "${parsed.data.status}"`,
      'task',
      updated.id,
      'System'
    );

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return next(createError('Không tìm thấy công việc', 404));

    const projectId = row.project_id as string;
    const title = row.title as string;

    deleteTask(req.params.id);
    logActivity(projectId, `Xóa công việc "${title}"`, 'task', req.params.id, 'System');

    return res.json({ message: 'Đã xóa công việc thành công' });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/request-approval  — gửi yêu cầu phê duyệt
router.post('/tasks/:id/request-approval', (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return next(createError('Không tìm thấy công việc', 404));
    if (!row.approval_required) return next(createError('Công việc này không yêu cầu phê duyệt', 400));
    if (row.approval_status === 'pending') return next(createError('Đã gửi yêu cầu phê duyệt rồi', 400));

    const parsed = RequestApprovalSchema.safeParse(req.body);
    const targetId = parsed.success ? parsed.data.targetId ?? null : null;
    const targetName = parsed.success ? parsed.data.targetName || null : null;

    const updated = requestTaskApproval(req.params.id, targetId, targetName);
    if (!updated) return next(createError('Có lỗi xảy ra', 500));

    logActivity(updated.projectId, `Gửi yêu cầu phê duyệt "${updated.title}"`, 'task', updated.id, 'System');
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id/approval-history  — lịch sử phê duyệt
router.get('/tasks/:id/approval-history', (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!row) return next(createError('Không tìm thấy công việc', 404));
    return res.json(getApprovalHistory(req.params.id));
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/process-approval  — phê duyệt / từ chối
router.post('/tasks/:id/process-approval', (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return next(createError('Không tìm thấy công việc', 404));
    if (row.approval_status !== 'pending') return next(createError('Công việc này không đang chờ phê duyệt', 400));

    const parsed = ApprovalActionSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const updated = processApproval(req.params.id, parsed.data.action, parsed.data.approvalBy, parsed.data.approvalNotes);
    if (!updated) return next(createError('Có lỗi xảy ra', 500));

    const actionLabel = parsed.data.action === 'approved' ? 'Phê duyệt' : 'Từ chối';
    logActivity(
      updated.projectId,
      `${actionLabel} công việc "${updated.title}"`,
      'task',
      updated.id,
      parsed.data.approvalBy,
      { action: parsed.data.action, notes: parsed.data.approvalNotes }
    );
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/approvals  — danh sách chờ phê duyệt (toàn hệ thống)
router.get('/approvals', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = getPendingApprovals();
    return res.json(pending);
  } catch (err) {
    next(err);
  }
});

export default router;
