import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

const app = createApp();
const testEmail = `me-test-${Date.now()}@example.com`;
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

describe('GET /auth/me', () => {
  it('returns the logged-in admin for a valid access token', async () => {
    const loginRes = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual({ id: expect.any(String), email: testEmail, name: 'Test Admin' });
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
