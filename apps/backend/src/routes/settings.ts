import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdminRole } from '../middleware/requireAdminRole';
import { getOrCreateSettings } from '../lib/settings';
import { prisma } from '../lib/prisma';
import { uploadLogo } from '../lib/supabaseStorage';
import { upload } from '../lib/upload';
import { updateSettingsSchema } from './settings.schema';

export const settingsRouter = Router();

const ALLOWED_LOGO_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

settingsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch('/', requireAuth, requireAdminRole('ADMIN'), async (req, res, next) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    await getOrCreateSettings();
    const settings = await prisma.appSettings.update({
      where: { key: 'singleton' },
      data: parsed.data,
    });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

settingsRouter.post(
  '/upload-logo',
  requireAuth,
  requireAdminRole('ADMIN'),
  upload.single('logo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'logo file is required' });
        return;
      }
      if (!ALLOWED_LOGO_MIMETYPES.includes(req.file.mimetype)) {
        res.status(400).json({ error: 'unsupported image type' });
        return;
      }

      const url = await uploadLogo(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.status(201).json({ url });
    } catch (err) {
      next(err);
    }
  },
);
