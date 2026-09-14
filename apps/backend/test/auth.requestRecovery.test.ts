import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin } from './helpers';

const app = createApp();
let testEmail: string;
let adminId: string;

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

beforeAll(async () => {
  ({ id: adminId, email: testEmail } = await createTestAdmin('Request Recovery Test Admin'));
});

afterAll(async () => {
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('POST /auth/request-recovery', () => {
  it('rejects a missing email (400)', async () => {
    const res = await request(app).post('/auth/request-recovery').send({});
    expect(res.status).toBe(400);
  });

  it(
    'responds identically for an existing and a non-existing email, and flags the existing one',
    async () => {
      const existing = await request(app).post('/auth/request-recovery').send({ email: testEmail });
      const nonExisting = await request(app)
        .post('/auth/request-recovery')
        .send({ email: `no-such-admin-${Date.now()}@example.com` });

      expect(existing.status).toBe(204);
      expect(nonExisting.status).toBe(204);
      expect(existing.body).toEqual(nonExisting.body);

      const admin = await prisma.admin.findUnique({ where: { id: adminId } });
      expect(admin?.recoveryRequestedAt).not.toBeNull();
    },
    15000,
  );

  it(
    'is rate limited to 5 requests per window when NODE_ENV is not test',
    async () => {
      process.env.NODE_ENV = 'production';
      // A fresh app so this limiter's counter starts at zero, independent of any requests the
      // earlier tests in this file made against the shared `app` instance.
      const freshApp = createApp();
      const email = `rate-limit-probe-${Date.now()}@example.com`;

      const results = await Promise.all(
        Array.from({ length: 6 }, () => request(freshApp).post('/auth/request-recovery').send({ email })),
      );

      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 204).length).toBe(5);
      expect(statuses.filter((s) => s === 429).length).toBe(1);
    },
    15000,
  );
});
