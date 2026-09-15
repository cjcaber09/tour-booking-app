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
let leadGuideId: string;
let leadGuideToken: string;
let staffId: string;
let staffToken: string;
let tourId: string;
let customerId: string;
const createdBookingIds: string[] = [];

async function createBooking(data: { status: 'PENDING' | 'CONFIRMED'; startDate: Date; guideId?: string }) {
  const booking = await prisma.booking.create({
    data: {
      reference: `BK-ONGOINGTEST${Date.now()}${Math.random().toString(16).slice(2)}`,
      tourId,
      customerId,
      guideId: data.guideId,
      participants: 1,
      startDate: data.startDate,
      totalPrice: 100,
      status: data.status,
    },
  });
  createdBookingIds.push(booking.id);
  return booking;
}

beforeAll(async () => {
  const [admin, guide, otherGuide, leadGuide, staff] = await Promise.all([
    createTestAdmin('Bookings Ongoing Test Admin'),
    createTestAdmin('Bookings Ongoing Test Guide', { role: 'GUIDE' }),
    createTestAdmin('Bookings Ongoing Test Other Guide', { role: 'GUIDE' }),
    createTestAdmin('Bookings Ongoing Test Lead Guide', { role: 'LEAD_GUIDE' }),
    createTestAdmin('Bookings Ongoing Test Staff', { role: 'STAFF' }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;
  otherGuideId = otherGuide.id;
  otherGuideToken = otherGuide.accessToken;
  leadGuideId = leadGuide.id;
  leadGuideToken = leadGuide.accessToken;
  staffId = staff.id;
  staffToken = staff.accessToken;

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Ongoing Tour ${base}`,
      slug: `bookings-ongoing-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;

  const customer = await prisma.customer.create({
    data: { email: `bookings-ongoing-customer-${base}@example.com`, name: 'Ongoing Test Customer' },
  });
  customerId = customer.id;
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: customerId } });
  await prisma.tour.deleteMany({ where: { id: tourId } });
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  await deleteTestAdmin(otherGuideId);
  await deleteTestAdmin(leadGuideId);
  await deleteTestAdmin(staffId);
  await prisma.$disconnect();
});

describe('POST /bookings/:id/ongoing', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post('/bookings/00000000-0000-0000-0000-000000000000/ongoing').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .post('/bookings/00000000-0000-0000-0000-000000000000/ongoing')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it(
    'returns 409 when the booking is not CONFIRMED',
    async () => {
      const booking = await createBooking({ status: 'PENDING', startDate: new Date() });
      const res = await request(app)
        .post(`/bookings/${booking.id}/ongoing`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'returns 409 when the start date has not been reached',
    async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const booking = await createBooking({ status: 'CONFIRMED', startDate: future });
      const res = await request(app)
        .post(`/bookings/${booking.id}/ongoing`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'moves a due CONFIRMED booking to ONGOING',
    async () => {
      const booking = await createBooking({ status: 'CONFIRMED', startDate: new Date(), guideId });
      const res = await request(app)
        .post(`/bookings/${booking.id}/ongoing`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ONGOING');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'returns 409 when marking an unassigned CONFIRMED, due booking ongoing',
    async () => {
      const booking = await createBooking({ status: 'CONFIRMED', startDate: new Date() });
      const res = await request(app)
        .post(`/bookings/${booking.id}/ongoing`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects a GUIDE not assigned to the booking (403), allows the assigned GUIDE (200)',
    async () => {
      const unassigned = await createBooking({ status: 'CONFIRMED', startDate: new Date() });
      const forbidden = await request(app)
        .post(`/bookings/${unassigned.id}/ongoing`)
        .set('Authorization', `Bearer ${guideToken}`);
      expect(forbidden.status).toBe(403);

      const assignedToOther = await createBooking({ status: 'CONFIRMED', startDate: new Date(), guideId: otherGuideId });
      const stillForbidden = await request(app)
        .post(`/bookings/${assignedToOther.id}/ongoing`)
        .set('Authorization', `Bearer ${guideToken}`);
      expect(stillForbidden.status).toBe(403);

      const assignedToMe = await createBooking({ status: 'CONFIRMED', startDate: new Date(), guideId });
      const allowed = await request(app)
        .post(`/bookings/${assignedToMe.id}/ongoing`)
        .set('Authorization', `Bearer ${guideToken}`);
      expect(allowed.status).toBe(200);
      expect(allowed.body.status).toBe('ONGOING');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'allows LEAD_GUIDE and STAFF regardless of assignment (unrestricted, unlike GUIDE)',
    async () => {
      const forLeadGuide = await createBooking({ status: 'CONFIRMED', startDate: new Date(), guideId: otherGuideId });
      const leadGuideRes = await request(app)
        .post(`/bookings/${forLeadGuide.id}/ongoing`)
        .set('Authorization', `Bearer ${leadGuideToken}`);
      expect(leadGuideRes.status).toBe(200);

      const forStaff = await createBooking({ status: 'CONFIRMED', startDate: new Date(), guideId: otherGuideId });
      const staffRes = await request(app)
        .post(`/bookings/${forStaff.id}/ongoing`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(staffRes.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
