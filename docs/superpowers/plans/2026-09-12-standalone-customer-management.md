# Add standalone Customer management, backend hardening, and public-booking polish

## Context

Customers currently only get created implicitly via `resolveCustomer()` during booking
creation (`apps/backend/src/lib/bookings.ts`) — there's no way to browse, edit, or delete a
customer record directly, and the only existing route (`GET /customers`) is a search-only
typeahead used by `BookingForm.tsx`'s inline picker. This plan adds a full standalone Customer
management feature (backend CRUD + admin UI screen), mirroring the `Admin`/`Tours` management
screens already in the app.

While reviewing the codebase for this, two adjacent gaps came up and are bundled in:
1. The backend has no `helmet` or rate limiting at all — `/auth/login` is unprotected against
   brute force, and there are no baseline security headers.
2. `POST /public/bookings` (the IP-allowlisted external-facing endpoint) is missing capacity
   validation, start-date validation, case-insensitive email matching, and returns a thin
   response body that would force an external client to make a second request to render a
   confirmation screen.

All three are grouped into one plan because Workstream 3's email-normalization fix and
Workstream 1's Customer CRUD both need the exact same logic, and it's cheap to land all three
together. Decisions already confirmed with the user (do not re-litigate):
- Customer CRUD is `requireAuth`-only, no role gate (matches `tours.ts`, not `admins.ts`).
- Customer detail view shows booking history.
- All four public-booking polish items are in scope, applied to the **shared** `lib/bookings.ts`
  functions (so admin-created bookings get the same guarantees), since there's no reason admin
  bookings should be allowed to violate tour capacity/date offerings either.

## Shared prerequisite: `apps/backend/src/lib/customers.ts` (new file)

```ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```
Consumed by `lib/bookings.ts`'s `resolveCustomer` (Workstream 3) and the new
`routes/customers.ts` create/update handlers (Workstream 1). Build this first.

---

## Workstream 1: Standalone Customer management

### Backend schema — `apps/backend/src/routes/customers.schema.ts`

Replace entirely (the current search-only schema is fully superseded):
```ts
listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  q: z.string().optional(),
});
createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
});
updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
});
```

### Backend routes — `apps/backend/src/routes/customers.ts` (full rewrite)

Mirror `apps/backend/src/routes/admins.ts`'s structure exactly (pagination envelope, `Promise.all([findMany,count])`, `safeParse` → `400` with `details`, `P2025`→404). One shared select const used everywhere: `CUSTOMER_SELECT = { id, name, email, phone, createdAt, updatedAt }`.

- **`GET /`** (`requireAuth`): `where = q ? {OR:[{name:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}}]} : {}`. Always respond `{customers, total, page, limit, totalPages}` — this is the intentional behavior change: a missing `q` used to 400, now means "list everyone, paginated."
- **`GET /:id`** (`requireAuth`): `findUnique` (404 if missing), then `prisma.booking.findMany({where:{customerId}, orderBy:{createdAt:'desc'}, select: bookingListSelect})` → `finalizeBookingList(...)` (both reused as-is from `../lib/bookings`). Respond with the customer's scalar fields spread at top level plus `bookings: [...]`.
- **`POST /`** (`requireAuth`): `email = normalizeEmail(parsed.data.email)`, pre-check `findUnique({where:{email}})` → 409 if found, else create. Catch `P2002` as defense-in-depth.
- **`PATCH /:id`** (`requireAuth`): if `email` present, normalize + pre-check for conflict **excluding the row being edited** (`existing && existing.id !== req.params.id`) — this has no direct precedent in `admins.ts` since admin email is immutable there, it's new logic. Catch `P2025`→404, `P2002`→409.
- **`DELETE /:id`** (`requireAuth`): catch `P2025`→404, catch **`P2003`→409** `{error:'cannot delete a customer with existing bookings'}` — identical pattern to `tours.ts`'s delete handler (same FK situation: `Booking.customerId` is a required FK with default Restrict).

### Frontend types — `apps/admin/src/preload.ts`

