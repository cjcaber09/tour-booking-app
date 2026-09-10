import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

export interface AuditEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  adminId: string | null;
}

const MAX_ENTRIES = 500;
const buffer: AuditEntry[] = [];

function isAuditEnabled(): boolean {
  // Read fresh per-request (not cached at module load), mirroring ipAllowlist.ts's
  // pattern: absence of explicit opt-in = disabled, so tests can flip the env var
  // between requests without recreating the app.
  return process.env.ENABLE_DEV_AUDIT_LOG === 'true';
}

export function auditLog(req: Request, res: Response, next: NextFunction) {
  if (!isAuditEnabled()) {
    next();
    return;
  }

  const startedAt = Date.now();
  const timestamp = new Date(startedAt).toISOString();

  // res.on('finish') fires only after Express has already flushed the full response
  // (status, headers, body) to the client — everything below runs strictly after the
  // response being measured has already gone out, so it cannot add latency to it.
  res.on('finish', () => {
    buffer.push({
      id: crypto.randomUUID(),
      timestamp,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      adminId: req.adminId ?? null,
    });
    if (buffer.length > MAX_ENTRIES) {
      buffer.shift();
    }
  });

  next();
}

export function getAuditEntries(): AuditEntry[] {
  return [...buffer].reverse();
}
