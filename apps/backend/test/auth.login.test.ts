import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, TEST_PASSWORD } from './helpers';

const app = createApp();
const testPassword = TEST_PASSWORD;
let testEmail: string;
let adminId: string;

beforeAll(async () => {
  ({ id: adminId, email: testEmail } = await createTestAdmin('Login Test Admin'));
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { adminId } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
  });

  it('stamps lastLoginAt on the admin row', async () => {
    const res = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });
    expect(res.status).toBe(200);

    const admin = await prisma.admin.findUnique({ where: { email: testEmail } });
    expect(admin?.lastLoginAt).toBeInstanceOf(Date);
    expect(admin!.lastLoginAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: testPassword });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('rejects a wrong password', async () => {
    const res = await request(app).post('/auth/login').send({ email: testEmail, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('rejects a missing password', async () => {
    const res = await request(app).post('/auth/login').send({ email: testEmail });
    expect(res.status).toBe(400);
  });

  it('rejects a suspended admin (403)', async () => {
    const suspended = await createTestAdmin('Suspended Admin', { data: { isActive: false } });
    try {
      const res = await request(app).post('/auth/login').send({ email: suspended.email, password: testPassword });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('account is suspended');
    } finally {
      await deleteTestAdmin(suspended.id);
    }
  });
});
