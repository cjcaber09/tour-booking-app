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
let tourId: string;
let customerId: string;
let bookingId: string;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];

beforeAll(async () => {
  const [admin, guide, otherGuide] = await Promise.all([
    createTestAdmin('Bookings Get Test Admin'),
    createTestAdmin('Bookings Get Test Guide', { role: 'GUIDE' }),
    createTestAdmin('Bookings Get Test Other Guide', { role: 'GUIDE' }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;
  otherGuideId = otherGuide.id;
  otherGuideToken = otherGuide.accessToken;

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
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  await deleteTestAdmin(otherGuideId);
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
    'rejects a GUIDE viewing a booking unassigned to anyone (403)',
    async () => {
      const res = await request(app).get(`/bookings/${bookingId}`).set('Authorization', `Bearer ${guideToken}`);
      expect(res.status).toBe(403);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects a GUIDE viewing a booking assigned to a different guide (403), allows the assigned guide (200)',
    async () => {
      const booking = await prisma.booking.create({
        data: {
          reference: `BK-GETTEST-ASSIGNED${Date.now()}`,
          tourId,
          customerId,
          guideId,
          participants: 1,
          startDate: new Date(),
          totalPrice: 100,
        },
      });
      createdBookingIds.push(booking.id);

      const forbidden = await request(app)
        .get(`/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${otherGuideToken}`);
      expect(forbidden.status).toBe(403);

      const allowed = await request(app).get(`/bookings/${booking.id}`).set('Authorization', `Bearer ${guideToken}`);
      expect(allowed.status).toBe(200);
      expect(allowed.body.guide.id).toBe(guideId);
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
