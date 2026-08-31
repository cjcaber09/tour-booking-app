import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { createTourSchema } from './tours.schema';
import { generateUniqueSlug } from '../lib/slug';
import { uploadTourImage } from '../lib/supabaseStorage';

export const toursRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

toursRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createTourSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { categoryIds, startDates, ...rest } = parsed.data;

    if (categoryIds && categoryIds.length > 0) {
      const foundCount = await prisma.category.count({ where: { id: { in: categoryIds } } });
      if (foundCount !== categoryIds.length) {
        res.status(400).json({ error: 'one or more categoryIds do not exist' });
        return;
      }
    }

    const slug = await generateUniqueSlug(rest.title);

    const tour = await prisma.tour.create({
      data: {
        ...rest,
        slug,
        startDates: startDates?.map((date) => new Date(date)),
        categories: categoryIds ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
      },
      include: { categories: true },
    });

    res.status(201).json(tour);
  } catch (err) {
    next(err);
  }
});

toursRouter.post('/upload-image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'image file is required' });
      return;
    }
    if (!ALLOWED_IMAGE_MIMETYPES.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'unsupported image type' });
      return;
    }

    const url = await uploadTourImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
});
