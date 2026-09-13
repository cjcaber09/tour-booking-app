import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { slugify } from '../lib/slug';
import { listCategoriesQuerySchema, createCategorySchema, updateCategorySchema } from './categories.schema';

export const categoriesRouter = Router();

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
} as const;

categoriesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = listCategoriesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: CATEGORY_SELECT,
      }),
      prisma.category.count(),
    ]);

    res.json({
      categories,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

categoriesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const slug = slugify(parsed.data.name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      res.status(409).json({ error: 'category name already in use' });
      return;
    }

    const category = await prisma.category.create({
      data: { name: parsed.data.name, slug },
      select: CATEGORY_SELECT,
    });

    res.status(201).json(category);
  } catch (err) {
    // Defense-in-depth alongside the findUnique pre-check above, for the race window between
    // the check and the write.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'category name already in use' });
      return;
    }
    next(err);
  }
});

// Rename-only: the slug is generated once on create and never touched again — it's returned to
// the public booking site via GET /public/tours' nested category, so silently changing it on
// rename could break an external consumer that references it (same policy tours.ts already
// applies to its own slug). Category.name has no unique constraint, so there's no 409 path here.
categoriesRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name: parsed.data.name },
      select: CATEGORY_SELECT,
    });

    res.json(category);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'category not found' });
      return;
    }
    next(err);
  }
});

// No P2003 branch: the _TourCategories join table has ON DELETE CASCADE on both sides, so
// deleting a category in use by tours just detaches it from them rather than throwing an FK
// error.
categoriesRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const category = await prisma.category.delete({ where: { id: req.params.id } });
    res.status(200).json({ id: category.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'category not found' });
      return;
    }
    next(err);
  }
});
