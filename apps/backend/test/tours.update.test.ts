import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
const createdTourIds: string[] = [];
const createdCategoryIds: string[] = [];

// The categories test below does 5 sequential/parallel round trips (3 category
// creates, a tour create, a patch) and runs close to DB_HEAVY_TEST_TIMEOUT under load.
const CATEGORY_SET_TEST_TIMEOUT = 25000;

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Tours Update Test Admin'));
});

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('PATCH /tours/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).patch('/tours/00000000-0000-0000-0000-000000000000').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .patch('/tours/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Does not exist' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid body', async () => {
    const created = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Invalid Update Tour', description: 'desc', price: 100 });
    createdTourIds.push(created.body.id);

    const res = await request(app)
      .patch(`/tours/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ difficulty: 'extreme' });
    expect(res.status).toBe(400);
  });

  it(
    'updates a single field and leaves the rest unchanged',
    async () => {
      const created = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Single Field Update Tour',
          description: 'original description',
          price: 100,
          summary: 'original summary',
        });
      createdTourIds.push(created.body.id);

      const res = await request(app)
        .patch(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Title Only' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title Only');
      expect(res.body.description).toBe('original description');
      expect(res.body.summary).toBe('original summary');
      expect(res.body.slug).toBe(created.body.slug);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'suspends a tour by setting isActive to false',
    async () => {
      const created = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Suspend Test Tour', description: 'desc', price: 100 });
      createdTourIds.push(created.body.id);

      const res = await request(app)
        .patch(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'replaces categories using set semantics, not append',
    async () => {
      const [categoryA, categoryB, categoryC] = await Promise.all([
        prisma.category.create({ data: { name: 'Cat A', slug: `cat-a-${Date.now()}` } }),
        prisma.category.create({ data: { name: 'Cat B', slug: `cat-b-${Date.now()}` } }),
        prisma.category.create({ data: { name: 'Cat C', slug: `cat-c-${Date.now()}` } }),
      ]);
      createdCategoryIds.push(categoryA.id, categoryB.id, categoryC.id);

      const created = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Category Set Tour',
          description: 'desc',
          price: 100,
          categoryIds: [categoryA.id, categoryB.id],
        });
      createdTourIds.push(created.body.id);

      const res = await request(app)
        .patch(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ categoryIds: [categoryC.id] });

      expect(res.status).toBe(200);
      expect(res.body.categories.map((c: { id: string }) => c.id)).toEqual([categoryC.id]);
    },
    CATEGORY_SET_TEST_TIMEOUT,
  );
});
