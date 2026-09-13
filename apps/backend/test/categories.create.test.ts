import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmail = `categories-create-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
const createdCategoryIds: string[] = [];

const DB_HEAVY_TEST_TIMEOUT = 15000;

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Categories Create Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });
});

afterAll(async () => {
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('POST /categories', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post('/categories').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid body (400)', async () => {
    const res = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it(
    'creates a category with an auto-generated slug',
    async () => {
      const base = Date.now();
      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Adventure ${base}` });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(`Adventure ${base}`);
      expect(typeof res.body.slug).toBe('string');
      expect(res.body.slug.length).toBeGreaterThan(0);
      createdCategoryIds.push(res.body.id);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects a name that slugifies to an existing category (409)',
    async () => {
      const base = Date.now();
      const first = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Wildlife Tours ${base}` });
      expect(first.status).toBe(201);
      createdCategoryIds.push(first.body.id);

      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Wildlife Tours ${base}` });
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
