import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const BUCKET = 'andy_booking';
const SIGNED_URL_EXPIRY_SECONDS = 10 * 365 * 24 * 60 * 60;

function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'image';
}

async function uploadToBucket(prefix: string, buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  const path = `${prefix}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimetype });
  if (uploadError) {
    throw new Error(`failed to upload file: ${uploadError.message}`);
  }

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (signError || !data) {
    throw new Error(`failed to create signed url: ${signError?.message ?? 'unknown error'}`);
  }

  return data.signedUrl;
}

export function uploadTourImage(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  return uploadToBucket('tours', buffer, filename, mimetype);
}

export function uploadPaymentProof(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  return uploadToBucket('payments', buffer, filename, mimetype);
}

export function uploadLogo(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  return uploadToBucket('settings', buffer, filename, mimetype);
}

export function uploadAvatar(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  return uploadToBucket('avatars', buffer, filename, mimetype);
}

function extractStoragePath(signedUrl: string): string | null {
  const marker = `/object/sign/${BUCKET}/`;
  const idx = signedUrl.indexOf(marker);
  if (idx === -1) {
    return null;
  }
  return decodeURIComponent(signedUrl.slice(idx + marker.length).split('?')[0]);
}

export async function deleteTourImages(urls: string[]): Promise<void> {
  const paths = urls.map(extractStoragePath).filter((path): path is string => path != null);
  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    throw new Error(`failed to delete images: ${error.message}`);
  }
}
