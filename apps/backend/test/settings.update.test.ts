import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';
import { getOrCreateSettings } from '../src/lib/settings';

const app = createApp();
const testEmailBase = `settings-update-test-${Date.now()}`;
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;
let originalCurrency: string;

beforeAll(async () => {
  const [admin, guide, settings] = await Promise.all([
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-admin@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Settings Update Test Admin',
        role: 'ADMIN',
      },
    }),
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-guide@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Settings Update Test Guide',
        role: 'GUIDE',
      },
    }),
    getOrCreateSettings(),
  ]);
  adminId = admin.id;
  guideId = guide.id;
  adminToken = signAccessToken({ adminId });
  guideToken = signAccessToken({ adminId: guideId });
  originalCurrency = settings.currency;
});

afterAll(async () => {
  await prisma.appSettings.update({ where: { key: 'singleton' }, data: { currency: originalCurrency } });
  await prisma.admin.deleteMany({ where: { id: { in: [adminId, guideId] } } });
  await prisma.$disconnect();
});

describe('PATCH /settings', () => {
  it('rejects a non-ADMIN role (403)', async () => {
    const res = await request(app)
      .patch('/settings')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ currency: 'EUR' });
    expect(res.status).toBe(403);
  });

  it('rejects an unknown currency (400)', async () => {
    const res = await request(app)
      .patch('/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currency: 'NOT_A_CURRENCY' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown timezone (400)', async () => {
    const res = await request(app)
      .patch('/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timezone: 'Not/A_Timezone' });
    expect(res.status).toBe(400);
  });

  it('accepts "UTC" as a timezone (special case excluded from Intl.supportedValuesOf)', async () => {
    const res = await request(app)
      .patch('/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timezone: 'UTC' });
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('UTC');
  });

  it('updates settings for an ADMIN and persists the change', async () => {
    const res = await request(app)
      .patch('/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currency: 'EUR' });
    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('EUR');

    const getRes = await request(app).get('/settings').set('Authorization', `Bearer ${guideToken}`);
    expect(getRes.body.currency).toBe('EUR');
  });
});
