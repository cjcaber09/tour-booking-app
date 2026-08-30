import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { verifyPassword } from '../lib/password';
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  refreshTokenExpiryDate,
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
