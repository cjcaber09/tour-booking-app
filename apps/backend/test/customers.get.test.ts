import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
const createdCustomerIds: string[] = [];
const createdTourIds: string[] = [];
const createdBookingIds: string[] = [];

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Customers Get Test Admin'));
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('GET /customers/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/customers/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .get('/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it(
    'returns an empty bookings array for a customer with no bookings',
    async () => {
      const customer = await prisma.customer.create({
        data: { email: `customers-get-no-bookings-${Date.now()}@example.com`, name: 'No Bookings' },
      });
      createdCustomerIds.push(customer.id);

      const res = await request(app)
        .get(`/customers/${customer.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('No Bookings');
      expect(res.body.bookings).toEqual([]);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'includes booking history for a customer with bookings',
    async () => {
      const base = Date.now();
      const tour = await prisma.tour.create({
        data: {
          title: `Customers Get Tour ${base}`,
          slug: `customers-get-tour-${base}`,
          description: 'desc',
          price: 150,
        },
      });
      createdTourIds.push(tour.id);

      const customer = await prisma.customer.create({
        data: { email: `customers-get-with-bookings-${base}@example.com`, name: 'Has Bookings' },
      });
      createdCustomerIds.push(customer.id);

      const booking = await prisma.booking.create({
        data: {
          reference: `BK-CUSTGETTEST${base}`,
          tourId: tour.id,
          customerId: customer.id,
          participants: 2,
          startDate: new Date(),
          totalPrice: 300,
        },
      });
      createdBookingIds.push(booking.id);

      const res = await request(app)
        .get(`/customers/${customer.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bookings).toHaveLength(1);
      expect(res.body.bookings[0].id).toBe(booking.id);
      expect(res.body.bookings[0].tour.id).toBe(tour.id);
      expect(res.body.bookings[0].finishDate).toBeDefined();
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
