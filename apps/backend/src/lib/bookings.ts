import { Prisma, PaymentStatus, BookingStatus } from '@prisma/client';
import { prisma } from './prisma';
import { generateUniqueBookingReference } from './bookingReference';

export class BookingServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function derivePaymentStatus(
  amountPaid: Prisma.Decimal.Value,
  totalPrice: Prisma.Decimal.Value,
): 'UNPAID' | 'PARTIAL' | 'PAID' {
  const paid = new Prisma.Decimal(amountPaid);
  const total = new Prisma.Decimal(totalPrice);
  if (paid.lte(0)) return PaymentStatus.UNPAID;
  if (paid.gte(total)) return PaymentStatus.PAID;
  return PaymentStatus.PARTIAL;
}

export interface CustomerInput {
  customerId?: string;
  customer?: { email: string; name: string; phone?: string };
}

export async function resolveCustomer(input: CustomerInput) {
  if (input.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      throw new BookingServiceError(400, 'customer not found');
    }
    return customer;
  }

  // Find-or-create by email — NOT an upsert. An existing match keeps its stored name/phone;
  // Customer is a shared row referenced by every past booking's customerId, so silently
  // overwriting it from a new booking's typed-in details would retroactively change what
  // old bookings display. A typo'd or slightly different name on a repeat booking is just
  // ignored in favor of the stored record.
  const existing = await prisma.customer.findUnique({ where: { email: input.customer!.email } });
  if (existing) {
    return existing;
  }
  return prisma.customer.create({
    data: {
      email: input.customer!.email,
      name: input.customer!.name,
      phone: input.customer!.phone,
    },
  });
}

export async function computeTotalPrice(tourId: string, participants: number, requireActiveTour: boolean) {
  const tour = await prisma.tour.findUnique({ where: { id: tourId } });
  if (!tour) {
    throw new BookingServiceError(400, 'tour not found');
  }
  if (requireActiveTour && !tour.isActive) {
    throw new BookingServiceError(400, 'tour is not active');
  }
  const unitPrice = tour.priceDiscount ?? tour.price;
  const totalPrice = unitPrice.mul(participants);
  return { tour, totalPrice };
}

export const bookingInclude = {
  tour: { select: { id: true, title: true, slug: true, imageCover: true } },
  customer: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.BookingInclude;

export interface CreateBookingParams {
  tourId: string;
  participants: number;
  startDate: Date;
  customerInput: CustomerInput;
  notes?: string;
  requireActiveTour: boolean;
  status: typeof BookingStatus.PENDING | typeof BookingStatus.CONFIRMED;
}

export async function createBooking(params: CreateBookingParams) {
  const { tour, totalPrice } = await computeTotalPrice(params.tourId, params.participants, params.requireActiveTour);
  const customer = await resolveCustomer(params.customerInput);
  const reference = await generateUniqueBookingReference();

  return prisma.booking.create({
    data: {
      reference,
      tourId: tour.id,
      customerId: customer.id,
      participants: params.participants,
      startDate: params.startDate,
      totalPrice,
      amountPaid: 0,
      paymentStatus: PaymentStatus.UNPAID,
      status: params.status,
      notes: params.notes,
    },
    include: bookingInclude,
  });
}
