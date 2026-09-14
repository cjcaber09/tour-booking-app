import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
const BUCKET = 'andy_booking';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
let adminId: string;
let accessToken: string;
const uploadedPaths: string[] = [];

function extractStoragePath(signedUrl: string): string {
  const marker = `/object/sign/${BUCKET}/`;
  const idx = signedUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error(`unexpected signed url format: ${signedUrl}`);
  }
  return decodeURIComponent(signedUrl.slice(idx + marker.length).split('?')[0]);
}

beforeAll(async () => {
  ({ id: adminId, accessToken } = await createTestAdmin('Upload Avatar Test Admin', { role: 'GUIDE' }));
});

afterAll(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('POST /profile/upload-avatar', () => {
  it(
    'uploads a valid image for any authenticated role and returns a signed url',
    async () => {
      const res = await request(app)
        .post('/profile/upload-avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', Buffer.from('fake-avatar-bytes'), { filename: 'avatar.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(typeof res.body.url).toBe('string');
      uploadedPaths.push(extractStoragePath(res.body.url));
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects a request with no authorization header', async () => {
    const res = await request(app)
      .post('/profile/upload-avatar')
      .attach('avatar', Buffer.from('fake-avatar-bytes'), { filename: 'avatar.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('rejects an unsupported mimetype', async () => {
    const res = await request(app)
      .post('/profile/upload-avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('avatar', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported image type');
  });
});
