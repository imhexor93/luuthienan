import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import {
  getSamplesByEngagement,
  getSampleById,
  createSample,
  updateSample,
  getNextSampleNumber,
  addSampleAttachment,
  removeSampleAttachment,
  addSampleLink,
  removeSampleLink,
} from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const router = Router();

// -------------------------
// Multer for sample media uploads (ảnh + video)
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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB cho video
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Định dạng không hỗ trợ. Chấp nhận: ảnh, video MP4/MOV, PDF, Word'));
    }
  },
});

// -------------------------
// Zod Schemas
// -------------------------
const EvaluationCriterionSchema = z.object({
  criterion: z.string(),
  rating: z.number().min(0).max(10),
  notes: z.string().optional().default(''),
});

const CreateSampleSchema = z.object({
  type: z.enum(['formula', 'packaging', 'label', 'finished-product', 'raw-material', 'other']).optional().default('other'),
  version: z.number().int().optional().default(1),
  receivedBy: z.string().optional().default(''),
  description: z.string().optional().default(''),
  evaluationStatus: z.enum(['pending-evaluation', 'evaluating', 'approved', 'approved-with-changes', 'rejected', 'reworking']).optional().default('pending-evaluation'),
  evaluatedBy: z.string().optional().default(''),
  evaluatedAt: z.string().nullable().optional().default(null),
  evaluationCriteria: z.array(EvaluationCriterionSchema).optional().default([]),
  overallRating: z.number().nullable().optional().default(null),
  feedbackToFactory: z.string().optional().default(''),
  revisionRequested: z.boolean().optional().default(false),
  revisionDetails: z.string().optional().default(''),
  formula: z.object({
    dosageForm: z.string().optional().default(''),
    totalWeight: z.string().optional().default(''),
    servingSize: z.string().optional().default(''),
    formulaNotes: z.string().optional().default(''),
    ingredients: z.array(z.object({
      id: z.string(),
      tradeName: z.string().optional().default(''),
      inciName: z.string().optional().default(''),
      function: z.string().optional().default(''),
      aiFunction: z.string().optional().default(''),
      activeRatio: z.string().optional().default(''),
      rawPercentage: z.string().optional().default(''),
      supplier: z.string().optional().default(''),
      notes: z.string().optional().default(''),
      warningLevel: z.enum(['banned', 'restricted', 'caution']).nullable().optional().default(null),
      warningDetail: z.string().optional().default(''),
    })).optional().default([]),
  }).optional(),
});

const UpdateSampleSchema = CreateSampleSchema.partial();

// -------------------------
// Routes
// -------------------------

// GET /api/engagements/:engagementId/samples
router.get('/engagements/:engagementId/samples', (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getSamplesByEngagement(req.params.engagementId));
  } catch (err) {
    next(err);
  }
});

// POST /api/engagements/:engagementId/samples
router.post('/engagements/:engagementId/samples', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateSampleSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const sampleNumber = getNextSampleNumber();
    const sample = createSample({
      id: uuidv4(),
      engagementId: req.params.engagementId,
      sampleNumber,
      type: data.type,
      version: data.version,
      receivedBy: data.receivedBy,
      description: data.description,
      evaluationStatus: data.evaluationStatus,
      evaluatedBy: data.evaluatedBy,
      evaluatedAt: data.evaluatedAt ?? null,
      evaluationCriteria: data.evaluationCriteria,
      overallRating: data.overallRating ?? null,
      feedbackToFactory: data.feedbackToFactory,
      revisionRequested: data.revisionRequested,
      revisionDetails: data.revisionDetails,
    });

    return res.status(201).json(sample);
  } catch (err) {
    next(err);
  }
});

// GET /api/samples/:id
router.get('/samples/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sample = getSampleById(req.params.id);
    if (!sample) return next(createError('Không tìm thấy mẫu', 404));
    return res.json(sample);
  } catch (err) {
    next(err);
  }
});

