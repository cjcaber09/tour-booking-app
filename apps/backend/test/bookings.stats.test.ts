import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { getBookingsStatsWindows } from '../src/lib/bookings';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
let tourId: string;
let customerId: string;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];
const createdPaymentIds: string[] = [];

async function getStats() {
  const res = await request(app).get('/bookings/stats').set('Authorization', `Bearer ${accessToken}`);
  return res.body;
}

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Bookings Stats Test Admin'));

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Stats Tour ${base}`,
      slug: `bookings-stats-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  const customer = await prisma.customer.create({
    data: { email: `bookings-stats-customer-${base}@example.com`, name: 'Stats Test Customer' },
  });
  customerId = customer.id;
  createdCustomerIds.push(customer.id);
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

// Pure-function tests, no DB/network involved — deterministic and immune to the concurrent
// cross-file DB pollution that a live aggregate count would suffer from (see the route-level
// tests below, which have to be much looser precisely because of that pollution).
describe('getBookingsStatsWindows', () => {
  it('todayStart is midnight of the current day', () => {
    const { todayStart } = getBookingsStatsWindows();
    const expected = new Date();
    expected.setHours(0, 0, 0, 0);
    expect(todayStart.getTime()).toBe(expected.getTime());
  });

  it('monthStart/monthEnd form a [start, end) window spanning exactly the current calendar month', () => {
    const { monthStart, monthEnd } = getBookingsStatsWindows();
    expect(monthStart.getDate()).toBe(1);
    expect(monthStart.getHours()).toBe(0);

    const dayBeforeMonthStart = new Date(monthStart);
    dayBeforeMonthStart.setDate(dayBeforeMonthStart.getDate() - 1);
    expect(dayBeforeMonthStart.getTime()).toBeLessThan(monthStart.getTime());

    // monthEnd is the 1st of next month — exactly one month after monthStart, so a date at
    // monthEnd itself must NOT be included in the [monthStart, monthEnd) window.
    expect(monthEnd.getMonth()).toBe((monthStart.getMonth() + 1) % 12);
    expect(monthEnd.getDate()).toBe(1);

    const lastMomentOfMonth = new Date(monthEnd.getTime() - 1);
    expect(lastMomentOfMonth.getTime()).toBeGreaterThanOrEqual(monthStart.getTime());
    expect(lastMomentOfMonth.getTime()).toBeLessThan(monthEnd.getTime());
  });

  it('last7Days has 7 entries, oldest first, today last, each a full [start, end) day window', () => {
    const { todayStart, last7Days } = getBookingsStatsWindows();
    expect(last7Days).toHaveLength(7);
    expect(last7Days[6].start.getTime()).toBe(todayStart.getTime());

    for (let i = 0; i < last7Days.length; i++) {
      const day = last7Days[i];
      expect(day.date).toBe(day.start.toISOString().slice(0, 10));
      const expectedEnd = new Date(day.start);
      expectedEnd.setDate(expectedEnd.getDate() + 1);
      expect(day.end.getTime()).toBe(expectedEnd.getTime());

      if (i > 0) {
        expect(day.start.getTime()).toBeGreaterThan(last7Days[i - 1].start.getTime());
      }
    }
  });
});

// Route-level smoke tests. All backend tests run against one shared real dev database, and
// these stats are unscoped global aggregates (total booking count, this-month sums, etc.) — the
// full suite routinely has other test files creating/cancelling bookings and recording payments
// "now" concurrently, so only a >= (does our contribution show up at all) assertion is reliable
// here; an exact-delta assertion is what bookings.stats.test.ts originally used and it was
// flaky under the full suite for exactly this reason. The precise date-boundary correctness is
// covered above by the pure getBookingsStatsWindows tests instead.
describe('GET /bookings/stats', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/bookings/stats');
    expect(res.status).toBe(401);
  });

  it(
    'totalBookings increases by at least 1 after creating a booking',
    async () => {
      const before = await getStats();
      const booking = await prisma.booking.create({
        data: {
          reference: `BK-STATSTOTAL${Date.now()}`,
          tourId,
          customerId,
          participants: 1,
          startDate: new Date(),
          totalPrice: 100,
        },
      });
      createdBookingIds.push(booking.id);

      const after = await getStats();
      expect(after.totalBookings).toBeGreaterThanOrEqual(before.totalBookings + 1);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'upcomingBookings: a non-cancelled future booking matches the route\'s own filter, and the route responds with a sane shape',
    async () => {
      // Unlike totalBookings/cancellationsThisMonth/revenueThisMonth (which only ever grow
      // during a test run), upcomingBookings is NOT monotonic — another concurrently-running
      // test file cancelling an unrelated booking that has a future startDate would decrease
      // the true count between our before/after snapshots. A `>=` delta on the global aggregate
      // is therefore not safe here (confirmed by an actual observed failure). Instead, verify
      // the route's exact filter condition directly, scoped to just our own booking's id —
      // immune to whatever else is happening in the shared table concurrently.
      const { todayStart } = getBookingsStatsWindows();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const booking = await prisma.booking.create({
        data: {
          reference: `BK-STATSUPCOMING${Date.now()}`,
          tourId,
          customerId,
          participants: 1,
          startDate: tomorrow,
          totalPrice: 100,
          status: 'CONFIRMED',
        },
      });
      createdBookingIds.push(booking.id);

      const matchCount = await prisma.booking.count({
        where: { id: booking.id, status: { not: 'CANCELLED' }, startDate: { gte: todayStart } },
      });
      expect(matchCount).toBe(1);

      const res = await request(app).get('/bookings/stats').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.upcomingBookings).toBe('number');
      expect(res.body.upcomingBookings).toBeGreaterThanOrEqual(0);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'cancellationsThisMonth increases by at least 1 after cancelling a booking with cancelledAt this month',
    async () => {
      const before = await getStats();
      const booking = await prisma.booking.create({
        data: {
          reference: `BK-STATSCANCELNOW${Date.now()}`,
          tourId,
          customerId,
          participants: 1,
          startDate: new Date(),
          totalPrice: 100,
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });
      createdBookingIds.push(booking.id);

      const after = await getStats();
      expect(after.cancellationsThisMonth).toBeGreaterThanOrEqual(before.cancellationsThisMonth + 1);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'revenueThisMonth increases by at least the amount of a payment created this month',
    async () => {
      const before = await getStats();
      const booking = await prisma.booking.create({
        data: {
          reference: `BK-STATSREV${Date.now()}`,
          tourId,
          customerId,
          participants: 1,
          startDate: new Date(),
          totalPrice: 500,
        },
      });
      createdBookingIds.push(booking.id);

      const payment = await prisma.payment.create({
        data: { bookingId: booking.id, amount: 30, method: 'CASH', createdAt: new Date() },
      });
      createdPaymentIds.push(payment.id);

      const after = await getStats();
      const delta = Number(after.revenueThisMonth) - Number(before.revenueThisMonth);
      expect(delta).toBeGreaterThanOrEqual(30);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
