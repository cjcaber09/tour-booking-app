import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { errorHandler } from './middleware/errorHandler';
import { auditLog } from './middleware/auditLog';
import { authRouter } from './routes/auth';
import { toursRouter } from './routes/tours';
import { customersRouter } from './routes/customers';
import { bookingsRouter } from './routes/bookings';
import { publicRouter } from './routes/public';
import { auditRouter } from './routes/audit';
import { settingsRouter } from './routes/settings';
import { profileRouter } from './routes/profile';
import { adminsRouter } from './routes/admins';
import { ipAllowlist } from './middleware/ipAllowlist';

export function createApp() {
  const app = express();
  // Mounted first so durationMs reflects true full server-side handling time for
  // every request, including ones that 404 before reaching a router.
  app.use(auditLog);
  app.use(compression());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/tours', toursRouter);
  app.use('/customers', customersRouter);
  app.use('/bookings', bookingsRouter);
  app.use('/public', ipAllowlist, publicRouter);
  app.use('/audit', auditRouter);
  app.use('/settings', settingsRouter);
  app.use('/profile', profileRouter);
  app.use('/admins', adminsRouter);

  app.use(errorHandler);

  return app;
}
