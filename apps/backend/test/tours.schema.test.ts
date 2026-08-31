import { describe, it, expect } from 'vitest';
import { createTourSchema } from '../src/routes/tours.schema';

const validImageUrl = 'https://example.com/cover.jpg';

describe('createTourSchema', () => {
  it('accepts a full valid payload', () => {
    const result = createTourSchema.safeParse({
      title: 'Full Tour',
      description: 'A full description',
      summary: 'Short summary',
      duration: 5,
      maxGroupSize: 12,
      difficulty: 'medium',
      price: 149.99,
      priceDiscount: 99.99,
      imageCover: validImageUrl,
      images: [validImageUrl],
      startDates: ['2027-01-01T00:00:00.000Z'],
      startLocation: 'Bali, Indonesia',
      isActive: false,
      categoryIds: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a minimal payload with only required fields', () => {
    const result = createTourSchema.safeParse({
      title: 'Minimal Tour',
      description: 'Bare minimum',
      price: 100,
      imageCover: validImageUrl,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing title', () => {
    const result = createTourSchema.safeParse({
      description: 'No title',
      price: 100,
      imageCover: validImageUrl,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing description', () => {
    const result = createTourSchema.safeParse({
      title: 'No Description',
      price: 100,
      imageCover: validImageUrl,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing price', () => {
    const result = createTourSchema.safeParse({
      title: 'No Price',
      description: 'Missing price',
      imageCover: validImageUrl,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing imageCover', () => {
    const result = createTourSchema.safeParse({
      title: 'No Cover',
      description: 'Missing cover',
      price: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive price', () => {
    const result = createTourSchema.safeParse({
      title: 'Bad Price',
      description: 'Negative price',
      price: -5,
      imageCover: validImageUrl,
    });
    expect(result.success).toBe(false);
  });

  it('rejects priceDiscount greater than or equal to price', () => {
    const result = createTourSchema.safeParse({
      title: 'Bad Discount',
      description: 'Discount too high',
      price: 100,
      priceDiscount: 150,
      imageCover: validImageUrl,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid difficulty value', () => {
    const result = createTourSchema.safeParse({
      title: 'Bad Difficulty',
      description: 'Invalid enum',
      price: 100,
      imageCover: validImageUrl,
      difficulty: 'extreme',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid categoryIds entry', () => {
    const result = createTourSchema.safeParse({
      title: 'Bad Category',
      description: 'Invalid category id',
      price: 100,
      imageCover: validImageUrl,
      categoryIds: ['not-a-uuid'],
    });
    expect(result.success).toBe(false);
  });
});
