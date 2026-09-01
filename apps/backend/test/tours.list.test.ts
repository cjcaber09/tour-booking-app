import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmail = `tours-list-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
const createdTourIds: string[] = [];

// Seeding + pagination round trips against the real dev database can exceed
// vitest's 5s default timeout under real network latency.
const DB_HEAVY_TEST_TIMEOUT = 15000;
const PAGE_SEED_COUNT = 15;

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Tours List Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });

  const base = Date.now();
  const seeded = await Promise.all(
    Array.from({ length: PAGE_SEED_COUNT }, (_, i) =>
      prisma.tour.create({
        data: {
          title: `List Page Test Tour ${i}`,
          slug: `list-page-test-tour-${base}-${i}`,
          description: 'Seed tour for pagination tests',
          price: 100,
          createdAt: new Date(base + i * 60_000),
        },
      }),
    ),
  );
  createdTourIds.push(...seeded.map((t) => t.id));
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('GET /tours', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/tours');
    expect(res.status).toBe(401);
  });

  it('returns the first page with the default limit of 10', async () => {
    const res = await request(app).get('/tours').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tours.length).toBe(10);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(res.body.total).toBeGreaterThanOrEqual(PAGE_SEED_COUNT);
  });

  it('returns the second page with the remaining tours', async () => {
    const res = await request(app)
      .get('/tours')
      .query({ page: 2, limit: 10 })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.tours.length).toBeGreaterThan(0);
  });

  it(
    'sorts active tours before inactive tours, newest first within each group',
    async () => {
      const base = Date.now();
      const orderingSeed = await Promise.all([
        prisma.tour.create({
          data: {
            title: 'Ordering Test Active Older',
            slug: `ordering-test-active-older-${base}`,
            description: 'active, older',
            price: 100,
            isActive: true,
            createdAt: new Date(base),
          },
        }),
        prisma.tour.create({
          data: {
            title: 'Ordering Test Active Newer',
            slug: `ordering-test-active-newer-${base}`,
            description: 'active, newer',
            price: 100,
            isActive: true,
            createdAt: new Date(base + 60_000),
          },
        }),
        prisma.tour.create({
          data: {
            title: 'Ordering Test Inactive Older',
            slug: `ordering-test-inactive-older-${base}`,
            description: 'inactive, older',
            price: 100,
            isActive: false,
            createdAt: new Date(base + 120_000),
          },
        }),
        prisma.tour.create({
          data: {
            title: 'Ordering Test Inactive Newer',
            slug: `ordering-test-inactive-newer-${base}`,
            description: 'inactive, newer',
            price: 100,
            isActive: false,
            createdAt: new Date(base + 180_000),
          },
        }),
      ]);
      createdTourIds.push(...orderingSeed.map((t) => t.id));

      const res = await request(app)
        .get('/tours')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);

      const orderingTitles = [
        'Ordering Test Active Older',
        'Ordering Test Active Newer',
        'Ordering Test Inactive Older',
        'Ordering Test Inactive Newer',
      ];
      const returnedOrder = res.body.tours
        .map((t: { title: string }) => t.title)
        .filter((title: string) => orderingTitles.includes(title));

      expect(returnedOrder).toEqual([
        'Ordering Test Active Newer',
        'Ordering Test Active Older',
        'Ordering Test Inactive Newer',
        'Ordering Test Inactive Older',
      ]);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects an invalid page value', async () => {
    const res = await request(app).get('/tours').query({ page: 0 }).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('rejects an invalid limit value', async () => {
    const res = await request(app)
      .get('/tours')
      .query({ limit: 'abc' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });
});
