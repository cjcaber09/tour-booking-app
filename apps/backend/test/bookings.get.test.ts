import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmail = `bookings-get-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
let tourId: string;
let customerId: string;
let bookingId: string;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];

const DB_HEAVY_TEST_TIMEOUT = 15000;

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Bookings Get Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Get Tour ${base}`,
      slug: `bookings-get-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  const customer = await prisma.customer.create({
    data: { email: `bookings-get-customer-${base}@example.com`, name: 'Get Test Customer', phone: '555-0000' },
  });
  customerId = customer.id;
  createdCustomerIds.push(customer.id);

  const booking = await prisma.booking.create({
    data: {
      reference: `BK-GETTEST${base}`,
      tourId,
      customerId,
      participants: 2,
      startDate: new Date(base),
      totalPrice: 200,
    },
  });
  bookingId = booking.id;
  createdBookingIds.push(booking.id);
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('GET /bookings/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get(`/bookings/${bookingId}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .get('/bookings/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it(
    'returns the full booking record including tour and customer',
    async () => {
      const res = await request(app).get(`/bookings/${bookingId}`).set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(bookingId);
      expect(res.body.tour.id).toBe(tourId);
      expect(res.body.customer.id).toBe(customerId);
      expect(res.body.customer.phone).toBe('555-0000');
      expect(Number(res.body.totalPrice)).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'auto-completes a CONFIRMED booking past its finish date once fully paid',
    async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const booking = await prisma.booking.create({
        data: {
          reference: `BK-GETTEST-PAID${Date.now()}`,
          tourId,
          customerId,
          participants: 1,
          startDate: tenDaysAgo,
          totalPrice: 100,
          amountPaid: 100,
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
        },
      });
      createdBookingIds.push(booking.id);

      const res = await request(app).get(`/bookings/${booking.id}`).set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'leaves a CONFIRMED booking past its finish date unchanged when only partially paid',
    async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const booking = await prisma.booking.create({
        data: {
          reference: `BK-GETTEST-PARTIAL${Date.now()}`,
          tourId,
          customerId,
          participants: 1,
          startDate: tenDaysAgo,
          totalPrice: 100,
          amountPaid: 50,
          paymentStatus: 'PARTIAL',
          status: 'CONFIRMED',
        },
      });
      createdBookingIds.push(booking.id);

      const res = await request(app).get(`/bookings/${booking.id}`).set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
