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
let staffId: string;
let staffToken: string;
const createdTourIds: string[] = [];
const createdCategoryIds: string[] = [];

beforeAll(async () => {
  const [admin, guide, staff] = await Promise.all([
    createTestAdmin('Tours Test Admin'),
    createTestAdmin('Tours Test Guide', { role: 'GUIDE' }),
    createTestAdmin('Tours Test Staff', { role: 'STAFF' }),
  ]);
  adminId = admin.id;
  accessToken = admin.accessToken;
  guideId = guide.id;
  guideToken = guide.accessToken;
  staffId = staff.id;
  staffToken = staff.accessToken;
});

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await deleteTestAdmin(adminId);
  await deleteTestAdmin(guideId);
  await deleteTestAdmin(staffId);
  await prisma.$disconnect();
});

describe('POST /tours', () => {
  it(
    'creates a tour with a full payload',
    async () => {
      const category = await prisma.category.create({
        data: { name: 'Adventure', slug: `adventure-${Date.now()}` },
      });
      createdCategoryIds.push(category.id);

      const res = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Full Payload Tour',
          description: 'A tour with every field filled in',
          summary: 'Short summary',
          duration: 5,
          maxGroupSize: 12,
          difficulty: 'medium',
          price: 149.99,
          priceDiscount: 99.99,
          imageCover: 'https://example.com/cover.jpg',
          images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
          startDates: ['2027-01-01T00:00:00.000Z'],
          startLocation: 'Bali, Indonesia',
          isActive: false,
          categoryIds: [category.id],
        });

      expect(res.status).toBe(201);
      createdTourIds.push(res.body.id);
      expect(res.body.title).toBe('Full Payload Tour');
      expect(res.body.slug).toBe('full-payload-tour');
      expect(Number(res.body.price)).toBe(149.99);
      expect(Number(res.body.priceDiscount)).toBe(99.99);
      expect(res.body.isActive).toBe(false);
      expect(res.body.categories).toEqual([{ id: category.id, name: 'Adventure', slug: category.slug }]);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('creates a tour with only required fields and applies defaults', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Minimal Tour',
        description: 'Bare minimum fields',
        price: 100,
        imageCover: 'https://example.com/minimal.jpg',
      });

    expect(res.status).toBe(201);
    createdTourIds.push(res.body.id);
    expect(res.body.slug).toBe('minimal-tour');
    expect(res.body.ratingsAverage).toBe('4.5');
    expect(res.body.ratingsQuantity).toBe(0);
    expect(res.body.isActive).toBe(true);
    expect(res.body.images).toEqual([]);
    expect(res.body.categories).toEqual([]);
  });

  it('creates a tour without an imageCover', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'No Cover Tour',
        description: 'Created without an image',
        price: 100,
      });

    expect(res.status).toBe(201);
    createdTourIds.push(res.body.id);
    expect(res.body.imageCover).toBeNull();
  });

  it('rejects a GUIDE role (403)', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({
        title: 'Guide Forbidden Tour',
        description: 'Should not be created',
        price: 100,
      });
    expect(res.status).toBe(403);
  });

  it('allows a STAFF role to create a tour', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Staff Created Tour',
        description: 'Created by staff',
        price: 100,
      });
    expect(res.status).toBe(201);
    createdTourIds.push(res.body.id);
  });

  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post('/tours').send({
      title: 'No Auth Tour',
      description: 'Should not be created',
      price: 100,
      imageCover: 'https://example.com/noauth.jpg',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a payload missing required fields', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Missing Fields' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive price', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Bad Price Tour',
        description: 'Invalid price',
        price: -5,
        imageCover: 'https://example.com/bad.jpg',
      });
    expect(res.status).toBe(400);
  });

  it('rejects priceDiscount greater than or equal to price', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Bad Discount Tour',
        description: 'Discount too high',
        price: 100,
        priceDiscount: 150,
        imageCover: 'https://example.com/bad-discount.jpg',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid difficulty value', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Bad Difficulty Tour',
        description: 'Invalid enum',
        price: 100,
        imageCover: 'https://example.com/bad-difficulty.jpg',
        difficulty: 'extreme',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown categoryId', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Unknown Category Tour',
        description: 'Bad category id',
        price: 100,
        imageCover: 'https://example.com/bad-category.jpg',
        categoryIds: ['00000000-0000-0000-0000-000000000000'],
      });
    expect(res.status).toBe(400);
  });

  it(
    'appends a suffix to the slug when the base slug is already taken',
    async () => {
      const first = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Duplicate Title Tour',
          description: 'First one',
          price: 100,
          imageCover: 'https://example.com/dup1.jpg',
        });
      createdTourIds.push(first.body.id);

      const second = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Duplicate Title Tour',
          description: 'Second one',
          price: 100,
          imageCover: 'https://example.com/dup2.jpg',
        });
      createdTourIds.push(second.body.id);

      expect(second.status).toBe(201);
      expect(second.body.slug).not.toBe(first.body.slug);
      expect(second.body.slug.startsWith('duplicate-title-tour')).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
