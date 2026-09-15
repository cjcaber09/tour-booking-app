import { Prisma, PaymentStatus, BookingStatus, AdminRole } from '@prisma/client';
import { prisma } from './prisma';
import { generateUniqueBookingReference } from './bookingReference';
import { normalizeEmail } from './customers';
import { getOrCreateSettings } from './settings';

export class BookingServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Exact-role check — GUIDE only. LEAD_GUIDE stays unrestricted regardless of
// assignment, unlike the renderer's isGuideRole() which treats GUIDE and LEAD_GUIDE
// as the same "guide-type" bucket for layout purposes.
export async function assertBookingAccessAllowed(role: AdminRole, adminId: string, booking: { guideId: string | null }) {
  if (role === 'GUIDE' && booking.guideId !== adminId) {
    throw new BookingServiceError(403, 'you are not assigned to this booking');
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
  guide: { select: { id: true, name: true, email: true, avatarUrl: true } },
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
  guide: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.BookingSelect;

export function dateOnly(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Bookings that occupy a slot for the "max bookings per day" cap — PENDING bookings
// are deliberately excluded (they don't guard a date until an admin confirms them;
// see assertDailyBookingCapNotExceeded), as is CANCELLED (frees the date back up).
const CAP_COUNTED_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.ONGOING, BookingStatus.COMPLETED];

export async function assertDailyBookingCapNotExceeded(startDate: Date) {
  const settings = await getOrCreateSettings();
  const cap = settings.maxBookingsPerDay;
  const start = dateOnly(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const count = await prisma.booking.count({
    where: { startDate: { gte: start, lt: end }, status: { in: CAP_COUNTED_STATUSES } },
  });
  if (count >= cap) {
    throw new BookingServiceError(
      409,
      `this date already has the maximum of ${cap} confirmed booking${cap === 1 ? '' : 's'} allowed — choose a different date, or an admin can raise the daily cap in Settings`,
    );
  }
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

// A booking is locked against full edits and against cancellation-while-paid once its
// tour is due, ongoing, or completed. Shared by the PATCH /:id full-edit gate and the
// POST /:id/cancel paid-refund gate in routes/bookings.ts.
export function isBookingLocked(booking: { status: BookingStatus; startDate: Date }): boolean {
  return (
    booking.status === BookingStatus.ONGOING ||
    booking.status === BookingStatus.COMPLETED ||
    (booking.status === BookingStatus.CONFIRMED && todayIsPastOrEqualStartDate(booking.startDate))
  );
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

  // Only a booking created straight into CONFIRMED (i.e. admin-created) occupies a
  // day's slot immediately — a publicly-created PENDING booking doesn't guard the
  // date until an admin confirms it (see assertDailyBookingCapNotExceeded). Checked
  // after the above resolve, so a genuinely invalid tourId/customerId still surfaces
  // its own error instead of being masked by an unrelated full-day rejection.
  if (params.status === BookingStatus.CONFIRMED) {
    await assertDailyBookingCapNotExceeded(params.startDate);
  }

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

export interface UpdateBookingParams {
  tourId?: string;
  customerId?: string;
  customer?: { email: string; name: string; phone?: string };
  participants?: number;
  startDate?: string;
  amountPaid?: number;
  notes?: string;
  guideId?: string | null;
}

type ExistingBookingForUpdate = {
  id: string;
  status: BookingStatus;
  tourId: string;
  participants: number;
  startDate: Date;
  totalPrice: Prisma.Decimal;
  customerId: string;
  amountPaid: Prisma.Decimal;
};

// Assigning a guide only makes sense once the booking is actually confirmed — a PENDING
// booking is still waiting on staff review and may never happen at all. Un-assigning
// (guideId: null) isn't gated: nothing can be assigned while PENDING in the first place,
// so there's nothing to block clearing.
async function assertGuideAssignmentAllowed(guideId: string | null | undefined, existingStatus: BookingStatus) {
  if (!guideId) {
    return;
  }
  if (existingStatus === BookingStatus.PENDING) {
    throw new BookingServiceError(409, 'cannot assign a guide until the booking is confirmed');
  }
  const guide = await prisma.admin.findUnique({ where: { id: guideId } });
  if (!guide || !['GUIDE', 'LEAD_GUIDE'].includes(guide.role) || !guide.isActive) {
    throw new BookingServiceError(400, 'guideId must reference an active admin with the GUIDE or LEAD_GUIDE role');
  }
}

// The tour/participants/startDate branch and the customer branch touch independent
// tables and don't depend on each other's result, so they're resolved concurrently
// rather than as two sequential round trips.
async function resolveUpdatedPricingAndCustomer(existing: ExistingBookingForUpdate, patch: UpdateBookingParams) {
  const totalPricePromise =
    patch.tourId !== undefined || patch.participants !== undefined || patch.startDate !== undefined
      ? computeTotalPrice(
          patch.tourId ?? existing.tourId,
          patch.participants ?? existing.participants,
          new Date(patch.startDate ?? existing.startDate),
          false,
        ).then((r) => r.totalPrice)
      : Promise.resolve(existing.totalPrice);

  const customerIdPromise =
    patch.customerId !== undefined || patch.customer !== undefined
      ? resolveCustomer({ customerId: patch.customerId, customer: patch.customer }).then((c) => c.id)
      : Promise.resolve(existing.customerId);

  const [totalPrice, customerId] = await Promise.all([totalPricePromise, customerIdPromise]);
  return { totalPrice, customerId };
}

// Only a CONFIRMED booking's startDate guards a day's slot — a PENDING booking never
// does (see assertDailyBookingCapNotExceeded), and only re-check when the date is
// actually changing: this booking's own row still counts toward its current day until
// the update commits, so an unconditional check would falsely block a no-op
// resubmission of the same startDate on an already-full day.
async function assertDailyCapForDateChange(existing: ExistingBookingForUpdate, startDate: string | undefined) {
  if (existing.status !== BookingStatus.CONFIRMED || startDate === undefined) {
    return;
  }
  const newDay = dateOnly(new Date(startDate));
  if (newDay.getTime() !== dateOnly(existing.startDate).getTime()) {
    await assertDailyBookingCapNotExceeded(new Date(startDate));
  }
}

function buildBookingUpdateData(
  patch: UpdateBookingParams,
  computed: { totalPrice: Prisma.Decimal; customerId: string; effectiveAmountPaid: Prisma.Decimal.Value },
): Prisma.BookingUncheckedUpdateInput {
  const { totalPrice, customerId, effectiveAmountPaid } = computed;
  const data: Prisma.BookingUncheckedUpdateInput = {
    customerId,
    totalPrice,
    paymentStatus: derivePaymentStatus(effectiveAmountPaid, totalPrice),
  };
  if (patch.tourId !== undefined) data.tourId = patch.tourId;
  if (patch.participants !== undefined) data.participants = patch.participants;
  if (patch.startDate !== undefined) data.startDate = new Date(patch.startDate);
  if (patch.amountPaid !== undefined) data.amountPaid = patch.amountPaid;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.guideId !== undefined) data.guideId = patch.guideId;
  return data;
}

// Caller (routes/bookings.ts) is expected to have already checked existing.status !==
// CANCELLED — mirrors that route's other handlers, which each own their own
// existing-booking status preconditions rather than delegating them here.
export async function updateBooking(existing: ExistingBookingForUpdate, params: UpdateBookingParams) {
  await assertGuideAssignmentAllowed(params.guideId, existing.status);

  // amountPaid-only patches (Record Payment) are always allowed; anything that touches
  // the booking's actual details is blocked once the tour is due, ongoing, or completed.
  const isFullEdit = [params.tourId, params.customerId, params.customer, params.participants, params.startDate, params.notes].some(
    (v) => v !== undefined,
  );
  if (isFullEdit && isBookingLocked(existing)) {
    throw new BookingServiceError(409, 'cannot edit a booking once it is due, ongoing, or completed');
  }

  const { totalPrice, customerId } = await resolveUpdatedPricingAndCustomer(existing, params);
  // Checked after the resolve above so an invalid tourId/offered-date still surfaces its
  // own error instead of being masked by an unrelated full-day rejection.
  await assertDailyCapForDateChange(existing, params.startDate);

  const effectiveAmountPaid = params.amountPaid ?? existing.amountPaid;
  const data = buildBookingUpdateData(params, { totalPrice, customerId, effectiveAmountPaid });

  return prisma.booking.update({ where: { id: existing.id }, data, include: bookingInclude });
}
