# Admin Login — Design

Date: 2026-08-30

## Purpose

`andy-booking-app` is a tours booking app with two surfaces:

- **Admin panel** — where Andy (and other staff) manage tours and bookings. Ships as an
  installable Electron desktop app, not a website. UI uses a neumorphic design language.
- **Public booking page** — a single page, populated via API, where customers browse and book
  tours. A normal website, not part of the Electron app.

This spec covers only the **first slice: admin Login**, end to end. The public booking page and
tour/booking management are separate future slices with no dependency on this one.

## Scope

In scope:
- Express + TypeScript backend with email/password auth (not Supabase Auth — a custom backend
  is needed because email integrations will be added to it later).
- Prisma ORM against the Supabase-hosted Postgres database.
- Electron Forge + Vite + React + TypeScript admin app, with a single Login screen.
- JWT access + refresh token session strategy, refresh token stored via Electron's OS-backed
  `safeStorage`.
- Multiple admin accounts (seeded/created directly in the database — no self-signup or admin
  management UI yet).

Out of scope (explicitly deferred):
- Admin account creation/management UI.
- `Tour` / `Booking` data models and any tour/booking management screens.
- The public booking page package.
- Password reset and other email integrations.

## Repo layout

npm workspaces monorepo:

```
andy-booking-app/
  package.json                 # workspaces: ["apps/*"]
  apps/
    backend/                   # Express + TS + Prisma
      prisma/schema.prisma
      src/
        index.ts               # server entrypoint
        routes/auth.ts         # /auth/login, /auth/refresh, /auth/logout, /auth/me
        middleware/auth.ts     # JWT verification middleware
        lib/prisma.ts
      .env                     # DATABASE_URL (Supabase), JWT secrets
    admin/                     # Electron Forge + Vite + React + TS
      src/
        main/                  # Electron main process (owns safeStorage)
        preload/                # contextBridge-exposed IPC (window.authAPI)
        renderer/               # React app
          screens/Login.tsx
          lib/auth.ts          # calls preload bridge, holds access token in memory
```

`apps/booking` (the public page) is not created in this slice.

## Data model

`apps/backend/prisma/schema.prisma`:

```prisma
model Admin {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  createdAt    DateTime @default(now())
}

model RefreshToken {
  id        String   @id @default(uuid())
  adminId   String
  tokenHash String
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

`RefreshToken` rows are hashed, not raw, so a leaked database dump doesn't hand out live
sessions. Storing them server-side (rather than relying purely on JWT statelessness) is what
makes `/auth/logout` able to actually revoke a session early.

## Backend auth API

- `POST /auth/login` — body `{ email, password }`. Looks up `Admin` by email, verifies password
  with `bcrypt.compare`, returns `{ accessToken, refreshToken }`. Returns a generic "invalid
  credentials" error on any failure (wrong email or wrong password) to avoid user enumeration.
- `POST /auth/refresh` — body `{ refreshToken }`. Verifies signature + expiry + presence in the
  `RefreshToken` table, issues a new access token.
- `POST /auth/logout` — body `{ refreshToken }`. Deletes the matching `RefreshToken` row.
- `GET /auth/me` — protected by the JWT middleware; returns `{ id, email, name }` for the
  logged-in admin. Used by the Electron app on startup to validate a restored session.

**Tokens:** access token is a JWT signed with `JWT_ACCESS_SECRET`, 15 minute expiry. Refresh
token is a JWT signed with a separate `JWT_REFRESH_SECRET`, 7 day expiry; its hash is what's
stored in `RefreshToken`.

**Middleware:** `middleware/auth.ts` reads `Authorization: Bearer <token>`, verifies the access
JWT, attaches `req.admin`, responds 401 otherwise.

**Error handling:** centralized Express error middleware returns `{ error: string }` JSON.
Validation errors (missing fields) → 400. Auth failures → 401 with a generic message.

## Electron admin app

**Process split** (Electron Forge + Vite + React-TS template):
- **Main process** — creates the `BrowserWindow`; owns all `safeStorage` (OS-backed encryption —
  Keychain / DPAPI / libsecret) calls, since the renderer shouldn't get raw filesystem/crypto
  access.
- **Preload** — exposes a narrow `window.authAPI` bridge via `contextBridge`: `login(email,
  password)`, `getSession()`, `logout()`. Context isolation stays on; the renderer never touches
  Node APIs directly.
- **Renderer** — the React app. `screens/Login.tsx` is the only screen in this slice.

**Flow:**
1. On boot, the renderer asks main (via preload) for a stored session. Main decrypts the refresh
   token from disk if present. The renderer calls `/auth/refresh` to silently restore the
   session, or shows the Login screen if there's none or it's invalid.
2. On submit, the renderer calls the preload bridge, which POSTs to the backend's `/auth/login`
   from the main process. On success, main encrypts and stores the refresh token via
   `safeStorage`; the access token is returned to the renderer.
3. The renderer holds the access token in memory only (React state/context) — never persisted by
   the renderer itself. This means every app restart re-runs the silent-refresh-or-login-screen
   flow in step 1, which is intentional for this token setup.
4. Logout clears the in-memory access token and tells main to delete the stored refresh token
   (and calls `/auth/logout` to revoke it server-side).

**Error handling:** the Login screen shows inline error text on failure (wrong credentials,
unreachable server) without crashing the app shell.

**Design language:** neumorphic UI (soft-UI shadows, raised/inset elements, muted palette). Use
the `frontend-design` skill when implementing the Login screen's visuals.

## Testing

Backend auth routes get integration tests (supertest) against a test database, covering the
happy path and failure cases for login/refresh/logout/me (wrong password, expired/invalid
refresh token, missing fields). No Electron E2E harness for this slice — manual verification of
the login screen is sufficient given the scope.
