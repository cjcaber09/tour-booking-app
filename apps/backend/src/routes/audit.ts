import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getAuditEntries } from '../middleware/auditLog';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, (_req, res) => {
  if (process.env.ENABLE_DEV_AUDIT_LOG !== 'true') {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ entries: getAuditEntries() });
});
