import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
const createdTourIds: string[] = [];

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Tours Get Test Admin'));
});

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('GET /tours/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/tours/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .get('/tours/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it(
    'returns the full tour record including categories',
    async () => {
      const created = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Get Detail Tour',
          description: 'A tour to fetch by id',
          summary: 'Short summary',
          price: 120,
          images: ['https://example.com/1.jpg'],
        });
      createdTourIds.push(created.body.id);

      const res = await request(app)
        .get(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Get Detail Tour');
      expect(res.body.description).toBe('A tour to fetch by id');
      expect(res.body.summary).toBe('Short summary');
      expect(res.body.images).toEqual(['https://example.com/1.jpg']);
      expect(res.body.categories).toEqual([]);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
