# Admin Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working admin login, end to end — an Express+Prisma backend issuing JWT access/refresh tokens over email+password auth, and an Electron admin app with a neumorphic Login screen that authenticates against it and silently restores sessions on relaunch.

**Architecture:** npm-workspaces monorepo with two packages: `apps/backend` (Express + TypeScript + Prisma against Supabase Postgres) and `apps/admin` (Electron Forge + Vite + React + TypeScript). The Electron main process owns all network calls to the backend and all encrypted-at-rest storage of the refresh token (via `safeStorage`); the renderer only talks to a narrow `window.authAPI` bridge exposed by the preload script.

**Tech Stack:** TypeScript everywhere. Backend: Express, Prisma, `bcryptjs`, `jsonwebtoken`, Vitest + Supertest for tests. Admin app: Electron Forge (`vite-typescript` template) + React 18 + Vite.

## Global Constraints

- Node.js 20+ (needed for built-in `fetch` in the Electron main process and for current Electron/Forge compatibility).
- npm workspaces is the package manager/monorepo tool (root `package.json` with `"workspaces": ["apps/*"]`) — not pnpm/yarn/Turborepo.
- `bcryptjs` (pure JS), not native `bcrypt`, to avoid requiring a native build toolchain on Windows dev machines.
- Access token: JWT, 15 minute expiry. Refresh token: JWT, 7 day expiry, and its SHA-256 hash is stored server-side in a `RefreshToken` table so `/auth/logout` can revoke it early.
- `/auth/login` returns a generic "invalid credentials" error for both unknown email and wrong password (no user enumeration).
- Renderer process never touches Node APIs, the filesystem, or `safeStorage` directly — only through the `window.authAPI` bridge (context isolation stays on).
- Out of scope for this plan (do not build): admin account management UI, `Tour`/`Booking` models, the public booking page package, password reset/email integrations.
- No automated Electron end-to-end tests for this slice — the Electron tasks end in manual verification steps instead, per the approved spec (`docs/superpowers/specs/2026-08-30-admin-login-design.md`).
- Backend integration tests require a reachable Postgres database (a Supabase project) via `DATABASE_URL`/`DIRECT_URL` — this is an external prerequisite the engineer must set up before Task 2's migration step will succeed.

---

### Task 1: Monorepo root scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: an `apps/*` npm workspaces root that Tasks 2 and 10 install into.

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "andy-booking-app",
  "private": true,
  "workspaces": [
    "apps/*"
  ]
}
```

- [ ] **Step 2: Create the root `.gitignore`**

```
node_modules/
dist/
out/
.env
*.log
.DS_Store
```

- [ ] **Step 3: Verify npm recognizes the workspace root**

Run: `npm install`
Expected: completes with no errors (no workspaces exist yet, so nothing to install, but the command must not fail).

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: scaffold npm workspaces root"
```

---

### Task 2: Backend project scaffold + Prisma schema + migration

**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/vitest.config.ts`
- Create: `apps/backend/.env.example`
- Create: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/src/lib/prisma.ts`

**Interfaces:**
- Produces: `prisma` (a `PrismaClient` singleton) from `apps/backend/src/lib/prisma.ts`, consumed by every later backend task. Produces `Admin { id, email, passwordHash, name, createdAt }` and `RefreshToken { id, adminId, tokenHash, expiresAt, createdAt }` tables.

- [ ] **Step 1: Create `apps/backend/package.json`**

```json
{
  "name": "backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "seed:admin": "tsx src/scripts/seed-admin.ts"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "@prisma/client": "^5.20.0"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "tsx": "^4.19.1",
    "@types/express": "^4.17.21",
    "@types/node": "^22.7.4",
    "@types/cors": "^2.8.17",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.7",
    "prisma": "^5.20.0",
    "vitest": "^2.1.1",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  }
}
```

- [ ] **Step 2: Create `apps/backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install --workspace=apps/backend`
Expected: completes with no errors, `apps/backend/node_modules` and a root `package-lock.json` are created/updated.

