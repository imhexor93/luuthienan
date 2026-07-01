import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getPackagingByProject,
  getPackagingByEngagement,
  getPackagingById,
  createPackagingDesign,
  updatePackagingDesign,
  getRevisionsByDesign,
  getRevisionById,
  createPackagingRevision,
  updatePackagingRevision,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

// -------------------------
// Zod Schemas
// -------------------------
const CreatePackagingDesignSchema = z.object({
  engagementId: z.string().nullable().optional().default(null),
  componentType: z.enum(['bottle', 'cap', 'label', 'box', 'inner-packaging', 'shipping-carton', 'other']).optional().default('other'),
  name: z.string().min(1, 'Tên thiết kế không được để trống'),
  currentVersion: z.number().int().optional().default(1),
  status: z.enum(['briefing', 'designing', 'review-round-1', 'review-round-2', 'review-round-3', 'finalized', 'on-hold']).optional().default('briefing'),
  briefSentAt: z.string().nullable().optional().default(null),
  briefDocument: z.string().optional().default(''),
  specifications: z.record(z.string()).optional().default({}),
  targetCost: z.number().nullable().optional().default(null),
  actualCost: z.number().nullable().optional().default(null),
  finalizedAt: z.string().nullable().optional().default(null),
});

const UpdatePackagingDesignSchema = CreatePackagingDesignSchema.partial();

const IssueSchema = z.object({
  category: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  description: z.string(),
});

const CreateRevisionSchema = z.object({
  revisionNumber: z.number().int().optional().default(1),
  submittedByFactoryAt: z.string().optional().default(() => new Date().toISOString()),
  reviewedAt: z.string().nullable().optional().default(null),
  reviewedBy: z.string().optional().default(''),
  issues: z.array(IssueSchema).optional().default([]),
  overallDecision: z.enum(['approved', 'minor-revision-needed', 'major-revision-needed', 'rejected']).nullable().optional().default(null),
  feedbackSummary: z.string().optional().default(''),
  factoryResponseAt: z.string().nullable().optional().default(null),
  factoryResponse: z.string().optional().default(''),
});

const UpdateRevisionSchema = CreateRevisionSchema.partial();

// -------------------------
// Packaging Design Routes
// -------------------------

// GET /api/projects/:projectId/packaging
router.get('/projects/:projectId/packaging', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getPackagingByProject(req.params.projectId));
  } catch (err) {
    next(err);
  }
});

// GET /api/engagements/:engagementId/packaging
router.get('/engagements/:engagementId/packaging', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getPackagingByEngagement(req.params.engagementId));
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/packaging
router.post('/projects/:projectId/packaging', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreatePackagingDesignSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const design = createPackagingDesign({
      id: uuidv4(),
      engagementId: data.engagementId ?? null,
      projectId: req.params.projectId,
      componentType: data.componentType,
      name: data.name,
      currentVersion: data.currentVersion,
      status: data.status,
      briefSentAt: data.briefSentAt ?? null,
      briefDocument: data.briefDocument,
      specifications: data.specifications,
      targetCost: data.targetCost ?? null,
      actualCost: data.actualCost ?? null,
      finalizedAt: data.finalizedAt ?? null,
    });

    return res.status(201).json(design);
  } catch (err) {
    next(err);
  }
});

// PUT /api/packaging/:id
router.put('/packaging/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getPackagingById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy thiết kế bao bì', 404));

    const parsed = UpdatePackagingDesignSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updatePackagingDesign(req.params.id, {
      engagementId: data.engagementId,
      componentType: data.componentType,
      name: data.name,
      currentVersion: data.currentVersion,
      status: data.status,
      briefSentAt: data.briefSentAt,
      briefDocument: data.briefDocument,
      specifications: data.specifications,
      targetCost: data.targetCost,
      actualCost: data.actualCost,
      finalizedAt: data.finalizedAt,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// -------------------------
// Revision Routes
// -------------------------

// GET /api/packaging/:id/revisions
router.get('/packaging/:id/revisions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const design = getPackagingById(req.params.id);
    if (!design) return next(createError('Không tìm thấy thiết kế bao bì', 404));

    return res.json(getRevisionsByDesign(req.params.id));
  } catch (err) {
    next(err);
  }
});

// POST /api/packaging/:id/revisions
router.post('/packaging/:id/revisions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const design = getPackagingById(req.params.id);
    if (!design) return next(createError('Không tìm thấy thiết kế bao bì', 404));

    const parsed = CreateRevisionSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const revision = createPackagingRevision({
      id: uuidv4(),
      packagingDesignId: req.params.id,
      revisionNumber: data.revisionNumber,
      submittedByFactoryAt: data.submittedByFactoryAt,
      reviewedAt: data.reviewedAt ?? null,
      reviewedBy: data.reviewedBy,
      issues: data.issues,
      overallDecision: data.overallDecision ?? null,
      feedbackSummary: data.feedbackSummary,
      factoryResponseAt: data.factoryResponseAt ?? null,
      factoryResponse: data.factoryResponse,
    });

    return res.status(201).json(revision);
  } catch (err) {
    next(err);
  }
});

// PUT /api/revisions/:id
router.put('/revisions/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getRevisionById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy revision', 404));

    const parsed = UpdateRevisionSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updatePackagingRevision(req.params.id, {
      submittedByFactoryAt: data.submittedByFactoryAt,
      reviewedAt: data.reviewedAt,
      reviewedBy: data.reviewedBy,
      issues: data.issues,
      overallDecision: data.overallDecision,
      feedbackSummary: data.feedbackSummary,
      factoryResponseAt: data.factoryResponseAt,
      factoryResponse: data.factoryResponse,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
