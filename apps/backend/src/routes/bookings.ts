import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { createBookingSchemaAdmin, listBookingsQuerySchema } from './bookings.schema';
import { createBooking, bookingInclude, BookingServiceError } from '../lib/bookings';

export const bookingsRouter = Router();

bookingsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = listBookingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { page, limit, status, paymentStatus, tourId, customerId, q } = parsed.data;
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(tourId ? { tourId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q, mode: 'insensitive' as const } },
              { customer: { name: { contains: q, mode: 'insensitive' as const } } },
              { customer: { email: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          reference: true,
          status: true,
          paymentStatus: true,
          participants: true,
          startDate: true,
          totalPrice: true,
          amountPaid: true,
          createdAt: true,
          tour: { select: { id: true, title: true } },
          customer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      bookings,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: bookingInclude,
    });
    if (!booking) {
      res.status(404).json({ error: 'booking not found' });
      return;
    }
    res.json(booking);
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createBookingSchemaAdmin.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { tourId, participants, startDate, customerId, customer, notes } = parsed.data;
    const booking = await createBooking({
      tourId,
      participants,
      startDate: new Date(startDate),
      customerInput: { customerId, customer },
      notes,
      requireActiveTour: false,
      status: 'CONFIRMED',
    });

    res.status(201).json(booking);
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
