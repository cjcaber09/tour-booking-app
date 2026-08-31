# Tours: Create API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Tour` and `Category` data models plus a single `POST /tours` endpoint that creates a tour, per `docs/superpowers/specs/2026-08-31-tours-create-api-design.md`.

**Architecture:** Extend the Prisma schema with `Tour`, `Category`, a `Difficulty` enum, and an `Admin.role` enum field, migrated against the project's existing Supabase dev database. A small `slug.ts` module derives a unique URL slug from the title. A zod schema validates the create payload (first use of zod in this backend). The route handler wires validation → category-existence check → slug generation → `prisma.tour.create`, mounted at `/tours` behind the existing `requireAuth` middleware.

**Tech Stack:** Express 4, TypeScript, Prisma 5 (PostgreSQL), zod (new dependency), vitest + supertest (existing test stack).

## Global Constraints

- `slug` is never accepted from the client — always derived from `title` server-side (see Task 2).
- `ratingsAverage` (default `4.5`) and `ratingsQuantity` (default `0`) are server-controlled — never accepted in the create request body.
- `POST /tours` is protected by the existing `requireAuth` middleware (`apps/backend/src/middleware/auth.ts`) — same 401 behavior as every other protected route.
- No `Category` CRUD in this plan — tests create `Category` rows directly via `prisma.category.create`, the same way existing tests create `Admin` fixtures directly.
- No `guides` field/relation on `Tour` in this plan — deferred to the future booking feature.
- Tests use vitest + supertest against the real dev database (no mocking), matching `test/auth.*.test.ts` — fixtures created in `beforeAll`, cleaned up in `afterAll` via `prisma.$disconnect()` at the end.
- The Prisma migration in Task 1 runs against the project's existing Supabase dev database (same one `Admin`/`RefreshToken` already live in) via the existing `npm run prisma:migrate` script — no new database is being provisioned.
- All commands below assume the repo root (`C:\Users\Lenovo\ai-projects\andy-booking-app`) as the working directory unless a step says otherwise.

---

### Task 1: Prisma schema — `Tour`, `Category`, `Difficulty` enum, `Admin.role`

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Test: `apps/backend/test/tours.model.test.ts`

**Interfaces:**
- Produces: Prisma models `Tour` (fields: `id`, `title`, `slug`, `description`, `summary`, `duration`, `maxGroupSize`, `difficulty`, `price`, `priceDiscount`, `ratingsAverage`, `ratingsQuantity`, `imageCover`, `images`, `startDates`, `startLocation`, `isActive`, `createdAt`, `updatedAt`, `categories`) and `Category` (`id`, `name`, `slug`, `tours`); enum `Difficulty` (`easy`, `medium`, `difficult`); `Admin.role: AdminRole` (`ADMIN`, `LEAD_GUIDE`, `GUIDE`, default `ADMIN`). Consumed by Task 2 (`generateUniqueSlug` queries `prisma.tour`), Task 3 (schema mirrors these fields/enum), and Task 4 (`prisma.tour.create`, `prisma.category.count`).

- [ ] **Step 1: Write the model test file**

Create `apps/backend/test/tours.model.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix apps/backend test -- test/tours.model.test.ts`
Expected: FAIL — `prisma.category` / `prisma.tour` are `undefined` on the generated client (e.g. `TypeError: Cannot read properties of undefined (reading 'create')`), and/or a TypeScript error that `role` does not exist on the `Admin` create input. This confirms the models don't exist yet.

- [ ] **Step 3: Add the schema changes**

Edit `apps/backend/prisma/schema.prisma` — add these models/enums, and add the `role` field to the existing `Admin` model:

```prisma
enum Difficulty {
  easy
  medium
  difficult
}

enum AdminRole {
  ADMIN
  LEAD_GUIDE
  GUIDE
}

model Category {
  id    String @id @default(uuid())
  name  String
  slug  String @unique
  tours Tour[] @relation("TourCategories")
}

model Tour {
  id              String      @id @default(uuid())
  title           String
  slug            String      @unique
  description     String
  summary         String?
  duration        Int?
  maxGroupSize    Int?
  difficulty      Difficulty?
  price           Decimal     @db.Decimal(10, 2)
  priceDiscount   Decimal?    @db.Decimal(10, 2)
  ratingsAverage  Decimal     @default(4.5) @db.Decimal(2, 1)
  ratingsQuantity Int         @default(0)
  imageCover      String
  images          String[]
  startDates      DateTime[]
  startLocation   String?
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  categories Category[] @relation("TourCategories")
}
```

Add `role` to the existing `Admin` model (insert the line after `name`):

```prisma
model Admin {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  name         String
  role         AdminRole @default(ADMIN)
  createdAt    DateTime  @default(now())
}
```

- [ ] **Step 4: Run the migration and regenerate the client**

