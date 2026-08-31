import { describe, it, expect, afterAll } from 'vitest';
import { slugify, generateUniqueSlug } from '../src/lib/slug';
import { prisma } from '../src/lib/prisma';

const createdTourIds: string[] = [];

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.$disconnect();
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Amazing Sea Trip')).toBe('amazing-sea-trip');
  });

  it('collapses punctuation and repeated separators', () => {
    expect(slugify('Hello,   World!!')).toBe('hello-world');
  });

  it('trims leading/trailing hyphens produced by leading/trailing punctuation', () => {
    expect(slugify('--Wrapped--')).toBe('wrapped');
  });

  it('falls back to "tour" when nothing alphanumeric remains', () => {
    expect(slugify('!!!')).toBe('tour');
  });
});

describe('generateUniqueSlug', () => {
  it('returns the base slug when there is no collision', async () => {
    const slug = await generateUniqueSlug(`Unique Title ${Date.now()}`);
    expect(slug).not.toContain(' ');
    expect(slug.startsWith('unique-title-')).toBe(true);
  });

  it('appends a suffix when the base slug already exists', async () => {
    const title = `Collision Title ${Date.now()}`;
    const baseSlug = slugify(title);

    const existing = await prisma.tour.create({
      data: {
        title,
        slug: baseSlug,
        description: 'First tour with this slug',
        price: 100,
        imageCover: 'https://example.com/cover.jpg',
      },
    });
    createdTourIds.push(existing.id);

    const secondSlug = await generateUniqueSlug(title);
    expect(secondSlug).not.toBe(baseSlug);
    expect(secondSlug.startsWith(`${baseSlug}-`)).toBe(true);
  });
});
