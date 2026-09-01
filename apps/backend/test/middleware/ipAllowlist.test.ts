import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ipAllowlist } from '../../src/middleware/ipAllowlist';

function buildTestApp() {
  const app = express();
  app.get('/gated', ipAllowlist, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

const originalAllowlist = process.env.PUBLIC_API_IP_ALLOWLIST;

afterEach(() => {
  if (originalAllowlist === undefined) {
    delete process.env.PUBLIC_API_IP_ALLOWLIST;
  } else {
    process.env.PUBLIC_API_IP_ALLOWLIST = originalAllowlist;
  }
});

describe('ipAllowlist middleware', () => {
  it('accepts a request from an allowlisted IP', async () => {
    // supertest hits an in-process server over loopback; the exact form Node reports
    // (127.0.0.1 vs ::1 vs the IPv4-mapped ::ffff:127.0.0.1) varies by platform/Node
    // version, so all three are allowlisted to cover whichever form shows up.
    process.env.PUBLIC_API_IP_ALLOWLIST = '127.0.0.1,::1,::ffff:127.0.0.1';
    const res = await request(buildTestApp()).get('/gated');
    expect(res.status).toBe(200);
  });

  it('rejects a request from a non-allowlisted IP', async () => {
    // TEST-NET-3, reserved for documentation — guaranteed not to be the real loopback address.
    process.env.PUBLIC_API_IP_ALLOWLIST = '203.0.113.99';
    const res = await request(buildTestApp()).get('/gated');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('fails closed when the allowlist is unset', async () => {
    delete process.env.PUBLIC_API_IP_ALLOWLIST;
    const res = await request(buildTestApp()).get('/gated');
    expect(res.status).toBe(403);
  });

  it('fails closed when the allowlist is an empty string', async () => {
    process.env.PUBLIC_API_IP_ALLOWLIST = '';
    const res = await request(buildTestApp()).get('/gated');
    expect(res.status).toBe(403);
  });
});
