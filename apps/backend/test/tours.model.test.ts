import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';

const createdTourIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdAdminIds: string[] = [];

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await prisma.admin.deleteMany({ where: { id: { in: createdAdminIds } } });
  await prisma.$disconnect();
});

describe('Tour / Category / Admin.role schema', () => {
  it('creates a Category', async () => {
    const category = await prisma.category.create({
      data: { name: 'Adventure', slug: `adventure-${Date.now()}` },
    });
    createdCategoryIds.push(category.id);
    expect(category.name).toBe('Adventure');
  });

  it('creates a Tour with only required fields and applies defaults', async () => {
    const tour = await prisma.tour.create({
      data: {
        title: 'Bare Tour',
        slug: `bare-tour-${Date.now()}`,
        description: 'A minimal tour',
        price: 100,
        imageCover: 'https://example.com/cover.jpg',
      },
    });
    createdTourIds.push(tour.id);
    expect(tour.ratingsAverage.toString()).toBe('4.5');
    expect(tour.ratingsQuantity).toBe(0);
    expect(tour.isActive).toBe(true);
    expect(tour.images).toEqual([]);
    expect(tour.startDates).toEqual([]);
  });

  it('connects a Tour to Categories via the many-to-many relation', async () => {
    const category = await prisma.category.create({
      data: { name: 'Cultural', slug: `cultural-${Date.now()}` },
    });
    createdCategoryIds.push(category.id);

    const tour = await prisma.tour.create({
      data: {
        title: 'Connected Tour',
        slug: `connected-tour-${Date.now()}`,
        description: 'A tour with a category',
        price: 200,
        imageCover: 'https://example.com/cover2.jpg',
        categories: { connect: [{ id: category.id }] },
      },
      include: { categories: true },
    });
    createdTourIds.push(tour.id);
    expect(tour.categories.map((c) => c.id)).toEqual([category.id]);
  });

  it('defaults a new Admin.role to ADMIN', async () => {
    const admin = await prisma.admin.create({
      data: { email: `role-test-${Date.now()}@example.com`, passwordHash: 'x', name: 'Role Test' },
    });
    createdAdminIds.push(admin.id);
    expect(admin.role).toBe('ADMIN');
  });
});