Add alongside the existing untouched `CustomerSummary`/`SearchCustomersResult`/`customersAPI.search`:
```ts
CustomerListItem extends CustomerSummary { createdAt: string; updatedAt: string }
ListCustomersResult { customers: CustomerListItem[]; total; page; limit; totalPages }
CustomerDetail extends CustomerListItem { bookings: BookingListItem[] }  // BookingListItem already exists
CreateCustomerPayload { name: string; email: string; phone?: string | null }
UpdateCustomerPayload = Partial<CreateCustomerPayload>
```
`customersAPI` gains `list(page, limit, q, token)`, `get(id, token)`, `create(payload, token)`, `update(id, payload, token)`, `delete(id, token)` — `search` stays untouched. Mirror into `apps/admin/src/renderer/window.d.ts`.

### Frontend main-process wiring

- `apps/admin/src/main/backend-client.ts`: add `backendListCustomers`/`backendGetCustomer`/`backendCreateCustomer`/`backendUpdateCustomer`/`backendDeleteCustomer`, following `admins.ts`'s exact split — `parseJsonOrThrow` for list/get/delete, structured `throw new Error(JSON.stringify({status,error,details}))` for create/update.
- `apps/admin/src/main.ts`: add five `ipcMain.handle('customers:list'|'get'|'create'|'update'|'delete', ...)` blocks, same thin try/catch shape as the existing `admins:*` handlers.

### Frontend screens — `apps/admin/src/renderer/screens/customers/` (new)

Model on **`Tours.tsx`/`TourForm.tsx`/`TourView.tsx`** (not `Users.tsx`) because View needs a pre-fetch (`CustomerListItem` lacks booking history) — same shape as `Tours.tsx`'s `handleViewClick` calling `toursAPI.get` before switching mode. Edit does *not* need a pre-fetch (list item already has everything the form needs) — that part matches `Users.tsx` instead.