Run: `npm run prisma:migrate --workspace=apps/backend -- --name add_tours_categories_admin_role`
Expected: Prisma reports the migration applied successfully against the dev database and regenerates the client automatically (migrate dev runs generate as part of its flow). If it doesn't auto-generate, also run: `npm run prisma:generate --workspace=apps/backend`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm --prefix apps/backend test -- test/tours.model.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma apps/backend/test/tours.model.test.ts
git commit -m "feat(backend): add Tour, Category, and Admin.role to the schema"
```

---

### Task 2: Unique slug generation

**Files:**
- Create: `apps/backend/src/lib/slug.ts`
- Test: `apps/backend/test/slug.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../lib/prisma` (Task 1's `Tour` model).
- Produces: `export function slugify(text: string): string`, `export function generateUniqueSlug(title: string): Promise<string>`. Consumed by Task 4's route handler.

- [ ] **Step 1: Write the failing tests**

Create `apps/backend/test/slug.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix apps/backend test -- test/slug.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/slug'`.

- [ ] **Step 3: Implement the slug module**

Create `apps/backend/src/lib/slug.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix apps/backend test -- test/slug.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/slug.ts apps/backend/test/slug.test.ts
git commit -m "feat(backend): add unique slug generation for tours"
```

---

### Task 3: Create-tour validation schema (zod)

**Files:**
- Modify: `apps/backend/package.json` (add `zod` dependency)
- Create: `apps/backend/src/routes/tours.schema.ts`
- Test: `apps/backend/test/tours.schema.test.ts`

**Interfaces:**
- Produces: `export const createTourSchema` (zod schema), `export type CreateTourInput = z.infer<typeof createTourSchema>`. Consumed by Task 4's route handler.

- [ ] **Step 1: Install zod**

Run: `npm install zod --workspace=apps/backend`
Expected: `zod` appears under `dependencies` in `apps/backend/package.json` and the root lockfile updates.

- [ ] **Step 2: Write the failing tests**

Create `apps/backend/test/tours.schema.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm --prefix apps/backend test -- test/tours.schema.test.ts`
Expected: FAIL — `Cannot find module '../src/routes/tours.schema'`.

- [ ] **Step 4: Implement the schema**

Create `apps/backend/src/routes/tours.schema.ts`:

```ts
import { z } from 'zod';

export const createTourSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    summary: z.string().optional(),
    duration: z.number().int().positive().optional(),
    maxGroupSize: z.number().int().positive().optional(),
    difficulty: z.enum(['easy', 'medium', 'difficult']).optional(),
    price: z.number().positive(),
    priceDiscount: z.number().positive().optional(),
    imageCover: z.string().url(),
    images: z.array(z.string().url()).optional(),
    startDates: z.array(z.string().datetime()).optional(),
    startLocation: z.string().optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.priceDiscount === undefined || data.priceDiscount < data.price, {
    message: 'priceDiscount must be less than price',
    path: ['priceDiscount'],
  });

export type CreateTourInput = z.infer<typeof createTourSchema>;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --prefix apps/backend test -- test/tours.schema.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/package.json apps/backend/package-lock.json apps/backend/src/routes/tours.schema.ts apps/backend/test/tours.schema.test.ts
git commit -m "feat(backend): add zod validation schema for tour creation"
```

(If `npm install` updated the root `package-lock.json` instead of one inside `apps/backend`, stage `package-lock.json` at the repo root instead.)

---

### Task 4: `POST /tours` route

**Files:**
- Create: `apps/backend/src/routes/tours.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/test/tours.create.test.ts`

**Interfaces:**
- Consumes: `createTourSchema` from `./tours.schema` (Task 3), `generateUniqueSlug` from `../lib/slug` (Task 2), `requireAuth` from `../middleware/auth`, `prisma` from `../lib/prisma`.
- Produces: `export const toursRouter` (Express `Router`), mounted at `/tours` in `app.ts`.

- [ ] **Step 1: Write the failing tests**

Create `apps/backend/test/tours.create.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmail = `tours-create-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';
let adminId: string;
let accessToken: string;
const createdTourIds: string[] = [];
const createdCategoryIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Tours Test Admin' },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });
});

