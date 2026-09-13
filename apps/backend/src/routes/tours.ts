import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { createTourSchema, updateTourSchema, listToursQuerySchema } from './tours.schema';
import { generateUniqueSlug } from '../lib/slug';
import { uploadTourImage, deleteTourImages } from '../lib/supabaseStorage';
import { upload } from '../lib/upload';

export const toursRouter = Router();

const ALLOWED_IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

toursRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = listToursQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { page, limit, q, isActive } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Prisma.TourWhereInput = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { slug: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    // Respects q but not isActive, so every status tab's count reflects "how many
    // match this search" regardless of which tab is currently selected.
    const searchOnlyWhere: Prisma.TourWhereInput = q
      ? { OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { slug: { contains: q, mode: 'insensitive' as const } }] }
      : {};

    const [tours, total, activeCount, inactiveCount] = await Promise.all([
      prisma.tour.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          priceDiscount: true,
          imageCover: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.tour.count({ where }),
      prisma.tour.count({ where: { ...searchOnlyWhere, isActive: true } }),
      prisma.tour.count({ where: { ...searchOnlyWhere, isActive: false } }),
    ]);

    res.json({
      tours,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      statusCounts: { ALL: activeCount + inactiveCount, ACTIVE: activeCount, INACTIVE: inactiveCount },
    });
  } catch (err) {
    next(err);
  }
});

toursRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const tour = await prisma.tour.findUnique({
      where: { id: req.params.id },
      include: { categories: true },
    });
    if (!tour) {
      res.status(404).json({ error: 'tour not found' });
      return;
    }
    res.json(tour);
  } catch (err) {
    next(err);
  }
});

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

toursRouter.post('/upload-images', requireAuth, upload.array('images', 10), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: 'at least one image file is required' });
      return;
    }
    const invalidFile = files.find((file) => !ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype));
    if (invalidFile) {
      res.status(400).json({ error: 'unsupported image type' });
      return;
    }

    const urls = await Promise.all(
      files.map((file) => uploadTourImage(file.buffer, file.originalname, file.mimetype)),
    );
    res.status(201).json({ urls });
  } catch (err) {
    next(err);
  }
});

toursRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const parsed = updateTourSchema.safeParse(req.body);
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

    // Slug is deliberately never regenerated on update, even if the title changes —
    // keeps any public-facing tour URL stable across edits.
    const tour = await prisma.tour.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(startDates ? { startDates: startDates.map((date) => new Date(date)) } : {}),
        ...(categoryIds ? { categories: { set: categoryIds.map((id) => ({ id })) } } : {}),
      },
      include: { categories: true },
    });

    res.json(tour);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'tour not found' });
      return;
    }
    next(err);
  }
});

toursRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const tour = await prisma.tour.delete({ where: { id: req.params.id } });

    const imageUrls = [tour.imageCover, ...tour.images].filter((url): url is string => url != null);
    if (imageUrls.length > 0) {
      try {
        await deleteTourImages(imageUrls);
      } catch (cleanupErr) {
        // Best-effort: the tour row is already gone, so a storage hiccup
        // shouldn't surface as a delete failure for a tour that no longer exists.
        console.error('failed to clean up tour images from storage', cleanupErr);
      }
    }

    res.status(200).json({ id: tour.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'tour not found' });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      res.status(409).json({ error: 'cannot delete a tour with existing bookings' });
      return;
    }
    next(err);
  }
});
