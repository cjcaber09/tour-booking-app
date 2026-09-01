import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmail = `bookings-create-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
let activeTourId: string;
let inactiveTourId: string;
let existingCustomerId: string;
const createdTourIds: string[] = [];
const createdBookingIds: string[] = [];
const createdCustomerIds: string[] = [];

const DB_HEAVY_TEST_TIMEOUT = 15000;

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Bookings Create Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });

  const base = Date.now();
  const activeTour = await prisma.tour.create({
    data: {
      title: `Bookings Create Active Tour ${base}`,
      slug: `bookings-create-active-tour-${base}`,
      description: 'desc',
      price: 100,
      priceDiscount: 80,
      isActive: true,
    },
  });
  activeTourId = activeTour.id;
  createdTourIds.push(activeTour.id);

  const inactiveTour = await prisma.tour.create({
    data: {
      title: `Bookings Create Inactive Tour ${base}`,
      slug: `bookings-create-inactive-tour-${base}`,
      description: 'desc',
      price: 100,
      isActive: false,
    },
  });
  inactiveTourId = inactiveTour.id;
  createdTourIds.push(inactiveTour.id);

  const existingCustomer = await prisma.customer.create({
    data: { email: `bookings-create-existing-${base}@example.com`, name: 'Existing Customer' },
  });
  existingCustomerId = existingCustomer.id;
  createdCustomerIds.push(existingCustomer.id);
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('POST /bookings', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post('/bookings').send({});
    expect(res.status).toBe(401);
  });

  it(
    'creates a booking with an existing customerId',
    async () => {
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId: activeTourId,
          participants: 2,
          startDate: '2027-06-01T00:00:00.000Z',
          customerId: existingCustomerId,
        });

      expect(res.status).toBe(201);
      createdBookingIds.push(res.body.id);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.paymentStatus).toBe('UNPAID');
      expect(Number(res.body.amountPaid)).toBe(0);
      expect(res.body.customer.id).toBe(existingCustomerId);
      expect(res.body.reference).toMatch(/^BK-[0-9A-F]{8}$/);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'creates a booking with an inline customer and creates a new Customer row',
    async () => {
      const email = `bookings-create-inline-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-06-01T00:00:00.000Z',
          customer: { email, name: 'Inline Customer', phone: '555-1234' },
        });

      expect(res.status).toBe(201);
      createdBookingIds.push(res.body.id);
      createdCustomerIds.push(res.body.customer.id);
      expect(res.body.customer.email).toBe(email);
      expect(res.body.customer.name).toBe('Inline Customer');

      const customerRow = await prisma.customer.findUnique({ where: { email } });
      expect(customerRow).not.toBeNull();
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'uses tour.priceDiscount over tour.price when computing totalPrice',
    async () => {
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId: activeTourId,
          participants: 3,
          startDate: '2027-06-01T00:00:00.000Z',
          customerId: existingCustomerId,
        });

      expect(res.status).toBe(201);
      createdBookingIds.push(res.body.id);
      expect(Number(res.body.totalPrice)).toBe(240); // 80 * 3
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'allows booking an inactive tour (admin can override)',
    async () => {
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId: inactiveTourId,
          participants: 1,
          startDate: '2027-06-01T00:00:00.000Z',
          customerId: existingCustomerId,
        });

      expect(res.status).toBe(201);
      createdBookingIds.push(res.body.id);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects an unknown tourId', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tourId: '00000000-0000-0000-0000-000000000000',
        participants: 1,
        startDate: '2027-06-01T00:00:00.000Z',
        customerId: existingCustomerId,
      });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown customerId', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tourId: activeTourId,
        participants: 1,
        startDate: '2027-06-01T00:00:00.000Z',
        customerId: '00000000-0000-0000-0000-000000000000',
      });
    expect(res.status).toBe(400);
  });

  it('rejects a payload with both customerId and customer', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tourId: activeTourId,
        participants: 1,
        startDate: '2027-06-01T00:00:00.000Z',
        customerId: existingCustomerId,
        customer: { email: 'x@example.com', name: 'X' },
      });
    expect(res.status).toBe(400);
  });

  it('rejects a payload with neither customerId nor customer', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tourId: activeTourId,
        participants: 1,
        startDate: '2027-06-01T00:00:00.000Z',
      });
    expect(res.status).toBe(400);
  });

  it(
    'generates a different reference on repeated creates',
    async () => {
      const first = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-06-01T00:00:00.000Z',
          customerId: existingCustomerId,
        });
      createdBookingIds.push(first.body.id);

      const second = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-06-01T00:00:00.000Z',
          customerId: existingCustomerId,
        });
      createdBookingIds.push(second.body.id);

      expect(second.body.reference).not.toBe(first.body.reference);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