// PUT /api/samples/:id
router.put('/samples/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = getSampleById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy mẫu', 404));

    const parsed = UpdateSampleSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));

    const data = parsed.data;
    const updated = updateSample(req.params.id, {
      type: data.type,
      version: data.version,
      receivedBy: data.receivedBy,
      description: data.description,
      evaluationStatus: data.evaluationStatus,
      evaluatedBy: data.evaluatedBy,
      evaluatedAt: data.evaluatedAt,
      evaluationCriteria: data.evaluationCriteria,
      overallRating: data.overallRating,
      feedbackToFactory: data.feedbackToFactory,
      revisionRequested: data.revisionRequested,
      revisionDetails: data.revisionDetails,
      formula: data.formula,
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/samples/:id/attachments — upload ảnh/video bằng chứng nhận mẫu
router.post(
  '/samples/:id/attachments',
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return next(createError('Không có file được upload'));

      const existing = getSampleById(req.params.id);
      if (!existing) {
        fs.unlinkSync(req.file.path);
        return next(createError('Không tìm thấy mẫu', 404));
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

      const updated = addSampleAttachment(req.params.id, attachment);
      if (!updated) {
        fs.unlinkSync(req.file.path);
        return next(createError('Không thể lưu file', 500));
      }

      return res.status(201).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/samples/:id/attachments/:attachmentId
router.delete('/samples/:id/attachments/:attachmentId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sample, filename } = removeSampleAttachment(req.params.id, req.params.attachmentId);
    if (!sample) return next(createError('Không tìm thấy mẫu', 404));

    if (filename) {
      const filePath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    return res.json(sample);
  } catch (err) {
    next(err);
  }
});

// POST /api/samples/:id/links
router.post('/samples/:id/links', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, url, addedBy } = req.body as { title?: string; url?: string; addedBy?: string };
    if (!url || !url.startsWith('http')) return next(createError('URL không hợp lệ'));

    const existing = getSampleById(req.params.id);
    if (!existing) return next(createError('Không tìm thấy mẫu', 404));

    const updated = addSampleLink(req.params.id, {
      id: uuidv4(),
      title: title?.trim() || url,
      url: url.trim(),
      addedAt: new Date().toISOString(),
      addedBy: addedBy || 'Ẩn danh',
    });

    return res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/samples/:id/links/:linkId
router.delete('/samples/:id/links/:linkId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = removeSampleLink(req.params.id, req.params.linkId);
    if (!updated) return next(createError('Không tìm thấy mẫu', 404));
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// -------------------------
// Multer for Excel formula import (memory storage, no disk needed)
// -------------------------
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
      'text/csv',                                                            // .csv
      'application/octet-stream',                                            // generic binary (some clients send this)
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ hỗ trợ file Excel (.xlsx, .xls) hoặc CSV'));
    }
  },
});

