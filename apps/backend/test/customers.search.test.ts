import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
let guideId: string;
let guideToken: string;
const createdCustomerIds: string[] = [];

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    createTestAdmin('Customers Search Test Admin'),
    createTestAdmin('Customers Search Test Guide', { role: 'GUIDE' }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;

  const base = Date.now();
  const seeded = await Promise.all([
    prisma.customer.create({
      data: { email: `zendaya-search-${base}@example.com`, name: `Zendaya Search Match ${base}` },
    }),
    prisma.customer.create({
      data: { email: `search-match-${base}@example.com`, name: 'Someone Else Entirely' },
    }),
    prisma.customer.create({
      data: { email: `unrelated-${base}@example.com`, name: 'Totally Unrelated Person' },
    }),
  ]);
  createdCustomerIds.push(...seeded.map((c) => c.id));
}, DB_HEAVY_TEST_TIMEOUT);

afterAll(async () => {
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  await prisma.$disconnect();
});

describe('GET /customers', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).get('/customers').query({ q: 'anything' });
    expect(res.status).toBe(401);
  });

  it('remains readable for a GUIDE role — BookingForm\'s typeahead depends on this', async () => {
    const res = await request(app).get('/customers').set('Authorization', `Bearer ${guideToken}`).query({ q: 'anything' });
    expect(res.status).toBe(200);
  });

  it(
    'returns a paginated list of everyone when q is omitted',
    async () => {
      const res = await request(app).get('/customers').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.customers)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('totalPages');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'matches by partial name, case-insensitive',
    async () => {
      const res = await request(app)
        .get('/customers')
        .query({ q: 'zendaya' })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.customers.some((c: { name: string }) => c.name.includes('Zendaya Search Match'))).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'matches by partial email, case-insensitive',
    async () => {
      const res = await request(app)
        .get('/customers')
        .query({ q: 'SEARCH-MATCH' })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      const emails = res.body.customers.map((c: { email: string }) => c.email);
      expect(emails.some((email: string) => email.includes('search-match-'))).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'respects the limit param',
    async () => {
      const res = await request(app)
        .get('/customers')
        .query({ q: 'search', limit: 1 })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.customers.length).toBeLessThanOrEqual(1);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'returns an empty array when nothing matches',
    async () => {
      const res = await request(app)
        .get('/customers')
        .query({ q: `no-such-customer-${Date.now()}` })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.customers).toEqual([]);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
