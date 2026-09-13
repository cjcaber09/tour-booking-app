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
import { requireAuth } from '../middleware/auth';
import { loginLimiter, recoveryLimiter } from '../middleware/rateLimit';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res, next) => {
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
    if (!admin.isActive) {
      res.status(403).json({ error: 'account is suspended' });
      return;
    }

    const accessToken = signAccessToken({ adminId: admin.id });
    const refreshToken = signRefreshToken(admin.id);

    // Independent writes with no data dependency on each other, run concurrently
    // rather than sequentially — same round-trip-minimizing pattern used in
    // lib/bookings.ts's createBooking.
    await Promise.all([
      prisma.refreshToken.create({
        data: {
          adminId: admin.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: refreshTokenExpiryDate(),
        },
      }),
      prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
    ]);

    res.json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// Public, unauthenticated by design — this is the "everyone else" side of account recovery.
// Never reveals whether the email exists: identical 204 response either way, so this can't be
// used to enumerate admin accounts. If it does exist, it just flags recoveryRequestedAt for an
// ADMIN to see and act on (POST /admins/:id/reset-password) — no password is ever generated or
// returned here.
authRouter.post('/request-recovery', recoveryLimiter, async (req, res, next) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (admin) {
      await prisma.admin.update({ where: { id: admin.id }, data: { recoveryRequestedAt: new Date() } });
    }

    res.status(204).send();
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

    const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { isActive: true } });
    if (!admin?.isActive) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
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

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.adminId } });
    if (!admin) {
      res.status(401).json({ error: 'invalid session' });
      return;
    }
    res.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
      phone: admin.phone,
      createdAt: admin.createdAt,
      lastLoginAt: admin.lastLoginAt,
    });
  } catch (err) {
    next(err);
  }
});
