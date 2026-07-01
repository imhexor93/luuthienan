import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getAllFactories,
  getFactoryById,
  createFactory,
  updateFactory,
  deleteFactory,
  getContactsByFactory,
  getContactById,
  createFactoryContact,
  updateFactoryContact,
  deleteFactoryContact,
  getFactoryStats,
  getWechatGroupsByFactory,
  getWechatGroupById,
  createWechatGroup,
  updateWechatGroup,
  deleteWechatGroup,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';
import { db } from '../db/schema';

const router = Router();

// Multer for QR code images
const UPLOAD_DIR = path.join(__dirname, '../../../data/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const qrUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `qr_${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP, GIF'));
    }
  },
});

// -------------------------
// Zod Schemas
// -------------------------
const CreateFactorySchema = z.object({
  name: z.string().min(1, 'Tên nhà máy không được để trống'),
  shortName: z.string().optional().default(''),
  address: z.string().optional().default(''),
  country: z.string().optional().default('Việt Nam'),
  specialties: z.array(z.string()).optional().default([]),
  certifications: z.array(z.string()).optional().default([]),
  moqDefault: z.number().nullable().optional().default(null),
  leadTimeDays: z.number().int().nullable().optional().default(null),
  paymentTerms: z.string().optional().default(''),
  rating: z.number().min(0).max(5).optional().default(3),
  notes: z.string().optional().default(''),
  status: z.enum(['active', 'inactive', 'blacklisted']).optional().default('active'),
});

const UpdateFactorySchema = CreateFactorySchema.partial();

const CreateContactSchema = z.object({
  name: z.string().min(1, 'Tên liên hệ không được để trống'),
  role: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().optional().default(''),
  zalo: z.string().optional().default(''),
  wechat: z.string().optional().default(''),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
});

const UpdateContactSchema = CreateContactSchema.partial();

const CreateWechatGroupSchema = z.object({
  groupName: z.string().min(1, 'Tên nhóm không được để trống'),
  purpose: z.string().optional().default(''),
  ourMembers: z.string().optional().default(''),
  theirMembers: z.string().optional().default(''),
  active: z.boolean().optional().default(true),
  notes: z.string().optional().default(''),
});
const UpdateWechatGroupSchema = CreateWechatGroupSchema.partial();

// -------------------------
// Factory routes
// -------------------------

// GET /api/factories
router.get('/factories', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, country } = req.query as Record<string, string>;
    const factories = getAllFactories({ status, country });
    return res.json(factories);
  } catch (err) {
    next(err);
  }
});

// POST /api/factories
router.post('/factories', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateFactorySchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const factory = createFactory({
      id: uuidv4(),
      name: data.name,
      shortName: data.shortName,
      address: data.address,
      country: data.country,
      specialties: data.specialties,
      certifications: data.certifications,
      moqDefault: data.moqDefault ?? null,
      leadTimeDays: data.leadTimeDays ?? null,
      paymentTerms: data.paymentTerms,
      rating: data.rating,
      notes: data.notes,
      status: data.status,
    });

    return res.status(201).json(factory);
  } catch (err) {
    next(err);
  }
});

// GET /api/factories/:id
router.get('/factories/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const factory = getFactoryById(req.params.id);
    if (!factory) return next(createError('Không tìm thấy nhà máy', 404));

    const contacts = getContactsByFactory(req.params.id);
    const wechatGroups = getWechatGroupsByFactory(req.params.id);
    const stats = getFactoryStats(req.params.id);

    // Get engagement history across all projects
    const engagementRows = db.prepare(`
      SELECT fe.*, f.name as factory_name, f.short_name as factory_short_name, f.country as factory_country,
             p.name as project_name
      FROM factory_engagements fe
      JOIN factories f ON f.id = fe.factory_id
      JOIN projects p ON p.id = fe.project_id
      WHERE fe.factory_id = ?
      ORDER BY fe.created_at DESC
    `).all(req.params.id) as Array<Record<string, unknown>>;

    return res.json({ ...factory, contacts, wechatGroups, stats, engagements: engagementRows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/factories/:id
router.put('/factories/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getFactoryById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy nhà máy', 404));

    const parsed = UpdateFactorySchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateFactory(req.params.id, {
      name: data.name,
      shortName: data.shortName,
      address: data.address,
      country: data.country,
      specialties: data.specialties,
      certifications: data.certifications,
      moqDefault: data.moqDefault,
      leadTimeDays: data.leadTimeDays,
      paymentTerms: data.paymentTerms,
      rating: data.rating,
      notes: data.notes,
      status: data.status,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/factories/:id
router.delete('/factories/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getFactoryById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy nhà máy', 404));
    const ok = deleteFactory(req.params.id);
    if (!ok) return next(createError('Không thể xóa nhà máy', 500));
    return res.json({ message: 'Đã xóa nhà máy' });
  } catch (err) {
    next(err);
  }
});

