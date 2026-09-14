import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
const createdCustomerIds: string[] = [];

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Customers Create Test Admin'));
});

afterAll(async () => {
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('POST /customers', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app)
      .post('/customers')
      .send({ name: 'X', email: `customers-create-noauth-${Date.now()}@example.com` });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid body (400)', async () => {
    const res = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it(
    'creates a customer and normalizes the email to lowercase',
    async () => {
      const base = Date.now();
      const mixedCaseEmail = `Customers-Create-New-${base}@Example.com`;
      const res = await request(app)
        .post('/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Customer', email: mixedCaseEmail, phone: '555-0100' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Customer');
      expect(res.body.email).toBe(mixedCaseEmail.toLowerCase());
      expect(res.body.phone).toBe('555-0100');
      createdCustomerIds.push(res.body.id);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects a duplicate email (409), case-insensitively',
    async () => {
      const base = Date.now();
      const email = `customers-create-dup-${base}@example.com`;
      const first = await request(app)
        .post('/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'First', email });
      expect(first.status).toBe(201);
      createdCustomerIds.push(first.body.id);

      const res = await request(app)
        .post('/customers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Duplicate', email: email.toUpperCase() });
      expect(res.status).toBe(409);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
