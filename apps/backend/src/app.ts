import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { toursRouter } from './routes/tours';
import { customersRouter } from './routes/customers';
import { bookingsRouter } from './routes/bookings';
import { publicRouter } from './routes/public';
import { ipAllowlist } from './middleware/ipAllowlist';

export function createApp() {
  const app = express();
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

  app.use(errorHandler);

  return app;
}
