import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  getRFQsByEngagement,
  getRFQById,
  createRFQ,
  updateRFQ,
  getNextRFQNumber,
  getQuotesByRFQ,
  getQuotesByEngagement,
  getQuoteById,
  createQuote,
  updateQuote,
  upsertMaterialCost,
  upsertPackagingCost,
  upsertTimelineEstimate,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

// -------------------------
// Zod Schemas
// -------------------------
const CreateRFQSchema = z.object({
  requestedBy: z.string().optional().default(''),
  specifications: z.string().optional().default(''),
  quantityRange: z.string().optional().default(''),
  deadlineForResponse: z.string().nullable().optional().default(null),
  status: z.enum(['sent', 'received', 'clarifying', 'expired', 'cancelled']).optional().default('sent'),
  notes: z.string().optional().default(''),
});

const UpdateRFQSchema = CreateRFQSchema.partial();

const ProductLineSchema = z.object({
  stt: z.number().int().min(1),
  productName: z.string().optional().default(''),
  specs: z.string().optional().default(''),
  productionQty: z.number().min(0).optional().default(0),
  contentPriceKg: z.number().nullable().optional().default(null),
  contentPricePcs: z.number().min(0).optional().default(0),
  processingFee: z.number().min(0).optional().default(0),
  packagingODM: z.number().min(0).optional().default(0),
  totalRMB: z.number().min(0).optional().default(0),
  totalUSD: z.number().nullable().optional().default(null),
  packagingComponents: z.string().optional().default(''),
  moq: z.number().min(0).optional().default(0),
  notes: z.string().optional().default(''),
});

const PackagingItemSchema = z.object({
  order: z.number().int().min(1),
  componentName: z.string().optional().default(''),
  componentType: z.enum(['bottle', 'cap', 'label', 'box', 'inner-bag', 'outer-box', 'pump', 'dropper', 'sleeve', 'shrink-wrap', 'tube', 'other']).optional().default('other'),
  unitCost: z.number().min(0).optional().default(0),
  quantity: z.number().min(0).optional().default(1),
  notes: z.string().optional().default(''),
});

const MaterialCostSchema = z.object({
  calculationMethod: z.enum(['by-weight', 'by-unit', 'mixed']).optional().default('by-weight'),
  pricePerKg: z.number().nullable().optional(),
  pricePerUnit: z.number().nullable().optional(),
  weightPerUnit: z.number().nullable().optional(),
  materialNotes: z.string().optional().default(''),
});

const PackagingCostSchema = z.object({
  wastageCost: z.number().optional().default(0),
  packagingNotes: z.string().optional().default(''),
  items: z.array(PackagingItemSchema).optional().default([]),
});

const TimelineEstimateSchema = z.object({
  packagingMinDays: z.number().int().optional().default(0),
  packagingMaxDays: z.number().int().optional().default(0),
  materialMinDays: z.number().int().optional().default(0),
  materialMaxDays: z.number().int().optional().default(0),
  fillingMinDays: z.number().int().optional().default(0),
  fillingMaxDays: z.number().int().optional().default(0),
  shippingMinDays: z.number().int().optional().default(0),
  shippingMaxDays: z.number().int().optional().default(0),
  stageOverlaps: z.object({ packagingMaterial: z.boolean().optional().default(true), materialFilling: z.boolean().optional().default(false) }).optional(),
  estimateNotes: z.string().optional().default(''),
});

const CreateQuoteSchema = z.object({
  version: z.number().int().optional().default(1),
  validUntil: z.string().nullable().optional().default(null),
  pricingTerms: z.string().optional().default('EXW'),
  currency: z.enum(['VND', 'USD', 'CNY']).optional().default('CNY'),
  leadTimeDays: z.number().int().nullable().optional().default(null),
  paymentTerms: z.string().optional().default(''),
  // v2 fields
  productName: z.string().optional().default(''),
  specification: z.string().optional().default(''),
  quantityScenario: z.string().optional().default(''),
  generalNotes: z.string().optional().default(''),
  laborCostPerUnit: z.number().optional().default(0),
  materialCost: MaterialCostSchema.optional(),
  packagingCost: PackagingCostSchema.optional(),
  timelineEstimate: TimelineEstimateSchema.optional(),
  // v1 legacy
  productLines: z.array(ProductLineSchema).optional().default([]),
  status: z.enum(['pending-review', 'accepted', 'rejected', 'countering']).optional().default('pending-review'),
  internalNotes: z.string().optional().default(''),
});

