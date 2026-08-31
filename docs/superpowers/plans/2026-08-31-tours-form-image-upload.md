# Tours: Form Layout Polish & Real Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `TourForm`'s "Image cover URL" text field with a real file picker that uploads to Supabase Storage, and fix the form's cramped single-column layout, per `docs/superpowers/specs/2026-08-31-tours-form-image-upload-design.md`.

**Architecture:** A new `POST /tours/upload-image` backend endpoint (multer in-memory upload → Supabase Storage → long-lived signed URL) is wired through the admin app's existing three-layer IPC pattern, mirroring `tours:create`. `TourForm` stages the picked file locally (instant preview, zero network calls) and only uploads it at submit time, immediately followed by the existing tour-creation call — this is what prevents orphaned uploads if the admin cancels. Independently, `.tour-form` becomes a 2-column CSS grid instead of a fixed-width single column.

**Tech Stack:** Express + Prisma + zod (existing backend stack) + `multer` + `@supabase/supabase-js` (new). React 19 + plain CSS (existing admin stack) — no new admin-side dependency, since Electron's main process has Node 18+'s built-in `fetch`/`FormData`/`Blob`.

## Global Constraints

- New backend dependencies: `@supabase/supabase-js`, `multer` (+ `@types/multer` dev dependency) — first use of both in this backend. Install via the workspace flag, e.g. `npm install @supabase/supabase-js --workspace=apps/backend`.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` already exist in `apps/backend/.env` (confirmed present, unused until now). Backend tests already rely on `.env` vars being present in `process.env` at test time (e.g. `DATABASE_URL` for the existing Prisma-backed tests) with no explicit `dotenv/config` import in test files — the same holds for these two vars.
- Storage bucket: `andy_booking` (private — signed URLs required, plain public URLs won't load). Upload path shape: `tours/<uuid>-<sanitized-filename>`. Signed URL expiry: 10 years (`10 * 365 * 24 * 60 * 60` seconds) — already-approved-in-spec tradeoff to avoid a schema change or a re-signing mechanism.
- Upload constraints: 5MB max file size, mimetypes limited to `image/jpeg`, `image/png`, `image/webp`, `image/gif` — enforced both client-side (instant rejection, nothing sent) and server-side (the source of truth).
- **Avoiding orphaned uploads:** picking a file only stages it locally (`URL.createObjectURL`, no network call). The actual upload only happens as the first step of submit, immediately followed by tour creation. Cancelling or closing the form before submit never touches the network, so nothing is ever orphaned in Storage.
- This backend has automated tests (`vitest` + `supertest`) that hit the real dev database and, per this same repo's "real DB, no mocks" philosophy, this plan's Storage tests hit the real `andy_booking` bucket too (cleaned up via `.remove()` in `afterAll`, using the already-available `SUPABASE_SECRET_KEY`).
- The admin/renderer app has **no automated tests** — established precedent (see the dark-mode, sidebar, and original tours-create-ui plans). Verification there is manual via the existing CDP driver script (`_tmp_drive.mjs`, repo root, untracked). This plan extends that script with one new `set-file` command (Task 5) — the script itself stays untracked and is not part of any commit.
- `main.ts`/`preload.ts` changes require restarting the Electron app (`npm start` from `apps/admin`) to take effect; renderer-only files hot-reload via Vite.
- IPC error propagation follows the existing convention: a failed IPC call's `{ status, error, details }` is JSON-stringified into the thrown `Error.message` end to end, then `JSON.parse`d back out on the renderer side (see `TourForm.tsx`'s existing error handling, generalized in Task 5 into a shared `handleRequestError`).
- Manual verification that successfully uploads an image and creates a tour leaves a real object in Storage and a real row in the dev database — accepted, consistent with this project's existing "real DB, no mocks" testing philosophy and the original tours-create-ui plan's identical acceptance for `POST /tours`.

---

### Task 1: Supabase Storage upload helper

**Files:**
- Modify: `apps/backend/package.json` (add `@supabase/supabase-js` dependency)
- Create: `apps/backend/src/lib/supabaseStorage.ts`
- Create: `apps/backend/test/supabaseStorage.test.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` env vars.
- Produces: `uploadTourImage(buffer: Buffer, filename: string, mimetype: string): Promise<string>`, consumed by Task 2's route handler.

- [ ] **Step 1: Install `@supabase/supabase-js`**

```bash
npm install @supabase/supabase-js --workspace=apps/backend
```

- [ ] **Step 2: Write the failing test — create `apps/backend/test/supabaseStorage.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { uploadTourImage } from '../src/lib/supabaseStorage';

const BUCKET = 'andy_booking';
const DB_HEAVY_TEST_TIMEOUT = 15000;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const uploadedPaths: string[] = [];

