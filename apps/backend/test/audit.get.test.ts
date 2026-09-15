import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
let guideId: string;
let guideToken: string;
const originalEnableDevAuditLog = process.env.ENABLE_DEV_AUDIT_LOG;

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    createTestAdmin('Audit Get Test Admin'),
    createTestAdmin('Audit Get Test Guide', { role: 'GUIDE' }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;
});

afterEach(() => {
  if (originalEnableDevAuditLog === undefined) {
    delete process.env.ENABLE_DEV_AUDIT_LOG;
  } else {
    process.env.ENABLE_DEV_AUDIT_LOG = originalEnableDevAuditLog;
  }
});

afterAll(async () => {
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  await prisma.$disconnect();
});

describe('GET /audit', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/audit');
    expect(res.status).toBe(401);
  });

  it('rejects a GUIDE role (403), even with the feature enabled', async () => {
    process.env.ENABLE_DEV_AUDIT_LOG = 'true';
    const res = await request(app).get('/audit').set('Authorization', `Bearer ${guideToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an ADMIN when the feature flag is off', async () => {
    delete process.env.ENABLE_DEV_AUDIT_LOG;
    const res = await request(app).get('/audit').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns the entry list for an ADMIN when the feature flag is on', async () => {
    process.env.ENABLE_DEV_AUDIT_LOG = 'true';
    const res = await request(app).get('/audit').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});
