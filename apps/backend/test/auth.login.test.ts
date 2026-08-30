import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

const app = createApp();
const testEmail = `login-test-${Date.now()}@example.com`;
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

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
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
});
