import { describe, it, expect, afterAll } from 'vitest';
import { uploadTourImage, uploadLogo, uploadAvatar } from '../src/lib/supabaseStorage';
import { BUCKET, supabase, extractStoragePath, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const uploadedPaths: string[] = [];

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

describe('uploadLogo', () => {
  it(
    'uploads a buffer into the settings/ prefix and returns a signed url',
    async () => {
      const buffer = Buffer.from('fake-logo-bytes-for-testing');

      const url = await uploadLogo(buffer, 'Company Logo.png', 'image/png');
      const path = extractStoragePath(url);
      uploadedPaths.push(path);

      expect(path.startsWith('settings/')).toBe(true);

      const res = await fetch(url);
      expect(res.status).toBe(200);
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.equals(buffer)).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});

describe('uploadAvatar', () => {
  it(
    'uploads a buffer into the avatars/ prefix and returns a signed url',
    async () => {
      const buffer = Buffer.from('fake-avatar-bytes-for-testing');

      const url = await uploadAvatar(buffer, 'Profile Pic.jpg', 'image/jpeg');
      const path = extractStoragePath(url);
      uploadedPaths.push(path);

      expect(path.startsWith('avatars/')).toBe(true);

      const res = await fetch(url);
      expect(res.status).toBe(200);
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.equals(buffer)).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