- [ ] **Step 5: Create `apps/backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

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

`directUrl` is set because Supabase's default pooled connection string (pgbouncer) can't run migrations — Prisma needs the direct connection for those while the app uses the pooled one at runtime.

- [ ] **Step 6: Create `apps/backend/.env.example`**

```
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
JWT_ACCESS_SECRET="change-me"
JWT_REFRESH_SECRET="change-me-too"
PORT=4000
```

- [ ] **Step 7: Create your real `apps/backend/.env` (not committed)**

Copy `.env.example` to `apps/backend/.env` and fill in your actual Supabase connection strings (Supabase dashboard → Project Settings → Database → Connection string) and two distinct random secrets for `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`. This file is gitignored by Task 1's `.gitignore`.

- [ ] **Step 8: Create `apps/backend/src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 9: Run the migration against your Supabase database**

Run: `npm run prisma:migrate --workspace=apps/backend -- --name init`
Expected: prompts complete, prints `Your database is now in sync with your schema`, and creates `apps/backend/prisma/migrations/<timestamp>_init/`.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/package.json apps/backend/tsconfig.json apps/backend/vitest.config.ts apps/backend/.env.example apps/backend/prisma apps/backend/src/lib/prisma.ts package-lock.json
git commit -m "feat(backend): scaffold Express+Prisma project and Admin/RefreshToken schema"
```

---

### Task 3: Backend Express app skeleton (health check + centralized error handler)

**Files:**
- Create: `apps/backend/src/app.ts`
- Create: `apps/backend/src/index.ts`
- Create: `apps/backend/src/middleware/errorHandler.ts`
- Test: `apps/backend/test/health.test.ts`
- Test: `apps/backend/test/errorHandler.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `createApp(): Express` from `src/app.ts` (used by every later route/test task), `errorHandler` middleware wired into it.

- [ ] **Step 1: Write the failing tests**

`apps/backend/test/health.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

`apps/backend/test/errorHandler.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from '../src/middleware/errorHandler';

