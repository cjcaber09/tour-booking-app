import { Router } from 'express';
import { Prisma, AdminRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdminRole } from '../middleware/requireAdminRole';
import {
  createBookingSchemaAdmin,
  listBookingsQuerySchema,
  updateBookingSchema,
  cancelBookingSchema,
  recordPaymentSchema,
} from './bookings.schema';
import {
  createBooking,
  updateBooking,
  bookingInclude,
  bookingListSelect,
  finalizeBookingList,
  getBookingCalendarWindow,
  getBookingsStatsWindows,
  BookingServiceError,
  derivePaymentStatus,
  serializeBooking,
  autoCompleteIfDue,
  todayIsPastOrEqualStartDate,
  assertDailyBookingCapNotExceeded,
  assertBookingAccessAllowed,
  isBookingLocked,
} from '../lib/bookings';
import { upload } from '../lib/upload';
import { uploadPaymentProof } from '../lib/supabaseStorage';

export const bookingsRouter = Router();

const ALL_ROLES: AdminRole[] = ['ADMIN', 'LEAD_GUIDE', 'GUIDE', 'STAFF'];

bookingsRouter.get('/', requireAuth, requireAdminRole(...ALL_ROLES), async (req, res, next) => {
  try {
    const parsed = listBookingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { page, limit, status, paymentStatus, tourId, customerId, q } = parsed.data;
    const skip = (page - 1) * limit;

    const searchClause = q
      ? {
          OR: [
            { reference: { contains: q, mode: 'insensitive' as const } },
            { tour: { title: { contains: q, mode: 'insensitive' as const } } },
            { customer: { name: { contains: q, mode: 'insensitive' as const } } },
            { customer: { email: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    // Respects every other filter but not status, so every status tab's count
    // reflects "how many match the rest of this filter" regardless of which tab is
    // currently selected. A GUIDE's scope is forced in here too (not just on `where`
    // below), since `where` is derived from `facetWhere` and the four status-tab
    // counts query `facetWhere` directly — scoping only `where` would narrow a
    // guide's list correctly while leaving every status-tab count showing
    // company-wide numbers.
    const facetWhere = {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(tourId ? { tourId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(req.adminRole === 'GUIDE' ? { guideId: req.adminId } : {}),
      ...searchClause,
    };
    const where = { ...facetWhere, ...(status ? { status } : {}) };

    const [rawBookings, total, pendingCount, confirmedCount, cancelledCount, allCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: bookingListSelect,
      }),
      prisma.booking.count({ where }),
      prisma.booking.count({ where: { ...facetWhere, status: 'PENDING' } }),
      prisma.booking.count({ where: { ...facetWhere, status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { ...facetWhere, status: 'CANCELLED' } }),
      prisma.booking.count({ where: facetWhere }),
    ]);

    res.json({
      bookings: await finalizeBookingList(rawBookings),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      // Only the 4 statuses the admin UI's tabs actually show (ONGOING/COMPLETED
      // have no tab) — ALL is every status combined, not just these 3.
      statusCounts: { ALL: allCount, PENDING: pendingCount, CONFIRMED: confirmedCount, CANCELLED: cancelledCount },
    });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get('/calendar', requireAuth, async (req, res, next) => {
  try {
    const { from, to } = getBookingCalendarWindow();
    const rawBookings = await prisma.booking.findMany({
      where: { startDate: { gte: from, lte: to } },
      orderBy: { startDate: 'asc' },
      select: bookingListSelect,
    });

    res.json({
      bookings: await finalizeBookingList(rawBookings),
      from: from.toISOString(),
      to: to.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const { todayStart, monthStart, monthEnd, last7Days } = getBookingsStatsWindows();

    const [totalBookings, upcomingBookings, cancellationsThisMonth, revenueAgg, ...trendCounts] =
      await Promise.all([
        prisma.booking.count(),
        prisma.booking.count({
          where: { status: { not: 'CANCELLED' }, startDate: { gte: todayStart } },
        }),
        prisma.booking.count({
          where: { status: 'CANCELLED', cancelledAt: { gte: monthStart, lt: monthEnd } },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gte: monthStart, lt: monthEnd } },
        }),
        ...last7Days.map((d) =>
          prisma.booking.count({ where: { createdAt: { gte: d.start, lt: d.end } } }),
        ),
      ]);

    res.json({
      totalBookings,
      upcomingBookings,
      cancellationsThisMonth,
      // _sum.amount is null when no payments matched — wrap explicitly so this always
      // serializes as a Decimal-string, matching every other money field in this codebase,
      // instead of a plain 0 on a zero-payment month.
      revenueThisMonth: new Prisma.Decimal(revenueAgg._sum.amount ?? 0),
      bookingsTrend: last7Days.map((d, i) => ({ date: d.date, count: trendCounts[i] })),
    });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get('/:id', requireAuth, requireAdminRole(...ALL_ROLES), async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: bookingInclude,
    });
    if (!booking) {
      res.status(404).json({ error: 'booking not found' });
      return;
    }
    await assertBookingAccessAllowed(req.adminRole!, req.adminId!, booking);
    res.json(serializeBooking(await autoCompleteIfDue(booking)));
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

bookingsRouter.post('/', requireAuth, requireAdminRole('ADMIN', 'LEAD_GUIDE', 'STAFF'), async (req, res, next) => {
  try {
    const parsed = createBookingSchemaAdmin.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { tourId, participants, startDate, customerId, customer, notes, confirmed } = parsed.data;
    const booking = await createBooking({
      tourId,
      participants,
      startDate: new Date(startDate),
      customerInput: { customerId, customer },
      notes,
      requireActiveTour: false,
      status: confirmed ? 'CONFIRMED' : 'PENDING',
    });

    res.status(201).json(serializeBooking(booking));
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

bookingsRouter.patch('/:id', requireAuth, requireAdminRole('ADMIN', 'LEAD_GUIDE', 'STAFF'), async (req, res, next) => {
  try {
    const parsed = updateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'booking not found' });
      return;
    }
    if (existing.status === 'CANCELLED') {
      res.status(409).json({ error: 'cannot edit a cancelled booking' });
      return;
    }

    const booking = await updateBooking(existing, parsed.data);
    res.json(serializeBooking(booking));
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'booking not found' });
      return;
    }
    next(err);
  }
});

bookingsRouter.post('/:id/confirm', requireAuth, requireAdminRole('ADMIN', 'LEAD_GUIDE', 'STAFF'), async (req, res, next) => {
  try {
    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'booking not found' });
      return;
    }
    if (existing.status !== 'PENDING') {
      res.status(409).json({ error: 'booking is not pending' });
      return;
    }

    await assertDailyBookingCapNotExceeded(existing.startDate);

    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED' },
      include: bookingInclude,
    });
    res.json(serializeBooking(booking));
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

bookingsRouter.post('/:id/ongoing', requireAuth, requireAdminRole(...ALL_ROLES), async (req, res, next) => {
  try {
    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'booking not found' });
      return;
    }
    await assertBookingAccessAllowed(req.adminRole!, req.adminId!, existing);
    if (existing.status !== 'CONFIRMED') {
      res.status(409).json({ error: 'booking is not confirmed' });
      return;
    }
    if (!todayIsPastOrEqualStartDate(existing.startDate)) {
      res.status(409).json({ error: 'booking has not reached its start date' });
      return;
    }
    if (!existing.guideId) {
      res.status(409).json({ error: 'assign a guide before marking this booking ongoing' });
      return;
    }

    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'ONGOING' },
      include: bookingInclude,
    });
    res.json(serializeBooking(booking));
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

const ALLOWED_PAYMENT_PROOF_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

bookingsRouter.post(
  '/:id/payments/upload-proof',
  requireAuth,
  requireAdminRole('ADMIN', 'LEAD_GUIDE', 'STAFF'),
  upload.single('proof'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'proof file is required' });
        return;
      }
      if (!ALLOWED_PAYMENT_PROOF_MIMETYPES.includes(req.file.mimetype)) {
        res.status(400).json({ error: 'unsupported file type' });
        return;
      }
      const url = await uploadPaymentProof(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.status(201).json({ url });
    } catch (err) {
      next(err);
    }
  },
);

