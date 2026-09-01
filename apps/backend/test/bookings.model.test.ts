import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';

const createdBookingIds: string[] = [];
const createdCustomerIds: string[] = [];
const createdTourIds: string[] = [];

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.$disconnect();
});

describe('Customer / Booking schema', () => {
  it('creates a Customer', async () => {
    const customer = await prisma.customer.create({
      data: { email: `model-test-customer-${Date.now()}@example.com`, name: 'Model Test Customer' },
    });
    createdCustomerIds.push(customer.id);
    expect(customer.name).toBe('Model Test Customer');
    expect(customer.phone).toBeNull();
  });

  it('rejects a second Customer with the same email', async () => {
    const email = `model-test-dup-${Date.now()}@example.com`;
    const first = await prisma.customer.create({ data: { email, name: 'First' } });
    createdCustomerIds.push(first.id);

    await expect(prisma.customer.create({ data: { email, name: 'Second' } })).rejects.toThrow();
  });

  it('creates a Booking with only required fields and applies defaults', async () => {
    const tour = await prisma.tour.create({
      data: {
        title: `Model Test Tour ${Date.now()}`,
        slug: `model-test-tour-${Date.now()}`,
        description: 'desc',
        price: 100,
      },
    });
    createdTourIds.push(tour.id);

    const customer = await prisma.customer.create({
      data: { email: `model-test-booking-customer-${Date.now()}@example.com`, name: 'Booking Customer' },
    });
    createdCustomerIds.push(customer.id);

    const booking = await prisma.booking.create({
      data: {
        reference: `BK-MODELTEST${Date.now()}`,
        tourId: tour.id,
        customerId: customer.id,
        participants: 1,
        startDate: new Date(),
        totalPrice: 100,
      },
    });
    createdBookingIds.push(booking.id);

    expect(booking.status).toBe('PENDING');
    expect(booking.paymentStatus).toBe('UNPAID');
    expect(booking.amountPaid.toString()).toBe('0');
    expect(booking.refundAmount).toBeNull();
    expect(booking.cancelledAt).toBeNull();
  });

  it('rejects a second Booking with the same reference', async () => {
    const tour = await prisma.tour.create({
      data: {
        title: `Model Test Dup Ref Tour ${Date.now()}`,
        slug: `model-test-dup-ref-tour-${Date.now()}`,
        description: 'desc',
        price: 100,
      },
    });
    createdTourIds.push(tour.id);

    const customer = await prisma.customer.create({
      data: { email: `model-test-dup-ref-customer-${Date.now()}@example.com`, name: 'Dup Ref Customer' },
    });
    createdCustomerIds.push(customer.id);

    const reference = `BK-MODELDUPREF${Date.now()}`;
    const first = await prisma.booking.create({
      data: { reference, tourId: tour.id, customerId: customer.id, participants: 1, startDate: new Date(), totalPrice: 100 },
    });
    createdBookingIds.push(first.id);

    await expect(
      prisma.booking.create({
        data: { reference, tourId: tour.id, customerId: customer.id, participants: 1, startDate: new Date(), totalPrice: 100 },
      }),
    ).rejects.toThrow();
  });

  it('resolves the Tour and Customer relations via include', async () => {
    const tour = await prisma.tour.create({
      data: {
        title: `Model Test Relation Tour ${Date.now()}`,
        slug: `model-test-relation-tour-${Date.now()}`,
        description: 'desc',
        price: 100,
      },
    });
    createdTourIds.push(tour.id);

    const customer = await prisma.customer.create({
      data: { email: `model-test-relation-customer-${Date.now()}@example.com`, name: 'Relation Customer' },
    });
    createdCustomerIds.push(customer.id);

    const booking = await prisma.booking.create({
      data: {
        reference: `BK-MODELRELATION${Date.now()}`,
        tourId: tour.id,
        customerId: customer.id,
        participants: 1,
        startDate: new Date(),
        totalPrice: 100,
      },
      include: { tour: true, customer: true },
    });
    createdBookingIds.push(booking.id);

    expect(booking.tour.id).toBe(tour.id);
    expect(booking.customer.id).toBe(customer.id);
  });
});
