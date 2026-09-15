import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
let guideId: string;
let guideToken: string;
let otherGuideId: string;
let otherGuideToken: string;
let leadGuideToken: string;
let leadGuideId: string;
let tourId: string;
let customerId: string;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];

async function createBooking(overrides: Record<string, unknown> = {}) {
  const booking = await prisma.booking.create({
    data: {
      reference: `BK-CANCELTEST${Date.now()}${Math.random().toString(16).slice(2)}`,
      tourId,
      customerId,
      participants: 1,
      startDate: new Date(),
      totalPrice: 100,
      status: 'CONFIRMED',
      ...overrides,
    },
  });
  createdBookingIds.push(booking.id);
  return booking;
}

beforeAll(async () => {
  const [admin, guide, otherGuide, leadGuide] = await Promise.all([
    createTestAdmin('Bookings Cancel Test Admin'),
    createTestAdmin('Bookings Cancel Test Guide', { role: 'GUIDE' }),
    createTestAdmin('Bookings Cancel Test Other Guide', { role: 'GUIDE' }),
    createTestAdmin('Bookings Cancel Test Lead Guide', { role: 'LEAD_GUIDE' }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;
  otherGuideId = otherGuide.id;
  otherGuideToken = otherGuide.accessToken;
  leadGuideId = leadGuide.id;
  leadGuideToken = leadGuide.accessToken;

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Cancel Tour ${base}`,
      slug: `bookings-cancel-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  const customer = await prisma.customer.create({
    data: { email: `bookings-cancel-customer-${base}@example.com`, name: 'Cancel Test Customer' },
  });
  customerId = customer.id;
  createdCustomerIds.push(customer.id);
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  await deleteTestAdmin(otherGuideId);
  await deleteTestAdmin(leadGuideId);
  await prisma.$disconnect();
});

describe('POST /bookings/:id/cancel', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post('/bookings/00000000-0000-0000-0000-000000000000/cancel').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .post('/bookings/00000000-0000-0000-0000-000000000000/cancel')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refundAmount: 0 });
    expect(res.status).toBe(404);
  });

  it(
    'rejects a GUIDE not assigned to the booking (403), allows the assigned GUIDE (200)',
    async () => {
      const unassigned = await createBooking();
      const forbidden = await request(app)
        .post(`/bookings/${unassigned.id}/cancel`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({ refundAmount: 0 });
      expect(forbidden.status).toBe(403);

      const assignedToOther = await createBooking({ guideId: otherGuideId });
      const stillForbidden = await request(app)
        .post(`/bookings/${assignedToOther.id}/cancel`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({ refundAmount: 0 });
      expect(stillForbidden.status).toBe(403);

      const assignedToMe = await createBooking({ guideId });
      const allowed = await request(app)
        .post(`/bookings/${assignedToMe.id}/cancel`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({ refundAmount: 0 });
      expect(allowed.status).toBe(200);
      expect(allowed.body.status).toBe('CANCELLED');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'allows LEAD_GUIDE regardless of assignment (unrestricted, unlike GUIDE)',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${leadGuideToken}`)
        .send({ refundAmount: 0 });
      expect(res.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'fully refunds a fully paid booking and sets paymentStatus to REFUNDED',
    async () => {
      // Explicit future startDate — createBooking()'s default of `new Date()` (today) already
      // counts as "started" under todayIsPastOrEqualStartDate's >= semantics, which would
      // incorrectly trip the paid-and-locked 409 this test isn't exercising.
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const booking = await createBooking({ startDate: tomorrow, amountPaid: 100, paymentStatus: 'PAID' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 100 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(Number(res.body.refundAmount)).toBe(100);
      expect(res.body.cancelledAt).not.toBeNull();
      expect(res.body.paymentStatus).toBe('REFUNDED');
      expect(Number(res.body.amountPaid)).toBe(100); // unchanged — historical total collected
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'partially refunds a booking and records the partial refundAmount',
    async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const booking = await createBooking({ startDate: tomorrow, amountPaid: 100, paymentStatus: 'PAID' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 40 });

      expect(res.status).toBe(200);
      expect(Number(res.body.refundAmount)).toBe(40);
      expect(Number(res.body.amountPaid)).toBe(100);
      expect(res.body.paymentStatus).toBe('REFUNDED');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'leaves paymentStatus unchanged when refundAmount is 0 (e.g. cancelling an unpaid booking)',
    async () => {
      const booking = await createBooking({ amountPaid: 0, paymentStatus: 'UNPAID', status: 'PENDING' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 0 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(Number(res.body.refundAmount)).toBe(0);
      expect(res.body.paymentStatus).toBe('UNPAID');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects a refundAmount greater than amountPaid',
    async () => {
      const booking = await createBooking({ amountPaid: 40, paymentStatus: 'PARTIAL' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 100 });
      expect(res.status).toBe(400);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects a negative refundAmount',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: -10 });
      expect(res.status).toBe(400);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'returns 409 when the booking is already cancelled',
    async () => {
      const booking = await createBooking();
      const first = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 0 });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 0 });
      expect(second.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects cancelling a fully paid booking once it is past its start date',
    async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const booking = await createBooking({ startDate: yesterday, amountPaid: 100, paymentStatus: 'PAID' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 100 });
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'allows cancelling a partially paid booking once it is past its start date',
    async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const booking = await createBooking({ startDate: yesterday, amountPaid: 50, paymentStatus: 'PARTIAL' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 50 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'allows cancelling an unpaid booking once it is past its start date',
    async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const booking = await createBooking({ startDate: yesterday, amountPaid: 0, paymentStatus: 'UNPAID' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 0 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'cancelling a still-PENDING booking works the same way as cancelling a CONFIRMED one',
    async () => {
      const booking = await createBooking({ status: 'PENDING', amountPaid: 30, paymentStatus: 'PARTIAL' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refundAmount: 30 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.paymentStatus).toBe('REFUNDED');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
