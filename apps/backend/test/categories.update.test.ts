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
  ({ id: adminId, accessToken } = await createTestAdmin('Categories Update Test Admin'));
});

afterAll(async () => {
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('PATCH /categories/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).patch('/categories/00000000-0000-0000-0000-000000000000').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .patch('/categories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it(
    'renames a category without changing its slug',
    async () => {
      const base = Date.now();
      const created = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Original Name ${base}` });
      createdCategoryIds.push(created.body.id);
      const originalSlug = created.body.slug;

      const res = await request(app)
        .patch(`/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Renamed ${base}` });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(`Renamed ${base}`);
      expect(res.body.slug).toBe(originalSlug);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'allows renaming two different categories to slug-colliding names, since name has no unique constraint',
    async () => {
      const base = Date.now();
      const a = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Category A ${base}` });
      const b = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Category B ${base}` });
      createdCategoryIds.push(a.body.id, b.body.id);

      const res = await request(app)
        .patch(`/categories/${b.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: a.body.name });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(a.body.name);
      expect(res.body.slug).toBe(b.body.slug); // unchanged — PATCH never touches slug
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
