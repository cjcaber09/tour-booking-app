import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
let tourId: string;
let customerId: string;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];

const PAGE_SEED_COUNT = 15;

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Bookings List Test Admin'));

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings List Tour ${base}`,
      slug: `bookings-list-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  const customer = await prisma.customer.create({
    data: { email: `bookings-list-customer-${base}@example.com`, name: 'List Findable Customer' },
  });
  customerId = customer.id;
  createdCustomerIds.push(customer.id);

  const seeded = await Promise.all(
    Array.from({ length: PAGE_SEED_COUNT }, (_, i) =>
      prisma.booking.create({
        data: {
          reference: `BK-LISTSEED${base}${i}`,
          tourId,
          customerId,
          participants: 1,
          startDate: new Date(base),
          totalPrice: 100,
          createdAt: new Date(base + i * 60_000),
        },
      }),
    ),
  );
  createdBookingIds.push(...seeded.map((b) => b.id));
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('GET /bookings', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/bookings');
    expect(res.status).toBe(401);
  });

  it('returns the first page with the default limit of 10', async () => {
    const res = await request(app).get('/bookings').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBe(10);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(res.body.total).toBeGreaterThanOrEqual(PAGE_SEED_COUNT);
  });

  it('returns the second page with the remaining bookings', async () => {
    const res = await request(app)
      .get('/bookings')
      .query({ page: 2, limit: 10 })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.bookings.length).toBeGreaterThan(0);
  });

  it(
    'sorts pending bookings before confirmed, newest first within each group',
    async () => {
      const base = Date.now();
      const orderingSeed = await Promise.all([
        prisma.booking.create({
          data: {
            reference: `BK-ORDCONFOLD${base}`,
            tourId,
            customerId,
            participants: 1,
            startDate: new Date(base),
            totalPrice: 100,
            status: 'CONFIRMED',
            createdAt: new Date(base),
          },
        }),
        prisma.booking.create({
          data: {
            reference: `BK-ORDPENDNEW${base}`,
            tourId,
            customerId,
            participants: 1,
            startDate: new Date(base),
            totalPrice: 100,
            status: 'PENDING',
            createdAt: new Date(base + 60_000),
          },
        }),
        prisma.booking.create({
          data: {
            reference: `BK-ORDPENDOLD${base}`,
            tourId,
            customerId,
            participants: 1,
            startDate: new Date(base),
            totalPrice: 100,
            status: 'PENDING',
            createdAt: new Date(base - 60_000),
          },
        }),
      ]);
      createdBookingIds.push(...orderingSeed.map((b) => b.id));

      const res = await request(app)
        .get('/bookings')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);

      const relevantRefs = [`BK-ORDCONFOLD${base}`, `BK-ORDPENDNEW${base}`, `BK-ORDPENDOLD${base}`];
      const returnedOrder = res.body.bookings
        .map((b: { reference: string }) => b.reference)
        .filter((reference: string) => relevantRefs.includes(reference));

      expect(returnedOrder).toEqual([`BK-ORDPENDNEW${base}`, `BK-ORDPENDOLD${base}`, `BK-ORDCONFOLD${base}`]);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'filters by status',
    async () => {
      const res = await request(app)
        .get('/bookings')
        .query({ status: 'PENDING', limit: 100 })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bookings.every((b: { status: string }) => b.status === 'PENDING')).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'matches q against the booking reference',
    async () => {
      const res = await request(app)
        .get('/bookings')
        .query({ q: 'LISTSEED' })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(PAGE_SEED_COUNT);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'matches q against the linked customer name',
    async () => {
      const res = await request(app)
        .get('/bookings')
        .query({ q: 'List Findable Customer' })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(0);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects an invalid page value', async () => {
    const res = await request(app).get('/bookings').query({ page: 0 }).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });
});
