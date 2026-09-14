import { z } from 'zod';

// Email is trimmed but deliberately NOT lowercased here — admin.email lookups are
// exact-match (prisma.admin.findUnique), and while newly created/updated admins now
// get a normalized-lowercase email (see admins.schema.ts), forcing login/recovery
// input to lowercase too could lock out any pre-existing admin whose stored email
// isn't already all-lowercase. Password is intentionally not trimmed — see
// profile.schema.ts's changePasswordSchema for why.
export const loginSchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const requestRecoverySchema = z.object({
  email: z.string().trim().min(1).max(320),
});

export type RequestRecoveryInput = z.infer<typeof requestRecoverySchema>;

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().trim().min(1),
});

export type RefreshTokenBodyInput = z.infer<typeof refreshTokenBodySchema>;
