import { Prisma, PaymentStatus, BookingStatus } from '@prisma/client';
import { prisma } from './prisma';
import { generateUniqueBookingReference } from './bookingReference';
import { normalizeEmail } from './customers';

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
  const email = normalizeEmail(input.customer!.email);
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }
  return prisma.customer.create({
    data: {
      email,
      name: input.customer!.name,
      phone: input.customer!.phone,
    },
  });
}

export async function computeTotalPrice(
  tourId: string,
  participants: number,
  startDate: Date,
  requireActiveTour: boolean,
) {
  const tour = await prisma.tour.findUnique({ where: { id: tourId } });
  if (!tour) {
    throw new BookingServiceError(400, 'tour not found');
  }
  if (requireActiveTour && !tour.isActive) {
    throw new BookingServiceError(400, 'tour is not active');
  }
  if (tour.maxGroupSize != null && participants > tour.maxGroupSize) {
    throw new BookingServiceError(400, `participants exceeds this tour's maximum group size of ${tour.maxGroupSize}`);
  }
  // Empty startDates means the tour has no fixed departure schedule — unrestricted, since
  // there's currently no admin UI to ever populate this field (every tour has startDates: []
  // by construction), so treating empty as "restricted" would make every existing tour
  // unbookable.
  if (tour.startDates.length > 0) {
    const offered = tour.startDates.some((d) => dateOnly(d).getTime() === dateOnly(startDate).getTime());
    if (!offered) {
      throw new BookingServiceError(400, "startDate is not one of this tour's offered start dates");
    }
  }
  const unitPrice = tour.priceDiscount ?? tour.price;
  const totalPrice = unitPrice.mul(participants);
  return { tour, totalPrice };
}

export const bookingInclude = {
  tour: { select: { id: true, title: true, slug: true, imageCover: true, duration: true } },
  customer: { select: { id: true, name: true, email: true, phone: true } },
  payments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.BookingInclude;

export const bookingListSelect = {
  id: true,
  reference: true,
  status: true,
  paymentStatus: true,
  participants: true,
  startDate: true,
  totalPrice: true,
  amountPaid: true,
  createdAt: true,
  cancelledAt: true,
  tour: { select: { id: true, title: true, duration: true } },
  customer: { select: { id: true, name: true, email: true } },
} satisfies Prisma.BookingSelect;

function dateOnly(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeFinishDate(startDate: Date, durationDays: number | null): Date {
  const daysToAdd = durationDays && durationDays > 0 ? durationDays - 1 : 0;
  const finish = new Date(startDate);
  finish.setDate(finish.getDate() + daysToAdd);
  return finish;
}

export function todayIsPastOrEqualStartDate(startDate: Date): boolean {
  return dateOnly(new Date()) >= dateOnly(startDate);
}

// A full month-view calendar grid: the current month plus the leading/trailing days from
// the adjacent months needed to complete full (Sunday-start) weeks at both ends.
export function getBookingCalendarWindow(now: Date = new Date()): { from: Date; to: Date } {
  const monthStart = dateOnly(now);
  monthStart.setDate(1);
  const monthEnd = dateOnly(now);
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0); // last day of the current month

  const from = new Date(monthStart);
  from.setDate(from.getDate() - from.getDay()); // back up to the Sunday on/before the 1st

  const to = new Date(monthEnd);
  to.setDate(to.getDate() + (6 - to.getDay())); // forward to the Saturday on/after the last day
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

// Precomputed windows for the dashboard stats endpoint: today's start (for "upcoming"), the
// current calendar month's [start, end) bounds (for "this month" counts/sums), and the last 7
// calendar days oldest-to-newest (today last) for the bookings trend.
export function getBookingsStatsWindows(now: Date = new Date()) {
  const todayStart = dateOnly(now);

  const monthStart = dateOnly(now);
  monthStart.setDate(1);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1); // exclusive upper bound

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const start = dateOnly(now);
    start.setDate(start.getDate() - (6 - i));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { date: start.toISOString().slice(0, 10), start, end };
  });

  return { todayStart, monthStart, monthEnd, last7Days };
}

type BookingWithTourDuration = { startDate: Date; tour: { duration: number | null } };

export function serializeBooking<T extends BookingWithTourDuration>(booking: T): T & { finishDate: string } {
  return {
    ...booking,
    finishDate: computeFinishDate(booking.startDate, booking.tour.duration).toISOString(),
  };
}

type BookingOngoingCheck = BookingWithTourDuration & {
  id: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
};

// Lazily flips CONFIRMED/ONGOING -> COMPLETED once the tour's finish date has passed and the
// booking is fully paid. There's no cron job driving this transition — it's checked (and
// persisted) whenever a booking is read. Unpaid/partial bookings past their finish date are
// left as-is so they stay eligible for the Cancel-button exception (see routes/bookings.ts).
export async function autoCompleteIfDue<T extends BookingOngoingCheck>(booking: T): Promise<T> {
  if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.ONGOING) {
    return booking;
  }
  const finish = dateOnly(computeFinishDate(booking.startDate, booking.tour.duration));
  if (dateOnly(new Date()) <= finish) {
    return booking;
  }
  if (booking.paymentStatus !== PaymentStatus.PAID) {
    return booking;
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.COMPLETED } });
  return { ...booking, status: BookingStatus.COMPLETED };
}

// Shared post-query pipeline for any endpoint returning a list of bookings in
// bookingListSelect's shape: flips due ONGOING bookings to COMPLETED, then serializes.
export async function finalizeBookingList<T extends BookingOngoingCheck>(rawBookings: T[]) {
  const bookings = await Promise.all(rawBookings.map((booking) => autoCompleteIfDue(booking)));
  return bookings.map(serializeBooking);
}

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
  // These three round trips touch independent tables (Tour, Customer, Booking-by-reference)
  // with no data dependency on each other, so they're run concurrently rather than
  // sequentially — each one otherwise pays full round-trip latency to the DB on its own.
  const [{ tour, totalPrice }, customer, reference] = await Promise.all([
    computeTotalPrice(params.tourId, params.participants, params.startDate, params.requireActiveTour),
    resolveCustomer(params.customerInput),
    generateUniqueBookingReference(),
  ]);

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
