import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createBookingSchemaPublic } from './bookings.schema';
import { createBooking, serializeBooking, BookingServiceError } from '../lib/bookings';

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

    const serialized = serializeBooking(booking);

    res.status(201).json({
      reference: serialized.reference,
      // tourId is kept at the top level for backward compatibility with the existing external
      // booking-site consumer of this endpoint (it lives outside this repo, so its exact field
      // usage isn't visible here) — tour.id below is the richer, preferred form going forward.
      tourId: serialized.tourId,
      status: serialized.status,
      participants: serialized.participants,
      startDate: serialized.startDate,
      finishDate: serialized.finishDate,
      totalPrice: serialized.totalPrice,
      createdAt: serialized.createdAt,
      tour: {
        id: serialized.tour.id,
        title: serialized.tour.title,
        slug: serialized.tour.slug,
        imageCover: serialized.tour.imageCover,
        duration: serialized.tour.duration,
      },
      // Deliberately excludes customer.id: this endpoint never accepts a customerId back in
      // (see createBookingSchemaPublic), and the booking's own reference is the purpose-built
      // handle for the external client — an internal PK with no matching lookup capability
      // would just be unnecessary exposure.
      customer: {
        name: serialized.customer.name,
        email: serialized.customer.email,
        phone: serialized.customer.phone,
      },
    });
  } catch (err) {
    if (err instanceof BookingServiceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
