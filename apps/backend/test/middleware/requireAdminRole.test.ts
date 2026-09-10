import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireAuth } from '../../src/middleware/auth';
import { requireAdminRole } from '../../src/middleware/requireAdminRole';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/lib/password';
import { signAccessToken } from '../../src/lib/tokens';

function buildTestApp() {
  const app = express();
  app.get('/gated', requireAuth, requireAdminRole('ADMIN'), (req, res) => {
    res.json({ adminRole: req.adminRole });
  });
  return app;
}

const testEmailBase = `require-admin-role-test-${Date.now()}`;
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-admin@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Admin Role Test Admin',
        role: 'ADMIN',
      },
    }),
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-guide@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Admin Role Test Guide',
        role: 'GUIDE',
      },
    }),
  ]);
  adminId = admin.id;
  guideId = guide.id;
  adminToken = signAccessToken({ adminId });
  guideToken = signAccessToken({ adminId: guideId });
});

afterAll(async () => {
  await prisma.admin.deleteMany({ where: { id: { in: [adminId, guideId] } } });
  await prisma.$disconnect();
});

describe('requireAdminRole middleware', () => {
  it('rejects a request with no token (401, never reaches the role check)', async () => {
    const res = await request(buildTestApp()).get('/gated');
    expect(res.status).toBe(401);
  });

  it('rejects a non-allowed role (403)', async () => {
    const res = await request(buildTestApp()).get('/gated').set('Authorization', `Bearer ${guideToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('allows an allowed role (200)', async () => {
    const res = await request(buildTestApp()).get('/gated').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.adminRole).toBe('ADMIN');
  });

  it('rejects a suspended admin even with an allowed role (403)', async () => {
    const suspended = await prisma.admin.create({
      data: {
        email: `${testEmailBase}-suspended@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Admin Role Test Suspended Admin',
        role: 'ADMIN',
        isActive: false,
      },
    });
    try {
      const suspendedToken = signAccessToken({ adminId: suspended.id });
      const res = await request(buildTestApp()).get('/gated').set('Authorization', `Bearer ${suspendedToken}`);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'forbidden' });
    } finally {
      await prisma.admin.delete({ where: { id: suspended.id } });
    }
  });
});