// POST /api/formula/parse-excel
// Nhận file Excel bảng thành phần, dùng xlsx + Claude để extract + enrich dữ liệu
router.post(
  '/formula/parse-excel',
  excelUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return next(createError('Không có file được gửi lên'));
      if (!process.env.ANTHROPIC_API_KEY) return next(createError('Chưa cấu hình ANTHROPIC_API_KEY', 500));

      // Lazy-load xlsx to avoid startup cost
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const XLSX = require('xlsx') as typeof import('xlsx');

      // Parse Excel from buffer
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert sheet → array of arrays (raw rows)
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Filter out completely empty rows
      const rows = rawRows.filter((row) => row.some((cell) => String(cell).trim() !== ''));
      if (rows.length < 2) return next(createError('File Excel không có dữ liệu hoặc quá ít dòng', 422));

      // Limit to first 200 rows to avoid token overload
      const limitedRows = rows.slice(0, 200);

      // Convert to readable text table for Claude
      const tableText = limitedRows
        .map((row) => (row as unknown[]).map((cell) => String(cell ?? '').trim()).join('\t'))
        .join('\n');

      const prompt = `Bạn là chuyên gia formulation về mỹ phẩm và thực phẩm chức năng. Dưới đây là dữ liệu thô từ file Excel bảng thành phần sản phẩm do nhà máy cung cấp (dạng tab-separated):

\`\`\`
${tableText}
\`\`\`

Nhiệm vụ của bạn:
1. Nhận diện cấu trúc bảng — xác định cột nào là tên thương mại, INCI name, chức năng, tỷ lệ hoạt chất, % trong công thức, nhà cung cấp, ghi chú...
2. Extract toàn bộ nguyên liệu trong bảng
3. Với MỖI nguyên liệu, điền đầy đủ các trường sau:
   a. "tradeName": tên thương mại của nguyên liệu thô (tên trong file, tên Trung/Việt/thương mại, trade name của nhà cung cấp)
   b. "inciName": tên INCI quốc tế chuẩn (International Nomenclature of Cosmetic Ingredients) hoặc tên khoa học Latin — dựa vào kiến thức của bạn để tra cứu nếu file không có
   c. "function": chức năng được ghi trong file Excel (nếu có cột chức năng, sao chép y nguyên; nếu không có để trống "")
   d. "aiFunction": chức năng thực sự của thành phần theo kiến thức chuyên môn của bạn (1-2 câu tiếng Việt, mô tả vai trò trong mỹ phẩm/thực phẩm chức năng)
   e. "activeRatio": tỷ lệ phần trăm hoạt chất có trong nguyên liệu thô (VD: nguyên liệu là "Vitamin C 25%" thì activeRatio = "25%"; nếu là nguyên chất thì "100%"; nếu không xác định được để "")
   f. "rawPercentage": % nguyên liệu thô này trong công thức cuối (lấy từ file nếu có; chỉ số, kèm ký hiệu %)
   g. "supplier": nhà cung cấp nếu có trong file, nếu không để ""
   h. "notes": các tên gọi khác, ghi chú từ file
   i. "warningLevel" và "warningDetail": kiểm tra theo quy định:
      - Thông tư 06/2011/TT-BYT và thông tư sửa đổi (mỹ phẩm Việt Nam)
      - ASEAN Cosmetics Directive Annex II (cấm) và Annex III (hạn chế)
      - EU Cosmetics Regulation 1223/2009 Annex II (cấm) và Annex III (hạn chế)
      - FDA banned ingredients list
      - "banned" = bị cấm hoàn toàn; "restricted" = chỉ được dùng ở nồng độ/điều kiện nhất định; "caution" = có lo ngại nhưng chưa bị cấm chính thức; null = an toàn

Trả về JSON theo đúng format sau, KHÔNG thêm markdown hay giải thích:

{
  "dosageForm": "dạng sản phẩm nếu xác định được, nếu không để trống",
  "totalWeight": "tổng khối lượng nếu có, nếu không để trống",
  "servingSize": "liều dùng nếu có, nếu không để trống",
  "formulaNotes": "ghi chú chung nếu có, nếu không để trống",
  "ingredients": [
    {
      "tradeName": "tên thương mại nguyên liệu thô",
      "inciName": "INCI name hoặc tên khoa học",
      "function": "chức năng từ file (hoặc rỗng)",
      "aiFunction": "chức năng AI kiểm chứng tiếng Việt",
      "activeRatio": "tỷ lệ hoạt chất trong nguyên liệu thô (VD: 25% hoặc 100%)",
      "rawPercentage": "% nguyên liệu này trong công thức cuối",
      "supplier": "nhà cung cấp hoặc rỗng",
      "notes": "tên khác, ghi chú từ file",
      "warningLevel": null,
      "warningDetail": ""
    }
  ]
}`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = (message.content[0] as { type: string; text: string }).text.trim();

      // Extract JSON robustly: find first '{' and last '}' to handle any surrounding text/markdown
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const jsonStr = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        return next(createError('AI không thể phân tích file Excel. Vui lòng kiểm tra định dạng file và thử lại.', 422));
      }

      return res.json(parsed);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
