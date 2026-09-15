import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
let guideId: string;
let guideToken: string;
let leadGuideId: string;
let leadGuideToken: string;
let staffId: string;
let staffToken: string;
let inactiveGuideId: string;

beforeAll(async () => {
  const [admin, guide, leadGuide, staff, inactiveGuide] = await Promise.all([
    createTestAdmin('Assignable Guides Test Admin'),
    createTestAdmin('Assignable Guides Test Guide', { role: 'GUIDE' }),
    createTestAdmin('Assignable Guides Test Lead Guide', { role: 'LEAD_GUIDE' }),
    createTestAdmin('Assignable Guides Test Staff', { role: 'STAFF' }),
    createTestAdmin('Assignable Guides Test Inactive Guide', { role: 'GUIDE', data: { isActive: false } }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;
  leadGuideId = leadGuide.id;
  leadGuideToken = leadGuide.accessToken;
  staffId = staff.id;
  staffToken = staff.accessToken;
  inactiveGuideId = inactiveGuide.id;
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  await deleteTestAdmin(leadGuideId);
  await deleteTestAdmin(staffId);
  await deleteTestAdmin(inactiveGuideId);
  await prisma.$disconnect();
});

describe('GET /admins/assignable-guides', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/admins/assignable-guides');
    expect(res.status).toBe(401);
  });

  it('rejects a GUIDE role (403)', async () => {
    const res = await request(app).get('/admins/assignable-guides').set('Authorization', `Bearer ${guideToken}`);
    expect(res.status).toBe(403);
  });

  it(
    'allows ADMIN, LEAD_GUIDE, and STAFF',
    async () => {
      const adminRes = await request(app).get('/admins/assignable-guides').set('Authorization', `Bearer ${accessToken}`);
      expect(adminRes.status).toBe(200);

      const leadGuideRes = await request(app)
        .get('/admins/assignable-guides')
        .set('Authorization', `Bearer ${leadGuideToken}`);
      expect(leadGuideRes.status).toBe(200);

      const staffRes = await request(app).get('/admins/assignable-guides').set('Authorization', `Bearer ${staffToken}`);
      expect(staffRes.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'includes active GUIDE and LEAD_GUIDE admins, excludes STAFF/ADMIN and suspended guides, and never leaks sensitive fields',
    async () => {
      const res = await request(app).get('/admins/assignable-guides').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.guides)).toBe(true);

      const ids = res.body.guides.map((g: { id: string }) => g.id);
      expect(ids).toContain(guideId);
      expect(ids).toContain(leadGuideId);
      expect(ids).not.toContain(staffId);
      expect(ids).not.toContain(adminId);
      expect(ids).not.toContain(inactiveGuideId);

      const entry = res.body.guides.find((g: { id: string }) => g.id === guideId);
      expect(entry).toEqual({ id: guideId, name: expect.any(String), avatarUrl: null, role: 'GUIDE' });
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
