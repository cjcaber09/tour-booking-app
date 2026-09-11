import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getAuditEntries } from '../middleware/auditLog';
import { prisma } from '../lib/prisma';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, async (_req, res, next) => {
  if (process.env.ENABLE_DEV_AUDIT_LOG !== 'true') {
    res.status(404).json({ error: 'not found' });
    return;
  }

  try {
    const entries = getAuditEntries();
    const adminIds = [...new Set(entries.map((entry) => entry.adminId).filter((id): id is string => id != null))];
    const admins =
      adminIds.length > 0
        ? await prisma.admin.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true, role: true } })
        : [];
    const adminById = new Map(admins.map((admin) => [admin.id, admin]));

    res.json({
      entries: entries.map((entry) => {
        const admin = entry.adminId ? adminById.get(entry.adminId) : undefined;
        return { ...entry, adminName: admin?.name ?? null, adminRole: admin?.role ?? null };
      }),
    });
  } catch (err) {
    next(err);
  }
});
