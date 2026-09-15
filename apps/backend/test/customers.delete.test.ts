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
const createdCustomerIds: string[] = [];
const createdTourIds: string[] = [];
const createdBookingIds: string[] = [];

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    createTestAdmin('Customers Delete Test Admin'),
    createTestAdmin('Customers Delete Test Guide', { role: 'GUIDE' }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  await prisma.$disconnect();
});

describe('DELETE /customers/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).delete('/customers/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('rejects a GUIDE role (403)', async () => {
    const res = await request(app)
      .delete('/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${guideToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .delete('/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it(
    'deletes a customer with no bookings',
    async () => {
      const created = await request(app)
        .post('/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Delete Me', email: `customers-delete-target-${Date.now()}@example.com` });

      const res = await request(app)
        .delete(`/customers/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);

      const followUp = await request(app)
        .get(`/customers/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(followUp.status).toBe(404);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects deleting a customer that has an existing booking (409)',
    async () => {
      const base = Date.now();
      const tour = await prisma.tour.create({
        data: {
          title: `Customers Delete Blocked Tour ${base}`,
          slug: `customers-delete-blocked-tour-${base}`,
          description: 'desc',
          price: 100,
        },
      });
      createdTourIds.push(tour.id);

      const customer = await prisma.customer.create({
        data: { email: `customers-delete-booking-blocker-${base}@example.com`, name: 'Booking Blocker' },
      });
      createdCustomerIds.push(customer.id);

      const booking = await prisma.booking.create({
        data: {
          reference: `BK-CUSTDELTEST${base}`,
          tourId: tour.id,
          customerId: customer.id,
          participants: 1,
          startDate: new Date(),
          totalPrice: 100,
        },
      });
      createdBookingIds.push(booking.id);

      const res = await request(app)
        .delete(`/customers/${customer.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(409);

      const stillExists = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(stillExists).not.toBeNull();
      const bookingStillExists = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(bookingStillExists).not.toBeNull();
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