- **`Customers.tsx`**: list + pagination + client-side filter-the-current-page search (matches existing `Users.tsx`/`Tours.tsx` convention). Row actions: primary View button, overflow menu [Edit, Delete] — no suspend/activate slot, no self-row exclusion (customers aren't logged-in accounts). On delete failure, surface the server's `409` message directly via toast (the common case) rather than a generic failure string.
- **`CustomerForm.tsx`**: mirror `TourForm.tsx`'s inferred-mode pattern exactly — `interface CustomerFormProps { customer?: CustomerListItem; onCancel; onSaved }`, `const isEditing = customer != null`. Fields: name, email, phone. Field-error handling identical to `UserForm.tsx`'s `handleRequestError` (parse the JSON-stringified `{status,error,details}`). No "reveal credentials" step (that's admin-account-specific) — call `onSaved()` immediately on success.
- **`CustomerView.tsx`**: contact info in a `detail-grid`/`detail-field` block (same classes as `UserView.tsx`/`TourView.tsx`), plus a read-only booking-history table (reference, tour title, start date, status badge, total price) using the existing `table-container`/`data-table`/`status-badge status-${status.toLowerCase()}` classes from `Bookings.tsx`. No click-through to the full booking — note as a future nice-to-have, not built now.

### Wiring

- `apps/admin/src/renderer/layout/icons.tsx`: add one new `CustomersIcon` export (same `IconProps`/svg boilerplate as the other icons in this flat file) — `UsersIcon` is already claimed by the admin-Users screen.
- `apps/admin/src/renderer/layout/Sidebar.tsx`: add `'customers'` to the `View` union, add a `NAV_ITEMS` entry.
- `apps/admin/src/renderer/layout/AppLayout.tsx`: import `Customers`, add `case 'customers': return <Customers />;`.

### Backend tests

- `customers.create.test.ts` (new, mirror `admins.create.test.ts`): 401, 400, duplicate-email 409, successful create with email normalized to lowercase even when submitted mixed-case.
- `customers.update.test.ts` (new, mirror `admins.update.test.ts`): 401, 404, updates name/phone/email, 409 on conflicting-with-a-different-customer email, no false-409 on a no-op PATCH resending the customer's own current email.
- `customers.delete.test.ts` (new, mirror `tours.delete.test.ts`'s booking-conflict case): 401, 404, successful delete with no bookings, **409 when the customer has a booking** (seed via direct Prisma; assert both rows still exist after).
- `customers.search.test.ts`: rewrite in place. The "rejects a missing q param" test becomes "returns a paginated list of everyone when q is omitted" (200, envelope has total/page/limit/totalPages). The four existing q-based assertions need no changes — they only read `res.body.customers`, which stays a flat array under that key.

---

## Workstream 2: helmet + rate limiting

### Dependencies

Add `helmet` and `express-rate-limit` to `apps/backend/package.json`.

### New file `apps/backend/src/middleware/rateLimit.ts`

```ts
const isTest = process.env.NODE_ENV === 'test';

function createLimiter(windowMs: number, max: number): RequestHandler {
  if (isTest) return (_req, _res, next) => next();
  return rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
}

export const globalLimiter = createLimiter(15 * 60 * 1000, 300);
export const loginLimiter = createLimiter(15 * 60 * 1000, 10);
```
Vitest sets `NODE_ENV=test` automatically and `vitest.config.ts` doesn't override it — confirmed no existing test needs modification, since every one of the 46 test files' `createApp()` instances gets a no-op limiter. No new env var introduced.

Single global tier, no separate `/public/*` tier — `/public/*` is already gated by `ipAllowlist`, which is arguably a stronger filter than IP-unrestricted-but-authenticated traffic. Keep it simple; a dedicated public tier can be added later if needed.

### `app.ts` changes

```ts
app.use(auditLog);
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

app.get('/health', ...);   // stays unlimited — mounted before globalLimiter

app.use(globalLimiter);    // applies to every router below

app.use('/auth', authRouter);   // POST /login also gets loginLimiter, route-local
...
```
Verified no conflicts: helmet only sets response headers (no interaction with `cors()`, multer multipart parsing, or Electron's `fetch`-based main-process client, which doesn't enforce browser CORP/COEP anyway). Default CSP is inert since this API serves zero HTML.

### `routes/auth.ts` change
```ts
import { loginLimiter } from '../middleware/rateLimit';
authRouter.post('/login', loginLimiter, async (req, res, next) => { ... });
```
Login requests are also still counted against `globalLimiter` (mounted ahead of `/auth`) — intentional defense-in-depth.

### `trust proxy` — no change

`express-rate-limit`'s default key generator uses `req.ip`, which with no `trust proxy` configured is the real socket peer address — same assumption `ipAllowlist.ts` already documents and relies on. If `express-rate-limit` v7's runtime validation warns about `X-Forwarded-For` headers, the fix is `validate: { xForwardedForHeader: false }` in the `rateLimit()` call, not adding `trust proxy`.

### Tests

New `apps/backend/test/rateLimit.test.ts`: unit-test `createLimiter` in isolation (temporarily flip `process.env.NODE_ENV` inside a try/finally, build a tiny standalone Express app with a `max: 2` limiter, assert the 3rd request in a burst gets 429; also assert the `NODE_ENV==='test'` path is a true no-op). Add one assertion somewhere (e.g. in an existing generic route test) that a response carries a helmet header like `x-content-type-options: nosniff`, as a cheap regression guard.

---

## Workstream 3: Polish `POST /public/bookings`

All four fixes land in shared `apps/backend/src/lib/bookings.ts` functions, so `POST /bookings` (admin) gets them too.

### Capacity + start-date validation — inside `computeTotalPrice`

Signature change: `computeTotalPrice(tourId, participants, startDate: Date, requireActiveTour)`. After the existing not-found/not-active checks:
```ts
if (tour.maxGroupSize != null && participants > tour.maxGroupSize) {
  throw new BookingServiceError(400, `participants exceeds this tour's maximum group size of ${tour.maxGroupSize}`);
}
if (tour.startDates.length > 0) {
  const offered = tour.startDates.some((d) => dateOnly(d).getTime() === dateOnly(startDate).getTime());
  if (!offered) {
    throw new BookingServiceError(400, "startDate is not one of this tour's offered start dates");
  }
}
```
Reuses the existing private `dateOnly()` helper already in this file.

**Empty `startDates` = unrestricted is confirmed correct, not just assumed**: grepped `apps/admin/src` — `startDates` appears only in a `preload.ts` type declaration, with **zero UI anywhere** (including `TourForm.tsx`) to actually set it on a tour. Every tour created today has `startDates: []` by construction, so treating empty as unrestricted is the only choice that doesn't make every existing tour unbookable. Flag as a related, out-of-scope gap for a future ticket (add a start-dates editor to `TourForm.tsx`).

Call-site updates:
- `createBooking`: passes `params.startDate` — trivial, already has it.
- `routes/bookings.ts` PATCH handler (verified at lines 163-192): currently only re-invokes `computeTotalPrice` when `tourId !== undefined || participants !== undefined` (line 181). **Deliberately broaden** the trigger to also include `startDate !== undefined`, and update the call to `computeTotalPrice(tourId ?? existing.tourId, participants ?? existing.participants, new Date(startDate ?? existing.startDate), false)`. Flag prominently to whoever implements this: a startDate-only PATCH that used to always succeed can now 400 if the new date isn't offered — this is an intentional tightening, not an accidental side effect. Confirmed neither `bookings.create.test.ts` nor `bookings.update.test.ts` sets `maxGroupSize`/`startDates` on any fixture tour today, so both pass unmodified; optionally add new positive/negative cases to each locking in the new behavior.

### Case-insensitive email — `resolveCustomer` in `lib/bookings.ts`

```ts
const email = normalizeEmail(input.customer!.email);  // from ../lib/customers
const existing = await prisma.customer.findUnique({ where: { email } });
// ...create() also uses the normalized `email`, not the raw input
```
Same `normalizeEmail` reused in Workstream 1's Customer create/update routes.

### Richer public response — `apps/backend/src/routes/public.ts`

Use `serializeBooking(booking)` (for `finishDate`) but hand-curate a narrower object than the admin route's full spread — omit `notes`/`refundAmount`/`cancelledAt`/`updatedAt`/`payments`/`amountPaid`/`paymentStatus`:
```ts
res.status(201).json({
  reference, status, participants, startDate, finishDate, totalPrice, createdAt,
  tour: { id: booking.tour.id, title: booking.tour.title, slug: booking.tour.slug, imageCover: booking.tour.imageCover, duration: booking.tour.duration },
  customer: { name: booking.customer.name, email: booking.customer.email, phone: booking.customer.phone },
});
```
**Deliberately exclude `customer.id`**: distinct from the existing IDOR guard (which is about never *accepting* a customerId — `createBookingSchemaPublic` stays untouched). There's no public endpoint that does anything with a customer id, and the booking already has a purpose-built external reference (`reference`) for the client to hold onto — an internal PK with no corresponding lookup capability adds exposure for no benefit. `tour.id` is kept since it's the same id the client already sent and the same one used by `GET /public/tours`.

### Tests — `apps/backend/test/public.bookings.test.ts`

Add: over-capacity → 400; startDate not in a tour's offered dates → 400 plus a positive control (an offered date → 201); repeat booking with a different-case email → still exactly one `Customer` row; response-shape assertions (`res.body.tour.title`, `res.body.customer.name/email`, `res.body.finishDate` present; `res.body.customer.id` is `undefined`).

---

## Workstream 4: URL-encode dynamic path segments in `backend-client.ts`

Found while answering a SonarQube question about `apps/admin/src/main/backend-client.ts:109` (`backendGetTour`) — SonarQube's S5144 (SSRF) Security Hotspot flags `` `${BACKEND_URL}/tours/${id}` `` because `id` is spliced into the URL unencoded. Real SSRF risk is low here (`BACKEND_URL` is a fixed trusted constant, only the path varies), but the fix is cheap and correct regardless: an unencoded `id` containing `/`, `?`, or `#` could otherwise alter the request path/target in unintended ways.

**Fix**: wrap every path-segment `id` (never query-string params — those already go through `URLSearchParams`, which auto-encodes) in `encodeURIComponent()`. Applies to every existing function in this file that interpolates an id into the URL path, not just `backendGetTour`:
- `backendGetTour`, `backendUpdateTour`, `backendDeleteTour` (`/tours/${id}`)
- `backendGetBooking`, `backendUpdateBooking`, `backendConfirmBooking`, `backendMarkBookingOngoing`, `backendCancelBooking`, `backendRecordPayment`, `backendUploadPaymentProof` (`/bookings/${id}...`)
- `backendUpdateAdmin`, `backendDeleteAdmin` (`/admins/${id}`)
- The new Workstream 1 functions (`backendGetCustomer`, `backendUpdateCustomer`, `backendDeleteCustomer`) should be written with `encodeURIComponent(id)` from the start rather than added unencoded and fixed later.

Example: `` fetch(`${BACKEND_URL}/tours/${encodeURIComponent(id)}`, ...) ``.

No test changes needed — all real `id` values in this app are server-generated UUIDs with no characters that `encodeURIComponent` would alter, so behavior is unchanged; this is a defensive fix, not a bug fix for an observed failure.

---

## Housekeeping: relocate this plan doc

Per this repo's SDD convention (`docs/superpowers/plans/YYYY-MM-DD-description.md`, e.g. the existing `2026-09-11-app-settings-profile-security.md`), once this plan is approved it should be copied to `docs/superpowers/plans/2026-09-12-standalone-customer-management.md` so it's part of the repo's plan history alongside the others. Plan Mode only permits editing this plan file itself, so the actual copy/move into the repo happens as the first step of implementation, not during planning.

---

## Sequencing

0. Copy this plan to `docs/superpowers/plans/2026-09-12-standalone-customer-management.md` (see Housekeeping above).
1. `lib/customers.ts` (`normalizeEmail`) — shared prerequisite.
2. Workstream 3 backend (`lib/bookings.ts`, `routes/bookings.ts` PATCH trigger, `routes/public.ts` response shape) + its tests.
3. Workstream 1 backend (`customers.schema.ts`, `customers.ts` routes — imports `normalizeEmail`) + its tests.
4. Workstream 1 frontend, in order: `preload.ts`/`window.d.ts` (types) → `backend-client.ts` (write new Customer functions with `encodeURIComponent(id)` directly, per Workstream 4) → `main.ts` → `icons.tsx`/`Sidebar.tsx`/`AppLayout.tsx` (wiring) → `Customers.tsx`/`CustomerForm.tsx`/`CustomerView.tsx` (screens, last).
5. Workstream 2 — independent, any time: `package.json` → `middleware/rateLimit.ts` → `app.ts` → `routes/auth.ts` → `rateLimit.test.ts`.
6. Workstream 4 — independent, any time: apply `encodeURIComponent(id)` to the existing `backend-client.ts` functions listed above.
7. Full `npm test --workspace=apps/backend` and a TS build/typecheck of `apps/admin`.

## Verification

**Automated**: run the full backend test suite (all existing 46 files plus the new/updated ones listed above) — expect all green, no flakiness from the rate limiter (gated off under `NODE_ENV=test`). Typecheck `apps/admin` (`npm run lint` in that workspace) after the frontend changes.

**Manual — Customers screen** (via `npm run dev` at repo root):
1. Navigate to the new Customers nav item — paginated list loads; search box filters the current page.
2. Create a customer; retry with a duplicate email → inline field error, not a crash.
3. View a customer with zero bookings, then one with bookings (seed via the Bookings screen) → confirm booking-history table renders correctly.
4. Edit a customer's email to another customer's email → 409 as a field error; edit to a mixed-case version of their own current email → succeeds (no false 409).
5. Delete a customer with no bookings → succeeds; delete one with bookings → clear error toast, not removed.
6. In the Bookings screen's "add booking" customer picker, confirm the typeahead search still works unchanged (regression check on `customersAPI.search`).

**Manual — security/public-booking**:
1. `curl -i` any route, confirm helmet headers present and existing functionality (CORS, uploads) unaffected.
2. Hammer `POST /auth/login` against a running (non-test) server → 429 kicks in well before the global limiter would.
3. Submit a public booking twice with the same email in different casing → only one `Customer` row created; try over-capacity and an unoffered start date → both 400.
