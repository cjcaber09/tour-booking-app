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
  ({ id: adminId, email: testEmail } = await createTestAdmin('Me Test Admin'));
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { adminId } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('GET /auth/me', () => {
  it('returns the logged-in admin for a valid access token', async () => {
    const loginRes = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual({
      id: expect.any(String),
      email: testEmail,
      name: 'Test Admin',
      role: 'ADMIN',
      avatarUrl: null,
      phone: null,
      createdAt: expect.any(String),
      lastLoginAt: expect.any(String),
    });
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
