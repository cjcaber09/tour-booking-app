import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createBookingSchemaPublic } from './bookings.schema';
import { createBooking, BookingServiceError } from '../lib/bookings';

export const publicRouter = Router();

publicRouter.get('/tours', async (_req, res, next) => {
  try {
    const tours = await prisma.tour.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        summary: true,
        duration: true,
        maxGroupSize: true,
        difficulty: true,
        price: true,
        priceDiscount: true,
        ratingsAverage: true,
        ratingsQuantity: true,
        imageCover: true,
        images: true,
        startDates: true,
        startLocation: true,
        categories: { select: { id: true, name: true, slug: true } },
      },
    });
    res.json({ tours });
  } catch (err) {
    next(err);
  }
});

publicRouter.post('/bookings', async (req, res, next) => {
  try {
    const parsed = createBookingSchemaPublic.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { tourId, participants, startDate, customer } = parsed.data;
    const booking = await createBooking({
      tourId,
      participants,
      startDate: new Date(startDate),
      // customerId is never accepted from the public route — see createBookingSchemaPublic,
      // which has no such field. This is a deliberate IDOR guard: an external caller must
      // never be able to attach a booking to an arbitrary internal customer id.
      customerInput: { customer },
      requireActiveTour: true,
      status: 'PENDING',
    });

    res.status(201).json({
      reference: booking.reference,
      tourId: booking.tourId,
      participants: booking.participants,
      startDate: booking.startDate,
      totalPrice: booking.totalPrice,
      status: booking.status,
      createdAt: booking.createdAt,
    });
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
