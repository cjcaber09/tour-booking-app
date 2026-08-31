import crypto from 'crypto';
import { prisma } from './prisma';

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'tour';
}

export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  const existing = await prisma.tour.findUnique({ where: { slug: base } });
  if (!existing) {
    return base;
  }
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}
