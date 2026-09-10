import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

const app = createApp();
const testEmail = `refresh-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';

beforeAll(async () => {
  await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Test Admin' },
  });
});

afterAll(async () => {
  const admin = await prisma.admin.findUnique({ where: { email: testEmail } });
  if (admin) {
    await prisma.refreshToken.deleteMany({ where: { adminId: admin.id } });
    await prisma.admin.delete({ where: { id: admin.id } });
  }
  await prisma.$disconnect();
});

async function login() {
  const res = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });
  return res.body.refreshToken as string;
}

describe('POST /auth/refresh', () => {
  it('issues a new access token from a valid refresh token', async () => {
    const refreshToken = await login();
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
  });

  it('rejects an invalid refresh token', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });

  it('rejects a valid refresh token for a suspended admin, and revokes it', async () => {
    const email = `refresh-test-suspended-${Date.now()}@example.com`;
    const suspended = await prisma.admin.create({
      data: { email, passwordHash: await hashPassword(testPassword), name: 'Suspended Admin' },
    });
    try {
      const loginRes = await request(app).post('/auth/login').send({ email, password: testPassword });
      const refreshToken = loginRes.body.refreshToken as string;

      await prisma.admin.update({ where: { id: suspended.id }, data: { isActive: false } });

      const res = await request(app).post('/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(401);

      const remaining = await prisma.refreshToken.count({ where: { adminId: suspended.id } });
      expect(remaining).toBe(0);
    } finally {
      await prisma.refreshToken.deleteMany({ where: { adminId: suspended.id } });
      await prisma.admin.delete({ where: { id: suspended.id } });
    }
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so it can no longer be used', async () => {
    const refreshToken = await login();

    const logoutRes = await request(app).post('/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
