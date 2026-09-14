import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT, BUCKET, supabase, extractStoragePath } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
const createdTourIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdBookingIds: string[] = [];
const createdCustomerIds: string[] = [];

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Tours Delete Test Admin'));
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('DELETE /tours/:id', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).delete('/tours/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .delete('/tours/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it(
    'deletes a tour and it is no longer retrievable',
    async () => {
      const created = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Delete Me Tour', description: 'desc', price: 100 });
      createdTourIds.push(created.body.id);

      const res = await request(app)
        .delete(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);

      const followUp = await request(app)
        .get(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(followUp.status).toBe(404);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'deletes a tour that has categories without error',
    async () => {
      const category = await prisma.category.create({
        data: { name: 'Delete Test Cat', slug: `delete-test-cat-${Date.now()}` },
      });
      createdCategoryIds.push(category.id);

      const created = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Delete With Categories Tour',
          description: 'desc',
          price: 100,
          categoryIds: [category.id],
        });
      createdTourIds.push(created.body.id);

      const res = await request(app)
        .delete(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'removes the tour images from storage when the tour is deleted',
    async () => {
      const upload = await request(app)
        .post('/tours/upload-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', Buffer.from('fake-jpeg-bytes'), {
          filename: 'delete-cleanup.jpg',
          contentType: 'image/jpeg',
        });
      const imagePath = extractStoragePath(upload.body.url);

      const created = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Delete Image Cleanup Tour',
          description: 'desc',
          price: 100,
          imageCover: upload.body.url,
        });
      createdTourIds.push(created.body.id);

      const res = await request(app)
        .delete(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);

      const download = await supabase.storage.from(BUCKET).download(imagePath);
      expect(download.error).not.toBeNull();
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'rejects deleting a tour that has an existing booking (409)',
    async () => {
      const created = await request(app)
        .post('/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Delete Blocked By Booking Tour', description: 'desc', price: 100 });
      createdTourIds.push(created.body.id);

      const customer = await prisma.customer.create({
        data: { email: `tours-delete-booking-${Date.now()}@example.com`, name: 'Booking Blocker' },
      });
      createdCustomerIds.push(customer.id);

      const booking = await prisma.booking.create({
        data: {
          reference: `BK-DELTEST${Date.now()}`,
          tourId: created.body.id,
          customerId: customer.id,
          participants: 1,
          startDate: new Date(),
          totalPrice: 100,
        },
      });
      createdBookingIds.push(booking.id);

      const res = await request(app)
        .delete(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(409);

      const followUp = await request(app)
        .get(`/tours/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(followUp.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
