import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT, BUCKET, supabase, extractStoragePath } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
let guideId: string;
let guideToken: string;
let tourId: string;
let customerId: string;
const createdTourIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdBookingIds: string[] = [];
const uploadedPaths: string[] = [];

async function createBooking(overrides: Record<string, unknown> = {}) {
  const booking = await prisma.booking.create({
    data: {
      reference: `BK-PAYTEST${Date.now()}${Math.random().toString(16).slice(2)}`,
      tourId,
      customerId,
      participants: 1,
      startDate: new Date(),
      totalPrice: 100,
      status: 'CONFIRMED',
      ...overrides,
    },
  });
  createdBookingIds.push(booking.id);
  return booking;
}

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    createTestAdmin('Bookings Payments Test Admin'),
    createTestAdmin('Bookings Payments Test Guide', { role: 'GUIDE' }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;

  const base = Date.now();
  const tour = await prisma.tour.create({
    data: {
      title: `Bookings Payments Tour ${base}`,
      slug: `bookings-payments-tour-${base}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;
  createdTourIds.push(tour.id);

  const customer = await prisma.customer.create({
    data: { email: `bookings-payments-customer-${base}@example.com`, name: 'Payments Test Customer' },
  });
  customerId = customer.id;
  createdCustomerIds.push(customer.id);
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
  await prisma.$disconnect();
});

describe('POST /bookings/:id/payments', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post('/bookings/00000000-0000-0000-0000-000000000000/payments').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown booking', async () => {
    const res = await request(app)
      .post('/bookings/00000000-0000-0000-0000-000000000000/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ method: 'CASH', amount: 10 });
    expect(res.status).toBe(404);
  });

  it(
    'rejects a GUIDE role (403), even on a booking assigned to them',
    async () => {
      const booking = await createBooking({ guideId });
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments`)
        .set('Authorization', `Bearer ${guideToken}`)
        .send({ method: 'CASH', amount: 10 });
      expect(res.status).toBe(403);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'records a CASH payment and recomputes amountPaid/paymentStatus',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ method: 'CASH', amount: 40 });

      expect(res.status).toBe(201);
      expect(Number(res.body.amountPaid)).toBe(40);
      expect(res.body.paymentStatus).toBe('PARTIAL');
      expect(res.body.payments).toHaveLength(1);
      expect(res.body.payments[0].method).toBe('CASH');
      expect(Number(res.body.payments[0].amount)).toBe(40);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects an INVOICE_REFERENCE payment with no invoiceReference',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ method: 'INVOICE_REFERENCE', amount: 40 });
      expect(res.status).toBe(400);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'records an INVOICE_REFERENCE payment and stores the reference',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ method: 'INVOICE_REFERENCE', amount: 100, invoiceReference: 'INV-001' });

      expect(res.status).toBe(201);
      expect(res.body.paymentStatus).toBe('PAID');
      expect(res.body.payments[0].method).toBe('INVOICE_REFERENCE');
      expect(res.body.payments[0].invoiceReference).toBe('INV-001');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'records a FILE payment and stores the proofUrl',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ method: 'FILE', amount: 100, proofUrl: 'https://example.com/proof.pdf' });

      expect(res.status).toBe(201);
      expect(res.body.payments[0].method).toBe('FILE');
      expect(res.body.payments[0].proofUrl).toBe('https://example.com/proof.pdf');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects an amount exceeding the remaining balance',
    async () => {
      const booking = await createBooking({ amountPaid: 80, paymentStatus: 'PARTIAL' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ method: 'CASH', amount: 30 });
      expect(res.status).toBe(400);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects recording a payment on a CANCELLED booking',
    async () => {
      const booking = await createBooking({ status: 'CANCELLED' });
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ method: 'CASH', amount: 10 });
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});

describe('POST /bookings/:id/payments/upload-proof', () => {
  it(
    'rejects a GUIDE role (403), even on a booking assigned to them',
    async () => {
      const booking = await createBooking({ guideId });
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments/upload-proof`)
        .set('Authorization', `Bearer ${guideToken}`)
        .attach('proof', Buffer.from('fake-pdf-bytes'), { filename: 'receipt.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(403);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'uploads a valid proof file and returns a signed url',
    async () => {
      const booking = await createBooking();
      const res = await request(app)
        .post(`/bookings/${booking.id}/payments/upload-proof`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('proof', Buffer.from('fake-pdf-bytes'), { filename: 'receipt.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(typeof res.body.url).toBe('string');
      uploadedPaths.push(extractStoragePath(res.body.url));
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects a request with no file attached', async () => {
    const booking = await createBooking();
    const res = await request(app)
      .post(`/bookings/${booking.id}/payments/upload-proof`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('proof file is required');
  });

  it('rejects an unsupported mimetype', async () => {
    const booking = await createBooking();
    const res = await request(app)
      .post(`/bookings/${booking.id}/payments/upload-proof`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('proof', Buffer.from('not a proof'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported file type');
  });
});
