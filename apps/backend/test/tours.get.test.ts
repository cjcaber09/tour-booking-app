import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmail = `tours-get-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
const createdTourIds: string[] = [];

const DB_HEAVY_TEST_TIMEOUT = 15000;

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Tours Get Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });
});

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
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
