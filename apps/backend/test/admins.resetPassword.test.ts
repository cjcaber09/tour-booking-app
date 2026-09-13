import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken, signRefreshToken, hashToken, refreshTokenExpiryDate } from '../src/lib/tokens';

const app = createApp();
const testEmailBase = `admins-reset-password-test-${Date.now()}`;
const password = 'correct-horse-battery-staple';
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;
const allIds: string[] = [];

const DB_HEAVY_TEST_TIMEOUT = 15000;

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-admin@example.com`,
        passwordHash: await hashPassword(password),
        name: 'Reset Password Test Admin',
        role: 'ADMIN',
      },
    }),
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-guide@example.com`,
        passwordHash: await hashPassword(password),
        name: 'Reset Password Test Guide',
        role: 'GUIDE',
      },
    }),
  ]);
  adminId = admin.id;
  guideId = guide.id;
  allIds.push(adminId, guideId);
  adminToken = signAccessToken({ adminId });
  guideToken = signAccessToken({ adminId: guideId });
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { adminId: { in: allIds } } });
  await prisma.admin.deleteMany({ where: { id: { in: allIds } } });
  await prisma.$disconnect();
});

describe('POST /admins/:id/reset-password', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post(`/admins/${guideId}/reset-password`).send({});
    expect(res.status).toBe(401);
  });

  it('rejects a non-ADMIN caller (403)', async () => {
    const res = await request(app)
      .post(`/admins/${adminId}/reset-password`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('rejects a self-target (400)', async () => {
    const res = await request(app)
      .post(`/admins/${adminId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .post('/admins/00000000-0000-0000-0000-000000000000/reset-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it(
    'resets the target password, revokes their sessions, and clears any pending recovery request',
    async () => {
      const target = await prisma.admin.create({
        data: {
          email: `${testEmailBase}-target@example.com`,
          passwordHash: await hashPassword(password),
          name: 'Reset Target',
          role: 'GUIDE',
          recoveryRequestedAt: new Date(),
        },
      });
      const targetId = target.id;
      const targetEmail = target.email;
      allIds.push(targetId);

      // A real, still-unexpired refresh token, the way a genuine logged-in session would have
      // one before the target's password gets reset out from under them.
      const targetRefreshToken = signRefreshToken(targetId);
      await prisma.refreshToken.create({
        data: {
          adminId: targetId,
          tokenHash: hashToken(targetRefreshToken),
          expiresAt: refreshTokenExpiryDate(),
        },
      });

      const res = await request(app)
        .post(`/admins/${targetId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(typeof res.body.temporaryPassword).toBe('string');
      expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(8);
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.recoveryRequestedAt).toBeNull();

      // Old password no longer works.
      const oldLoginRes = await request(app).post('/auth/login').send({ email: targetEmail, password });
      expect(oldLoginRes.status).toBe(401);

      // Old refresh token is revoked.
      const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken: targetRefreshToken });
      expect(refreshRes.status).toBe(401);

      // New temporary password logs in.
      const newLoginRes = await request(app)
        .post('/auth/login')
        .send({ email: targetEmail, password: res.body.temporaryPassword });
      expect(newLoginRes.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
