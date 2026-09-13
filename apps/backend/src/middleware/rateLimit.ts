import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

function isTest(): boolean {
  // Read fresh per-call (not cached at module load) so tests can flip NODE_ENV between
  // requests without recreating the app — same pattern as ipAllowlist.ts/auditLog.ts.
  return process.env.NODE_ENV === 'test';
}

export function createLimiter(windowMs: number, max: number): RequestHandler {
  const limiter = rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
  return (req, res, next) => {
    if (isTest()) {
      next();
      return;
    }
    limiter(req, res, next);
  };
}

export const globalLimiter = createLimiter(15 * 60 * 1000, 300);
export const loginLimiter = createLimiter(15 * 60 * 1000, 10);
// Stricter than loginLimiter: this gates an unauthenticated, email-enumerable endpoint.
export const recoveryLimiter = createLimiter(15 * 60 * 1000, 5);