bookingsRouter.post('/:id/payments', requireAuth, requireAdminRole('ADMIN', 'LEAD_GUIDE', 'STAFF'), async (req, res, next) => {
  try {
    const parsed = recordPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'booking not found' });
      return;
    }
    if (existing.status === 'CANCELLED') {
      res.status(409).json({ error: 'cannot record a payment on a cancelled booking' });
      return;
    }

    const newAmountPaid = new Prisma.Decimal(existing.amountPaid).add(parsed.data.amount);
    if (newAmountPaid.gt(new Prisma.Decimal(existing.totalPrice))) {
      res.status(400).json({ error: 'amount cannot exceed the remaining balance' });
      return;
    }

    const { method } = parsed.data;
    const [, booking] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          bookingId: existing.id,
          amount: parsed.data.amount,
          method,
          invoiceReference: method === 'INVOICE_REFERENCE' ? parsed.data.invoiceReference : null,
          proofUrl: method === 'FILE' ? parsed.data.proofUrl : null,
        },
      }),
      prisma.booking.update({
        where: { id: existing.id },
        data: { amountPaid: newAmountPaid, paymentStatus: derivePaymentStatus(newAmountPaid, existing.totalPrice) },
        include: bookingInclude,
      }),
    ]);
    res.status(201).json(serializeBooking(booking));
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post('/:id/cancel', requireAuth, requireAdminRole(...ALL_ROLES), async (req, res, next) => {
  try {
    const parsed = cancelBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'booking not found' });
      return;
    }
    await assertBookingAccessAllowed(req.adminRole!, req.adminId!, existing);
    if (existing.status === 'CANCELLED') {
      res.status(409).json({ error: 'booking is already cancelled' });
      return;
    }
    if (isBookingLocked(existing) && existing.paymentStatus === 'PAID') {
      res.status(409).json({ error: 'booking cannot be cancelled once it is due, ongoing, or completed' });
      return;
    }
    if (parsed.data.refundAmount > Number(existing.amountPaid)) {
      res.status(400).json({ error: 'refundAmount cannot exceed amountPaid' });
      return;
    }

    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        refundAmount: parsed.data.refundAmount,
        cancelledAt: new Date(),
        ...(parsed.data.refundAmount > 0 ? { paymentStatus: 'REFUNDED' } : {}),
      },
      include: bookingInclude,
    });
    res.json(serializeBooking(booking));
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