afterAll(async () => {
  await prisma.tour.deleteMany({ where: { id: { in: createdTourIds } } });
  await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('POST /tours', () => {
  it('creates a tour with a full payload', async () => {
    const category = await prisma.category.create({
      data: { name: 'Adventure', slug: `adventure-${Date.now()}` },
    });
    createdCategoryIds.push(category.id);

    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Full Payload Tour',
        description: 'A tour with every field filled in',
        summary: 'Short summary',
        duration: 5,
        maxGroupSize: 12,
        difficulty: 'medium',
        price: 149.99,
        priceDiscount: 99.99,
        imageCover: 'https://example.com/cover.jpg',
        images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
        startDates: ['2027-01-01T00:00:00.000Z'],
        startLocation: 'Bali, Indonesia',
        isActive: false,
        categoryIds: [category.id],
      });

    expect(res.status).toBe(201);
    createdTourIds.push(res.body.id);
    expect(res.body.title).toBe('Full Payload Tour');
    expect(res.body.slug).toBe('full-payload-tour');
    expect(Number(res.body.price)).toBe(149.99);
    expect(Number(res.body.priceDiscount)).toBe(99.99);
    expect(res.body.isActive).toBe(false);
    expect(res.body.categories).toEqual([{ id: category.id, name: 'Adventure', slug: category.slug }]);
  });

  it('creates a tour with only required fields and applies defaults', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Minimal Tour',
        description: 'Bare minimum fields',
        price: 100,
        imageCover: 'https://example.com/minimal.jpg',
      });

    expect(res.status).toBe(201);
    createdTourIds.push(res.body.id);
    expect(res.body.slug).toBe('minimal-tour');
    expect(res.body.ratingsAverage).toBe('4.5');
    expect(res.body.ratingsQuantity).toBe(0);
    expect(res.body.isActive).toBe(true);
    expect(res.body.images).toEqual([]);
    expect(res.body.categories).toEqual([]);
  });

  it('rejects a request with no authorization header', async () => {
    const res = await request(app).post('/tours').send({
      title: 'No Auth Tour',
      description: 'Should not be created',
      price: 100,
      imageCover: 'https://example.com/noauth.jpg',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a payload missing required fields', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Missing Fields' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive price', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Bad Price Tour',
        description: 'Invalid price',
        price: -5,
        imageCover: 'https://example.com/bad.jpg',
      });
    expect(res.status).toBe(400);
  });

  it('rejects priceDiscount greater than or equal to price', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Bad Discount Tour',
        description: 'Discount too high',
        price: 100,
        priceDiscount: 150,
        imageCover: 'https://example.com/bad-discount.jpg',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid difficulty value', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Bad Difficulty Tour',
        description: 'Invalid enum',
        price: 100,
        imageCover: 'https://example.com/bad-difficulty.jpg',
        difficulty: 'extreme',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown categoryId', async () => {
    const res = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Unknown Category Tour',
        description: 'Bad category id',
        price: 100,
        imageCover: 'https://example.com/bad-category.jpg',
        categoryIds: ['00000000-0000-0000-0000-000000000000'],
      });
    expect(res.status).toBe(400);
  });

  it('appends a suffix to the slug when the base slug is already taken', async () => {
    const first = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Duplicate Title Tour',
        description: 'First one',
        price: 100,
        imageCover: 'https://example.com/dup1.jpg',
      });
    createdTourIds.push(first.body.id);

    const second = await request(app)
      .post('/tours')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Duplicate Title Tour',
        description: 'Second one',
        price: 100,
        imageCover: 'https://example.com/dup2.jpg',
      });
    createdTourIds.push(second.body.id);

    expect(second.status).toBe(201);
    expect(second.body.slug).not.toBe(first.body.slug);
    expect(second.body.slug.startsWith('duplicate-title-tour')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix apps/backend test -- test/tours.create.test.ts`
Expected: FAIL — every request gets a 404 (no `/tours` route registered yet).

- [ ] **Step 3: Implement the route**

Create `apps/backend/src/routes/tours.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { createTourSchema } from './tours.schema';
import { generateUniqueSlug } from '../lib/slug';

export const toursRouter = Router();

toursRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createTourSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { categoryIds, startDates, ...rest } = parsed.data;

    if (categoryIds && categoryIds.length > 0) {
      const foundCount = await prisma.category.count({ where: { id: { in: categoryIds } } });
      if (foundCount !== categoryIds.length) {
        res.status(400).json({ error: 'one or more categoryIds do not exist' });
        return;
      }
    }

    const slug = await generateUniqueSlug(rest.title);

    const tour = await prisma.tour.create({
      data: {
        ...rest,
        slug,
        startDates: startDates?.map((date) => new Date(date)),
        categories: categoryIds ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
      },
      include: { categories: true },
    });

    res.status(201).json(tour);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Wire the router into the app**

Edit `apps/backend/src/app.ts`:

```ts
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { toursRouter } from './routes/tours';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/tours', toursRouter);

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --prefix apps/backend test -- test/tours.create.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Run the full backend test suite**

Run: `npm --prefix apps/backend test`
Expected: PASS — all existing tests (auth, tokens, password, errorHandler, middleware) plus all new tour/slug/schema/model tests pass together.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/routes/tours.ts apps/backend/src/app.ts apps/backend/test/tours.create.test.ts
git commit -m "feat(backend): add POST /tours create endpoint"
```
