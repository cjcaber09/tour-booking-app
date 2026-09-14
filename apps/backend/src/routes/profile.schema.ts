import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
  role: z.enum(['ADMIN', 'LEAD_GUIDE', 'GUIDE', 'STAFF']).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Deliberately NOT trimmed — silently altering a password (even just stripping
// surrounding whitespace) risks masking a real typo as a confusing "wrong password"
// instead. A generous max is just hygiene against absurd payloads, not a real
// password-strength constraint.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
