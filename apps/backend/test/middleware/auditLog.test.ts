import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { auditLog, getAuditEntries } from '../../src/middleware/auditLog';

function buildTestApp() {
  const app = express();
  app.use(auditLog);
  app.get('/gated/:marker', (req, res) => {
    req.adminId = `admin-${req.params.marker}`;
    res.status(200).json({ ok: true });
  });
  return app;
}

function waitForFinishHandler() {
  // res.on('finish') fires asynchronously after the response is flushed; give it a tick
  // to run before asserting on the buffer.
  return new Promise((resolve) => setTimeout(resolve, 20));
}

const originalFlag = process.env.ENABLE_DEV_AUDIT_LOG;

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.ENABLE_DEV_AUDIT_LOG;
  } else {
    process.env.ENABLE_DEV_AUDIT_LOG = originalFlag;
  }
});

describe('auditLog middleware', () => {
  it('does not record an entry when unset (fails closed)', async () => {
    delete process.env.ENABLE_DEV_AUDIT_LOG;
    const marker = `unset-${Date.now()}`;
    const res = await request(buildTestApp()).get(`/gated/${marker}`);
    expect(res.status).toBe(200);
    await waitForFinishHandler();
    expect(getAuditEntries().some((e) => e.path === `/gated/${marker}`)).toBe(false);
  });

  it('does not record an entry when explicitly not "true"', async () => {
    process.env.ENABLE_DEV_AUDIT_LOG = 'false';
    const marker = `false-${Date.now()}`;
    const res = await request(buildTestApp()).get(`/gated/${marker}`);
    expect(res.status).toBe(200);
    await waitForFinishHandler();
    expect(getAuditEntries().some((e) => e.path === `/gated/${marker}`)).toBe(false);
  });

  it('records method/path/status/durationMs/adminId after the response has been sent, when enabled', async () => {
    process.env.ENABLE_DEV_AUDIT_LOG = 'true';
    const marker = `enabled-${Date.now()}`;
    const res = await request(buildTestApp()).get(`/gated/${marker}`);
    expect(res.status).toBe(200);
    await waitForFinishHandler();

    const entry = getAuditEntries().find((e) => e.path === `/gated/${marker}`);
    expect(entry).toBeDefined();
    expect(entry?.method).toBe('GET');
    expect(entry?.status).toBe(200);
    expect(entry?.adminId).toBe(`admin-${marker}`);
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof entry?.timestamp).toBe('string');
  });

  it('returns entries newest first', async () => {
    process.env.ENABLE_DEV_AUDIT_LOG = 'true';
    const base = Date.now();
    const first = `order-a-${base}`;
    const second = `order-b-${base}`;
    const app = buildTestApp();
    await request(app).get(`/gated/${first}`);
    await waitForFinishHandler();
    await request(app).get(`/gated/${second}`);
    await waitForFinishHandler();

    const entries = getAuditEntries();
    const firstIndex = entries.findIndex((e) => e.path === `/gated/${first}`);
    const secondIndex = entries.findIndex((e) => e.path === `/gated/${second}`);
    expect(secondIndex).toBeLessThan(firstIndex);
  });
});
