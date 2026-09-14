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

async function createPendingBooking() {
  const booking = await prisma.booking.create({
    data: {
      reference: `BK-CONFIRMTEST${Date.now()}${Math.random().toString(16).slice(2)}`,
      tourId,
      customerId,
      participants: 1,
      startDate: new Date(),
      totalPrice: 100,
      status: 'PENDING',
    },
  });
  createdBookingIds.push(booking.id);
  return booking;
}

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Bookings Confirm Test Admin'));

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Confirm Tour ${base}`,
      slug: `bookings-confirm-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  const customer = await prisma.customer.create({
    data: { email: `bookings-confirm-customer-${base}@example.com`, name: 'Confirm Test Customer' },
  });
  customerId = customer.id;
  createdCustomerIds.push(customer.id);
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('POST /bookings/:id/confirm', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post('/bookings/00000000-0000-0000-0000-000000000000/confirm').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .post('/bookings/00000000-0000-0000-0000-000000000000/confirm')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it(
    'moves a PENDING booking to CONFIRMED, independent of payment state',
    async () => {
      const booking = await createPendingBooking();
      expect(Number(booking.amountPaid)).toBe(0);

      const res = await request(app)
        .post(`/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
      expect(Number(res.body.amountPaid)).toBe(0);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'returns 409 when the booking is already CONFIRMED',
    async () => {
      const booking = await createPendingBooking();
      const first = await request(app)
        .post(`/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(first.status).toBe(200);

      const second = await request(app)
        .post(`/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(second.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'returns 409 when the booking is CANCELLED',
    async () => {
      const booking = await createPendingBooking();
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });

      const res = await request(app)
        .post(`/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
