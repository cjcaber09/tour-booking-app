import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireAuth } from '../../src/middleware/auth';
import { signAccessToken } from '../../src/lib/tokens';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
});

function buildTestApp() {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ adminId: req.adminId });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('allows a request with a valid access token', async () => {
    const token = signAccessToken({ adminId: 'admin-1' });
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.adminId).toBe('admin-1');
  });

  it('rejects a request with no authorization header', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });
});
