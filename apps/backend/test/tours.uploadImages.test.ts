import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT, BUCKET, supabase, extractStoragePath } from './helpers';

const app = createApp();
let adminId: string;
let accessToken: string;
const uploadedPaths: string[] = [];

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Upload Images Test Admin'));
});

afterAll(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('POST /tours/upload-images', () => {
  it(
    'uploads multiple valid images and returns their signed urls',
    async () => {
      const res = await request(app)
        .post('/tours/upload-images')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('images', Buffer.from('fake-jpeg-bytes-1'), { filename: 'gallery-1.jpg', contentType: 'image/jpeg' })
        .attach('images', Buffer.from('fake-jpeg-bytes-2'), { filename: 'gallery-2.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.urls.length).toBe(2);
      uploadedPaths.push(...res.body.urls.map(extractStoragePath));
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects a request with no authorization header', async () => {
    const res = await request(app)
      .post('/tours/upload-images')
      .attach('images', Buffer.from('fake-jpeg-bytes'), { filename: 'gallery.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  it('rejects a request with no files attached', async () => {
    const res = await request(app).post('/tours/upload-images').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('at least one image file is required');
  });

  it('rejects the whole batch if any file has an unsupported mimetype', async () => {
    const res = await request(app)
      .post('/tours/upload-images')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('images', Buffer.from('fake-jpeg-bytes'), { filename: 'gallery.jpg', contentType: 'image/jpeg' })
      .attach('images', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported image type');
  });
});
