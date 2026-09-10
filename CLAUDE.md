# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Andy Tours Admin: a desktop admin tool for a tour-booking business, plus the backend it talks to.
Staff use it to manage tours, bookings, customers, and payments. There is no public-facing web
app in this repo — `apps/backend` also exposes a small IP-allowlisted `/public/*` API (tour
listing + booking creation) presumably for an external booking site to call, but that site itself
lives elsewhere.

npm workspaces monorepo, two apps, no shared package between them yet:
- **apps/backend** — Express + Prisma + PostgreSQL (Supabase), JWT auth
- **apps/admin** — Electron + React 19 + Tailwind CSS v4 desktop app

## Commands

Root: `npm run dev` runs backend + admin concurrently (`concurrently -n backend,admin`).

### Backend (`apps/backend`)
- `npm run dev` — tsx watch src/index.ts
- `npm run build` / `npm start` — compile then run dist/index.js
- `npm test` — `vitest run` (all tests hit a real Supabase-backed Postgres, not mocked)
- `npx vitest run test/bookings.create.test.ts` — single file
- `npx vitest run -t "test name"` — single test by name
- `npm run prisma:migrate` / `npm run prisma:generate`
- `npm run seed:admin` — seed an initial Admin login
- Requires `.env` (see `.env.example`): `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `PORT`, `PUBLIC_API_IP_ALLOWLIST`

### Admin (`apps/admin`)
- `npm start` — electron-forge start (dev)
- `npm run lint` — eslint --ext .ts,.tsx .
- `npm run package` / `npm run make` — electron-forge packaging
- Talks to the backend over HTTP at `BACKEND_URL` (defaults to `http://localhost:4000`)

## Architecture

### Backend (`apps/backend/src`)
- `app.ts` builds the Express app (`createApp()`); `index.ts` just starts it on `PORT`.
- Routers: `routes/{auth,tours,customers,bookings,public}.ts`, each paired with a
  `*.schema.ts` (zod). `requireAuth` (JWT bearer, `middleware/auth.ts`) is applied
  per-route inside each authenticated router, not globally in `app.ts`.
- `/public/*` is mounted behind `ipAllowlist` (`middleware/ipAllowlist.ts`) — fails
  closed if `PUBLIC_API_IP_ALLOWLIST` is empty, and only correct with the backend
  directly exposed (no reverse proxy, since `trust proxy` isn't configured).
- `lib/bookings.ts` is the shared booking domain logic used by multiple routes:
  - pricing: `unitPrice = tour.priceDiscount ?? tour.price`
  - `resolveCustomer`: find-by-email-or-create, **never** overwrites an existing
    customer's stored name/phone from a new booking's input (a Customer row is
    shared across all of that person's bookings)
  - `autoCompleteIfDue` / `finalizeBookingList`: there is no cron job — a
    CONFIRMED/ONGOING booking is lazily flipped to COMPLETED whenever it's read,
    once its finish date has passed *and* it's fully paid. Unpaid/partial bookings
    past finish date are deliberately left alone (stays eligible for cancellation).
- `lib/supabaseStorage.ts` — tour images and payment-proof files go to Supabase
  Storage; `lib/upload.ts` wraps multer for multipart routes.
- Prisma schema (`prisma/schema.prisma`) models: `Admin`, `RefreshToken`, `Category`,
  `Tour`, `Customer`, `Booking`, `Payment`. Booking has `status` (PENDING → CONFIRMED
  → ONGOING → COMPLETED, or CANCELLED) and independently `paymentStatus` (UNPAID/
  PARTIAL/PAID/REFUNDED) driven by the sum of its `Payment` rows.
- Tests live in `apps/backend/test/*.test.ts` (vitest + supertest). They exercise the
  real database, so a few DB-heavy tests carry explicit longer timeouts.

### Admin (`apps/admin/src`)
Electron's main process is the only thing that talks to the backend — the renderer
never calls `fetch` against it directly.
- `main.ts` registers all `ipcMain.handle` channels (`auth:*`, `tours:*`, `bookings:*`,
  `customers:*`) and calls into `main/backend-client.ts`, which does the actual
  `fetch()` calls to the Express backend.
- `main/session-store.ts` persists the refresh token to disk so login survives
  app restarts.
- `preload.ts` is the single source of truth for the renderer↔main contract: it
  defines every payload/result type and exposes `authAPI` / `toursAPI` /
  `bookingsAPI` / `customersAPI` via `contextBridge`. Add new IPC surface here first,
  then wire the handler in `main.ts` and the fetch call in `backend-client.ts`.
- Renderer has no router — `AppLayout.tsx` swaps screens via a `View` enum + local
  state, driven by `Sidebar`. `AuthContext.tsx` gates the whole UI between
  loading/unauthenticated/authenticated (`App.tsx`).
- Screens live under `renderer/screens/{tours,bookings,calendar,settings}/`; shared
  dialogs (`RecordPaymentDialog`, `CancelBookingDialog`, `ConfirmDialog`,
  `ImageLightbox`) sit at `renderer/` top level.
- Styling: Tailwind CSS v4, `@fontsource` fonts (Bebas Neue display / Open Sans body),
  Radix UI primitives wrapped in `renderer/components/ui/`. Dark mode is a manual
  `dataset.theme` override backed by `localStorage['admin.theme']` (see gotcha below).

## Known gotchas (carried forward from `.superpowers/sdd/progress.md`)
- `AuthContext` fetches the session once at mount and never refreshes it, even though
  `auth:getSession` mints a fresh access token every call — a long-running dev session
  can silently 401. Known, not yet fixed.
- When testing/verifying dark mode, set `localStorage['admin.theme']` in addition to
  the `dataset.theme` override — a `prefers-color-scheme` matchMedia listener will
  silently revert a dataset-only override back to system theme.
- Some zod v4 calls in the schemas (`.url()`, `.uuid()`, `.datetime()`, `.flatten()`)
  use spellings that are deprecated-but-functional in the installed version; flagged
  for future migration, not urgent.

## Repo conventions worth knowing
- `.superpowers/sdd/` and `docs/superpowers/{plans,specs}/` hold this project's spec-driven-
  development history (per-task plans, design docs, and a running `progress.md` log of what
  was built, reviewed, and any issues found). Useful for "why does this work this way"
  context beyond `git log`.

## Recent work (snapshot, branch `bookings-ui`)
Most recent commits, newest first:
- `b674a2d` fix(admin): restrict `shell.openExternal` to http(s) URLs
- `16ad898` feat(admin): migrate to Tailwind CSS v4, add Calendar screen, redesign bookings table
- `6461c43` feat(backend): add payment ledger, booking calendar, and ongoing/completed statuses
- `3b7160c` feat(admin): BookingView detail screen, wired into AppLayout
- `8dd1c25` feat(admin): BookingForm with tour picker and customer search

As of this snapshot there is uncommitted work in progress on this branch, reworking the
Bookings and Tours admin screens (`renderer/screens/bookings/Bookings.tsx`,
`renderer/screens/tours/Tours.tsx`, plus small related edits in `App.tsx`,
`RecordPaymentDialog.tsx`, `CalendarPage.tsx`) — check `git status`/`git diff` for the
current state rather than trusting this list as it will go stale.
