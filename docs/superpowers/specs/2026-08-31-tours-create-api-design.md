# Tours: Create API — Design

Date: 2026-08-31

## Purpose

The backend has no tour data at all yet — only `Admin` and `RefreshToken`. This spec adds the
`Tour` entity (plus a `Category` entity it relates to) and a single `POST /tours` endpoint to
create one. It's the foundation the admin UI's future "create tour" button will call.

## Scope

In scope:
- `Tour` and `Category` Prisma models, plus a `Difficulty` enum.
- An `Admin.role` enum field (`ADMIN | LEAD_GUIDE | GUIDE`, default `ADMIN`), added now so it's in
  place before the booking feature needs it — added but not read or enforced anywhere yet.
- `POST /tours`, protected by the existing `requireAuth` middleware, validated with a new zod
  schema (first use of zod in this backend).
- Prisma migration for the above, run against the project's Supabase dev database.

Out of scope (explicitly deferred):
- Guides on a tour. In the source spec `guides` was a Tour field, but guides are really only
  relevant at booking time (which admin/guide is assigned to which booking), not at tour
  creation. No `guides` field or relation on `Tour`; `Admin.role` exists but nothing wires it to
  tours yet.
- Structured geo data (`type`/`coordinates`/`address`/`description` objects) for locations, and
  the `locations` (stops) array entirely. `startLocation` is a single plain `String?` for now —
  good enough to display, not enough to map or query geospatially. Revisit if/when the tour detail
  UI needs an actual map.
- Every other tour operation — list, get-one, update, delete. This spec is create-only.
- Any `Category` CRUD endpoints. `Category` rows have no creation API in this pass; tests create
  them directly via Prisma (`prisma.category.create`), the same way existing tests create `Admin`
  fixtures directly. Real category management is a future piece of work.
- The admin UI (button, form). Follows as a separate plan once this API exists.

## Data model

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

model Admin {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  name         String
  role         AdminRole @default(ADMIN)
  createdAt    DateTime  @default(now())
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

Notes:
- `ratingsAverage`/`ratingsQuantity` exist on the model with defaults but are **server-controlled**
  — never accepted in the create request body. They're meant to be computed from real
  reviews/bookings later; a freshly-created tour always starts at the default.
- `slug` is unique but never client-supplied (see API contract) — Prisma's `@unique` is still the
  right guard against a race between the app-level uniqueness check and the insert.
- `RefreshToken` is untouched by this change.

## API: `POST /tours`

- Mounted the same way `authRouter` is: `app.use('/tours', toursRouter)` in `app.ts`.
- Behind `requireAuth` — same 401 behavior as every other protected admin route.
- Request body validated with a zod schema before touching Prisma:

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `title` | string | yes | min length 1 |
  | `description` | string | yes | min length 1 |
  | `summary` | string | no | |
  | `duration` | integer | no | must be `> 0` if present |
  | `maxGroupSize` | integer | no | must be `> 0` if present |
  | `difficulty` | `'easy' \| 'medium' \| 'difficult'` | no | |
  | `price` | number | yes | must be `> 0` |
  | `priceDiscount` | number | no | must be `> 0`; must be `< price` if both present |
  | `imageCover` | string (URL) | yes | |
  | `images` | string[] (URLs) | no | |
  | `startDates` | string[] (ISO datetime) | no | |
  | `startLocation` | string | no | |
  | `isActive` | boolean | no | defaults to `true` |
  | `categoryIds` | string[] (uuid) | no | every id must reference an existing `Category` |

- Slug generation: slugify `title` (lowercase, hyphenated, strip non-alphanumerics). If that slug
  is already taken, append a short random suffix (e.g. `-a1b2c`) and use that instead — no
  user-facing collision error for this field.
- On success: `201` with the created tour, including nested `categories` (`id`, `name`, `slug`).
- Error responses:
  - `400` — zod validation failure (field-level messages), or a `categoryIds` entry that doesn't
    exist.
  - `401` — via existing `requireAuth` (missing/invalid token).
  - `500` — via existing `errorHandler`, for anything unexpected.

## Testing

Same approach as `test/auth.*.test.ts` — vitest + supertest against the real dev database, no
mocking, fixtures created in `beforeAll` and cleaned up in `afterAll`. Cases:
- Create with a full payload (all fields, including `categoryIds`) → 201, response shape correct.
- Create with only the required fields → 201, defaults applied (`ratingsAverage` 4.5,
  `ratingsQuantity` 0, `isActive` true), slug correctly derived from title.
- No auth header → 401.
- Each validation failure → 400: missing `title`/`description`/`price`/`imageCover`, non-positive
  `price`, `priceDiscount >= price`, invalid `difficulty` value, unknown `categoryIds` entry.
- Two tours with titles that slugify to the same value → both succeed, second gets a suffixed
  slug, no collision error surfaced.