describe('errorHandler', () => {
  it('responds with 500 and a generic error message', () => {
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'internal server error' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/health.test.ts test/errorHandler.test.ts --root apps/backend`
Expected: FAIL — `Cannot find module '../src/app'` and `Cannot find module '../src/middleware/errorHandler'`.

- [ ] **Step 3: Write `apps/backend/src/middleware/errorHandler.ts`**

```ts
import type { NextFunction, Request, Response } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
}
```

- [ ] **Step 4: Write `apps/backend/src/app.ts`**

```ts
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 5: Write `apps/backend/src/index.ts`**

```ts
import 'dotenv/config';
import { createApp } from './app';

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/health.test.ts test/errorHandler.test.ts --root apps/backend`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/app.ts apps/backend/src/index.ts apps/backend/src/middleware/errorHandler.ts apps/backend/test/health.test.ts apps/backend/test/errorHandler.test.ts
git commit -m "feat(backend): Express app skeleton with health check and error handler"
```

---

### Task 4: Password + token utility functions

**Files:**
- Create: `apps/backend/src/lib/password.ts`
- Create: `apps/backend/src/lib/tokens.ts`
- Test: `apps/backend/test/password.test.ts`
- Test: `apps/backend/test/tokens.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>`, `signAccessToken({ adminId }): string`, `verifyAccessToken(token): { adminId: string }`, `signRefreshToken(adminId: string): string`, `verifyRefreshToken(token): { adminId: string }`, `hashToken(token: string): string`, `refreshTokenExpiryDate(): Date` — all consumed by Tasks 5–7.

- [ ] **Step 1: Write the failing tests**

`apps/backend/test/password.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password';

describe('password hashing', () => {
  it('produces a hash that verifies correctly', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword('correct-horse', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});
```

`apps/backend/test/tokens.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../src/lib/tokens';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});

describe('tokens', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken({ adminId: 'admin-1' });
    expect(verifyAccessToken(token).adminId).toBe('admin-1');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken('admin-1');
    expect(verifyRefreshToken(token).adminId).toBe('admin-1');
  });

  it('hashes a token deterministically', () => {
    const token = 'some-refresh-token';
    expect(hashToken(token)).toBe(hashToken(token));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/password.test.ts test/tokens.test.ts --root apps/backend`
Expected: FAIL — `Cannot find module '../src/lib/password'` and `'../src/lib/tokens'`.

- [ ] **Step 3: Write `apps/backend/src/lib/password.ts`**

```ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Write `apps/backend/src/lib/tokens.ts`**

```ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  adminId: string;
}

function requireSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, requireSecret('JWT_ACCESS_SECRET'), { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, requireSecret('JWT_ACCESS_SECRET')) as AccessTokenPayload;
}

export function signRefreshToken(adminId: string): string {
  return jwt.sign({ adminId }, requireSecret('JWT_REFRESH_SECRET'), { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): { adminId: string } {
  return jwt.verify(token, requireSecret('JWT_REFRESH_SECRET')) as { adminId: string };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/password.test.ts test/tokens.test.ts --root apps/backend`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/password.ts apps/backend/src/lib/tokens.ts apps/backend/test/password.test.ts apps/backend/test/tokens.test.ts
git commit -m "feat(backend): password hashing and JWT utilities"
```

---

### Task 5: Auth middleware (`requireAuth`)

**Files:**
- Create: `apps/backend/src/middleware/auth.ts`
- Test: `apps/backend/test/middleware/auth.test.ts`

**Interfaces:**
- Consumes: `signAccessToken`, `verifyAccessToken` from Task 4.
- Produces: `requireAuth` Express middleware that sets `req.adminId`, consumed by Task 8's `/auth/me` route.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/middleware/auth.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireAuth } from '../../src/middleware/auth';
import { signAccessToken } from '../../src/lib/tokens';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
});

function buildTestApp() {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ adminId: req.adminId });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('allows a request with a valid access token', async () => {
    const token = signAccessToken({ adminId: 'admin-1' });
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.adminId).toBe('admin-1');
  });

  it('rejects a request with no authorization header', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/middleware/auth.test.ts --root apps/backend`
Expected: FAIL — `Cannot find module '../../src/middleware/auth'`.

- [ ] **Step 3: Write `apps/backend/src/middleware/auth.ts`**

```ts
import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/tokens';

declare global {
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    req.adminId = verifyAccessToken(token).adminId;
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/middleware/auth.test.ts --root apps/backend`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/middleware/auth.ts apps/backend/test/middleware/auth.test.ts
git commit -m "feat(backend): requireAuth JWT middleware"
```

---

### Task 6: `POST /auth/login`

**Files:**
- Create: `apps/backend/src/routes/auth.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/test/auth.login.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `hashPassword`/`verifyPassword`/`signAccessToken`/`signRefreshToken`/`hashToken`/`refreshTokenExpiryDate` (Task 4).
- Produces: `authRouter` mounted at `/auth`, extended by Tasks 7 and 8.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/auth.login.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

const app = createApp();
const testEmail = `login-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';

beforeAll(async () => {
  await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Test Admin' },
  });
});

afterAll(async () => {
  const admin = await prisma.admin.findUnique({ where: { email: testEmail } });
  if (admin) {
    await prisma.refreshToken.deleteMany({ where: { adminId: admin.id } });
    await prisma.admin.delete({ where: { id: admin.id } });
  }
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
  });

  it('rejects an unknown email', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: testPassword });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('rejects a wrong password', async () => {
    const res = await request(app).post('/auth/login').send({ email: testEmail, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('rejects a missing password', async () => {
    const res = await request(app).post('/auth/login').send({ email: testEmail });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth.login.test.ts --root apps/backend`
Expected: FAIL — `/auth/login` returns 404 (route doesn't exist yet).

- [ ] **Step 3: Write `apps/backend/src/routes/auth.ts`**

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { verifyPassword } from '../lib/password';
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  refreshTokenExpiryDate,
} from '../lib/tokens';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }

    const accessToken = signAccessToken({ adminId: admin.id });
    const refreshToken = signRefreshToken(admin.id);

    await prisma.refreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiryDate(),
      },
    });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Wire the router into `apps/backend/src/app.ts`**

```ts
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/auth.login.test.ts --root apps/backend`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/routes/auth.ts apps/backend/src/app.ts apps/backend/test/auth.login.test.ts
git commit -m "feat(backend): POST /auth/login"
```

---

### Task 7: `POST /auth/refresh` and `POST /auth/logout`

**Files:**
- Modify: `apps/backend/src/routes/auth.ts`
- Test: `apps/backend/test/auth.refresh-logout.test.ts`

**Interfaces:**
- Consumes: `authRouter` (Task 6), `verifyRefreshToken`/`hashToken` (Task 4), `prisma.refreshToken` (Task 2).
- Produces: `/auth/refresh` and `/auth/logout` routes on `authRouter`, consumed by Task 15's Electron main-process client.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/auth.refresh-logout.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

const app = createApp();
const testEmail = `refresh-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';

beforeAll(async () => {
  await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Test Admin' },
  });
});

