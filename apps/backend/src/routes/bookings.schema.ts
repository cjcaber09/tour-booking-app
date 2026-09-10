import { z } from 'zod';

export const customerInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
});

const bookingCoreSchema = z.object({
  tourId: z.string().uuid(),
  participants: z.number().int().positive(),
  startDate: z.string().datetime(),
});

export const createBookingSchemaAdmin = bookingCoreSchema
  .extend({
    customerId: z.string().uuid().optional(),
    customer: customerInputSchema.optional(),
    notes: z.string().optional(),
  })
  .refine((data) => (data.customerId != null) !== (data.customer != null), {
    message: 'provide exactly one of customerId or customer',
    path: ['customerId'],
  });

export type CreateBookingAdminInput = z.infer<typeof createBookingSchemaAdmin>;

export const createBookingSchemaPublic = bookingCoreSchema.extend({
  customer: customerInputSchema,
});

export type CreateBookingPublicInput = z.infer<typeof createBookingSchemaPublic>;

export const updateBookingSchema = z
  .object({
    tourId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    customer: customerInputSchema.optional(),
    participants: z.number().int().positive().optional(),
    startDate: z.string().datetime().optional(),
    amountPaid: z.number().nonnegative().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => !(data.customerId != null && data.customer != null), {
    message: 'provide at most one of customerId or customer',
    path: ['customerId'],
  });

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

export const cancelBookingSchema = z.object({
  refundAmount: z.number().nonnegative(),
});

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export const recordPaymentSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('CASH'), amount: z.number().positive() }),
  z.object({
    method: z.literal('INVOICE_REFERENCE'),
    amount: z.number().positive(),
    invoiceReference: z.string().trim().min(1),
  }),
  z.object({ method: z.literal('FILE'), amount: z.number().positive(), proofUrl: z.string().min(1) }),
]);

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(['PENDING', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']).optional(),
  tourId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  q: z.string().min(1).optional(),
});

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
