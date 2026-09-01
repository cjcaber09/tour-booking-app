import { describe, it, expect } from 'vitest';
import { createBookingSchemaAdmin, createBookingSchemaPublic, listBookingsQuerySchema } from '../src/routes/bookings.schema';

const validTourId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const validCustomerId = '4fa85f64-5717-4562-b3fc-2c963f66afa6';
const validStartDate = '2027-01-01T00:00:00.000Z';
const validCustomer = { email: 'jane@example.com', name: 'Jane Doe' };

describe('createBookingSchemaAdmin', () => {
  it('accepts a payload with an existing customerId', () => {
    const result = createBookingSchemaAdmin.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
      customerId: validCustomerId,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a payload with an inline customer object', () => {
    const result = createBookingSchemaAdmin.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
      customer: validCustomer,
    });
    expect(result.success).toBe(true);
  });

  it('rejects when both customerId and customer are provided', () => {
    const result = createBookingSchemaAdmin.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
      customerId: validCustomerId,
      customer: validCustomer,
    });
    expect(result.success).toBe(false);
  });

  it('rejects when neither customerId nor customer is provided', () => {
    const result = createBookingSchemaAdmin.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive participants value', () => {
    const result = createBookingSchemaAdmin.safeParse({
      tourId: validTourId,
      participants: 0,
      startDate: validStartDate,
      customer: validCustomer,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid tourId', () => {
    const result = createBookingSchemaAdmin.safeParse({
      tourId: 'not-a-uuid',
      participants: 2,
      startDate: validStartDate,
      customer: validCustomer,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid startDate', () => {
    const result = createBookingSchemaAdmin.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: 'not-a-date',
      customer: validCustomer,
    });
    expect(result.success).toBe(false);
  });

  it('has no amountPaid field, and silently strips one if sent', () => {
    const result = createBookingSchemaAdmin.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
      customer: validCustomer,
      amountPaid: 500,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).amountPaid).toBeUndefined();
    }
  });
});

describe('createBookingSchemaPublic', () => {
  it('accepts a payload with an inline customer object', () => {
    const result = createBookingSchemaPublic.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
      customer: validCustomer,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload with no customer object at all', () => {
    const result = createBookingSchemaPublic.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
    });
    expect(result.success).toBe(false);
  });

  it('has no customerId field, and silently strips one if sent', () => {
    const result = createBookingSchemaPublic.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
      customer: validCustomer,
      customerId: validCustomerId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).customerId).toBeUndefined();
    }
  });

  it('rejects an invalid customer email', () => {
    const result = createBookingSchemaPublic.safeParse({
      tourId: validTourId,
      participants: 2,
      startDate: validStartDate,
      customer: { email: 'not-an-email', name: 'Jane Doe' },
    });
    expect(result.success).toBe(false);
  });
});

describe('listBookingsQuerySchema', () => {
  it('applies default page and limit when none are provided', () => {
    const result = listBookingsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
    }
  });

  it('accepts a valid status filter', () => {
    const result = listBookingsQuerySchema.safeParse({ status: 'PENDING' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status filter', () => {
    const result = listBookingsQuerySchema.safeParse({ status: 'MAYBE' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid paymentStatus filter', () => {
    const result = listBookingsQuerySchema.safeParse({ paymentStatus: 'REFUNDED' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid paymentStatus filter', () => {
    const result = listBookingsQuerySchema.safeParse({ paymentStatus: 'MAYBE' });
    expect(result.success).toBe(false);
  });

  it('accepts a free-text q filter', () => {
    const result = listBookingsQuerySchema.safeParse({ q: 'jane' });
    expect(result.success).toBe(true);
  });
});
