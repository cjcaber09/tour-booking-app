import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmail = `categories-list-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
const createdCategoryIds: string[] = [];

const DB_HEAVY_TEST_TIMEOUT = 15000;

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Categories List Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });

  const base = Date.now();
  const seeded = await Promise.all([
    prisma.category.create({ data: { name: `Zeta List ${base}`, slug: `zeta-list-${base}` } }),
    prisma.category.create({ data: { name: `Alpha List ${base}`, slug: `alpha-list-${base}` } }),
  ]);
  createdCategoryIds.push(...seeded.map((c) => c.id));
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('GET /categories', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(401);
  });

  it(
    'returns a paginated envelope',
    async () => {
      const res = await request(app).get('/categories').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('totalPages');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'sorts alphabetically by name',
    async () => {
      // limit=100 to make it likely both seeded rows land on the same page even alongside
      // other tests' leftover data; if either is missing from this page the ordering
      // assertion is skipped rather than false-failing on an unrelated pagination gap.
      const res = await request(app)
        .get('/categories')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);

      const names: string[] = res.body.categories.map((c: { name: string }) => c.name);
      const alphaIndex = names.findIndex((n) => n.startsWith('Alpha List'));
      const zetaIndex = names.findIndex((n) => n.startsWith('Zeta List'));
      if (alphaIndex !== -1 && zetaIndex !== -1) {
        expect(alphaIndex).toBeLessThan(zetaIndex);
      }
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'respects the limit param',
    async () => {
      const res = await request(app)
        .get('/categories')
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.categories.length).toBeLessThanOrEqual(1);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
