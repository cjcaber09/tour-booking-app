import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
let tourId: string;
let otherTourId: string;
let customerId: string;
let otherCustomerId: string;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];

// The "max bookings per day" cap (default 1) counts CONFIRMED bookings per calendar
// day, and every booking created here via POST /bookings lands as CONFIRMED — so each
// one needs its own distinct day by default, or later creates would 409 against
// earlier ones. Anchored far in the future (year 2091, distinct from other test
// files' anchors) so it never collides with a hardcoded date used elsewhere in the
// suite; callers that need a specific date (e.g. testing offered-dates validation)
// still override it via `overrides.startDate`.
const dateAnchor = Date.now() % 10000;
let dayOffset = 0;
function uniqueStartDate(): string {
  return new Date(Date.UTC(2091, 0, 1 + dateAnchor + dayOffset++)).toISOString();
}

async function createBooking(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/bookings')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      tourId,
      participants: 1,
      startDate: uniqueStartDate(),
      customerId,
      ...overrides,
    });
  createdBookingIds.push(res.body.id);
  return res.body;
}

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Bookings Update Test Admin'));

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Update Tour ${base}`,
      slug: `bookings-update-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  const otherTour = await prisma.tour.create({
    data: {
      title: `Bookings Update Other Tour ${base}`,
      slug: `bookings-update-other-tour-${base}`,
      description: 'desc',
      price: 50,
    },
  });
  otherTourId = otherTour.id;
  createdTourIds.push(otherTour.id);

  const customer = await prisma.customer.create({
    data: { email: `bookings-update-customer-${base}@example.com`, name: 'Update Test Customer' },
  });
  customerId = customer.id;
  createdCustomerIds.push(customer.id);

  const otherCustomer = await prisma.customer.create({
    data: { email: `bookings-update-other-customer-${base}@example.com`, name: 'Other Update Test Customer' },
  });
  otherCustomerId = otherCustomer.id;
  createdCustomerIds.push(otherCustomer.id);
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('PATCH /bookings/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).patch('/bookings/00000000-0000-0000-0000-000000000000').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .patch('/bookings/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ notes: 'x' });
    expect(res.status).toBe(404);
  });

  it(
    'updates notes and leaves everything else unchanged',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ notes: 'Called ahead, confirmed arrival time' });
      expect(res.status).toBe(200);
      expect(res.body.notes).toBe('Called ahead, confirmed arrival time');
      expect(Number(res.body.totalPrice)).toBe(Number(booking.totalPrice));
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'recomputes totalPrice when participants changes',
    async () => {
      const booking = await createBooking({ participants: 1 });
      expect(Number(booking.totalPrice)).toBe(100);

      const res = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ participants: 3 });
      expect(res.status).toBe(200);
      expect(Number(res.body.totalPrice)).toBe(300);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'recomputes totalPrice when tourId changes',
    async () => {
      const booking = await createBooking({ participants: 2 });
      const res = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tourId: otherTourId });
      expect(res.status).toBe(200);
      expect(Number(res.body.totalPrice)).toBe(100); // 50 * 2
      expect(res.body.tour.id).toBe(otherTourId);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'moves through UNPAID -> PARTIAL -> PAID as amountPaid is updated',
    async () => {
      const booking = await createBooking({ participants: 1 }); // totalPrice 100
      expect(booking.paymentStatus).toBe('UNPAID');

      const partial = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amountPaid: 40 });
      expect(partial.status).toBe(200);
      expect(partial.body.paymentStatus).toBe('PARTIAL');

      const paid = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amountPaid: 100 });
      expect(paid.status).toBe(200);
      expect(paid.body.paymentStatus).toBe('PAID');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'updates the linked customer via customerId',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ customerId: otherCustomerId });
      expect(res.status).toBe(200);
      expect(res.body.customer.id).toBe(otherCustomerId);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'ignores a status field in the request body — status is not PATCH-able',
    async () => {
      const booking = await createBooking();
      expect(booking.status).toBe('CONFIRMED');

      const res = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'CANCELLED', notes: 'attempted status change' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.notes).toBe('attempted status change');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'returns 409 when attempting to edit a cancelled booking',
    async () => {
      const booking = await createBooking();
      const cancelled = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      expect(cancelled.status).toBe('CANCELLED');

      const res = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ notes: 'should not be allowed' });
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects a payload with both customerId and customer',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ customerId: otherCustomerId, customer: { email: 'x@example.com', name: 'X' } });
      expect(res.status).toBe(400);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'allows a startDate-only edit when the tour has no fixed schedule',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ startDate: '2027-09-01T00:00:00.000Z' });
      expect(res.status).toBe(200);
      expect(res.body.startDate).toBe('2027-09-01T00:00:00.000Z');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'revalidates startDate against the tour\'s offered dates on PATCH, once the tour has a fixed schedule',
    async () => {
      const base = Date.now();
      const offeredDate = new Date('2027-10-01T00:00:00.000Z');
      const scheduledTour = await prisma.tour.create({
        data: {
          title: `Bookings Update Scheduled Tour ${base}`,
          slug: `bookings-update-scheduled-tour-${base}`,
          description: 'desc',
          price: 100,
          startDates: [offeredDate],
        },
      });
      createdTourIds.push(scheduledTour.id);

      const booking = await createBooking({ tourId: scheduledTour.id, startDate: offeredDate.toISOString() });

      const rejected = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ startDate: '2027-10-02T00:00:00.000Z' });
      expect(rejected.status).toBe(400);

      const accepted = await request(app)
        .patch(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ startDate: offeredDate.toISOString() });
      expect(accepted.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
