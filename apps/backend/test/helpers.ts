import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { AdminRole, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

// Was hand-copied (hashPassword + prisma.admin.create + signAccessToken, with the same
// hardcoded literal string) into ~30 test files' beforeAll blocks — centralized here.
// Generated fresh per test run rather than a fixed literal: nothing in this suite ever
// checks the actual value (tests only need *a* password they can log in with), and a
// random one avoids a static credential-shaped string sitting in source control, which
// secret scanners flag regardless of it only ever guarding a throwaway test admin in
// the dev database.
export const TEST_PASSWORD = randomBytes(18).toString('base64url');

// Shared by every DB-heavy test (anything hitting the real Supabase-backed Postgres
// more than trivially) that needs a longer-than-default vitest timeout.
export const DB_HEAVY_TEST_TIMEOUT = 15000;

export interface TestAdmin {
  id: string;
  email: string;
  accessToken: string;
}

/**
 * Creates a throwaway Admin row plus a matching access token, for test setup.
 * `name` becomes both the DB row's `name` and (slugified, with a timestamp suffix
 * for uniqueness across runs) the email local-part — e.g. `createTestAdmin('Categories
 * Update Test Admin')` gets email `categories-update-test-admin-<ts>@example.com`.
 * Caller is responsible for cleanup via deleteTestAdmin in an afterAll.
 */
export async function createTestAdmin(
  name: string,
  opts?: { role?: AdminRole; data?: Partial<Prisma.AdminCreateInput> },
): Promise<TestAdmin> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const email = `${slug}-${Date.now()}@example.com`;
  const admin = await prisma.admin.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      name,
      ...(opts?.role ? { role: opts.role } : {}),
      ...opts?.data,
    },
  });
  return { id: admin.id, email, accessToken: signAccessToken({ adminId: admin.id }) };
}

export async function deleteTestAdmin(id: string): Promise<void> {
  await prisma.admin.delete({ where: { id } });
}

// Was hand-copied (BUCKET + a supabase client + this exact extractStoragePath body)
// into every test file that uploads to Supabase Storage — centralized here.
export const BUCKET = 'andy_booking';

export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

/**
 * Extracts the storage object path from a Supabase signed URL, so it can be passed
 * to `supabase.storage.from(BUCKET).remove([...])` in test cleanup.
 */
export function extractStoragePath(signedUrl: string): string {
  const marker = `/object/sign/${BUCKET}/`;
  const idx = signedUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error(`unexpected signed url format: ${signedUrl}`);
  }
  return decodeURIComponent(signedUrl.slice(idx + marker.length).split('?')[0]);
}
