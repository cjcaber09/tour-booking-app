import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdminRole } from '../middleware/requireAdminRole';
import { hashPassword, generateTemporaryPassword } from '../lib/password';
import { createAdminSchema, updateAdminSchema, listAdminsQuerySchema } from './admins.schema';

export const adminsRouter = Router();

// Never spread a raw Prisma Admin row into a response — it carries passwordHash.
const ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true,
  phone: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

adminsRouter.get('/', requireAuth, requireAdminRole('ADMIN'), async (req, res, next) => {
  try {
    const parsed = listAdminsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { page, limit, role, isActive, q } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Prisma.AdminWhereInput = {
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}),
    };

    const [admins, total] = await Promise.all([
      prisma.admin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: ADMIN_SELECT,
      }),
      prisma.admin.count({ where }),
    ]);

    res.json({
      admins,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

adminsRouter.post('/', requireAuth, requireAdminRole('ADMIN'), async (req, res, next) => {
  try {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const existing = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      res.status(409).json({ error: 'email already in use' });
      return;
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const admin = await prisma.admin.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        phone: parsed.data.phone ?? null,
        passwordHash,
      },
      select: ADMIN_SELECT,
    });

    res.status(201).json({ ...admin, temporaryPassword });
  } catch (err) {
    // Defense-in-depth alongside the findUnique pre-check above, for the race window between
    // the check and the write.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'email already in use' });
      return;
    }
    next(err);
  }
});

adminsRouter.patch('/:id', requireAuth, requireAdminRole('ADMIN'), async (req, res, next) => {
  try {
    if (req.params.id === req.adminId) {
      res.status(400).json({ error: 'use /profile to edit your own account' });
      return;
    }

    const parsed = updateAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const admin = await prisma.admin.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: ADMIN_SELECT,
    });

    res.json(admin);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'admin not found' });
      return;
    }
    next(err);
  }
});

adminsRouter.delete('/:id', requireAuth, requireAdminRole('ADMIN'), async (req, res, next) => {
  try {
    if (req.params.id === req.adminId) {
      res.status(400).json({ error: 'cannot delete your own account' });
      return;
    }

    // RefreshToken has no actual @relation/FK to Admin in this schema, so there's no cascade
    // to rely on — clean up explicitly or the rows silently orphan.
    await prisma.refreshToken.deleteMany({ where: { adminId: req.params.id } });
    const admin = await prisma.admin.delete({ where: { id: req.params.id } });

    res.status(200).json({ id: admin.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'admin not found' });
      return;
    }
    next(err);
  }
});
