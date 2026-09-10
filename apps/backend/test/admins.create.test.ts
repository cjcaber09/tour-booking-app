import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmailBase = `admins-create-test-${Date.now()}`;
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;
const createdAdminIds: string[] = [];

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-admin@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Admins Create Test Admin',
        role: 'ADMIN',
      },
    }),
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-guide@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Admins Create Test Guide',
        role: 'GUIDE',
      },
    }),
  ]);
  adminId = admin.id;
  guideId = guide.id;
  adminToken = signAccessToken({ adminId });
  guideToken = signAccessToken({ adminId: guideId });
});

afterAll(async () => {
  const allIds = [adminId, guideId, ...createdAdminIds];
  await prisma.refreshToken.deleteMany({ where: { adminId: { in: allIds } } });
  await prisma.admin.deleteMany({ where: { id: { in: allIds } } });
  await prisma.$disconnect();
});

describe('POST /admins', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app)
      .post('/admins')
      .send({ name: 'X', email: `${testEmailBase}-x@example.com`, role: 'GUIDE' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-ADMIN caller (403)', async () => {
    const res = await request(app)
      .post('/admins')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ name: 'X', email: `${testEmailBase}-x@example.com`, role: 'GUIDE' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid body (400)', async () => {
    const res = await request(app)
      .post('/admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', email: 'not-an-email', role: 'NOT_A_ROLE' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email (409)', async () => {
    const res = await request(app)
      .post('/admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', email: `${testEmailBase}-admin@example.com`, role: 'GUIDE' });
    expect(res.status).toBe(409);
  });

  it('creates a new admin with a one-time temporaryPassword and no passwordHash leak', async () => {
    const email = `${testEmailBase}-new@example.com`;
    const res = await request(app)
      .post('/admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Guide', email, role: 'GUIDE', phone: '+1-555-0100' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    expect(res.body.role).toBe('GUIDE');
    expect(res.body.isActive).toBe(true);
    expect(typeof res.body.temporaryPassword).toBe('string');
    expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(8);
    expect(res.body.passwordHash).toBeUndefined();
    createdAdminIds.push(res.body.id);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email, password: res.body.temporaryPassword });
    expect(loginRes.status).toBe(200);
  });
});
