import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { verifyPassword } from '../lib/password';
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  refreshTokenExpiryDate,
  verifyRefreshToken,
} from '../lib/tokens';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }

    const accessToken = signAccessToken({ adminId: admin.id });
    const refreshToken = signRefreshToken(admin.id);

    await prisma.refreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiryDate(),
      },
    });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    let adminId: string;
    try {
      adminId = verifyRefreshToken(refreshToken).adminId;
    } catch {
      res.status(401).json({ error: 'invalid refresh token' });
      return;
    }

    const stored = await prisma.refreshToken.findFirst({
      where: { adminId, tokenHash: hashToken(refreshToken) },
    });
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'invalid refresh token' });
      return;
    }

    res.json({ accessToken: signAccessToken({ adminId }) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
