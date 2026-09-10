import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      adminRole?: AdminRole;
    }
  }
}

export function requireAdminRole(...allowedRoles: AdminRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const admin = await prisma.admin.findUnique({
        where: { id: req.adminId },
        select: { role: true, isActive: true },
      });
      if (!admin) {
        res.status(401).json({ error: 'invalid session' });
        return;
      }
      // Same 'forbidden' response as the role-mismatch branch below, deliberately — a caller
      // who shouldn't have access either way doesn't need to learn their account was suspended
      // versus just under-privileged.
      if (!admin.isActive) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      if (!allowedRoles.includes(admin.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      req.adminRole = admin.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}
