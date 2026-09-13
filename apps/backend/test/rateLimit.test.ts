import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { createLimiter } from '../src/middleware/rateLimit';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('rate limiting', () => {
  it('is a no-op under NODE_ENV=test (the default for the whole suite)', async () => {
    // Sanity check that the 46+ other test files aren't silently rate-limited: hammer a
    // trivial route well past any sane limit and confirm none of the requests are throttled.
    const app = createApp();
    const results = await Promise.all(Array.from({ length: 20 }, () => request(app).get('/health')));
    expect(results.every((res) => res.status === 200)).toBe(true);
  });

  it(
    'throttles with a 429 once the configured max is exceeded, when NODE_ENV is not test',
    async () => {
      process.env.NODE_ENV = 'production';
      const limiter = createLimiter(60 * 1000, 2);

      const app = express();
      app.use(limiter);
      app.get('/probe', (_req, res) => res.json({ ok: true }));

      const first = await request(app).get('/probe');
      const second = await request(app).get('/probe');
      const third = await request(app).get('/probe');

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
    },
    10000,
  );

  it('sets a baseline helmet security header on every response', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
