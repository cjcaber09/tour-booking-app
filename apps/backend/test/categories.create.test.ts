import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
const createdCategoryIds: string[] = [];

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Categories Create Test Admin'));
});

afterAll(async () => {
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await deleteTestAdmin(adminId);
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
