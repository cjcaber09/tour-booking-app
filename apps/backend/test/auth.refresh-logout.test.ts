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
  ({ id: adminId, email: testEmail } = await createTestAdmin('Refresh Logout Test Admin'));
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { adminId } });
  await deleteTestAdmin(adminId);
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
    const suspended = await createTestAdmin('Suspended Admin');
    try {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: suspended.email, password: testPassword });
      const refreshToken = loginRes.body.refreshToken as string;

      await prisma.admin.update({ where: { id: suspended.id }, data: { isActive: false } });

      const res = await request(app).post('/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(401);

      const remaining = await prisma.refreshToken.count({ where: { adminId: suspended.id } });
      expect(remaining).toBe(0);
    } finally {
      await prisma.refreshToken.deleteMany({ where: { adminId: suspended.id } });
      await deleteTestAdmin(suspended.id);
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
