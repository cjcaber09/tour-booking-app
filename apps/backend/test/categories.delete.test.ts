import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
const createdCategoryIds: string[] = [];
const createdTourIds: string[] = [];

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Categories Delete Test Admin'));
});

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('DELETE /categories/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).delete('/categories/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .delete('/categories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it(
    'deletes a category with no tours attached',
    async () => {
      const created = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Delete Me ${Date.now()}` });

      const res = await request(app)
        .delete(`/categories/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'deleting a category attached to a tour succeeds and just detaches it (ON DELETE CASCADE on the join table), not blocked with a 409',
    async () => {
      const base = Date.now();
      const category = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Attached Category ${base}` });
      createdCategoryIds.push(category.body.id);

      const tour = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: `Categories Delete Test Tour ${base}`,
          description: 'desc',
          price: 100,
          categoryIds: [category.body.id],
        });
      createdTourIds.push(tour.body.id);
      expect(tour.body.categories.map((c: { id: string }) => c.id)).toContain(category.body.id);

      const deleteRes = await request(app)
        .delete(`/categories/${category.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(200);

      const refetched = await request(app)
        .get(`/tours/${tour.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(refetched.status).toBe(200);
      expect(refetched.body.categories.map((c: { id: string }) => c.id)).not.toContain(category.body.id);

      createdCategoryIds.splice(createdCategoryIds.indexOf(category.body.id), 1); // already deleted
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
