import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { uploadTourImage } from '../src/lib/supabaseStorage';

const BUCKET = 'andy_booking';
const DB_HEAVY_TEST_TIMEOUT = 15000;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const uploadedPaths: string[] = [];

function extractStoragePath(signedUrl: string): string {
  const marker = `/object/sign/${BUCKET}/`;
  const idx = signedUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error(`unexpected signed url format: ${signedUrl}`);
  }
  return decodeURIComponent(signedUrl.slice(idx + marker.length).split('?')[0]);
}

afterAll(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
});

describe('uploadTourImage', () => {
  it(
    'uploads a buffer and returns a signed url that serves the same bytes back',
    async () => {
      const buffer = Buffer.from('fake-image-bytes-for-testing');

      const url = await uploadTourImage(buffer, 'Test Photo.jpg', 'image/jpeg');
      uploadedPaths.push(extractStoragePath(url));

      expect(url).toContain(BUCKET);

      const res = await fetch(url);
      expect(res.status).toBe(200);
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.equals(buffer)).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'sanitizes the filename into a lowercase path segment with no spaces',
    async () => {
      const buffer = Buffer.from('another-fake-image');

      const url = await uploadTourImage(buffer, 'Weird Name!!.PNG', 'image/png');
      const path = extractStoragePath(url);
      uploadedPaths.push(path);

      expect(path.startsWith('tours/')).toBe(true);
      expect(path.endsWith('.png')).toBe(true);
      expect(path).toBe(path.toLowerCase());
      expect(path).not.toMatch(/[ !]/);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