function extractStoragePath(signedUrl: string): string {
  const marker = `/object/sign/${BUCKET}/`;
  const idx = signedUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error(`unexpected signed url format: ${signedUrl}`);
  }
  return decodeURIComponent(signedUrl.slice(idx + marker.length).split('?')[0]);
}

afterAll(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
});

describe('uploadTourImage', () => {
  it(
    'uploads a buffer and returns a signed url that serves the same bytes back',
    async () => {
      const buffer = Buffer.from('fake-image-bytes-for-testing');

      const url = await uploadTourImage(buffer, 'Test Photo.jpg', 'image/jpeg');
      uploadedPaths.push(extractStoragePath(url));

      expect(url).toContain(BUCKET);

      const res = await fetch(url);
      expect(res.status).toBe(200);
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.equals(buffer)).toBe(true);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it(
    'sanitizes the filename into a lowercase path segment with no spaces',
    async () => {
      const buffer = Buffer.from('another-fake-image');

      const url = await uploadTourImage(buffer, 'Weird Name!!.PNG', 'image/png');
      const path = extractStoragePath(url);
      uploadedPaths.push(path);

      expect(path.startsWith('tours/')).toBe(true);
      expect(path.endsWith('.png')).toBe(true);
      expect(path).toBe(path.toLowerCase());
      expect(path).not.toMatch(/[ !]/);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace=apps/backend -- supabaseStorage`
Expected: FAIL — `Cannot find module '../src/lib/supabaseStorage'` (or equivalent "no exported member `uploadTourImage`").

- [ ] **Step 4: Implement `apps/backend/src/lib/supabaseStorage.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const BUCKET = 'andy_booking';
const SIGNED_URL_EXPIRY_SECONDS = 10 * 365 * 24 * 60 * 60;

function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'image';
}

export async function uploadTourImage(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  const path = `tours/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimetype });
  if (uploadError) {
    throw new Error(`failed to upload image: ${uploadError.message}`);
  }

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (signError || !data) {
    throw new Error(`failed to create signed url: ${signError?.message ?? 'unknown error'}`);
  }

  return data.signedUrl;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=apps/backend -- supabaseStorage`
Expected: PASS (2 tests) — this hits the real `andy_booking` bucket and cleans up after itself.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/package.json apps/backend/package-lock.json apps/backend/src/lib/supabaseStorage.ts apps/backend/test/supabaseStorage.test.ts
git commit -m "feat(backend): add Supabase Storage upload helper for tour images"
```

---

### Task 2: `POST /tours/upload-image` route

**Files:**
- Modify: `apps/backend/package.json` (add `multer` dependency, `@types/multer` dev dependency)
- Modify: `apps/backend/src/routes/tours.ts`
- Modify: `apps/backend/src/middleware/errorHandler.ts`
- Modify: `apps/backend/test/errorHandler.test.ts`
- Create: `apps/backend/test/tours.uploadImage.test.ts`

**Interfaces:**
- Consumes: `uploadTourImage` (Task 1).
- Produces: `POST /tours/upload-image` → `201 { url: string }` on success, `400 { error }` on a missing/oversized/wrong-type file. Consumed by Task 3's `backendUploadImage`.

- [ ] **Step 1: Install `multer`**

```bash
npm install multer --workspace=apps/backend
npm install -D @types/multer --workspace=apps/backend
```

- [ ] **Step 2: Write the failing tests**

Create `apps/backend/test/tours.uploadImage.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const BUCKET = 'andy_booking';
const DB_HEAVY_TEST_TIMEOUT = 15000;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const testEmail = `tours-upload-test-${Date.now()}@example.com`;
let adminId: string;
let accessToken: string;
const uploadedPaths: string[] = [];

function extractStoragePath(signedUrl: string): string {
  const marker = `/object/sign/${BUCKET}/`;
  const idx = signedUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error(`unexpected signed url format: ${signedUrl}`);
  }
  return decodeURIComponent(signedUrl.slice(idx + marker.length).split('?')[0]);
}

beforeAll(async () => {
  const admin = await prisma.admin.create({
    data: {
      email: testEmail,
      passwordHash: await hashPassword('correct-horse-battery-staple'),
      name: 'Upload Test Admin',
    },
  });
  adminId = admin.id;
  accessToken = signAccessToken({ adminId });
});

afterAll(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
  }
  await prisma.admin.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('POST /tours/upload-image', () => {
  it(
    'uploads a valid image and returns a signed url',
    async () => {
      const res = await request(app)
        .post('/tours/upload-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', Buffer.from('fake-jpeg-bytes'), { filename: 'cover.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(typeof res.body.url).toBe('string');
      uploadedPaths.push(extractStoragePath(res.body.url));
    },
    DB_HEAVY_TEST_TIMEOUT,
  );

  it('rejects a request with no authorization header', async () => {
    const res = await request(app)
      .post('/tours/upload-image')
      .attach('image', Buffer.from('fake-jpeg-bytes'), { filename: 'cover.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  it('rejects a request with no file attached', async () => {
    const res = await request(app).post('/tours/upload-image').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('image file is required');
  });

  it('rejects an unsupported mimetype', async () => {
    const res = await request(app)
      .post('/tours/upload-image')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('image', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported image type');
  });

  it(
    'rejects a file over the 5MB limit',
    async () => {
      const res = await request(app)
        .post('/tours/upload-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', Buffer.alloc(6 * 1024 * 1024), { filename: 'huge.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('image exceeds 5MB limit');
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
```

Add a second test to `apps/backend/test/errorHandler.test.ts` (replace the file's contents with):

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import multer from 'multer';
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

  it('responds with 400 and a size-limit message for an oversized upload', () => {
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'image exceeds 5MB limit' });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace=apps/backend -- tours.uploadImage errorHandler`
Expected: FAIL — `tours.uploadImage.test.ts` gets 404s (no such route), the new `errorHandler` case gets `500`/generic message instead of `400`/size-limit message.

- [ ] **Step 4: Add the route — replace `apps/backend/src/routes/tours.ts` contents with**

```ts
import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { createTourSchema } from './tours.schema';
import { generateUniqueSlug } from '../lib/slug';
import { uploadTourImage } from '../lib/supabaseStorage';

export const toursRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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

toursRouter.post('/upload-image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'image file is required' });
      return;
    }
    if (!ALLOWED_IMAGE_MIMETYPES.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'unsupported image type' });
      return;
    }

    const url = await uploadTourImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Add `MulterError` handling — replace `apps/backend/src/middleware/errorHandler.ts` contents with**

```ts
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'image exceeds 5MB limit' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test --workspace=apps/backend -- tours.uploadImage errorHandler`
Expected: PASS (5 + 2 tests) — the upload tests hit the real `andy_booking` bucket and clean up after themselves.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/package.json apps/backend/package-lock.json apps/backend/src/routes/tours.ts apps/backend/src/middleware/errorHandler.ts apps/backend/test/tours.uploadImage.test.ts apps/backend/test/errorHandler.test.ts
git commit -m "feat(backend): add POST /tours/upload-image endpoint"
```

---

### Task 3: Wire `tours:upload-image` through the IPC bridge

**Files:**
- Modify: `apps/admin/src/preload.ts`
- Modify: `apps/admin/src/main/backend-client.ts`
- Modify: `apps/admin/src/main.ts`
- Modify: `apps/admin/src/renderer/window.d.ts`

**Interfaces:**
- Consumes: `POST /tours/upload-image` (Task 2).
- Produces: `window.toursAPI.uploadImage(fileBase64: string, filename: string, mimetype: string, accessToken: string): Promise<{ url: string }>` (global), `backendUploadImage` in `backend-client.ts`. Consumed by Task 5's `TourForm`.

- [ ] **Step 1: Add `uploadImage` to `apps/admin/src/preload.ts` — replace the file's contents with**

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

export interface CreateTourPayload {
  title: string;
  description: string;
  price: number;
  imageCover: string;
  summary?: string;
  duration?: number;
  maxGroupSize?: number;
  difficulty?: 'easy' | 'medium' | 'difficult';
  priceDiscount?: number;
  startLocation?: string;
  isActive?: boolean;
}

export interface UploadImageResult {
  url: string;
}

contextBridge.exposeInMainWorld('authAPI', {
  login: (email: string, password: string): Promise<AdminSession> =>
    ipcRenderer.invoke('auth:login', email, password),
  getSession: (): Promise<AdminSession | null> => ipcRenderer.invoke('auth:getSession'),
  logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
});

contextBridge.exposeInMainWorld('toursAPI', {
  create: (payload: CreateTourPayload, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('tours:create', payload, accessToken),
  uploadImage: (
    fileBase64: string,
    filename: string,
    mimetype: string,
    accessToken: string,
  ): Promise<UploadImageResult> =>
    ipcRenderer.invoke('tours:upload-image', fileBase64, filename, mimetype, accessToken),
});
```

- [ ] **Step 2: Add `backendUploadImage` to `apps/admin/src/main/backend-client.ts`**

Change the import line at the top of the file:

```ts
import type { CreateTourPayload, UploadImageResult } from '../preload';
```

Add this function at the end of the file:

```ts
export async function backendUploadImage(
  fileBase64: string,
  filename: string,
  mimetype: string,
  accessToken: string,
): Promise<UploadImageResult> {
  const buffer = Buffer.from(fileBase64, 'base64');
  const formData = new FormData();
  formData.append('image', new Blob([buffer], { type: mimetype }), filename);

  const res = await fetch(`${BACKEND_URL}/tours/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}
```

- [ ] **Step 3: Register the `tours:upload-image` IPC handler in `apps/admin/src/main.ts`**

Change the import line:

```ts
import { backendLogin, backendRefresh, backendLogout, backendMe, backendCreateTour, backendUploadImage } from './main/backend-client';
```

Add this handler after the existing `tours:create` handler (before the `app.on('ready', ...)` line):

```ts
ipcMain.handle('tours:upload-image', async (_event, fileBase64, filename, mimetype, accessToken) => {
  try {
    return await backendUploadImage(fileBase64, filename, mimetype, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'upload failed');
  }
});
```

- [ ] **Step 4: Add `uploadImage` typing to `apps/admin/src/renderer/window.d.ts` — replace the file's contents with**

```ts
import type { AdminSession, CreateTourPayload, UploadImageResult } from '../preload';

declare global {
  interface Window {
    authAPI: {
      login: (email: string, password: string) => Promise<AdminSession>;
      getSession: () => Promise<AdminSession | null>;
      logout: () => Promise<void>;
    };
    toursAPI: {
      create: (payload: CreateTourPayload, accessToken: string) => Promise<unknown>;
      uploadImage: (
        fileBase64: string,
        filename: string,
        mimetype: string,
        accessToken: string,
      ) => Promise<UploadImageResult>;
    };
  }
}

export {};
```

- [ ] **Step 5: Restart the Electron app**

`main.ts` and `preload.ts` changed. Stop the running `npm start` process (from `apps/admin`) and start it again with `npm start -- -- --remote-debugging-port=9223`.

- [ ] **Step 6: Manually verify the IPC wiring end-to-end**

Confirm there's a logged-in session first (log in through the app's UI if `getSession()` below resolves `null`), then:

```bash
node _tmp_drive.mjs eval "window.authAPI.getSession().then(s => window.toursAPI.uploadImage('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'verify.png', 'image/png', s.accessToken))"
```

Expected: a JSON object printed with a `"url"` key whose value contains `andy_booking` and `/tours/` — confirming the full renderer → main process → backend → Supabase Storage round trip works. (This creates a real object in the dev Storage bucket — see Global Constraints.)

```bash
node _tmp_drive.mjs eval "window.authAPI.getSession().then(s => window.toursAPI.uploadImage('not-base64-image-data', 'bad.txt', 'text/plain', s.accessToken)).catch(e => e.message)"
```

Expected: a JSON string containing `"status":400` and `"error":"unsupported image type"` — confirming a server-side rejection survives the IPC round trip.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/preload.ts apps/admin/src/main/backend-client.ts apps/admin/src/main.ts apps/admin/src/renderer/window.d.ts
git commit -m "feat(admin): wire tours:upload-image through the IPC bridge"
```

---

### Task 4: `TourForm` layout polish — grid, spinner removal, placeholders

**Files:**
- Modify: `apps/admin/src/renderer/screens/tours/TourForm.tsx`
- Modify: `apps/admin/src/renderer/screens/tours/Tours.css`

**Interfaces:**
- Consumes: nothing new — pure CSS/JSX polish of the existing `TourForm`.
- Produces: `.tour-field-full` CSS class and the 2-column grid layout, reused by Task 5's image section.

- [ ] **Step 1: Replace `apps/admin/src/renderer/screens/tours/Tours.css` contents with**

```css
.tours {
  position: relative;
  overflow: hidden;
  height: 100%;
  padding: 2rem;
  box-sizing: border-box;
}

.tours-idle h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem;
  color: var(--color-text-heading);
}

.tours-empty {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 1.5rem;
}

.tours-panel {
  position: absolute;
  inset: 0;
  padding: 2rem;
  box-sizing: border-box;
  background: var(--color-bg);
  transform: translateX(-100%);
  transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
  pointer-events: none;
}

.tours-panel-open {
  transform: translateX(0);
  transition-duration: 280ms;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .tours-panel {
    transform: none;
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .tours-panel-open {
    opacity: 1;
  }
}

.tour-form {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem 1.5rem;
  padding: 0 2rem;
  height: 100%;
  overflow-y: auto;
}

.tour-form h2 {
  grid-column: 1 / -1;
  font-family: var(--font-display);
  font-size: 1.5rem;
  letter-spacing: 0.05em;
  margin: 0;
  color: var(--color-text-heading);
}

.tour-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.tour-field-full {
  grid-column: 1 / -1;
}

.tour-field input,
.tour-field textarea,
.tour-field select {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 12px;
  background: var(--color-bg);
  box-shadow: inset 4px 4px 8px var(--color-shadow-dark), inset -4px -4px 8px var(--color-shadow-light);
  outline: none;
  font-size: 1rem;
  font-family: var(--font-body);
  color: var(--color-text-heading);
}

.tour-field textarea {
  min-height: 5rem;
  resize: vertical;
}

.tour-field input[type='number']::-webkit-inner-spin-button,
.tour-field input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.tour-field input[type='number'] {
  -moz-appearance: textfield;
}

.tour-field-checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.tour-field-error {
  color: var(--color-error);
  font-size: 0.75rem;
  margin: 0;
}

.tour-form-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
```

- [ ] **Step 2: Replace `apps/admin/src/renderer/screens/tours/TourForm.tsx` contents with**

```tsx
import { FormEvent, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import type { CreateTourPayload } from '../../../preload';

interface TourFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

interface FormState {
  title: string;
  description: string;
  price: string;
  imageCover: string;
  summary: string;
  duration: string;
  maxGroupSize: string;
  difficulty: '' | 'easy' | 'medium' | 'difficult';
  priceDiscount: string;
  startLocation: string;
  isActive: boolean;
}

const INITIAL_STATE: FormState = {
  title: '',
  description: '',
  price: '',
  imageCover: '',
  summary: '',
  duration: '',
  maxGroupSize: '',
  difficulty: '',
  priceDiscount: '',
  startLocation: '',
  isActive: true,
};

function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

export function TourForm({ onCancel, onCreated }: TourFormProps) {
  const { session } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCancel() {
    setForm(INITIAL_STATE);
    setFieldErrors({});
    onCancel();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setSubmitting(true);
    setFieldErrors({});

    const payload: CreateTourPayload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      imageCover: form.imageCover,
      isActive: form.isActive,
    };
    if (form.summary) payload.summary = form.summary;
    if (form.duration) payload.duration = Number(form.duration);
    if (form.maxGroupSize) payload.maxGroupSize = Number(form.maxGroupSize);
    if (form.difficulty) payload.difficulty = form.difficulty;
    if (form.priceDiscount) payload.priceDiscount = Number(form.priceDiscount);
    if (form.startLocation) payload.startLocation = form.startLocation;

    try {
      await window.toursAPI.create(payload, session.accessToken);
      toast.success('Tour created.');
      setForm(INITIAL_STATE);
      onCreated();
    } catch (err) {
      const raw = err instanceof Error ? cleanIpcErrorMessage(err.message) : 'create failed';
      try {
        const parsed = JSON.parse(raw) as {
          status?: number;
          error?: string;
          details?: Record<string, string[]>;
        };
        if (parsed.status === 401) {
          toast.error('Session expired, please log in again.');
        } else if (parsed.details) {
          const flat: Record<string, string> = {};
          for (const [field, messages] of Object.entries(parsed.details)) {
            if (messages?.[0]) {
              flat[field] = messages[0];
            }
          }
          setFieldErrors(flat);
        } else {
          toast.error(parsed.error || 'Could not create tour.');
        }
      } catch {
        toast.error(raw || 'Could not create tour.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tour-form" onSubmit={handleSubmit}>
      <h2>New Tour</h2>

      <label className="tour-field tour-field-full">
        <span>Title</span>
        <input
          name="title"
          placeholder="e.g. Sunset Kayak Tour"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          required
        />
        {fieldErrors.title && <p className="tour-field-error">{fieldErrors.title}</p>}
      </label>

      <label className="tour-field tour-field-full">
        <span>Description</span>
        <textarea
          name="description"
          placeholder="Describe what makes this tour worth booking..."
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          required
        />
        {fieldErrors.description && <p className="tour-field-error">{fieldErrors.description}</p>}
      </label>

      <label className="tour-field">
        <span>Summary</span>
        <input
          name="summary"
          placeholder="A short one-line summary for listings"
          value={form.summary}
          onChange={(e) => update('summary', e.target.value)}
        />
      </label>

      <label className="tour-field">
        <span>Price</span>
        <input
          name="price"
          type="number"
          placeholder="0.00"
          value={form.price}
          onChange={(e) => update('price', e.target.value)}
          required
        />
        {fieldErrors.price && <p className="tour-field-error">{fieldErrors.price}</p>}
      </label>

      <label className="tour-field">
        <span>Price discount</span>
        <input
          name="priceDiscount"
          type="number"
          placeholder="Optional discounted price"
          value={form.priceDiscount}
          onChange={(e) => update('priceDiscount', e.target.value)}
        />
        {fieldErrors.priceDiscount && <p className="tour-field-error">{fieldErrors.priceDiscount}</p>}
      </label>

      <label className="tour-field">
        <span>Duration (days)</span>
        <input
          name="duration"
          type="number"
          placeholder="e.g. 5"
          value={form.duration}
          onChange={(e) => update('duration', e.target.value)}
        />
        {fieldErrors.duration && <p className="tour-field-error">{fieldErrors.duration}</p>}
      </label>

      <label className="tour-field">
        <span>Max group size</span>
        <input
          name="maxGroupSize"
          type="number"
          placeholder="e.g. 12"
          value={form.maxGroupSize}
          onChange={(e) => update('maxGroupSize', e.target.value)}
        />
        {fieldErrors.maxGroupSize && <p className="tour-field-error">{fieldErrors.maxGroupSize}</p>}
      </label>

      <label className="tour-field">
        <span>Difficulty</span>
        <select
          name="difficulty"
          value={form.difficulty}
          onChange={(e) => update('difficulty', e.target.value as FormState['difficulty'])}
        >
          <option value="">—</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="difficult">Difficult</option>
        </select>
      </label>

      <label className="tour-field tour-field-full">
        <span>Image cover URL</span>
        <input
          name="imageCover"
          value={form.imageCover}
          onChange={(e) => update('imageCover', e.target.value)}
          required
        />
        {fieldErrors.imageCover && <p className="tour-field-error">{fieldErrors.imageCover}</p>}
      </label>

      <label className="tour-field tour-field-full">
        <span>Start location</span>
        <input
          name="startLocation"
          placeholder="e.g. Bali, Indonesia"
          value={form.startLocation}
          onChange={(e) => update('startLocation', e.target.value)}
        />
      </label>

      <label className="tour-field tour-field-checkbox tour-field-full">
        <input
          name="isActive"
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => update('isActive', e.target.checked)}
        />
        <span>Active</span>
      </label>

      <div className="tour-form-actions">
        <button type="button" className="neumorphic-button" onClick={handleCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="neumorphic-button" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Tour'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Manually verify the layout in light and dark mode**

Renderer-only changes — no restart needed, Vite HMR applies them live.

```bash
node _tmp_drive.mjs click "[data-view=tours]"
node _tmp_drive.mjs click-text "New Tour"
node _tmp_drive.mjs shot t4-layout-light
```

Expected: Summary+Price share a row, Price discount+Duration share the next row, Max group size+Difficulty share the row after that; Title, Description, Image cover URL, Start location, the Active checkbox, and the Cancel/Create Tour buttons each span the full width; every text/number field shows its placeholder text; no spinner arrows on any number input.

```bash
node _tmp_drive.mjs eval "document.documentElement.dataset.theme = 'dark'"
node _tmp_drive.mjs shot t4-layout-dark
node _tmp_drive.mjs eval "document.documentElement.dataset.theme = 'light'"
node _tmp_drive.mjs click-text "Cancel"
node _tmp_drive.mjs click "[data-view=dashboard]"
```

Expected: the same grid layout re-themed correctly in dark mode — nothing hardcoded to the light palette. The last two commands reset the app (form closed, back on Dashboard) for future work.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/renderer/screens/tours/TourForm.tsx apps/admin/src/renderer/screens/tours/Tours.css
git commit -m "feat(admin): tours form 2-column grid layout and input placeholders"
```

---

### Task 5: `TourForm` real image upload

**Files:**
- Modify: `apps/admin/src/renderer/screens/tours/TourForm.tsx`
- Modify: `apps/admin/src/renderer/screens/tours/Tours.css`
- Modify (untracked, not committed): `_tmp_drive.mjs` (repo root) — adds a `set-file` command

**Interfaces:**
- Consumes: `window.toursAPI.uploadImage` (Task 3), `.tour-field-full` (Task 4).
- Produces: final `TourForm` — no further consumers within this plan.

- [ ] **Step 1: Replace `apps/admin/src/renderer/screens/tours/TourForm.tsx` contents with**

```tsx
import { ChangeEvent, FormEvent, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import type { CreateTourPayload } from '../../../preload';

interface TourFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

interface FormState {
  title: string;
  description: string;
  price: string;
  summary: string;
  duration: string;
  maxGroupSize: string;
  difficulty: '' | 'easy' | 'medium' | 'difficult';
  priceDiscount: string;
  startLocation: string;
  isActive: boolean;
}

const INITIAL_STATE: FormState = {
  title: '',
  description: '',
  price: '',
  summary: '',
  duration: '',
  maxGroupSize: '',
  difficulty: '',
  priceDiscount: '',
  startLocation: '',
  isActive: true,
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function TourForm({ onCancel, onCreated }: TourFormProps) {
  const { session } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetImage() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl('');
    setImageError('');
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Unsupported file type. Use JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image exceeds 5MB limit.');
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageError('');
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleCancel() {
    setForm(INITIAL_STATE);
    setFieldErrors({});
    resetImage();
    onCancel();
  }

  function handleRequestError(err: unknown) {
    const raw = err instanceof Error ? cleanIpcErrorMessage(err.message) : 'request failed';
    try {
      const parsed = JSON.parse(raw) as {
        status?: number;
        error?: string;
        details?: Record<string, string[]>;
      };
      if (parsed.status === 401) {
        toast.error('Session expired, please log in again.');
      } else if (parsed.details) {
        const flat: Record<string, string> = {};
        for (const [field, messages] of Object.entries(parsed.details)) {
          if (messages?.[0]) {
            flat[field] = messages[0];
          }
        }
        setFieldErrors(flat);
      } else {
        toast.error(parsed.error || 'Could not complete request.');
      }
    } catch {
      toast.error(raw || 'Could not complete request.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session || !imageFile) {
      return;
    }
    setSubmitting(true);
    setFieldErrors({});

    try {
      const base64 = await fileToBase64(imageFile);
      const { url } = await window.toursAPI.uploadImage(base64, imageFile.name, imageFile.type, session.accessToken);

      const payload: CreateTourPayload = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        imageCover: url,
        isActive: form.isActive,
      };
      if (form.summary) payload.summary = form.summary;
      if (form.duration) payload.duration = Number(form.duration);
      if (form.maxGroupSize) payload.maxGroupSize = Number(form.maxGroupSize);
      if (form.difficulty) payload.difficulty = form.difficulty;
      if (form.priceDiscount) payload.priceDiscount = Number(form.priceDiscount);
      if (form.startLocation) payload.startLocation = form.startLocation;

      await window.toursAPI.create(payload, session.accessToken);
      toast.success('Tour created.');
      setForm(INITIAL_STATE);
      resetImage();
      onCreated();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tour-form" onSubmit={handleSubmit}>
      <h2>New Tour</h2>

      <label className="tour-field tour-field-full">
        <span>Title</span>
        <input
          name="title"
          placeholder="e.g. Sunset Kayak Tour"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          required
        />
        {fieldErrors.title && <p className="tour-field-error">{fieldErrors.title}</p>}
      </label>

      <label className="tour-field tour-field-full">
        <span>Description</span>
        <textarea
          name="description"
          placeholder="Describe what makes this tour worth booking..."
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          required
        />
        {fieldErrors.description && <p className="tour-field-error">{fieldErrors.description}</p>}
      </label>

      <label className="tour-field">
        <span>Summary</span>
        <input
          name="summary"
          placeholder="A short one-line summary for listings"
          value={form.summary}
          onChange={(e) => update('summary', e.target.value)}
        />
      </label>

      <label className="tour-field">
        <span>Price</span>
        <input
          name="price"
          type="number"
          placeholder="0.00"
          value={form.price}
          onChange={(e) => update('price', e.target.value)}
          required
        />
        {fieldErrors.price && <p className="tour-field-error">{fieldErrors.price}</p>}
      </label>

      <label className="tour-field">
        <span>Price discount</span>
        <input
          name="priceDiscount"
          type="number"
          placeholder="Optional discounted price"
          value={form.priceDiscount}
          onChange={(e) => update('priceDiscount', e.target.value)}
        />
        {fieldErrors.priceDiscount && <p className="tour-field-error">{fieldErrors.priceDiscount}</p>}
      </label>

      <label className="tour-field">
        <span>Duration (days)</span>
        <input
          name="duration"
          type="number"
          placeholder="e.g. 5"
          value={form.duration}
          onChange={(e) => update('duration', e.target.value)}
        />
        {fieldErrors.duration && <p className="tour-field-error">{fieldErrors.duration}</p>}
      </label>

      <label className="tour-field">
        <span>Max group size</span>
        <input
          name="maxGroupSize"
          type="number"
          placeholder="e.g. 12"
          value={form.maxGroupSize}
          onChange={(e) => update('maxGroupSize', e.target.value)}
        />
        {fieldErrors.maxGroupSize && <p className="tour-field-error">{fieldErrors.maxGroupSize}</p>}
      </label>

      <label className="tour-field">
        <span>Difficulty</span>
        <select
          name="difficulty"
          value={form.difficulty}
          onChange={(e) => update('difficulty', e.target.value as FormState['difficulty'])}
        >
          <option value="">—</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="difficult">Difficult</option>
        </select>
      </label>

      <label className="tour-field tour-field-full">
        <span>Cover image</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageChange} />
        {imagePreviewUrl && <img className="tour-image-preview" src={imagePreviewUrl} alt="Cover preview" />}
        {imageError && <p className="tour-field-error">{imageError}</p>}
      </label>

      <label className="tour-field tour-field-full">
        <span>Start location</span>
        <input
          name="startLocation"
          placeholder="e.g. Bali, Indonesia"
          value={form.startLocation}
          onChange={(e) => update('startLocation', e.target.value)}
        />
      </label>

      <label className="tour-field tour-field-checkbox tour-field-full">
        <input
          name="isActive"
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => update('isActive', e.target.checked)}
        />
        <span>Active</span>
      </label>

      <div className="tour-form-actions">
        <button type="button" className="neumorphic-button" onClick={handleCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="neumorphic-button" disabled={submitting || !imageFile}>
          {submitting ? 'Creating…' : 'Create Tour'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Add preview image styling — append to `apps/admin/src/renderer/screens/tours/Tours.css`**

```css
.tour-image-preview {
  width: 160px;
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 4px 4px 8px var(--color-shadow-dark), -4px -4px 8px var(--color-shadow-light);
}
```

- [ ] **Step 3: Add a `set-file` command to `_tmp_drive.mjs` (repo root, untracked)**

Find this block:

```js
    case 'scroll-bottom': {
```

Insert immediately before it:

```js
    case 'set-file': {
      const sel = process.argv[3];
      const filePath = process.argv[4];
      await page.setInputFiles(sel, filePath);
      console.log('set-file', sel, '→', filePath);
      break;
    }
    case 'scroll-bottom': {
```

- [ ] **Step 4: Manually verify the full image-upload flow**

Renderer-only changes — no restart needed. First generate three test fixtures (replace `<SCRATCHPAD>` with this session's scratchpad directory):

```bash
node -e "require('fs').writeFileSync('<SCRATCHPAD>/test-cover.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))"
node -e "require('fs').writeFileSync('<SCRATCHPAD>/test-huge.jpg', Buffer.alloc(6 * 1024 * 1024))"
node -e "require('fs').writeFileSync('<SCRATCHPAD>/test-notes.txt', 'not an image')"
```

Check the current object count in the `tours/` folder of the bucket (baseline for the orphan check below):

```bash
(cd apps/backend && node -e "require('dotenv/config'); const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY); supabase.storage.from('andy_booking').list('tours').then(({ data }) => console.log('object count:', data.length));")
```

Open the form and pick a valid image — confirm an instant local preview with no network call:

```bash
node _tmp_drive.mjs click "[data-view=tours]"
node _tmp_drive.mjs click-text "New Tour"
node _tmp_drive.mjs set-file "input[type=file]" "<SCRATCHPAD>/test-cover.png"
node _tmp_drive.mjs shot t5-preview
```

Expected: a `.tour-image-preview` thumbnail is visible, no toast appears, no field error appears (the preview rendering with zero toasts/errors is the observable proxy that nothing was sent over the network yet — the driver script can't inspect main-process IPC traffic directly). Re-run the object-count command above — it must still equal the baseline.

Cancel and confirm nothing was uploaded:

```bash
node _tmp_drive.mjs click-text "Cancel"
```

Re-run the object-count command — still equals the baseline, confirming cancelling after picking a file never touches the network.

Reopen the form, fill the required text fields, pick the valid image again, and submit:

```bash
node _tmp_drive.mjs click-text "New Tour"
node _tmp_drive.mjs eval "(() => { function setVal(sel, val) { const el = document.querySelector(sel); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); } setVal('[name=title]', 'Sunset Kayak Tour'); setVal('[name=description]', 'A guided sunset kayaking trip along the coast.'); setVal('[name=price]', '89.5'); return 'filled'; })()"
node _tmp_drive.mjs set-file "input[type=file]" "<SCRATCHPAD>/test-cover.png"
node _tmp_drive.mjs click-text "Create Tour"
node _tmp_drive.mjs shot t5-success
```

Expected: a "Tour created." toast appears bottom-right, the panel slides back to the idle view. Re-run the object-count command — it must now be baseline + 1. (This leaves a real object in Storage and a real row in the dev database — accepted, see Global Constraints.)

Verify client-side rejection of an oversized file:

```bash
node _tmp_drive.mjs click-text "New Tour"
node _tmp_drive.mjs set-file "input[type=file]" "<SCRATCHPAD>/test-huge.jpg"
node _tmp_drive.mjs shot t5-oversized
```

Expected: an inline "Image exceeds 5MB limit." error under the Cover image field, no preview shown, the Create Tour button stays disabled. Object count unchanged.

Verify client-side rejection of a wrong-type file:

```bash
node _tmp_drive.mjs set-file "input[type=file]" "<SCRATCHPAD>/test-notes.txt"
node _tmp_drive.mjs shot t5-wrongtype
```

Expected: an inline "Unsupported file type. Use JPEG, PNG, WebP, or GIF." error, no preview shown, Create Tour still disabled. Object count unchanged.

Finally, reset the app to a normal state:

```bash
node _tmp_drive.mjs click-text "Cancel"
node _tmp_drive.mjs click "[data-view=dashboard]"
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/renderer/screens/tours/TourForm.tsx apps/admin/src/renderer/screens/tours/Tours.css
git commit -m "feat(admin): real image upload for TourForm"
```
