import { describe, it, expect } from 'vitest';
import { createTourSchema, updateTourSchema, listToursQuerySchema } from '../src/routes/tours.schema';

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

  it('accepts a missing imageCover', () => {
    const result = createTourSchema.safeParse({
      title: 'No Cover',
      description: 'Missing cover',
      price: 100,
    });
    expect(result.success).toBe(true);
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

describe('updateTourSchema', () => {
  it('accepts an empty object', () => {
    const result = updateTourSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a partial single-field update', () => {
    const result = updateTourSchema.safeParse({ title: 'Updated Title' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid difficulty value when provided', () => {
    const result = updateTourSchema.safeParse({ difficulty: 'extreme' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive price when provided', () => {
    const result = updateTourSchema.safeParse({ price: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects priceDiscount greater than or equal to price when both are provided', () => {
    const result = updateTourSchema.safeParse({ price: 100, priceDiscount: 150 });
    expect(result.success).toBe(false);
  });

  it('accepts priceDiscount alone without price', () => {
    const result = updateTourSchema.safeParse({ priceDiscount: 50 });
    expect(result.success).toBe(true);
  });
});

describe('listToursQuerySchema', () => {
  it('applies default page and limit when none are provided', () => {
    const result = listToursQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
    }
  });

  it('coerces string query values into numbers', () => {
    const result = listToursQuerySchema.safeParse({ page: '2', limit: '5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(5);
    }
  });

  it('rejects a non-positive page', () => {
    const result = listToursQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer page', () => {
    const result = listToursQuerySchema.safeParse({ page: '1.5' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric limit', () => {
    const result = listToursQuerySchema.safeParse({ limit: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects a limit above the maximum', () => {
    const result = listToursQuerySchema.safeParse({ limit: '500' });
    expect(result.success).toBe(false);
  });
});
