import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin } from './helpers';

const app = createApp();
let adminId: string;
let guideToken: string;

beforeAll(async () => {
  ({ id: adminId, accessToken: guideToken } = await createTestAdmin('Settings Get Test Admin', { role: 'GUIDE' }));
});

afterAll(async () => {
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('GET /settings', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(401);
  });

  it('returns the singleton settings row for any authenticated role', async () => {
    const res = await request(app).get('/settings').set('Authorization', `Bearer ${guideToken}`);
    expect(res.status).toBe(200);
    expect(res.body.key).toBe('singleton');
    expect(res.body.currency).toBeTypeOf('string');
  });

  it('does not create a second row on repeated calls (upsert is idempotent)', async () => {
    const first = await request(app).get('/settings').set('Authorization', `Bearer ${guideToken}`);
    const second = await request(app).get('/settings').set('Authorization', `Bearer ${guideToken}`);
    expect(first.body.id).toBe(second.body.id);

    const count = await prisma.appSettings.count({ where: { key: 'singleton' } });
    expect(count).toBe(1);
  });
});
