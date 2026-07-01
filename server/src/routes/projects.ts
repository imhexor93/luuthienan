import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllProjects, getProjectById, createProject, updateProject, deleteProject,
  logActivity,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

// -------------------------
// Validation schemas
// -------------------------
const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Tên dự án không được để trống'),
  description: z.string().optional().default(''),
  productCategory: z.string().optional().default(''),
  market: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  progressSummary: z.string().optional().default(''),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate phải có dạng YYYY-MM-DD'),
  targetLaunchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'targetLaunchDate phải có dạng YYYY-MM-DD'),
  budget: z.number().min(0).optional().default(0),
  status: z.enum(['active', 'on-hold', 'completed', 'cancelled']).optional().default('active'),
}).refine(
  (d) => new Date(d.targetLaunchDate) >= new Date(d.startDate),
  { message: 'Ngày ra mắt phải sau ngày bắt đầu' }
);

const UpdateProjectBaseSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  productCategory: z.string().optional(),
  market: z.string().optional(),
  brand: z.string().optional(),
  progressSummary: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetLaunchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budget: z.number().min(0).optional(),
  status: z.enum(['active', 'on-hold', 'completed', 'cancelled']).optional(),
});

const UpdateProjectSchema = UpdateProjectBaseSchema.refine(
  (d) => {
    if (d.startDate && d.targetLaunchDate) {
      return new Date(d.targetLaunchDate) >= new Date(d.startDate);
    }
    return true;
  },
  { message: 'Ngày ra mắt phải sau ngày bắt đầu' }
);

// GET /api/projects
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, brand, sortBy } = req.query as Record<string, string>;
    const projects = getAllProjects({ status, category, brand, sortBy });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(parsed.error.errors[0].message));
    }
    const data = parsed.data;
    const id = uuidv4();

    const project = createProject({
      id,
      name: data.name,
      description: data.description,
      productCategory: data.productCategory,
      market: data.market,
      brand: data.brand,
      progressSummary: data.progressSummary,
      startDate: data.startDate,
      targetLaunchDate: data.targetLaunchDate,
      budget: data.budget,
      status: data.status,
    });

    logActivity(id, `Tạo dự án "${project.name}"`, 'project', id, 'System', { name: project.name });

    return res.status(201).json(getProjectById(id));
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = getProjectById(req.params.id);
    if (!project) return next(createError('Không tìm thấy dự án', 404));
    return res.json(project);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getProjectById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy dự án', 404));

    const parsed = UpdateProjectSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateProject(req.params.id, {
      name: data.name,
      description: data.description,
      productCategory: data.productCategory,
      market: data.market,
      brand: data.brand,
      progressSummary: data.progressSummary,
      startDate: data.startDate,
      targetLaunchDate: data.targetLaunchDate,
      budget: data.budget,
      status: data.status,
    });

    logActivity(req.params.id, `Cập nhật dự án "${updated?.name}"`, 'project', req.params.id);

    return res.json(getProjectById(req.params.id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getProjectById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy dự án', 404));

    // Log trước khi xóa (cascade sẽ xóa activity_logs cũng)
    deleteProject(req.params.id);

    return res.json({ message: 'Đã xóa dự án thành công' });
  } catch (err) {
    next(err);
  }
});

export default router;
