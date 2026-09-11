import { z } from 'zod';

export const createAdminSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'LEAD_GUIDE', 'GUIDE', 'STAFF']),
  phone: z.string().nullable().optional(),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const updateAdminSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(['ADMIN', 'LEAD_GUIDE', 'GUIDE', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;

export const listAdminsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  role: z.enum(['ADMIN', 'LEAD_GUIDE', 'GUIDE', 'STAFF']).optional(),
  // z.coerce.boolean() just does JS's Boolean(value), so the query string "false" (a
  // non-empty string) would coerce to true — parse the literal strings explicitly instead.
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  q: z.string().optional(),
});

export type ListAdminsQuery = z.infer<typeof listAdminsQuerySchema>;
