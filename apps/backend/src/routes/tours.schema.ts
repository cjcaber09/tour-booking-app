import { z } from 'zod';

export const baseTourSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  summary: z.string().optional(),
  duration: z.number().int().positive().optional(),
  maxGroupSize: z.number().int().positive().optional(),
  difficulty: z.enum(['easy', 'medium', 'difficult']).optional(),
  price: z.number().positive(),
  priceDiscount: z.number().positive().optional(),
  imageCover: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  startDates: z.array(z.string().datetime()).optional(),
  startLocation: z.string().optional(),
  isActive: z.boolean().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

export const createTourSchema = baseTourSchema.refine(
  (data) => data.priceDiscount === undefined || data.priceDiscount < data.price,
  {
    message: 'priceDiscount must be less than price',
    path: ['priceDiscount'],
  },
);

export type CreateTourInput = z.infer<typeof createTourSchema>;

export const updateTourSchema = baseTourSchema.partial().refine(
  (data) => data.priceDiscount === undefined || data.price === undefined || data.priceDiscount < data.price,
  {
    message: 'priceDiscount must be less than price',
    path: ['priceDiscount'],
  },
);

export type UpdateTourInput = z.infer<typeof updateTourSchema>;

export const listToursQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type ListToursQuery = z.infer<typeof listToursQuerySchema>;
