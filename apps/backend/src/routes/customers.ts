import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdminRole } from '../middleware/requireAdminRole';
import { normalizeEmail } from '../lib/customers';
import { bookingListSelect, finalizeBookingList } from '../lib/bookings';
import { listCustomersQuerySchema, createCustomerSchema, updateCustomerSchema } from './customers.schema';

export const customersRouter = Router();

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Dual-purpose: the typeahead picker in BookingForm.tsx calls this with just `q`, the
// standalone Customers screen calls it with page/limit and an optional q. Omitting q means
// "list everyone, paginated" rather than a 400 — a behavior change from the old search-only
// route, which required q.
customersRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = listCustomersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { page, limit, q } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: CUSTOMER_SELECT,
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      customers,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

customersRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      select: CUSTOMER_SELECT,
    });
    if (!customer) {
      res.status(404).json({ error: 'customer not found' });
      return;
    }

    const rawBookings = await prisma.booking.findMany({
      where: { customerId: req.params.id },
      orderBy: { createdAt: 'desc' },
      select: bookingListSelect,
    });

    res.json({ ...customer, bookings: await finalizeBookingList(rawBookings) });
  } catch (err) {
    next(err);
  }
});

customersRouter.post('/', requireAuth, requireAdminRole('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const email = normalizeEmail(parsed.data.email);
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'email already in use' });
      return;
    }

    const customer = await prisma.customer.create({
      data: {
        name: parsed.data.name,
        email,
        phone: parsed.data.phone ?? null,
      },
      select: CUSTOMER_SELECT,
    });

    res.status(201).json(customer);
  } catch (err) {
    // Defense-in-depth alongside the findUnique pre-check above, for the race window between
    // the check and the write.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'email already in use' });
      return;
    }
    next(err);
  }
});

customersRouter.patch('/:id', requireAuth, requireAdminRole('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { email, ...rest } = parsed.data;
    let normalizedEmail: string | undefined;
    if (email !== undefined) {
      normalizedEmail = normalizeEmail(email);
      // Excludes the row being edited — re-submitting a customer's own current email (even in
      // a different case) must not 409 against itself.
      const existing = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== req.params.id) {
        res.status(409).json({ error: 'email already in use' });
        return;
      }
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...rest, ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}) },
      select: CUSTOMER_SELECT,
    });

    res.json(customer);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'customer not found' });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'email already in use' });
      return;
    }
    next(err);
  }
});

customersRouter.delete('/:id', requireAuth, requireAdminRole('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const customer = await prisma.customer.delete({ where: { id: req.params.id } });
    res.status(200).json({ id: customer.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'customer not found' });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      res.status(409).json({ error: 'cannot delete a customer with existing bookings' });
      return;
    }
    next(err);
  }
});
