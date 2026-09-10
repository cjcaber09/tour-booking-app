import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const BUCKET = 'andy_booking';
const DB_HEAVY_TEST_TIMEOUT = 15000;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const testEmailBase = `settings-upload-logo-test-${Date.now()}`;
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;
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
  const [admin, guide] = await Promise.all([
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-admin@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Upload Logo Test Admin',
        role: 'ADMIN',
      },
    }),
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-guide@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Upload Logo Test Guide',
        role: 'GUIDE',
      },
    }),
  ]);
  adminId = admin.id;
  guideId = guide.id;
  adminToken = signAccessToken({ adminId });
  guideToken = signAccessToken({ adminId: guideId });
});

afterAll(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
  await prisma.admin.deleteMany({ where: { id: { in: [adminId, guideId] } } });
  await prisma.$disconnect();
});

describe('POST /settings/upload-logo', () => {
  it(
    'uploads a valid image for an ADMIN and returns a signed url',
    async () => {
      const res = await request(app)
        .post('/settings/upload-logo')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('logo', Buffer.from('fake-logo-bytes'), { filename: 'logo.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(typeof res.body.url).toBe('string');
      uploadedPaths.push(extractStoragePath(res.body.url));
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects a non-ADMIN role (403)', async () => {
    const res = await request(app)
      .post('/settings/upload-logo')
      .set('Authorization', `Bearer ${guideToken}`)
      .attach('logo', Buffer.from('fake-logo-bytes'), { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });

  it('rejects a request with no file attached', async () => {
    const res = await request(app).post('/settings/upload-logo').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('logo file is required');
  });

  it('rejects an unsupported mimetype', async () => {
    const res = await request(app)
      .post('/settings/upload-logo')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('logo', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported image type');
  });
});
