import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signRefreshToken, hashToken, refreshTokenExpiryDate } from '../src/lib/tokens';
import { createTestAdmin, TEST_PASSWORD, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
const password = TEST_PASSWORD;
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;
const allIds: string[] = [];

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    createTestAdmin('Admins Update Test Admin', { role: 'ADMIN' }),
    createTestAdmin('Admins Update Test Guide', { role: 'GUIDE' }),
  ]);
  adminId = admin.id;
  adminToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;
  allIds.push(adminId, guideId);
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { adminId: { in: allIds } } });
  await prisma.admin.deleteMany({ where: { id: { in: allIds } } });
  await prisma.$disconnect();
});

describe('PATCH /admins/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).patch(`/admins/${guideId}`).send({ isActive: false });
    expect(res.status).toBe(401);
  });

  it('rejects a non-ADMIN caller (403)', async () => {
    const res = await request(app)
      .patch(`/admins/${adminId}`)
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it('rejects a self-edit (400)', async () => {
    const res = await request(app)
      .patch(`/admins/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .patch('/admins/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(404);
  });

  it(
    'suspending an admin blocks login, refresh, and the admin-gated middleware on an ' +
      'already-issued access token',
    async () => {
      // A fresh ADMIN target: this exercises requireAdminRole's isActive check, not just
      // the role check.
      const target = await createTestAdmin('Suspend Target', { role: 'ADMIN' });
      const targetId = target.id;
      const targetEmail = target.email;
      allIds.push(targetId);

      // A real, still-unexpired access token and refresh token for the target, the way
      // a real client would have one before being suspended mid-session.
      const targetAccessToken = target.accessToken;
      const targetRefreshToken = signRefreshToken(targetId);
      await prisma.refreshToken.create({
        data: {
          adminId: targetId,
          tokenHash: hashToken(targetRefreshToken),
          expiresAt: refreshTokenExpiryDate(),
        },
      });

      // Sanity check: before suspension, the target's token works on an admin-gated route.
      const beforeRes = await request(app).get('/admins').set('Authorization', `Bearer ${targetAccessToken}`);
      expect(beforeRes.status).toBe(200);

      const suspendRes = await request(app)
        .patch(`/admins/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.isActive).toBe(false);

      // 1. Login now fails.
      const loginRes = await request(app).post('/auth/login').send({ email: targetEmail, password });
      expect(loginRes.status).toBe(403);

      // 2. The existing refresh token can no longer be renewed.
      const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken: targetRefreshToken });
      expect(refreshRes.status).toBe(401);

      // 3. The already-issued, still-unexpired access token is now rejected by
      // requireAdminRole on an admin-gated route — the actual fix under test.
      const afterRes = await request(app).get('/admins').set('Authorization', `Bearer ${targetAccessToken}`);
      expect(afterRes.status).toBe(403);

      // Re-activate and confirm it's reversible.
      const activateRes = await request(app)
        .patch(`/admins/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });
      expect(activateRes.status).toBe(200);
      expect(activateRes.body.isActive).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('changes role', async () => {
    const res = await request(app)
      .patch(`/admins/${guideId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'LEAD_GUIDE' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('LEAD_GUIDE');
  });
});
