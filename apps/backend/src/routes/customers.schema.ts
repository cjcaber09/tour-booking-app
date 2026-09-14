import { z } from 'zod';

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  q: z.string().trim().max(200).optional(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).nullable().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
