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

export async function uploadTourImage(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  const path = `tours/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimetype });
  if (uploadError) {
    throw new Error(`failed to upload image: ${uploadError.message}`);
  }

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (signError || !data) {
    throw new Error(`failed to create signed url: ${signError?.message ?? 'unknown error'}`);
  }

  return data.signedUrl;
}
