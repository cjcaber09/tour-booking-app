import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const ALLOWED = '127.0.0.1,::1,::ffff:127.0.0.1';
let activeTourId: string;
let inactiveTourId: string;
const createdTourIds: string[] = [];
const createdBookingIds: string[] = [];
const createdCustomerIds: string[] = [];
const originalAllowlist = process.env.PUBLIC_API_IP_ALLOWLIST;

const DB_HEAVY_TEST_TIMEOUT = 15000;
// Tests that chain more than 3 sequential round trips against the real dev DB need
// extra headroom beyond DB_HEAVY_TEST_TIMEOUT.
const MULTI_ROUND_TRIP_TIMEOUT = 30000;

beforeAll(async () => {
  const base = Date.now();
  const activeTour = await prisma.tour.create({
    data: {
      title: `Public Bookings Active Tour ${base}`,
      slug: `public-bookings-active-tour-${base}`,
      description: 'desc',
      price: 100,
      isActive: true,
    },
  });
  activeTourId = activeTour.id;
  createdTourIds.push(activeTour.id);

  const inactiveTour = await prisma.tour.create({
    data: {
      title: `Public Bookings Inactive Tour ${base}`,
      slug: `public-bookings-inactive-tour-${base}`,
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
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.$disconnect();
});

describe('POST /public/bookings', () => {
  it(
    'creates a PENDING booking from an allowlisted IP and creates a new Customer via upsert-by-email',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
      const email = `public-bookings-new-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/public/bookings')
        .send({
          tourId: activeTourId,
          participants: 2,
          startDate: '2027-07-01T00:00:00.000Z',
          customer: { email, name: 'Public Customer', phone: '555-9999' },
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.reference).toMatch(/^BK-[0-9A-F]{8}$/);
      expect(Number(res.body.totalPrice)).toBe(200);
      expect(res.body.customerId).toBeUndefined();
      expect(res.body.amountPaid).toBeUndefined();

      const created = await prisma.booking.findUnique({ where: { reference: res.body.reference } });
      expect(created).not.toBeNull();
      if (created) createdBookingIds.push(created.id);

      const customer = await prisma.customer.findUnique({ where: { email } });
      expect(customer).not.toBeNull();
      if (customer) createdCustomerIds.push(customer.id);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'reuses the same Customer row when the same email books twice',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
      const email = `public-bookings-repeat-${Date.now()}@example.com`;

      const first = await request(app)
        .post('/public/bookings')
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-07-01T00:00:00.000Z',
          customer: { email, name: 'Repeat Customer' },
        });
      expect(first.status).toBe(201);
      const firstBooking = await prisma.booking.findUnique({ where: { reference: first.body.reference } });
      if (firstBooking) createdBookingIds.push(firstBooking.id);

      const second = await request(app)
        .post('/public/bookings')
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-07-02T00:00:00.000Z',
          customer: { email, name: 'Repeat Customer Typo Name' },
        });
      expect(second.status).toBe(201);
      const secondBooking = await prisma.booking.findUnique({ where: { reference: second.body.reference } });
      if (secondBooking) createdBookingIds.push(secondBooking.id);

      const matchingCustomers = await prisma.customer.findMany({ where: { email } });
      expect(matchingCustomers.length).toBe(1);
      expect(matchingCustomers[0].name).toBe('Repeat Customer'); // not overwritten by the second booking's typo'd name
      createdCustomerIds.push(matchingCustomers[0].id);
    },
    MULTI_ROUND_TRIP_TIMEOUT,
  );

  it(
    'rejects booking an inactive tour, even from an allowlisted IP',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
      const res = await request(app)
        .post('/public/bookings')
        .send({
          tourId: inactiveTourId,
          participants: 1,
          startDate: '2027-07-01T00:00:00.000Z',
          customer: { email: `public-bookings-inactive-${Date.now()}@example.com`, name: 'X' },
        });
      expect(res.status).toBe(400);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects an unknown tourId', async () => {
    process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
    const res = await request(app)
      .post('/public/bookings')
      .send({
        tourId: '00000000-0000-0000-0000-000000000000',
        participants: 1,
        startDate: '2027-07-01T00:00:00.000Z',
        customer: { email: `public-bookings-unknown-tour-${Date.now()}@example.com`, name: 'X' },
      });
    expect(res.status).toBe(400);
  });

  it('rejects a payload missing the customer object', async () => {
    process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
    const res = await request(app)
      .post('/public/bookings')
      .send({ tourId: activeTourId, participants: 1, startDate: '2027-07-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
  });

  it(
    'rejects a request from a non-allowlisted IP even with an otherwise valid body — the IP gate runs before any business logic',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = '203.0.113.99';
      const email = `public-bookings-blocked-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/public/bookings')
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-07-01T00:00:00.000Z',
          customer: { email, name: 'Blocked' },
        });
      expect(res.status).toBe(403);

      const stray = await prisma.customer.findUnique({ where: { email } });
      expect(stray).toBeNull();
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects participants over the tour maxGroupSize',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
      const tour = await prisma.tour.create({
        data: {
          title: `Public Bookings Capacity Tour ${Date.now()}`,
          slug: `public-bookings-capacity-tour-${Date.now()}`,
          description: 'desc',
          price: 100,
          isActive: true,
          maxGroupSize: 2,
        },
      });
      createdTourIds.push(tour.id);

      const res = await request(app)
        .post('/public/bookings')
        .send({
          tourId: tour.id,
          participants: 3,
          startDate: '2027-07-01T00:00:00.000Z',
          customer: { email: `public-bookings-capacity-${Date.now()}@example.com`, name: 'X' },
        });
      expect(res.status).toBe(400);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects a startDate the tour does not offer, and accepts one that it does',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
      const base = Date.now();
      const offeredDate = new Date('2027-08-01T00:00:00.000Z');
      const tour = await prisma.tour.create({
        data: {
          title: `Public Bookings Scheduled Tour ${base}`,
          slug: `public-bookings-scheduled-tour-${base}`,
          description: 'desc',
          price: 100,
          isActive: true,
          startDates: [offeredDate],
        },
      });
      createdTourIds.push(tour.id);

      const rejected = await request(app)
        .post('/public/bookings')
        .send({
          tourId: tour.id,
          participants: 1,
          startDate: '2027-08-02T00:00:00.000Z',
          customer: { email: `public-bookings-unoffered-${base}@example.com`, name: 'X' },
        });
      expect(rejected.status).toBe(400);

      const acceptedEmail = `public-bookings-offered-${base}@example.com`;
      const accepted = await request(app)
        .post('/public/bookings')
        .send({
          tourId: tour.id,
          participants: 1,
          startDate: offeredDate.toISOString(),
          customer: { email: acceptedEmail, name: 'X' },
        });
      expect(accepted.status).toBe(201);

      const acceptedBooking = await prisma.booking.findUnique({ where: { reference: accepted.body.reference } });
      if (acceptedBooking) createdBookingIds.push(acceptedBooking.id);
      const acceptedCustomer = await prisma.customer.findUnique({ where: { email: acceptedEmail } });
      if (acceptedCustomer) createdCustomerIds.push(acceptedCustomer.id);
    },
    MULTI_ROUND_TRIP_TIMEOUT,
  );

  it(
    'normalizes email case so a repeat booking with different casing reuses the same Customer row',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
      const base = Date.now();
      const lower = `public-bookings-case-${base}@example.com`;
      const mixed = `Public-Bookings-Case-${base}@Example.com`;

      const first = await request(app)
        .post('/public/bookings')
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-07-01T00:00:00.000Z',
          customer: { email: lower, name: 'Case Test' },
        });
      expect(first.status).toBe(201);
      const firstBooking = await prisma.booking.findUnique({ where: { reference: first.body.reference } });
      if (firstBooking) createdBookingIds.push(firstBooking.id);

      const second = await request(app)
        .post('/public/bookings')
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-07-02T00:00:00.000Z',
          customer: { email: mixed, name: 'Case Test' },
        });
      expect(second.status).toBe(201);
      const secondBooking = await prisma.booking.findUnique({ where: { reference: second.body.reference } });
      if (secondBooking) createdBookingIds.push(secondBooking.id);

      const matches = await prisma.customer.findMany({ where: { email: lower } });
      expect(matches.length).toBe(1);
      createdCustomerIds.push(matches[0].id);
    },
    MULTI_ROUND_TRIP_TIMEOUT,
  );

  it(
    'returns a richer response shape including finishDate, tour, and customer details',
    async () => {
      process.env.PUBLIC_API_IP_ALLOWLIST = ALLOWED;
      const email = `public-bookings-shape-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/public/bookings')
        .send({
          tourId: activeTourId,
          participants: 1,
          startDate: '2027-07-01T00:00:00.000Z',
          customer: { email, name: 'Shape Test', phone: '555-1111' },
        });
      expect(res.status).toBe(201);

      const booking = await prisma.booking.findUnique({ where: { reference: res.body.reference } });
      if (booking) createdBookingIds.push(booking.id);
      const customer = await prisma.customer.findUnique({ where: { email } });
      if (customer) createdCustomerIds.push(customer.id);

      expect(res.body.tourId).toBe(activeTourId);
      expect(res.body.finishDate).toBeDefined();
      expect(res.body.tour.id).toBe(activeTourId);
      expect(typeof res.body.tour.title).toBe('string');
      expect(res.body.customer.name).toBe('Shape Test');
      expect(res.body.customer.email).toBe(email);
      expect(res.body.customer.id).toBeUndefined();
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
