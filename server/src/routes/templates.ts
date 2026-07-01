import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getPackagingTemplates, createPackagingTemplate, deletePackagingTemplate } from '../db/helpers';
import { createError } from '../middleware/errorHandler';

const router = Router();

const TemplateItemSchema = z.object({
  componentName: z.string(),
  componentType: z.enum(['bottle', 'cap', 'label', 'box', 'inner-bag', 'outer-box', 'pump', 'dropper', 'sleeve', 'shrink-wrap', 'tube', 'other']),
  defaultQuantity: z.number().optional().default(1),
  orderIndex: z.number().int().optional().default(0),
});

const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  productCategory: z.string().optional().default(''),
  items: z.array(TemplateItemSchema).min(1),
  createdBy: z.string().optional().default(''),
});

// GET /api/packaging-templates
router.get('/packaging-templates', (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(getPackagingTemplates());
  } catch (err) { next(err); }
});

// POST /api/packaging-templates
router.post('/packaging-templates', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateTemplateSchema.safeParse(req.body);
    if (!parsed.success) return next(createError(parsed.error.errors[0].message));
    const data = parsed.data;
    const template = createPackagingTemplate({
      id: uuidv4(), name: data.name, productCategory: data.productCategory,
      items: data.items, createdBy: data.createdBy,
    });
    return res.status(201).json(template);
  } catch (err) { next(err); }
});

// DELETE /api/packaging-templates/:id
router.delete('/packaging-templates/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    deletePackagingTemplate(req.params.id);
    return res.json({ message: 'Đã xóa template' });
  } catch (err) { next(err); }
});

export default router;
