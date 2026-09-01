import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { searchCustomersQuerySchema } from './customers.schema';

export const customersRouter = Router();

customersRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = searchCustomersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { q, limit } = parsed.data;

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, phone: true },
    });

    res.json({ customers });
  } catch (err) {
    next(err);
  }
});
