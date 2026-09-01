import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const BUCKET = 'andy_booking';
const testEmail = `tours-delete-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
const createdTourIds: string[] = [];
const createdCategoryIds: string[] = [];

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const DB_HEAVY_TEST_TIMEOUT = 15000;

function extractStoragePath(signedUrl: string): string {
  const marker = `/object/sign/${BUCKET}/`;
  const idx = signedUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error(`unexpected signed url format: ${signedUrl}`);
  }
  return decodeURIComponent(signedUrl.slice(idx + marker.length).split('?')[0]);
}

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Tours Delete Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });
});

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
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
});
