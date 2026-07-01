import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getStagesWithProgress, updateStage, logActivity,
  getStageWeeklyUpdates, createWeeklyUpdate, updateWeeklyUpdate, deleteWeeklyUpdate, getWeeklyFeed,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';
import { db } from '../db/schema';

const router = Router();

const UpdateStageSchema = z.object({
  gateStatus: z.enum(['not-started', 'in-progress', 'passed', 'failed']).optional(),
  gateApprovedBy: z.string().optional(),
  gateNotes: z.string().optional(),
  stageSummary: z.string().optional(),
});

// GET /api/projects/:id/stages
router.get('/projects/:projectId/stages', (req: Request, res: Response, next: NextFunction) => {
  try {
    const stages = getStagesWithProgress(req.params.projectId);
    return res.json(stages);
  } catch (err) {
    next(err);
  }
});

// PUT /api/stages/:id
router.put('/stages/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const stageRow = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!stageRow) return next(createError('Không tìm thấy giai đoạn', 404));

    const parsed = UpdateStageSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    // Enforce gate prerequisites when trying to pass a stage
    if (parsed.data.gateStatus === 'passed' || parsed.data.gateStatus === 'in-progress') {
      const projectId = stageRow.project_id as string;
      const stageOrder = stageRow.order as number;
      const stageGroup = stageRow.stage_group as string | null;
      const allStages = getStagesWithProgress(projectId);
      const thisStage = allStages.find((s) => s.id === req.params.id);

      if (thisStage?.isLocked) {
        return next(createError(`Không thể chuyển trạng thái: ${thisStage.lockReason}`, 400));
      }

      // For gate approval (passed/failed), also require 100% task completion
      if (parsed.data.gateStatus === 'passed' && thisStage) {
        if (thisStage.totalTasks > 0 && thisStage.progressPercent < 100) {
          return next(createError(`Cần hoàn thành 100% công việc trước khi thông qua cổng (hiện tại: ${thisStage.progressPercent}%)`, 400));
        }
      }

      void stageGroup; void stageOrder;
    }

    const updated = updateStage(req.params.id, parsed.data);
    if (!updated) return next(createError('Không có dữ liệu để cập nhật'));

    const action = parsed.data.gateStatus === 'passed'
      ? `Phê duyệt cổng giai đoạn "${updated.name}"`
      : parsed.data.gateStatus === 'failed'
        ? `Từ chối cổng giai đoạn "${updated.name}"`
        : `Cập nhật giai đoạn "${updated.name}"`;

    logActivity(
      updated.projectId,
      action,
      'stage',
      updated.id,
      parsed.data.gateApprovedBy ?? 'System',
      { gateStatus: parsed.data.gateStatus }
    );

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── Weekly Updates ────────────────────────────────────────────────────────────

const WeeklyUpdateSchema = z.object({
  weekLabel: z.string().min(1, 'Nhãn tuần không được để trống'),
  content: z.string().min(1, 'Nội dung không được để trống'),
  createdBy: z.string().optional().default(''),
});

// GET /api/stages/:id/weekly-updates
router.get('/stages/:id/weekly-updates', (req: Request, res: Response, next: NextFunction) => {
  try {
    const stage = db.prepare('SELECT id FROM stages WHERE id = ?').get(req.params.id);
    if (!stage) return next(createError('Không tìm thấy giai đoạn', 404));
    return res.json(getStageWeeklyUpdates(req.params.id));
  } catch (err) { next(err); }
});

// POST /api/stages/:id/weekly-updates
router.post('/stages/:id/weekly-updates', (req: Request, res: Response, next: NextFunction) => {
  try {
    const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!stage) return next(createError('Không tìm thấy giai đoạn', 404));
    const parsed = WeeklyUpdateSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const row = createWeeklyUpdate({ stageId: req.params.id, ...parsed.data });
    logActivity(stage.project_id as string, `Thêm cập nhật tuần cho "${stage.name}"`, 'stage', req.params.id, parsed.data.createdBy || 'System');
    return res.status(201).json({
      id: row.id, stageId: row.stage_id, weekLabel: row.week_label,
      content: row.content, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
    });
  } catch (err) { next(err); }
});

// PUT /api/weekly-updates/:id
router.put('/weekly-updates/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = WeeklyUpdateSchema.partial().safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const updated = updateWeeklyUpdate(req.params.id, { weekLabel: parsed.data.weekLabel, content: parsed.data.content });
    if (!updated) return next(createError('Không tìm thấy bản ghi', 404));
    return res.json({
      id: updated.id, stageId: updated.stage_id, weekLabel: updated.week_label,
      content: updated.content, createdBy: updated.created_by, createdAt: updated.created_at, updatedAt: updated.updated_at,
    });
  } catch (err) { next(err); }
});

// DELETE /api/weekly-updates/:id
router.delete('/weekly-updates/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = deleteWeeklyUpdate(req.params.id);
    if (!ok) return next(createError('Không tìm thấy bản ghi', 404));
    return res.json({ message: 'Đã xóa' });
  } catch (err) { next(err); }
});

// GET /api/weekly-updates/feed  — all recent updates with project/stage context (for overview report)
router.get('/weekly-updates/feed', (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getWeeklyFeed());
  } catch (err) { next(err); }
});

export default router;
