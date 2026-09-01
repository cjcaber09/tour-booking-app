import { z } from 'zod';

export const searchCustomersQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().max(25).default(10),
});

export type SearchCustomersQuery = z.infer<typeof searchCustomersQuerySchema>;