// -------------------------
// Contact routes
// -------------------------

// GET /api/factories/:id/contacts
router.get('/factories/:id/contacts', (req: Request, res: Response, next: NextFunction) => {
  try {
    const factory = getFactoryById(req.params.id);
    if (!factory) return next(createError('Không tìm thấy nhà máy', 404));

    return res.json(getContactsByFactory(req.params.id));
  } catch (err) {
    next(err);
  }
});

// POST /api/factories/:id/contacts
router.post('/factories/:id/contacts', (req: Request, res: Response, next: NextFunction) => {
  try {
    const factory = getFactoryById(req.params.id);
    if (!factory) return next(createError('Không tìm thấy nhà máy', 404));

    const parsed = CreateContactSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const contact = createFactoryContact({
      id: uuidv4(),
      factoryId: req.params.id,
      name: data.name,
      role: data.role,
      phone: data.phone,
      email: data.email,
      zalo: data.zalo,
      wechat: data.wechat,
      isPrimary: data.isPrimary,
      notes: data.notes,
    });

    return res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

// PUT /api/contacts/:id
router.put('/contacts/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getContactById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy liên hệ', 404));

    const parsed = UpdateContactSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateFactoryContact(req.params.id, {
      name: data.name,
      role: data.role,
      phone: data.phone,
      email: data.email,
      zalo: data.zalo,
      wechat: data.wechat,
      isPrimary: data.isPrimary,
      notes: data.notes,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/contacts/:id
router.delete('/contacts/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getContactById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy liên hệ', 404));

    deleteFactoryContact(req.params.id);
    return res.json({ message: 'Đã xóa liên hệ thành công' });
  } catch (err) {
    next(err);
  }
});

// -------------------------
// WeChat Group routes
// -------------------------

// GET /api/factories/:id/wechat-groups
router.get('/factories/:id/wechat-groups', (req: Request, res: Response, next: NextFunction) => {
  try {
    const factory = getFactoryById(req.params.id);
    if (!factory) return next(createError('Không tìm thấy nhà máy', 404));
    return res.json(getWechatGroupsByFactory(req.params.id));
  } catch (err) { next(err); }
});

// POST /api/factories/:id/wechat-groups
router.post('/factories/:id/wechat-groups', (req: Request, res: Response, next: NextFunction) => {
  try {
    const factory = getFactoryById(req.params.id);
    if (!factory) return next(createError('Không tìm thấy nhà máy', 404));

    const parsed = CreateWechatGroupSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const group = createWechatGroup({
      id: uuidv4(), factoryId: req.params.id,
      groupName: data.groupName, purpose: data.purpose,
      ourMembers: data.ourMembers, theirMembers: data.theirMembers,
      active: data.active, notes: data.notes,
    });
    return res.status(201).json(group);
  } catch (err) { next(err); }
});

// PUT /api/wechat-groups/:id
router.put('/wechat-groups/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getWechatGroupById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy nhóm WeChat', 404));

    const parsed = UpdateWechatGroupSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const updated = updateWechatGroup(req.params.id, parsed.data);
    return res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/wechat-groups/:id
router.delete('/wechat-groups/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getWechatGroupById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy nhóm WeChat', 404));

    // Delete QR file if exists
    if (existing.qrCodePath) {
      const filePath = path.join(UPLOAD_DIR, existing.qrCodePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    deleteWechatGroup(req.params.id);
    return res.json({ message: 'Đã xóa nhóm WeChat' });
  } catch (err) { next(err); }
});

// POST /api/wechat-groups/:id/qr-code  — upload QR image
router.post('/wechat-groups/:id/qr-code', qrUpload.single('qrCode'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getWechatGroupById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy nhóm WeChat', 404));
    if (!req.file) return next(createError('Không có file được upload'));

    // Delete old QR file if exists
    if (existing.qrCodePath) {
      const oldPath = path.join(UPLOAD_DIR, existing.qrCodePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const updated = updateWechatGroup(req.params.id, { qrCodePath: req.file.filename });
    return res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/wechat-groups/:id/qr-code  — remove QR image
router.delete('/wechat-groups/:id/qr-code', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getWechatGroupById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy nhóm WeChat', 404));

    if (existing.qrCodePath) {
      const filePath = path.join(UPLOAD_DIR, existing.qrCodePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const updated = updateWechatGroup(req.params.id, { qrCodePath: '' });
    return res.json(updated);
  } catch (err) { next(err); }
});

export default router;
