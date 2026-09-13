import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmail = `customers-update-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
const createdCustomerIds: string[] = [];

const DB_HEAVY_TEST_TIMEOUT = 15000;

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Customers Update Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });
});

afterAll(async () => {
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('PATCH /customers/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).patch('/customers/00000000-0000-0000-0000-000000000000').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .patch('/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it(
    'updates name and phone',
    async () => {
      const base = Date.now();
      const created = await request(app)
        .post('/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Original Name', email: `customers-update-target-${base}@example.com` });
      createdCustomerIds.push(created.body.id);

      const res = await request(app)
        .patch(`/customers/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name', phone: '555-0200' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.phone).toBe('555-0200');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'updates email and normalizes it to lowercase',
    async () => {
      const base = Date.now();
      const created = await request(app)
        .post('/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Email Update Target', email: `customers-update-email-${base}@example.com` });
      createdCustomerIds.push(created.body.id);

      const newEmail = `Customers-Update-Email-New-${base}@Example.com`;
      const res = await request(app)
        .patch(`/customers/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: newEmail });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(newEmail.toLowerCase());
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects updating to an email already used by a different customer (409)',
    async () => {
      const base = Date.now();
      const [a, b] = await Promise.all([
        request(app)
          .post('/customers')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: 'Customer A', email: `customers-update-conflict-a-${base}@example.com` }),
        request(app)
          .post('/customers')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: 'Customer B', email: `customers-update-conflict-b-${base}@example.com` }),
      ]);
      createdCustomerIds.push(a.body.id, b.body.id);

      const res = await request(app)
        .patch(`/customers/${a.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: b.body.email });
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'does not false-409 when re-submitting the customer\'s own current email in a different case',
    async () => {
      const base = Date.now();
      const email = `customers-update-noop-${base}@example.com`;
      const created = await request(app)
        .post('/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'No-op Target', email });
      createdCustomerIds.push(created.body.id);

      const res = await request(app)
        .patch(`/customers/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: email.toUpperCase() });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(email);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
