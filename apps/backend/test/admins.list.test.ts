import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin } from './helpers';

const app = createApp();
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;
let suspendedId: string;
const allIds: string[] = [];

beforeAll(async () => {
  const [admin, guide, suspended] = await Promise.all([
    createTestAdmin('Admins List Test Admin', { role: 'ADMIN' }),
    createTestAdmin('Zendaya Guide List Match', { role: 'GUIDE' }),
    createTestAdmin('Suspended Lead', { role: 'LEAD_GUIDE', data: { isActive: false } }),
  ]);
  adminId = admin.id;
  guideId = guide.id;
  suspendedId = suspended.id;
  allIds.push(adminId, guideId, suspendedId);
  adminToken = admin.accessToken;
  guideToken = guide.accessToken;
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { adminId: { in: allIds } } });
  await prisma.admin.deleteMany({ where: { id: { in: allIds } } });
  await prisma.$disconnect();
});

describe('GET /admins', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/admins');
    expect(res.status).toBe(401);
  });

  it('rejects a non-ADMIN caller (403)', async () => {
    const res = await request(app).get('/admins').set('Authorization', `Bearer ${guideToken}`);
    expect(res.status).toBe(403);
  });

  it('filters by role', async () => {
    const res = await request(app)
      .get('/admins')
      .query({ role: 'LEAD_GUIDE' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.admins.every((a: { role: string }) => a.role === 'LEAD_GUIDE')).toBe(true);
    expect(res.body.admins.some((a: { id: string }) => a.id === suspendedId)).toBe(true);
  });

  it('filters by isActive', async () => {
    const res = await request(app)
      .get('/admins')
      .query({ isActive: 'false' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.admins.every((a: { isActive: boolean }) => a.isActive === false)).toBe(true);
    expect(res.body.admins.some((a: { id: string }) => a.id === suspendedId)).toBe(true);
  });

  it('matches q against name or email, case-insensitively', async () => {
    const res = await request(app)
      .get('/admins')
      .query({ q: 'zendaya' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.admins.some((a: { id: string }) => a.id === guideId)).toBe(true);
  });

  it('paginates and never returns passwordHash', async () => {
    const res = await request(app)
      .get('/admins')
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.admins.length).toBeLessThanOrEqual(1);
    expect(res.body.admins.every((a: Record<string, unknown>) => a.passwordHash === undefined)).toBe(true);
  });
});
