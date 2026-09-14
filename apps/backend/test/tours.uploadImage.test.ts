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
  ({ id: adminId, accessToken } = await createTestAdmin('Upload Test Admin'));
});

afterAll(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('POST /tours/upload-image', () => {
  it(
    'uploads a valid image and returns a signed url',
    async () => {
      const res = await request(app)
        .post('/tours/upload-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', Buffer.from('fake-jpeg-bytes'), { filename: 'cover.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(typeof res.body.url).toBe('string');
      uploadedPaths.push(extractStoragePath(res.body.url));
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects a request with no authorization header', async () => {
    const res = await request(app)
      .post('/tours/upload-image')
      .attach('image', Buffer.from('fake-jpeg-bytes'), { filename: 'cover.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  it('rejects a request with no file attached', async () => {
    const res = await request(app).post('/tours/upload-image').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('image file is required');
  });

  it('rejects an unsupported mimetype', async () => {
    const res = await request(app)
      .post('/tours/upload-image')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('image', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported image type');
  });

  it(
    'rejects a file over the 5MB limit',
    async () => {
      const res = await request(app)
        .post('/tours/upload-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', Buffer.alloc(6 * 1024 * 1024), { filename: 'huge.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('image exceeds 5MB limit');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
