import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';
import { getBookingCalendarWindow } from '../src/lib/bookings';

const app = createApp();
const testEmail = `bookings-calendar-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
let tourId: string;
let longTourId: string;
let customerId: string;
let base: number;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];

const DB_HEAVY_TEST_TIMEOUT = 15000;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// The route always computes its window against the real current date (no override param),
// so the test must anchor its expectations to that same real window rather than a fixed
// fake date, or the two would disagree right at a month boundary.
const { from: gridStart, to: gridEnd } = getBookingCalendarWindow();

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Bookings Calendar Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });

  base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Calendar Tour ${base}`,
      slug: `bookings-calendar-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  const longTour = await prisma.tour.create({
    data: {
      title: `Bookings Calendar Long Tour ${base}`,
      slug: `bookings-calendar-long-tour-${base}`,
      description: 'desc',
      price: 100,
      duration: 30,
    },
  });
  longTourId = longTour.id;
  createdTourIds.push(longTour.id);

  const customer = await prisma.customer.create({
    data: { email: `bookings-calendar-customer-${base}@example.com`, name: 'Calendar Test Customer' },
  });
  customerId = customer.id;
  createdCustomerIds.push(customer.id);

  const seeded = await Promise.all([
    prisma.booking.create({
      data: { reference: `BK-CALSTART${base}`, tourId, customerId, participants: 1, startDate: gridStart, totalPrice: 100 },
    }),
    prisma.booking.create({
      data: { reference: `BK-CALEND${base}`, tourId, customerId, participants: 1, startDate: gridEnd, totalPrice: 100 },
    }),
    prisma.booking.create({
      data: {
        reference: `BK-CALBEFORE${base}`,
        tourId,
        customerId,
        participants: 1,
        startDate: addDays(gridStart, -1),
        totalPrice: 100,
      },
    }),
    prisma.booking.create({
      data: {
        reference: `BK-CALAFTER${base}`,
        tourId,
        customerId,
        participants: 1,
        startDate: addDays(gridEnd, 1),
        totalPrice: 100,
      },
    }),
    // startDate is outside the window, but this tour's 30-day duration makes its finishDate
    // (startDate + 29 days = gridStart + 26 days) fall inside it — must still be excluded, since
    // the /calendar route filters on startDate only, not the booking's full stay span.
    prisma.booking.create({
      data: {
        reference: `BK-CALSPAN${base}`,
        tourId: longTourId,
        customerId,
        participants: 1,
        startDate: addDays(gridStart, -3),
        totalPrice: 100,
      },
    }),
  ]);
  createdBookingIds.push(...seeded.map((b) => b.id));
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('GET /bookings/calendar', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/bookings/calendar');
    expect(res.status).toBe(401);
  });

  it(
    'includes the grid start/end boundaries, excludes one day outside on either side, and ignores stay span',
    async () => {
      const res = await request(app).get('/bookings/calendar').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.from).toBe('string');
      expect(typeof res.body.to).toBe('string');

      const refs: string[] = res.body.bookings.map((b: { reference: string }) => b.reference);

      expect(refs).toContain(`BK-CALSTART${base}`);
      expect(refs).toContain(`BK-CALEND${base}`);
      expect(refs).not.toContain(`BK-CALBEFORE${base}`);
      expect(refs).not.toContain(`BK-CALAFTER${base}`);
      expect(refs).not.toContain(`BK-CALSPAN${base}`);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'sorts bookings by startDate ascending',
    async () => {
      const res = await request(app).get('/bookings/calendar').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);

      const relevantRefs = [`BK-CALSTART${base}`, `BK-CALEND${base}`];
      const returnedOrder = res.body.bookings
        .map((b: { reference: string }) => b.reference)
        .filter((reference: string) => relevantRefs.includes(reference));

      expect(returnedOrder).toEqual(relevantRefs);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
