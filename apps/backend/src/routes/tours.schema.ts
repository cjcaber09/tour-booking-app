import { z } from 'zod';

export const createTourSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    summary: z.string().optional(),
    duration: z.number().int().positive().optional(),
    maxGroupSize: z.number().int().positive().optional(),
    difficulty: z.enum(['easy', 'medium', 'difficult']).optional(),
    price: z.number().positive(),
    priceDiscount: z.number().positive().optional(),
    imageCover: z.string().url(),
    images: z.array(z.string().url()).optional(),
    startDates: z.array(z.string().datetime()).optional(),
    startLocation: z.string().optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.priceDiscount === undefined || data.priceDiscount < data.price, {
    message: 'priceDiscount must be less than price',
    path: ['priceDiscount'],
  });

export type CreateTourInput = z.infer<typeof createTourSchema>;