afterAll(async () => {
  const admin = await prisma.admin.findUnique({ where: { email: testEmail } });
  if (admin) {
    await prisma.refreshToken.deleteMany({ where: { adminId: admin.id } });
    await prisma.admin.delete({ where: { id: admin.id } });
  }
  await prisma.$disconnect();
});

async function login() {
  const res = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });
  return res.body.refreshToken as string;
}

describe('POST /auth/refresh', () => {
  it('issues a new access token from a valid refresh token', async () => {
    const refreshToken = await login();
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
  });

  it('rejects an invalid refresh token', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so it can no longer be used', async () => {
    const refreshToken = await login();

    const logoutRes = await request(app).post('/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth.refresh-logout.test.ts --root apps/backend`
Expected: FAIL — both routes return 404.

- [ ] **Step 3: Add the refresh and logout routes to `apps/backend/src/routes/auth.ts`**

Add these imports to the top (alongside the existing ones from Task 6):
```ts
import { verifyRefreshToken } from '../lib/tokens';
```

Append to the bottom of the file:
```ts
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    let adminId: string;
    try {
      adminId = verifyRefreshToken(refreshToken).adminId;
    } catch {
      res.status(401).json({ error: 'invalid refresh token' });
      return;
    }

    const stored = await prisma.refreshToken.findFirst({
      where: { adminId, tokenHash: hashToken(refreshToken) },
    });
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'invalid refresh token' });
      return;
    }

    res.json({ accessToken: signAccessToken({ adminId }) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/auth.refresh-logout.test.ts --root apps/backend`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/auth.ts apps/backend/test/auth.refresh-logout.test.ts
git commit -m "feat(backend): POST /auth/refresh and POST /auth/logout"
```

---

### Task 8: `GET /auth/me`

**Files:**
- Modify: `apps/backend/src/routes/auth.ts`
- Test: `apps/backend/test/auth.me.test.ts`

**Interfaces:**
- Consumes: `authRouter` (Task 6/7), `requireAuth` (Task 5).
- Produces: `GET /auth/me` returning `{ id, email, name }`, consumed by Task 15's Electron main-process client.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/auth.me.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

const app = createApp();
const testEmail = `me-test-${Date.now()}@example.com`;
const testPassword = 'correct-horse-battery-staple';

beforeAll(async () => {
  await prisma.admin.create({
    data: { email: testEmail, passwordHash: await hashPassword(testPassword), name: 'Test Admin' },
  });
});

afterAll(async () => {
  const admin = await prisma.admin.findUnique({ where: { email: testEmail } });
  if (admin) {
    await prisma.refreshToken.deleteMany({ where: { adminId: admin.id } });
    await prisma.admin.delete({ where: { id: admin.id } });
  }
  await prisma.$disconnect();
});

describe('GET /auth/me', () => {
  it('returns the logged-in admin for a valid access token', async () => {
    const loginRes = await request(app).post('/auth/login').send({ email: testEmail, password: testPassword });

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual({ id: expect.any(String), email: testEmail, name: 'Test Admin' });
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth.me.test.ts --root apps/backend`
Expected: FAIL — `/auth/me` returns 404.

- [ ] **Step 3: Add the route to `apps/backend/src/routes/auth.ts`**

Add this import to the top:
```ts
import { requireAuth } from '../middleware/auth';
```

Append to the bottom of the file:
```ts
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.adminId } });
    if (!admin) {
      res.status(401).json({ error: 'invalid session' });
      return;
    }
    res.json({ id: admin.id, email: admin.email, name: admin.name });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/auth.me.test.ts --root apps/backend`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full backend test suite**

Run: `npm test --workspace=apps/backend`
Expected: PASS (all tests across every file in this task group, ~16 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/routes/auth.ts apps/backend/test/auth.me.test.ts
git commit -m "feat(backend): GET /auth/me"
```

---

### Task 9: Admin seed script

**Files:**
- Create: `apps/backend/src/scripts/seed-admin.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `hashPassword` (Task 4).
- Produces: an admin row usable for manual login testing in Task 15.

- [ ] **Step 1: Write `apps/backend/src/scripts/seed-admin.ts`**

```ts
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/password';

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password || !name) {
    console.error('Usage: npm run seed:admin --workspace=apps/backend -- <email> <password> "<name>"');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Admin ready: ${admin.email} (${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it against your Supabase database**

Run: `npm run seed:admin --workspace=apps/backend -- andy@example.com "a-real-password" "Andy"`
Expected: prints `Admin ready: andy@example.com (<uuid>)`. Use real values you'll remember for Task 15's manual login test.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/scripts/seed-admin.ts
git commit -m "feat(backend): admin seed script"
```

---

### Task 10: Electron admin app scaffold (Forge + Vite + React + TS)

**Files:**
- Create: `apps/admin/` (generated by Electron Forge, then modified below)
- Modify: `apps/admin/index.html`
- Modify: `apps/admin/vite.renderer.config.ts`
- Create: `apps/admin/src/renderer/App.tsx`
- Rename: `apps/admin/src/renderer.ts` → `apps/admin/src/renderer.tsx`

**Interfaces:**
- Produces: a launchable Electron+React app, whose `src/main.ts`, `src/preload.ts`, and `src/renderer/` are extended by Tasks 11–15.

- [ ] **Step 1: Scaffold the Forge project**

Run (from the repo root): `cd apps && npx create-electron-app@latest admin --template=vite-typescript && cd ..`
Expected: `apps/admin/` is created with `forge.config.ts`, `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`, `index.html`, `package.json`, `tsconfig.json`, and `src/main.ts`, `src/preload.ts`, `src/renderer.ts`.

Since this is a generator, confirm the file list matches before continuing:
Run: `ls apps/admin/src`
Expected: `main.ts`, `preload.ts`, `renderer.ts`. If the generator produced different filenames, use those names in place of the ones referenced in this and later tasks.

- [ ] **Step 2: Add React**

Run: `npm install react react-dom --workspace=apps/admin`
Run: `npm install -D @types/react @types/react-dom @vitejs/plugin-react @types/node --workspace=apps/admin`

`@types/node` is added explicitly (even though Electron depends on Node) so Task 11's main-process code can rely on typed global `fetch`/`Response` without depending on whatever version the generator happened to pull in transitively.

- [ ] **Step 3: Enable the React Vite plugin — replace `apps/admin/vite.renderer.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 4: Rename `apps/admin/src/renderer.ts` to `apps/admin/src/renderer.tsx`, with this content**

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './renderer/App';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container #app not found');
}

createRoot(container).render(<App />);
```

- [ ] **Step 5: Create `apps/admin/src/renderer/App.tsx`**

```tsx
export function App() {
  return <div>Admin app scaffold running</div>;
}
```

- [ ] **Step 6: Update `apps/admin/index.html`**

Replace the `<body>` contents so it mounts React and points at the renamed entry file:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Andy Tours Admin</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/renderer.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Verify it launches**

Run: `npm start --workspace=apps/admin`
Expected: an Electron window opens showing "Admin app scaffold running". Close the window to stop the process.

- [ ] **Step 8: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): scaffold Electron Forge + Vite + React admin app"
```

---

### Task 11: Electron main process — session store + backend HTTP client + IPC handlers

**Files:**
- Create: `apps/admin/src/main/session-store.ts`
- Create: `apps/admin/src/main/backend-client.ts`
- Modify: `apps/admin/src/main.ts`

**Interfaces:**
- Consumes: the backend's `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` (Tasks 6–8).
- Produces: IPC handlers `auth:login`, `auth:getSession`, `auth:logout` invoked by Task 12's preload bridge.

- [ ] **Step 1: Create `apps/admin/src/main/session-store.ts`**

```ts
import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

function sessionFilePath(): string {
  return join(app.getPath('userData'), 'session.bin');
}

export function saveRefreshToken(token: string): void {
  writeFileSync(sessionFilePath(), safeStorage.encryptString(token));
}

export function loadRefreshToken(): string | null {
  const path = sessionFilePath();
  if (!existsSync(path)) {
    return null;
  }
  return safeStorage.decryptString(readFileSync(path));
}

export function clearRefreshToken(): void {
  const path = sessionFilePath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
```

- [ ] **Step 2: Create `apps/admin/src/main/backend-client.ts`**

```ts
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export interface AdminSummary {
  id: string;
  email: string;
  name: string;
}

async function parseJsonOrThrow(res: Response): Promise<any> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || 'request failed');
  }
  return body;
}

export async function backendLogin(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow(res);
}

export async function backendRefresh(refreshToken: string): Promise<{ accessToken: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return parseJsonOrThrow(res);
}

export async function backendLogout(refreshToken: string): Promise<void> {
  await fetch(`${BACKEND_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function backendMe(accessToken: string): Promise<AdminSummary> {
  const res = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}
```

- [ ] **Step 3: Add IPC handlers to `apps/admin/src/main.ts`**

Add these imports at the top, alongside the generated ones:
```ts
import { ipcMain } from 'electron';
import { saveRefreshToken, loadRefreshToken, clearRefreshToken } from './main/session-store';
import { backendLogin, backendRefresh, backendLogout, backendMe } from './main/backend-client';
```

Add this block right before the generated `app.on('ready', createWindow);` line:
```ts
ipcMain.handle('auth:login', async (_event, email: string, password: string) => {
  const { accessToken, refreshToken } = await backendLogin(email, password);
  saveRefreshToken(refreshToken);
  const admin = await backendMe(accessToken);
  return { accessToken, admin };
});

ipcMain.handle('auth:getSession', async () => {
  const refreshToken = loadRefreshToken();
  if (!refreshToken) {
    return null;
  }
  try {
    const { accessToken } = await backendRefresh(refreshToken);
    const admin = await backendMe(accessToken);
    return { accessToken, admin };
  } catch {
    clearRefreshToken();
    return null;
  }
});

ipcMain.handle('auth:logout', async () => {
  const refreshToken = loadRefreshToken();
  if (refreshToken) {
    await backendLogout(refreshToken);
  }
  clearRefreshToken();
});
```

- [ ] **Step 4: Verify it still launches**

Run: `npm start --workspace=apps/admin`
Expected: the window still opens showing "Admin app scaffold running" (IPC handlers are registered but not yet called from the renderer — nothing should have changed visibly).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/main/session-store.ts apps/admin/src/main/backend-client.ts apps/admin/src/main.ts
git commit -m "feat(admin): main-process session store and backend auth client"
```

---

### Task 12: Preload bridge

**Files:**
- Modify: `apps/admin/src/preload.ts`
- Create: `apps/admin/src/renderer/window.d.ts`

**Interfaces:**
- Consumes: `auth:login`, `auth:getSession`, `auth:logout` IPC channels (Task 11).
- Produces: `window.authAPI.{login, getSession, logout}`, consumed by Task 13's `AuthContext`.

- [ ] **Step 1: Replace `apps/admin/src/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';

export interface AdminSummary {
  id: string;
  email: string;
  name: string;
}

export interface AdminSession {
  accessToken: string;
  admin: AdminSummary;
}

contextBridge.exposeInMainWorld('authAPI', {
  login: (email: string, password: string): Promise<AdminSession> =>
    ipcRenderer.invoke('auth:login', email, password),
  getSession: (): Promise<AdminSession | null> => ipcRenderer.invoke('auth:getSession'),
  logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
});
```

- [ ] **Step 2: Create `apps/admin/src/renderer/window.d.ts`**

```ts
import type { AdminSession } from '../preload';

declare global {
  interface Window {
    authAPI: {
      login: (email: string, password: string) => Promise<AdminSession>;
      getSession: () => Promise<AdminSession | null>;
      logout: () => Promise<void>;
    };
  }
}

export {};
```

- [ ] **Step 3: Verify the project still type-checks and launches**

Run: `npx tsc --noEmit -p apps/admin/tsconfig.json`
Expected: no errors.
Run: `npm start --workspace=apps/admin`
Expected: window still opens showing "Admin app scaffold running".

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/preload.ts apps/admin/src/renderer/window.d.ts
git commit -m "feat(admin): expose window.authAPI via preload contextBridge"
```

---

### Task 13: Renderer `AuthContext`

**Files:**
- Create: `apps/admin/src/renderer/AuthContext.tsx`

**Interfaces:**
- Consumes: `window.authAPI` (Task 12).
- Produces: `AuthProvider` and `useAuth(): { session, status, login, logout, error }`, consumed by Tasks 14 and 15.

- [ ] **Step 1: Create `apps/admin/src/renderer/AuthContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { AdminSession } from '../preload';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  session: AdminSession | null;
  status: Status;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.authAPI.getSession().then((restored) => {
      setSession(restored);
      setStatus(restored ? 'authenticated' : 'unauthenticated');
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await window.authAPI.login(email, password);
      setSession(result);
      setStatus('authenticated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await window.authAPI.logout();
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ session, status, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p apps/admin/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/renderer/AuthContext.tsx
git commit -m "feat(admin): AuthContext for session restore, login, and logout"
```

---

### Task 14: Login screen (neumorphic)

**Files:**
- Create: `apps/admin/src/renderer/screens/Login.tsx`
- Create: `apps/admin/src/renderer/screens/Login.css`

**Interfaces:**
- Consumes: `useAuth()` (Task 13).
- Produces: `LoginScreen`, consumed by Task 15's `App.tsx`.

- [ ] **Step 1: Create `apps/admin/src/renderer/screens/Login.css`**

```css
.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #e0e5ec;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 320px;
  padding: 2.5rem;
  border-radius: 24px;
  background: #e0e5ec;
  box-shadow: 9px 9px 16px #a3b1c6, -9px -9px 16px #ffffff;
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
}

.login-field input {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 12px;
  background: #e0e5ec;
  box-shadow: inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff;
  outline: none;
  font-size: 1rem;
}

.login-error {
  color: #b91c1c;
  font-size: 0.875rem;
  margin: 0;
}

.login-card button {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 12px;
  background: #e0e5ec;
  box-shadow: 6px 6px 12px #a3b1c6, -6px -6px 12px #ffffff;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}

.login-card button:active {
  box-shadow: inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff;
}

.login-card button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

This is a functional neumorphic baseline (soft-UI shadows, raised/inset elements). Invoke the `frontend-design` skill before shipping to refine spacing, typography, and polish beyond this baseline.

- [ ] **Step 2: Create `apps/admin/src/renderer/screens/Login.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { useAuth } from '../AuthContext';
import './Login.css';

export function LoginScreen() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // error is surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Andy Tours Admin</h1>
        <label className="login-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit -p apps/admin/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/renderer/screens/Login.tsx apps/admin/src/renderer/screens/Login.css
git commit -m "feat(admin): neumorphic Login screen"
```

---

### Task 15: Wire the boot flow + manual end-to-end verification

**Files:**
- Modify: `apps/admin/src/renderer/App.tsx`
- Test: manual verification (no automated test — Electron E2E is out of scope for this slice per the spec)

**Interfaces:**
- Consumes: `AuthProvider`/`useAuth` (Task 13), `LoginScreen` (Task 14).

- [ ] **Step 1: Replace `apps/admin/src/renderer/App.tsx`**

```tsx
import { AuthProvider, useAuth } from './AuthContext';
import { LoginScreen } from './screens/Login';

function AppShell() {
  const { status, session, logout } = useAuth();

  if (status === 'loading') {
    return <div>Loading…</div>;
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  return (
    <div>
      <p>Signed in as {session?.admin.name}</p>
      <button onClick={() => logout()}>Sign out</button>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Start the backend**

Run: `npm run dev --workspace=apps/backend`
Expected: logs `Backend listening on port 4000`. Leave this running.

- [ ] **Step 3: Start the admin app**

In a second terminal, run: `npm start --workspace=apps/admin`
Expected: an Electron window opens showing the neumorphic Login screen (not "Loading…", since there's no stored session yet).

- [ ] **Step 4: Verify the wrong-password path**

In the running app, enter the seeded admin's email (from Task 9) with an incorrect password and submit.
Expected: an inline error message appears on the Login screen; the app does not crash or navigate away.

- [ ] **Step 5: Verify the correct-login path**

Enter the seeded admin's real email and password and submit.
Expected: the screen changes to "Signed in as Andy" (or whichever `name` you seeded) with a "Sign out" button.

- [ ] **Step 6: Verify session restore across restarts**

Quit the Electron app entirely and run `npm start --workspace=apps/admin` again.
Expected: the app briefly shows "Loading…" then goes straight to the "Signed in as …" screen — no login form, because the encrypted refresh token on disk was used to silently restore the session.

- [ ] **Step 7: Verify sign-out**

Click "Sign out", then quit and relaunch the app.
Expected: after clicking "Sign out" the Login screen reappears immediately; after relaunch, the Login screen still appears (not the authenticated screen), confirming the stored refresh token was actually cleared.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/renderer/App.tsx
git commit -m "feat(admin): wire session-restore boot flow into App shell"
```

---
