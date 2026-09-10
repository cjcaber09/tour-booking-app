import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { uploadAvatar } from '../lib/supabaseStorage';
import { upload } from '../lib/upload';
import { updateProfileSchema, changePasswordSchema } from './profile.schema';

export const profileRouter = Router();

const ALLOWED_AVATAR_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

profileRouter.patch('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { role, ...rest } = parsed.data;

    if (role !== undefined) {
      const requester = await prisma.admin.findUnique({ where: { id: req.adminId }, select: { role: true } });
      if (!requester || requester.role !== 'ADMIN') {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
    }

    const admin = await prisma.admin.update({
      where: { id: req.adminId },
      data: { ...rest, ...(role !== undefined ? { role } : {}) },
    });

    res.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
      phone: admin.phone,
    });
  } catch (err) {
    next(err);
  }
});

profileRouter.post('/upload-avatar', requireAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'avatar file is required' });
      return;
    }
    if (!ALLOWED_AVATAR_MIMETYPES.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'unsupported image type' });
      return;
    }

    const url = await uploadAvatar(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
});

profileRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { id: req.adminId } });
    if (!admin || !(await verifyPassword(parsed.data.currentPassword, admin.passwordHash))) {
      res.status(401).json({ error: 'current password is incorrect' });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash } });
    await prisma.refreshToken.deleteMany({ where: { adminId: admin.id } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
