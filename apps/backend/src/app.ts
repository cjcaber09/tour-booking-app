import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { toursRouter } from './routes/tours';
import { customersRouter } from './routes/customers';

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

  app.use(errorHandler);

  return app;
}
