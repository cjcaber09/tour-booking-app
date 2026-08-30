import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/tokens';

declare global {
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    req.adminId = verifyAccessToken(token).adminId;
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}