const UpdateQuoteSchema = CreateQuoteSchema.partial();

// -------------------------
// RFQ Routes
// -------------------------

// GET /api/engagements/:engagementId/quotes — tất cả quotes của engagement (dùng cho lệnh SX)
router.get('/engagements/:engagementId/quotes', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getQuotesByEngagement(req.params.engagementId));
  } catch (err) {
    next(err);
  }
});

// GET /api/engagements/:engagementId/rfqs
router.get('/engagements/:engagementId/rfqs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rfqs = getRFQsByEngagement(req.params.engagementId);
    return res.json(rfqs);
  } catch (err) {
    next(err);
  }
});

// POST /api/engagements/:engagementId/rfqs
router.post('/engagements/:engagementId/rfqs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateRFQSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const requestNumber = getNextRFQNumber();
    const rfq = createRFQ({
      id: uuidv4(),
      engagementId: req.params.engagementId,
      requestNumber,
      requestedBy: data.requestedBy,
      specifications: data.specifications,
      quantityRange: data.quantityRange,
      deadlineForResponse: data.deadlineForResponse ?? null,
      status: data.status,
      notes: data.notes,
    });

    return res.status(201).json(rfq);
  } catch (err) {
    next(err);
  }
});

// PUT /api/rfqs/:id
router.put('/rfqs/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getRFQById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy RFQ', 404));

    const parsed = UpdateRFQSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateRFQ(req.params.id, {
      requestedBy: data.requestedBy,
      specifications: data.specifications,
      quantityRange: data.quantityRange,
      deadlineForResponse: data.deadlineForResponse,
      status: data.status,
      notes: data.notes,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// -------------------------
// Quote Routes
// -------------------------

// GET /api/rfqs/:rfqId/quotes
router.get('/rfqs/:rfqId/quotes', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rfq = getRFQById(req.params.rfqId);
    if (!rfq) return next(createError('Không tìm thấy RFQ', 404));

    return res.json(getQuotesByRFQ(req.params.rfqId));
  } catch (err) {
    next(err);
  }
});

// POST /api/rfqs/:rfqId/quotes
router.post('/rfqs/:rfqId/quotes', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rfq = getRFQById(req.params.rfqId);
    if (!rfq) return next(createError('Không tìm thấy RFQ', 404));

    const parsed = CreateQuoteSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const quote = createQuote({
      id: uuidv4(),
      quoteRequestId: req.params.rfqId,
      version: data.version,
      validUntil: data.validUntil ?? null,
      pricingTerms: data.pricingTerms,
      currency: data.currency,
      leadTimeDays: data.leadTimeDays ?? null,
      paymentTerms: data.paymentTerms,
      productName: data.productName,
      specification: data.specification,
      quantityScenario: data.quantityScenario,
      generalNotes: data.generalNotes,
      laborCostPerUnit: data.laborCostPerUnit,
      materialCost: data.materialCost,
      packagingCost: data.packagingCost,
      timelineEstimate: data.timelineEstimate,
      productLines: data.productLines,
      status: data.status,
      internalNotes: data.internalNotes,
    });

    return res.status(201).json(quote);
  } catch (err) {
    next(err);
  }
});

// PUT /api/quotes/:id
router.put('/quotes/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getQuoteById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy báo giá', 404));

    const parsed = UpdateQuoteSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;

    // Update sub-entities if provided
    if (data.materialCost) upsertMaterialCost(req.params.id, data.materialCost);
    if (data.packagingCost) upsertPackagingCost(req.params.id, data.packagingCost);
    if (data.timelineEstimate) upsertTimelineEstimate(req.params.id, data.timelineEstimate);

    const updated = updateQuote(req.params.id, {
      validUntil: data.validUntil,
      pricingTerms: data.pricingTerms,
      currency: data.currency,
      leadTimeDays: data.leadTimeDays,
      paymentTerms: data.paymentTerms,
      productLines: data.productLines,
      status: data.status,
      internalNotes: data.internalNotes,
      productName: data.productName,
      specification: data.specification,
      quantityScenario: data.quantityScenario,
      generalNotes: data.generalNotes,
      laborCostPerUnit: data.laborCostPerUnit,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
