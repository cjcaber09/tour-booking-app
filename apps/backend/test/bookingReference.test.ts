import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { generateReferenceCandidate, generateUniqueBookingReference } from '../src/lib/bookingReference';
import { prisma } from '../src/lib/prisma';

let tourId: string;
let customerId: string;
const createdBookingIds: string[] = [];

beforeAll(async () => {
  const tour = await prisma.tour.create({
    data: {
      title: `Booking Reference Test Tour ${Date.now()}`,
      slug: `booking-reference-test-tour-${Date.now()}`,
      description: 'desc',
      price: 100,
    },
  });
  tourId = tour.id;

  const customer = await prisma.customer.create({
    data: { email: `booking-reference-test-${Date.now()}@example.com`, name: 'Reference Test Customer' },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.delete({ where: { id: customerId } });
  await prisma.tour.delete({ where: { id: tourId } });
  await prisma.$disconnect();
});

describe('generateReferenceCandidate', () => {
  it('produces a "BK-" prefix followed by 8 uppercase hex characters', () => {
    const candidate = generateReferenceCandidate();
    expect(candidate).toMatch(/^BK-[0-9A-F]{8}$/);
  });
});

describe('generateUniqueBookingReference', () => {
  it('returns a candidate when there is no collision', async () => {
    const reference = await generateUniqueBookingReference();
    expect(reference).toMatch(/^BK-[0-9A-F]{8}$/);
  });

  it('retries when the candidate collides with an existing reference', async () => {
    const collidingReference = 'BK-00000000';
    const existing = await prisma.booking.create({
      data: {
        reference: collidingReference,
        tourId,
        customerId,
        participants: 1,
        startDate: new Date(),
        totalPrice: 100,
      },
    });
    createdBookingIds.push(existing.id);

    const randomBytesSpy = vi
      .spyOn(crypto, 'randomBytes')
      // First call reproduces the pre-existing reference (forces a collision), second call
      // produces a different one so the retry loop actually terminates.
      .mockReturnValueOnce(Buffer.from([0x00, 0x00, 0x00, 0x00]) as unknown as Buffer)
      .mockReturnValueOnce(Buffer.from([0x01, 0x01, 0x01, 0x01]) as unknown as Buffer);

    try {
      const secondReference = await generateUniqueBookingReference();
      expect(secondReference).toBe('BK-01010101');
      expect(secondReference).not.toBe(collidingReference);
      expect(randomBytesSpy).toHaveBeenCalledTimes(2);
    } finally {
      randomBytesSpy.mockRestore();
    }
  });
});
