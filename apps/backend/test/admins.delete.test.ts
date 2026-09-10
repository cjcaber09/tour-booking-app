import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken, signRefreshToken, hashToken, refreshTokenExpiryDate } from '../src/lib/tokens';

const app = createApp();
const testEmailBase = `admins-delete-test-${Date.now()}`;
const password = 'correct-horse-battery-staple';
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;
const allIds: string[] = [];

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-admin@example.com`,
        passwordHash: await hashPassword(password),
        name: 'Admins Delete Test Admin',
        role: 'ADMIN',
      },
    }),
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-guide@example.com`,
        passwordHash: await hashPassword(password),
        name: 'Admins Delete Test Guide',
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

describe('DELETE /admins/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).delete(`/admins/${guideId}`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-ADMIN caller (403)', async () => {
    const res = await request(app).delete(`/admins/${adminId}`).set('Authorization', `Bearer ${guideToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects a self-delete (400)', async () => {
    const res = await request(app).delete(`/admins/${adminId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .delete('/admins/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('deletes the admin and cleans up their refresh tokens', async () => {
    const target = await prisma.admin.create({
      data: {
        email: `${testEmailBase}-target@example.com`,
        passwordHash: await hashPassword(password),
        name: 'Delete Target',
        role: 'GUIDE',
      },
    });
    const refreshToken = signRefreshToken(target.id);
    await prisma.refreshToken.create({
      data: { adminId: target.id, tokenHash: hashToken(refreshToken), expiresAt: refreshTokenExpiryDate() },
    });

    const res = await request(app).delete(`/admins/${target.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: target.id });

    const stillThere = await prisma.admin.findUnique({ where: { id: target.id } });
    expect(stillThere).toBeNull();

    const remainingTokens = await prisma.refreshToken.findMany({ where: { adminId: target.id } });
    expect(remainingTokens).toEqual([]);
  });
});
