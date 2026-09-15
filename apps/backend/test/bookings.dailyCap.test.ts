import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { getOrCreateSettings } from '../src/lib/settings';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
const ALLOWED = '127.0.0.1,::1,::ffff:127.0.0.1';
const originalAllowlist = process.env.PUBLIC_API_IP_ALLOWLIST;

let adminId: string;
let accessToken: string;
let tourId: string;
let originalMaxBookingsPerDay: number;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];

// Dedicated calendar days per scenario, anchored far in the future (year 2093, distinct
// from the per-file anchors bookings.create/update/confirm.test.ts use) so nothing here
// can collide with a booking created elsewhere in the suite regardless of run order.
const dayPublic = new Date(Date.UTC(2093, 0, 1));
const dayAdminCreate = new Date(Date.UTC(2093, 0, 2));
const dayConfirmQueue = new Date(Date.UTC(2093, 0, 3));
const dayMovedInto = new Date(Date.UTC(2093, 0, 4));
const dayMovedFrom = new Date(Date.UTC(2093, 0, 5));
const dayAdminCreatePending = new Date(Date.UTC(2093, 0, 6));

async function createPendingBooking(startDate: Date) {
  const customer = await prisma.customer.create({
    data: {
      email: `bookings-dailycap-${Date.now()}${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Daily Cap Customer',
    },
  });
  createdCustomerIds.push(customer.id);
  const booking = await prisma.booking.create({
    data: {
      reference: `BK-DAILYCAP${Date.now()}${Math.random().toString(16).slice(2)}`,
      tourId,
      customerId: customer.id,
      participants: 1,
      startDate,
      totalPrice: 100,
      status: 'PENDING',
    },
  });
  createdBookingIds.push(booking.id);
  return booking;
}

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Bookings Daily Cap Test Admin'));

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Daily Cap Tour ${base}`,
      slug: `bookings-daily-cap-tour-${base}`,
      description: 'desc',
      price: 100,
      isActive: true,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  // Same snapshot-and-restore-in-afterAll pattern settings.update.test.ts already uses
  // for `currency`. A concurrently-running file that also mutates maxBookingsPerDay
  // (settings.update.test.ts briefly sets it to 3) could in theory interleave with
  // this — the same class of shared-global-state risk bookings.stats.test.ts already
  // documents for its own aggregate counts. Accepted here rather than engineered
  // around, matching this suite's existing risk tolerance.
  const settings = await getOrCreateSettings();
  originalMaxBookingsPerDay = settings.maxBookingsPerDay;
  await prisma.appSettings.update({ where: { key: 'singleton' }, data: { maxBookingsPerDay: 1 } });
}, DB_HEAVY_TEST_TIMEOUT);

afterEach(() => {
  if (originalAllowlist === undefined) {
    delete process.env.PUBLIC_API_IP_ALLOWLIST;
  } else {
    process.env.PUBLIC_API_IP_ALLOWLIST = originalAllowlist;
  }
});

afterAll(async () => {
  await prisma.appSettings.update({ where: { key: 'singleton' }, data: { maxBookingsPerDay: originalMaxBookingsPerDay } });
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('Daily booking cap (maxBookingsPerDay)', () => {
  it(
    'PENDING bookings never guard a date, even past the cap',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;

      const email1 = `dailycap-pub1-${Date.now()}${Math.random().toString(16).slice(2)}@example.com`;
      const first = await request(app)
        .post('/public/bookings')
        .send({ tourId, participants: 1, startDate: dayPublic.toISOString(), customer: { email: email1, name: 'Public One' } });
      expect(first.status).toBe(201);
      const firstBooking = await prisma.booking.findUnique({ where: { reference: first.body.reference } });
      if (firstBooking) createdBookingIds.push(firstBooking.id);
      const customer1 = await prisma.customer.findUnique({ where: { email: email1 } });
      if (customer1) createdCustomerIds.push(customer1.id);

      const email2 = `dailycap-pub2-${Date.now()}${Math.random().toString(16).slice(2)}@example.com`;
      const second = await request(app)
        .post('/public/bookings')
        .send({ tourId, participants: 1, startDate: dayPublic.toISOString(), customer: { email: email2, name: 'Public Two' } });
      expect(second.status).toBe(201);
      const secondBooking = await prisma.booking.findUnique({ where: { reference: second.body.reference } });
      if (secondBooking) createdBookingIds.push(secondBooking.id);
      const customer2 = await prisma.customer.findUnique({ where: { email: email2 } });
      if (customer2) createdCustomerIds.push(customer2.id);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'a second admin-created CONFIRMED booking on an already-full day is rejected',
    async () => {
      const first = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId,
          participants: 1,
          startDate: dayAdminCreate.toISOString(),
          customer: { email: `dailycap-admin1-${Date.now()}@example.com`, name: 'Admin One' },
          confirmed: true,
        });
      expect(first.status).toBe(201);
      createdBookingIds.push(first.body.id);
      createdCustomerIds.push(first.body.customer.id);

      const second = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId,
          participants: 1,
          startDate: dayAdminCreate.toISOString(),
          customer: { email: `dailycap-admin2-${Date.now()}@example.com`, name: 'Admin Two' },
          confirmed: true,
        });
      expect(second.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'two admin-created bookings on the same day both succeed when neither passes confirmed (PENDING does not consume the cap)',
    async () => {
      const first = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId,
          participants: 1,
          startDate: dayAdminCreatePending.toISOString(),
          customer: { email: `dailycap-pending1-${Date.now()}@example.com`, name: 'Pending One' },
        });
      expect(first.status).toBe(201);
      expect(first.body.status).toBe('PENDING');
      createdBookingIds.push(first.body.id);
      createdCustomerIds.push(first.body.customer.id);

      const second = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId,
          participants: 1,
          startDate: dayAdminCreatePending.toISOString(),
          customer: { email: `dailycap-pending2-${Date.now()}@example.com`, name: 'Pending Two' },
        });
      expect(second.status).toBe(201);
      expect(second.body.status).toBe('PENDING');
      createdBookingIds.push(second.body.id);
      createdCustomerIds.push(second.body.customer.id);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'confirming a second PENDING booking on a day that already has one CONFIRMED booking is rejected, then succeeds once the day frees up',
    async () => {
      const booking1 = await createPendingBooking(dayConfirmQueue);
      const booking2 = await createPendingBooking(dayConfirmQueue);

      const confirm1 = await request(app)
        .post(`/bookings/${booking1.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(confirm1.status).toBe(200);

      const confirm2 = await request(app)
        .post(`/bookings/${booking2.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(confirm2.status).toBe(409);

      const cancel1 = await request(app)
        .post(`/bookings/${booking1.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 0 });
      expect(cancel1.status).toBe(200);

      const confirm2Retry = await request(app)
        .post(`/bookings/${booking2.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(confirm2Retry.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'moving a CONFIRMED booking onto an already-full day is rejected; resubmitting its current date is not',
    async () => {
      const occupying = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId,
          participants: 1,
          startDate: dayMovedInto.toISOString(),
          customer: { email: `dailycap-occupy-${Date.now()}@example.com`, name: 'Occupying' },
          confirmed: true,
        });
      expect(occupying.status).toBe(201);
      createdBookingIds.push(occupying.body.id);
      createdCustomerIds.push(occupying.body.customer.id);

      const mover = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId,
          participants: 1,
          startDate: dayMovedFrom.toISOString(),
          customer: { email: `dailycap-mover-${Date.now()}@example.com`, name: 'Mover' },
          confirmed: true,
        });
      expect(mover.status).toBe(201);
      createdBookingIds.push(mover.body.id);
      createdCustomerIds.push(mover.body.customer.id);

      const rejected = await request(app)
        .patch(`/bookings/${mover.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ startDate: dayMovedInto.toISOString() });
      expect(rejected.status).toBe(409);

      const noop = await request(app)
        .patch(`/bookings/${mover.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ startDate: dayMovedFrom.toISOString(), notes: 'unchanged date resubmit' });
      expect(noop.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
