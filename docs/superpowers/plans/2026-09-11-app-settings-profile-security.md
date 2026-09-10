# Plan: Global App Settings + Profile + Security tabs

## Context

The admin app's Settings screen currently has a single "Appearance" tab (theme only,
stored client-side in localStorage). This adds three more tabs:

1. **General** — org-wide settings (app name, company name, logo, timezone, date/time
   format, language, currency, fiscal year start) that are global/singleton, persisted
   server-side, and consumed across the app (starting with currency formatting on every
   screen that shows money). Editing is restricted to `AdminRole.ADMIN`; reading is not
   (every screen needs to read the currency to format prices, regardless of who's
   viewing).
2. **Profile** — the logged-in admin's own info: Name (editable), Email (read-only),
   Avatar (editable), Phone (optional, editable), Position/role (editable only if the
   viewer is ADMIN — you can't self-promote by editing your own position).
3. **Security** — for now, just: Email (read-only, shown for context) and Change
   Password (current + new password).

Two Explore agents and one Plan agent already gathered exact current-state facts for
the General/currency portion (verified file contents, line numbers, existing
conventions) — that work is folded in below as ground truth, not re-derived.

## Assumptions (flag for correction)

- **Singleton settings pattern**: `AppSettings` gets a `key String @unique @default("singleton")` column; `getOrCreateSettings()` does an atomic `prisma.appSettings.upsert({ where: { key: 'singleton' }, update: {}, create: {} })` — avoids the race condition of two concurrent first-boot requests both `findFirst()`-then-`create()`-ing duplicate rows, without a hardcoded UUID literal. `id` still follows the existing `String @id @default(uuid())` convention used by every other model.
- **Currency/date/time/language stored as plain `String` columns**, validated by a closed `z.enum([...])` at the API boundary — not Postgres enums, since (unlike `BookingStatus`/`Difficulty`/etc.) these are user-editable preference lists that may grow without a schema migration.
- **Role checks via a per-request DB lookup**, not embedded in the JWT — a role downgrade takes effect immediately rather than waiting out the 15-minute access-token TTL, and it keeps `tokens.ts` untouched.
- **"Position" = the existing `Admin.role` field** (`ADMIN`/`LEAD_GUIDE`/`GUIDE`), shown on the Profile tab labeled "Position" — not a new free-text field. This directly satisfies "non-editable by other user than admin": role changes are inherently permission-sensitive, so gating them to ADMIN-only is the same rule as the General tab, applied to one field instead of a whole tab.
- **Profile fields live on the `Admin` model** (`avatarUrl String?`, `phone String?` — new columns) rather than a separate table, since they're 1:1 with an admin account, matching how the schema already keeps `role`/`name`/`email` directly on `Admin`.
- **Password change revokes all of that admin's refresh tokens** (`prisma.refreshToken.deleteMany({ where: { adminId } })`, same call already used by `/auth/logout`) — forces re-login with the new password on other sessions/devices once the current 15-min access token expires. Standard practice, small addition.
- **`/auth/me` is extended** (not a separate `GET /profile`) to return `role`, `avatarUrl`, `phone` alongside the existing `id`/`email`/`name` — it's already the canonical "who am I" fetch on every session restore, no need for a second endpoint. `POST /login`'s own response is untouched (confirmed `main.ts`'s `auth:login` handler already calls `backendMe()` separately and never reads an admin object off the login response).
- **Tab order**: Profile, Security, General, Appearance (personal settings first, admin-only org settings next, cosmetic last) — easy to reorder later, not blocking.

---

## 1. Prisma schema (two model changes, can be one migration or two)

```prisma
model AppSettings {
  id     String @id @default(uuid())
  key    String @unique @default("singleton")

  appName     String  @default("Andy Tours")
  companyName String  @default("Andy Tours")
  logoUrl     String?

  timezone              String @default("UTC")
  dateFormat            String @default("MM/DD/YYYY")
  timeFormat            String @default("12h")
  language              String @default("en")
  currency              String @default("USD")
  fiscalYearStartMonth  Int    @default(1)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

`Admin` model — add three nullable/new columns (`avatarUrl`, `phone`, `lastLoginAt`;
`createdAt` already exists and doubles as "Member since"):
```prisma
model Admin {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  name         String
  role         AdminRole @default(ADMIN)
  avatarUrl    String?
  phone        String?
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
}
```

Migration: `npm run prisma:migrate --workspace=apps/backend -- --name add_app_settings_and_profile_fields`.

---

## 2. Backend

### New shared helper — `apps/backend/src/lib/settings.ts`
```ts
import { prisma } from './prisma';

export async function getOrCreateSettings() {
  return prisma.appSettings.upsert({
    where: { key: 'singleton' },
    update: {},
    create: { key: 'singleton' },
  });
}
```

### New middleware — `apps/backend/src/middleware/requireAdminRole.ts`
Separate file (not folded into `auth.ts`) to preserve one-concern-per-middleware-file,
matching `ipAllowlist.ts`/`auditLog.ts`. Factory taking allowed roles, runs after
`requireAuth` (needs `req.adminId`):
```ts
export function requireAdminRole(...allowedRoles: AdminRole[]) {
  return async (req, res, next) => {
    const admin = await prisma.admin.findUnique({ where: { id: req.adminId }, select: { role: true } });
    if (!admin) { res.status(401).json({ error: 'invalid session' }); return; }
    if (!allowedRoles.includes(admin.role)) { res.status(403).json({ error: 'forbidden' }); return; }
    req.adminRole = admin.role; // declare on Express.Request via module augmentation, like auth.ts does for adminId
    next();
  };
}
```

### `apps/backend/src/lib/supabaseStorage.ts` — add two exports
```ts
export function uploadLogo(buffer, filename, mimetype) { return uploadToBucket('settings', buffer, filename, mimetype); }
export function uploadAvatar(buffer, filename, mimetype) { return uploadToBucket('avatars', buffer, filename, mimetype); }
```

### New route — `apps/backend/src/routes/settings.ts` + `settings.schema.ts`
- `GET /settings` — `requireAuth` only. Returns `getOrCreateSettings()` result directly (unwrapped, singular resource — matches `GET /tours/:id`'s `res.json(tour)`, not the `{ tours }`-list-wrapper convention).
- `PATCH /settings` — `requireAuth, requireAdminRole('ADMIN')`. Body validated by `updateSettingsSchema` (zod): `appName`/`companyName` optional strings, `logoUrl` optional nullable url, `timezone` optional string validated against `new Set(Intl.supportedValuesOf('timeZone'))` (Node ≥18 ships full ICU — same source of truth the frontend dropdown uses), `dateFormat`/`timeFormat`/`language`/`currency` optional `z.enum([...])` against exported const arrays (`CURRENCY_OPTIONS = ['USD','PHP','EUR','GBP','AUD','SGD','JPY']`, `DATE_FORMAT_OPTIONS = ['MM/DD/YYYY','DD/MM/YYYY','YYYY-MM-DD']`, `TIME_FORMAT_OPTIONS = ['12h','24h']`, `LANGUAGE_OPTIONS = ['en']`), `fiscalYearStartMonth` optional int 1-12. On success: `prisma.appSettings.update(...)`, `res.json(settings)`.
- `POST /settings/upload-logo` — `requireAuth, requireAdminRole('ADMIN'), upload.single('logo')` — mirrors `POST /tours/upload-image` exactly (file presence check, `ALLOWED_LOGO_MIMETYPES` check, `uploadLogo(...)`, `res.status(201).json({ url })`).

### New route — `apps/backend/src/routes/profile.ts` + `profile.schema.ts`
- `PATCH /profile` — `requireAuth` only (any admin can edit their own name/phone/avatar). Body: `name`/`phone`/`avatarUrl` optional, plus `role` optional. **If `role` is present in the body and the requester's own current role is not `ADMIN`, respond `403`** (explicit rejection, not a silent drop — requires one extra `prisma.admin.findUnique` to check the requester's current role before allowing a role change, same pattern as `requireAdminRole`). On success, `prisma.admin.update(...)`, respond with the updated `{ id, email, name, role, avatarUrl, phone }` (same shape `/auth/me` returns).
- `POST /profile/upload-avatar` — `requireAuth, upload.single('avatar')` (no admin-role gate — everyone can change their own avatar) — mirrors the logo/tour-image upload pattern, `uploadAvatar(...)`, `res.status(201).json({ url })`.
- `POST /profile/change-password` — `requireAuth`. Body via `changePasswordSchema`: `currentPassword` (min 1), `newPassword` (min 8). Look up the admin, `verifyPassword(currentPassword, admin.passwordHash)` (existing helper in `lib/password.ts` — no new password-comparison code needed) — 401 `{ error: 'current password is incorrect' }` if it fails. Otherwise `hashPassword(newPassword)`, `prisma.admin.update({ data: { passwordHash } })`, then `prisma.refreshToken.deleteMany({ where: { adminId } })` (revoke other sessions), respond `204`.

### `apps/backend/src/routes/auth.ts` — extend `/me`, and stamp `lastLoginAt` on login
`/me`:
```ts
res.json({
  id: admin.id, email: admin.email, name: admin.name, role: admin.role,
  avatarUrl: admin.avatarUrl, phone: admin.phone,
  createdAt: admin.createdAt, lastLoginAt: admin.lastLoginAt,
});
```
`/login` — after credentials are verified, update `lastLoginAt` alongside creating the
refresh token (independent writes, run via `Promise.all` rather than sequentially —
same round-trip-minimizing pattern already used in `lib/bookings.ts`'s `createBooking`):
```ts
const [, ] = await Promise.all([
  prisma.refreshToken.create({ data: { adminId: admin.id, tokenHash: hashToken(refreshToken), expiresAt: refreshTokenExpiryDate() } }),
  prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
]);
```
Note: since this stamps `lastLoginAt` on the login that's happening *right now*, viewing
your own Profile in the current session will show your last login as "just now" (the
current session's sign-in), not the prior one — the simplest, literal reading of "last
login timestamp," not a "previous session" tracker.

### `apps/backend/src/app.ts` — mount both new routers
```ts
app.use('/settings', settingsRouter);
app.use('/profile', profileRouter);
```

### Tests (new files, mirroring `customers.search.test.ts`'s conventions — `DB_HEAVY_TEST_TIMEOUT`, real admin rows via `prisma.admin.create` + `signAccessToken`, cleanup in `afterAll`)
- `test/settings.get.test.ts`, `test/settings.update.test.ts`, `test/settings.uploadLogo.test.ts` — 401/403/400/200 cases per the endpoint behavior above; a second `GET` proves the upsert doesn't duplicate rows; a non-ADMIN role can still `GET` (200) but not `PATCH` (403).
- `test/profile.update.test.ts` — own name/phone update succeeds for any role; a non-ADMIN admin including `role` in the body gets 403; an ADMIN including `role` succeeds.
- `test/profile.uploadAvatar.test.ts` — mirrors `tours.uploadImage.test.ts`, any authenticated role succeeds, invalid mimetype 400.
- `test/profile.changePassword.test.ts` — wrong current password → 401; new password too short → 400; correct flow → 204, then confirms the old password no longer works via `/auth/login` and refresh tokens issued before the change are rejected by `/auth/refresh`.
- `test/middleware/requireAdminRole.test.ts` — standalone minimal-`express()`-app pattern (like `ipAllowlist.test.ts`), seeded ADMIN + GUIDE admins: no `adminId` → 401, GUIDE → 403, ADMIN → 200.
- `test/auth.me.test.ts` (existing) — update the exact-equality assertion to include the new fields (`role: 'ADMIN'`, `avatarUrl: null`, `phone: null`, `createdAt: expect.any(String)`, `lastLoginAt: null` before first login / a timestamp string after).
- `test/auth.login.test.ts` (existing) — add a case confirming `lastLoginAt` is set (non-null, recent) after a successful login.
- `test/supabaseStorage.test.ts` (existing) — extend with `uploadLogo`/`uploadAvatar` cases analogous to the existing `uploadTourImage` block.

---

## 3. Frontend IPC (mirrors the exact existing pattern used for every other API object — `preload.ts` types + `contextBridge.exposeInMainWorld` block → `window.d.ts` global declaration → `main/backend-client.ts` fetch function → `main.ts` `ipcMain.handle`)

**`apps/admin/src/preload.ts`**:
- `AdminSummary` gains `role: AdminRole`, `avatarUrl: string | null`, `phone: string | null`, `createdAt: string`, `lastLoginAt: string | null`.
- New `AppSettingsDto` / `UpdateAppSettingsPayload` / `UploadLogoResult` types (see field list in §1/§2) and a new `settingsAPI` bridge block (`get`, `update`, `uploadLogo`) — appended after the existing `auditAPI` block (last thing in the file currently).
- New `UpdateProfilePayload` (`name?`, `phone?`, `avatarUrl?`, `role?`) / `ChangePasswordPayload` (`currentPassword`, `newPassword`) / `UploadAvatarResult` types and a new `profileAPI` bridge block (`update`, `uploadAvatar`, `changePassword`).

**`apps/admin/src/renderer/window.d.ts`**: mirror both new API objects into the global `Window` interface, importing the new types from `../preload`.

**`apps/admin/src/main/backend-client.ts`**: add `backendGetSettings`/`backendUpdateSettings`/`backendUploadLogo` and `backendUpdateProfile`/`backendUploadAvatar`/`backendChangePassword` — same `fetch(...)` + `parseJsonOrThrow`/manual-status-check shape as every existing function in this file. Note: this file keeps its own locally-duplicated `AdminSummary` interface (pre-existing duplication from `preload.ts`, not something to fix here) — update both copies to include `role`/`avatarUrl`/`phone`.

**`apps/admin/src/main.ts`**: add `settings:get`/`settings:update`/`settings:upload-logo` and `profile:update`/`profile:upload-avatar`/`profile:change-password` handlers, same try/catch-wrap-and-rethrow shape as every existing handler.

---

## 4. Frontend state

### New `apps/admin/src/renderer/AppSettingsContext.tsx` (mirrors `AuthContext.tsx`)
Fetches `settings` once `useAuth()`'s `session` exists, exposes `{ settings, status, error, refresh, formatCurrency }`. `formatCurrency(amount)` is `useMemo`'d off `settings?.currency` (defaults to `'USD'` pre-fetch, via `new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)`) — safe to call from any screen immediately, never crashes before the first fetch resolves.

### `apps/admin/src/renderer/App.tsx` — nest the new provider inside `AuthProvider`, wrapping `AppShell`
```tsx
<AuthProvider>
  <AppSettingsProvider>
    <AppShell />
  </AppSettingsProvider>
</AuthProvider>
```
Confirmed: every screen `AppLayout` renders (`Dashboard`, `Settings`, `Tours`, `Bookings`, and the dialogs/detail views they render — `BookingView`, `RecordPaymentDialog`, `CancelBookingDialog`, `TourView`) is a descendant of `AppShell`, so `useAppSettings()` is callable anywhere with no prop-drilling.

### `apps/admin/src/renderer/AuthContext.tsx` — add a `refreshSession` method
Add a small method that re-calls `window.authAPI.getSession()` and updates `session` state (reusing the existing restore logic), exposed alongside `login`/`logout`. Used by the new Profile tab after a successful save, so the in-memory `session.admin` (name/avatar/phone/role) reflects the edit immediately without requiring a full re-login.

---

## 5. Settings.tsx — four tabs, one role-gated

```tsx
type SettingsTab = 'profile' | 'security' | 'general' | 'appearance';

const { session } = useAuth();
const isAdmin = session?.admin.role === 'ADMIN';

const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  ...(isAdmin ? [{ id: 'general' as const, label: 'General' }] : []),
  { id: 'appearance', label: 'Appearance' },
];
```
Content rendering stays the existing explicit `activeTab === 'x' && <XTab />` pattern, one line per tab. `Profile`/`Security`/`Appearance` are visible to every role (personal account management); only `General` is hidden from non-ADMINs (same `PATCH /settings` 403 already enforces this server-side — the UI gate just avoids showing an edit surface a non-admin can't use). Note the existing `max-w-[480px]` wrapper is likely too narrow once `GeneralTab`/`ProfileTab` (logo/avatar dropzone + several fields) are added — widen or drop the constraint during implementation.

### `apps/admin/src/renderer/screens/settings/GeneralTab.tsx` (new)
Fields: App name (text input), Company name (text input), Logo (dropzone reusing
`TourForm.tsx`'s cover-image pattern exactly — `ALLOWED_IMAGE_TYPES`, `MAX_IMAGE_BYTES = 5 * 1024 * 1024`, `URL.createObjectURL` preview, upload-then-save with a `{file, url}` cache keyed by File reference to avoid re-uploading on retry), Timezone (`Select` from `components/ui/select.tsx`, options via `useMemo(() => Intl.supportedValuesOf('timeZone'), [])`), Date format / Time format / Language / Currency (same `Select` component, options mirrored locally from the backend's const arrays — no shared package between the two apps, so these two lists must be kept manually in sync), Fiscal year start month (`Select`, 12 items, January–December labels mapped to 1–12). Save: upload logo first if a new file was staged (mirrors `TourForm.handleSubmit`'s upload-then-save sequencing), then `PATCH /settings`, then `refresh()` from `useAppSettings()` so `formatCurrency` picks up the new currency immediately, then a success toast.

### `apps/admin/src/renderer/screens/settings/ProfileTab.tsx` (new)
Editable fields: Name (text input), Avatar (dropzone, same pattern as Logo above, single image, calls `profileAPI.uploadAvatar`), Phone (text input, optional), Position (label "Position", value = `session.admin.role` — rendered as a `Select` of the three `AdminRole` values if `isAdmin`, else a plain read-only text display of the current role).
Read-only display fields (no input, just labeled text — same visual treatment as `BookingView`/`TourView`'s `detail-field` blocks): Email, **Member since** (`session.admin.createdAt`, formatted via `toLocaleDateString()`), **Last login** (`session.admin.lastLoginAt`, formatted via `toLocaleString()`).
Save: upload avatar first if changed, then `profileAPI.update(...)` (include `role` in the payload only if `isAdmin` and it changed), then `refreshSession()` from `AuthContext` so the sidebar/session state reflects the change, then a success toast.

### `apps/admin/src/renderer/screens/settings/SecurityTab.tsx` (new)
Email (read-only display, same as Profile). Change Password section: Current password / New password / Confirm new password (three `type="password"` inputs), client-side check that New/Confirm match before submit (mirrors the existing pattern of inline validation used elsewhere, e.g. `RecordPaymentDialog`'s `isAmountValid`), calls `profileAPI.changePassword({ currentPassword, newPassword })`. On success: clear the fields and show a success toast; a `401`/"current password is incorrect" error from the backend surfaces as a field-level error under Current Password (same `handleRequestError`-style JSON-error-parsing pattern already used in `TourForm.tsx`/`BookingForm.tsx`).

---

## 6. Money-formatting call-site replacements

Every current `${amount.toFixed(2)}`-style occurrence gets replaced with
`{formatCurrency(amount)}` (from `useAppSettings()`), confirmed exact locations:

| File | Lines | Note |
|---|---|---|
| `screens/bookings/Bookings.tsx` | 604-605, 684-685, 775 | desktop table + mobile card (identical pattern, both computed from the same `paid`/`totalPrice` per row) + a `ConfirmDialog` message template literal |
| `screens/bookings/BookingView.tsx` | 55, 60, 67, 99 | total price, amount paid, refund (conditional), payment-history line item |
| `RecordPaymentDialog.tsx` | 77, 79, 81, 154 | total/paid/remaining grid + validation message. **Line 150 left untouched** — sets a live numeric `<input>` value, not display text |
| `CancelBookingDialog.tsx` | 21, 39 | dialog message + validation message |
| `screens/tours/Tours.tsx` | 328, 329, 332 | list table price/discount cells |
| `screens/tours/TourView.tsx` | 38, 44 | detail view price/discount fields |
| `screens/tours/TourForm.tsx` | — | **no changes** — Price/Price discount stay bare `type="number"` inputs, never formatted |
| `screens/Dashboard.tsx` + `screens/mockAnalytics.ts` | — | Revenue stat is currently a pre-formatted string mixed into an otherwise non-currency `StatCard[]`; move it out to a separate `revenueThisMonth = 48200` raw number in `mockAnalytics.ts`, re-inserted via `formatCurrency(revenueThisMonth)` at its original position (2nd of 4 stat cards) in `Dashboard.tsx` — the other 3 mock stats (counts, not money) stay untouched |

Every listed component is a confirmed descendant of `AppSettingsProvider` (mounted around `AppShell` in `App.tsx`, the sole parent of `AppLayout`, which is the sole render path for all of these) — `useAppSettings()` is callable directly, no prop-drilling needed.

---

## 7. Verification plan

1. **Backend**: `npm run test --workspace=apps/backend` — watch the new/updated test files listed in §2. Run `npm run prisma:generate --workspace=apps/backend` if the client isn't auto-regenerated by the migrate step.
2. **Manual smoke test as an ADMIN**: log in → Settings shows all 4 tabs → General: change currency/date format/etc. + upload a logo → Save → reopen General, confirm persisted values (real round-trip, not local state) → Tours/Bookings/Dashboard money figures now reflect the new currency → Record Payment / Cancel Booking dialogs also reformatted, while the "Amount received now" input and "Full remaining balance" autofill stay plain numbers → Profile: edit name/phone, upload an avatar, change Position via the Select → Security: change password, confirm old password stops working and a fresh login is required once the current access token expires.
3. **Manual smoke test as a non-ADMIN** (seed one directly since `seed-admin.ts` always creates `ADMIN` — use Prisma Studio or a one-off script to set `role: 'GUIDE'`): Settings shows only Profile/Security/Appearance (General absent) → Profile's Position field is read-only, not a Select → money figures across the app still render correctly (read path unrestricted) → a direct `PATCH /settings` call with this admin's token returns 403 → Profile/Security tabs work normally (self-service, not role-gated).
