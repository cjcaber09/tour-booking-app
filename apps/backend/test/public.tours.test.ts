import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const ALLOWED = '127.0.0.1,::1,::ffff:127.0.0.1';
let activeTourId: string;
let inactiveTourId: string;
const createdTourIds: string[] = [];
const createdCategoryIds: string[] = [];
const originalAllowlist = process.env.PUBLIC_API_IP_ALLOWLIST;

const DB_HEAVY_TEST_TIMEOUT = 15000;

beforeAll(async () => {
  const base = Date.now();
  const category = await prisma.category.create({
    data: { name: `Public Tours Test Category ${base}`, slug: `public-tours-test-category-${base}` },
  });
  createdCategoryIds.push(category.id);

  const activeTour = await prisma.tour.create({
    data: {
      title: `Public Active Tour ${base}`,
      slug: `public-active-tour-${base}`,
      description: 'desc',
      price: 100,
      isActive: true,
      categories: { connect: [{ id: category.id }] },
    },
  });
  activeTourId = activeTour.id;
  createdTourIds.push(activeTour.id);

  const inactiveTour = await prisma.tour.create({
    data: {
      title: `Public Inactive Tour ${base}`,
      slug: `public-inactive-tour-${base}`,
      description: 'desc',
      price: 100,
      isActive: false,
    },
  });
  inactiveTourId = inactiveTour.id;
  createdTourIds.push(inactiveTour.id);
}, DB_HEAVY_TEST_TIMEOUT);

afterEach(() => {
  if (originalAllowlist === undefined) {
    delete process.env.PUBLIC_API_IP_ALLOWLIST;
  } else {
    process.env.PUBLIC_API_IP_ALLOWLIST = originalAllowlist;
  }
});

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await prisma.$disconnect();
});

describe('GET /public/tours', () => {
  it(
    'returns only active tours, unpaginated, when called from an allowlisted IP',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
      const res = await request(app).get('/public/tours');
      expect(res.status).toBe(200);
      const ids = res.body.tours.map((t: { id: string }) => t.id);
      expect(ids).toContain(activeTourId);
      expect(ids).not.toContain(inactiveTourId);
      expect(res.body.page).toBeUndefined();
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects a call from a non-allowlisted IP', async () => {
    process.env.PUBLIC_API_IP_ALLOWLIST = '203.0.113.99';
    const res = await request(app).get('/public/tours');
    expect(res.status).toBe(403);
  });

  it('rejects when the allowlist is unset', async () => {
    delete process.env.PUBLIC_API_IP_ALLOWLIST;
    const res = await request(app).get('/public/tours');
    expect(res.status).toBe(403);
  });
});
