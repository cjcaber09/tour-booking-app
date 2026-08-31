# Tours: Create UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Tours tab's `ComingSoon` placeholder with a real screen that creates a tour via the existing `POST /tours` backend endpoint, per `docs/superpowers/specs/2026-08-31-tours-create-ui-design.md`.

**Architecture:** A `Tours` screen toggles between an idle state and a form state, the form sliding in via a CSS-transition-driven panel (no backdrop, no new modal primitive). The create call is routed through this app's existing three-layer IPC pattern (`main/backend-client.ts` → `main.ts` → `preload.ts`/`window.d.ts`), the same path `auth:login` already uses. A small toast module (plain TS, no Context) surfaces success/error feedback from anywhere in the app.

**Tech Stack:** React 19, TypeScript, plain CSS transitions (no animation library) — matching the rest of this admin app.

## Global Constraints

- No React Context for toasts — `toast.ts` is a plain module (`toast.success`, `toast.error`, `subscribeToasts`), matching `theme.ts`'s existing precedent in this app.
- The slide panel has no backdrop/dimming — it's an in-place content panel, not a modal; the sidebar stays fully interactive while it's open.
- The v1 form covers only: `title`, `description`, `price`, `imageCover` (required), `summary`, `duration`, `maxGroupSize`, `difficulty`, `priceDiscount`, `startLocation`, `isActive` (optional). No `images[]`, `startDates[]`, or `categoryIds` — deferred (see design spec).
- No tours list view. After a successful create, the screen returns to its idle state — nothing is persisted/displayed beyond that.
- Panel animation: `transform: translateX(-100%)` (closed) → `translateX(0)` (open), `cubic-bezier(0.23, 1, 0.32, 1)`, 280ms opening / 180ms closing, `prefers-reduced-motion` respected (opacity-only fallback). Buttons keep the existing neumorphic inset-shadow `:active` state — no added `scale()`.
- Toasts: bottom-right stack, auto-dismiss after 4000ms, `success`/`error` variants, exit via a real CSS transition (not an instant unmount) at 200ms.
- IPC error propagation: Electron's `ipcMain.handle`/`ipcRenderer.invoke` boundary only reliably carries a string (`Error.message`) — confirmed by `AuthContext.tsx`'s existing `cleanIpcErrorMessage`. A failed response's `{ status, error, details }` is JSON-stringified into that message string end to end and `JSON.parse`d back out on the renderer side (`status` distinguishes a `401` — shown as a friendly "session expired" toast — from a `400`'s field errors or any other failure).
- `main.ts`/`preload.ts` changes require restarting the Electron app (`npm start` from `apps/admin`) to take effect — unlike renderer-only files, which hot-reload via Vite. The rest of this app's "don't restart the running app" convention applies only to renderer-only changes.
- No automated tests for this UI — established precedent for this app (see the dark-mode and sidebar plans). Verification is manual via the existing CDP driver script (`_tmp_drive.mjs`, repo root, untracked).
- Manual verification steps that successfully create a tour leave a real row in the dev database — there's no `DELETE /tours` endpoint to clean it up with. This is acceptable for the project's dev database and consistent with this project's "real DB, no mocks" testing philosophy elsewhere.

---

### Task 1: Tours screen shell with slide-in panel

**Files:**
- Create: `apps/admin/src/renderer/screens/tours/Tours.tsx`
- Create: `apps/admin/src/renderer/screens/tours/Tours.css`
- Modify: `apps/admin/src/renderer/layout/AppLayout.tsx`

**Interfaces:**
- Produces: `Tours` component (named export), rendered by `AppLayout.tsx` when `activeView === 'tours'`. Produces the `.tours`, `.tours-idle`, `.tours-panel`, `.tours-panel-open` CSS classes that Task 4 will attach the real form to (replacing this task's placeholder panel content).

- [ ] **Step 1: Create `apps/admin/src/renderer/screens/tours/Tours.css`**

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
```

- [ ] **Step 2: Create `apps/admin/src/renderer/screens/tours/Tours.tsx`**

```tsx
import { useState } from 'react';
import './Tours.css';

type Mode = 'idle' | 'form';

export function Tours() {
  const [mode, setMode] = useState<Mode>('idle');

  return (
    <div className="tours">
      <div className="tours-idle">
        <h1>Tours</h1>
        <p className="tours-empty">No tours created yet.</p>
        <button className="neumorphic-button" onClick={() => setMode('form')}>
          New Tour
        </button>
      </div>

      <div className={`tours-panel ${mode === 'form' ? 'tours-panel-open' : ''}`}>
        <button className="neumorphic-button" onClick={() => setMode('idle')}>
          Cancel
        </button>
      </div>
    </div>
  );
}
```

(The panel's body is a placeholder "Cancel" button for now — Task 4 replaces it with the real `TourForm`. Keeping the panel always mounted, toggling only the `tours-panel-open` class, is what makes the CSS `transition` animate both opening and closing; conditionally rendering it would skip the closing animation entirely.)

- [ ] **Step 3: Wire `Tours` into `AppLayout.tsx`**

Modify `apps/admin/src/renderer/layout/AppLayout.tsx`:

```tsx
import { useState } from 'react';
import { Sidebar, type View } from './Sidebar';
import { Dashboard } from '../screens/Dashboard';
import { Settings } from '../screens/settings/Settings';
import { Tours } from '../screens/tours/Tours';
import { ComingSoon } from '../screens/ComingSoon';
import './AppLayout.css';

const SIDEBAR_COLLAPSED_KEY = 'admin.sidebarCollapsed';

function renderContent(activeView: View) {
  switch (activeView) {
    case 'dashboard':
      return <Dashboard />;
    case 'settings':
      return <Settings />;
    case 'tours':
      return <Tours />;
    case 'bookings':
      return <ComingSoon title="Bookings" />;
    case 'users':
      return <ComingSoon title="Users" />;
  }
}

export function AppLayout() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <main className="app-layout-content">{renderContent(activeView)}</main>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify the slide panel**

The admin Electron app should already be running (`npm start -- -- --remote-debugging-port=9223` from `apps/admin`, Vite HMR live) — these are renderer-only changes so far, no restart needed.

```bash
node _tmp_drive.mjs click "[data-view=tours]"
node _tmp_drive.mjs shot t1-tours-idle
```
Expected: a "Tours" heading, "No tours created yet." text, and a "New Tour" button — no leftover `ComingSoon` text.

```bash
node _tmp_drive.mjs click-text "New Tour"
node _tmp_drive.mjs shot t1-tours-form-open
```
Expected: the panel has slid in from the left, fully covering the idle view, showing just the "Cancel" button.

```bash
node _tmp_drive.mjs click-text "Cancel"
node _tmp_drive.mjs shot t1-tours-form-closed
```
Expected: the panel slides back out to the left; the idle view ("New Tour" button) is visible again.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/renderer/screens/tours apps/admin/src/renderer/layout/AppLayout.tsx
git commit -m "feat(admin): Tours screen shell with slide-in panel"
```

---

### Task 2: Wire `tours:create` through the IPC bridge

**Files:**
- Modify: `apps/admin/src/main/backend-client.ts`
- Modify: `apps/admin/src/main.ts`
- Modify: `apps/admin/src/preload.ts`
- Modify: `apps/admin/src/renderer/window.d.ts`

**Interfaces:**
- Produces: `CreateTourPayload` interface (in `preload.ts`), `backendCreateTour(payload: CreateTourPayload, accessToken: string): Promise<unknown>` (in `backend-client.ts`), `window.toursAPI.create(payload: CreateTourPayload, accessToken: string): Promise<unknown>` (global, via `contextBridge` + `window.d.ts`). Consumed by Task 4's `TourForm`.

- [ ] **Step 1: Add `CreateTourPayload` and `toursAPI` to `apps/admin/src/preload.ts`**

Replace the file's contents with:

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

contextBridge.exposeInMainWorld('authAPI', {
  login: (email: string, password: string): Promise<AdminSession> =>
    ipcRenderer.invoke('auth:login', email, password),
  getSession: (): Promise<AdminSession | null> => ipcRenderer.invoke('auth:getSession'),
  logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
});

contextBridge.exposeInMainWorld('toursAPI', {
  create: (payload: CreateTourPayload, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('tours:create', payload, accessToken),
});
```

- [ ] **Step 2: Add `backendCreateTour` to `apps/admin/src/main/backend-client.ts`**

Add this import at the top of the file:

```ts
import type { CreateTourPayload } from '../preload';
```

Add this function at the end of the file:

```ts
export async function backendCreateTour(payload: CreateTourPayload, accessToken: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/tours`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}
```

(This deliberately doesn't reuse `parseJsonOrThrow` — that helper only forwards `body.error`, discarding `body.details` and the HTTP status, both of which the create-tour form needs: `details` for per-field error messages, `status` to show a specific message for an expired session (`401`) rather than lumping it in with a generic failure toast.)

- [ ] **Step 3: Register the `tours:create` IPC handler in `apps/admin/src/main.ts`**

Change the import line:

```ts
import { backendLogin, backendRefresh, backendLogout, backendMe, backendCreateTour } from './main/backend-client';
```

Add this handler after the existing `auth:logout` handler (before the `app.on('ready', ...)` line):

```ts
ipcMain.handle('tours:create', async (_event, payload, accessToken) => {
  try {
    return await backendCreateTour(payload, accessToken);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'create failed');
  }
});
```

- [ ] **Step 4: Add `toursAPI` typing to `apps/admin/src/renderer/window.d.ts`**

Replace the file's contents with:

```ts
import type { AdminSession, CreateTourPayload } from '../preload';

declare global {
  interface Window {
    authAPI: {
      login: (email: string, password: string) => Promise<AdminSession>;
      getSession: () => Promise<AdminSession | null>;
      logout: () => Promise<void>;
    };
    toursAPI: {
      create: (payload: CreateTourPayload, accessToken: string) => Promise<unknown>;
    };
  }
}

export {};
```

- [ ] **Step 5: Restart the Electron app**

`main.ts` and `preload.ts` changed — these are main-process files that don't hot-reload via Vite. Stop the running `npm start` process (from `apps/admin`) and start it again with the same flags: `npm start -- -- --remote-debugging-port=9223`.

- [ ] **Step 6: Manually verify the IPC wiring end-to-end**

This calls the real backend through the full chain without needing any UI yet. First confirm there's a logged-in session (log in through the app's UI if `getSession()` below resolves `null`):

```bash
node _tmp_drive.mjs eval "window.authAPI.getSession().then(s => window.toursAPI.create({ title: 'IPC Verify Tour', description: 'Verifying the tours:create IPC wiring end to end', price: 42, imageCover: 'https://example.com/verify.jpg' }, s.accessToken))"
```
Expected: a JSON object printed with `"title":"IPC Verify Tour"`, a derived `"slug"`, `"ratingsAverage":"4.5"`, `"isActive":true`, and an `"id"` — confirming the full renderer → main process → backend → database round trip works. (This creates a real row in the dev database — see Global Constraints.)

```bash
node _tmp_drive.mjs eval "window.authAPI.getSession().then(s => window.toursAPI.create({ title: '' }, s.accessToken)).catch(e => e.message)"
```
Expected: a JSON string containing `"status":400`, `"error":"validation failed"`, and a `"details":{...}` object whose keys are the missing required field names (`title`, `description`, `price`, `imageCover`), each mapped directly to an array of message strings (this is `zod`'s `.flatten().fieldErrors` shape passed straight through by the backend — `details` **is** the field-name-to-messages map itself, not `{ fieldErrors: {...} }`) — confirming `status` and `details` both survive the IPC round trip inside the error message, not just `error`.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/main/backend-client.ts apps/admin/src/main.ts apps/admin/src/preload.ts apps/admin/src/renderer/window.d.ts
git commit -m "feat(admin): wire tours:create through the IPC bridge"
```

---

### Task 3: Toast notification system

**Files:**
- Create: `apps/admin/src/renderer/toast.ts`
- Create: `apps/admin/src/renderer/Toaster.tsx`
- Create: `apps/admin/src/renderer/Toaster.css`
- Modify: `apps/admin/src/renderer/layout/AppLayout.tsx`

**Interfaces:**
- Produces: `export interface Toast { id: string; message: string; variant: 'success' | 'error'; leaving: boolean }`, `export const toast: { success(message: string): void; error(message: string): void }`, `export function subscribeToasts(listener: (toasts: Toast[]) => void): () => void`. `toast` is consumed by Task 4's `TourForm`; `Toaster` is consumed only by `AppLayout.tsx`.

- [ ] **Step 1: Create `apps/admin/src/renderer/toast.ts`**

```ts
export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error';
  leaving: boolean;
}

type Listener = (toasts: Toast[]) => void;

const EXIT_DURATION_MS = 200;
const AUTO_DISMISS_MS = 4000;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener(toasts));
}

function push(message: string, variant: Toast['variant']) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, message, variant, leaving: false }];
  notify();
  setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
}

function dismiss(id: string) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, EXIT_DURATION_MS);
}

export const toast = {
  success: (message: string) => push(message, 'success'),
  error: (message: string) => push(message, 'error'),
};

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}
```

- [ ] **Step 2: Create `apps/admin/src/renderer/Toaster.css`**

```css
.toaster {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 1000;
}

.toast {
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  background: var(--color-bg);
  box-shadow: 6px 6px 12px var(--color-shadow-dark), -6px -6px 12px var(--color-shadow-light);
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-text-heading);
  opacity: 1;
  transform: translateY(0);
  transition: opacity 250ms ease-out, transform 250ms ease-out;
}

.toast-success {
  border-left: 3px solid var(--color-status-confirmed-text);
}

.toast-error {
  border-left: 3px solid var(--color-error);
}

.toast-leaving {
  opacity: 0;
  transform: translateY(100%);
  transition-duration: 200ms;
}

@starting-style {
  .toast {
    opacity: 0;
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast {
    transition: opacity 200ms ease;
  }
}
```

- [ ] **Step 3: Create `apps/admin/src/renderer/Toaster.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { subscribeToasts, type Toast } from './toast';
import './Toaster.css';

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.variant} ${t.leaving ? 'toast-leaving' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Mount `Toaster` in `AppLayout.tsx`**

Add the import:

```tsx
import { Toaster } from '../Toaster';
```

Add `<Toaster />` as a sibling of `<Sidebar>`/`<main>` inside the returned `<div className="app-layout">`:

```tsx
  return (
    <div className="app-layout">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <main className="app-layout-content">{renderContent(activeView)}</main>
      <Toaster />
    </div>
  );
```

- [ ] **Step 5: Manually verify `Toaster` mounts cleanly**

Renderer-only changes — no restart needed, Vite HMR applies them live.

```bash
node _tmp_drive.mjs shot t3-app-with-toaster
```
Expected: no visible change from before this task — the `.toaster` container is present but empty (zero toasts), so nothing should look different.

```bash
node _tmp_drive.mjs eval "document.querySelector('.toaster') !== null"
```
Expected: `true` — confirms `Toaster` actually mounted into the DOM without crashing the app. (This only proves the container exists; the full visual proof of a toast appearing, stacking, and exiting comes in Task 4, once `TourForm` is the first thing to actually call `toast.success()`/`toast.error()`.)

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/renderer/toast.ts apps/admin/src/renderer/Toaster.tsx apps/admin/src/renderer/Toaster.css apps/admin/src/renderer/layout/AppLayout.tsx
git commit -m "feat(admin): toast notification system"
```

---

### Task 4: `TourForm` and end-to-end integration

**Files:**
- Create: `apps/admin/src/renderer/screens/tours/TourForm.tsx`
- Modify: `apps/admin/src/renderer/screens/tours/Tours.tsx`
- Modify: `apps/admin/src/renderer/screens/tours/Tours.css`

**Interfaces:**
- Consumes: `window.toursAPI.create` and `CreateTourPayload` (Task 2), `toast` (Task 3), `useAuth` from `../../AuthContext` (existing).
- Produces: `TourForm` component (named export, props `{ onCancel: () => void; onCreated: () => void }`), consumed by `Tours.tsx`.

- [ ] **Step 1: Create `apps/admin/src/renderer/screens/tours/TourForm.tsx`**

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

      <label className="tour-field">
        <span>Title</span>
        <input name="title" value={form.title} onChange={(e) => update('title', e.target.value)} required />
        {fieldErrors.title && <p className="tour-field-error">{fieldErrors.title}</p>}
      </label>

      <label className="tour-field">
        <span>Description</span>
        <textarea
          name="description"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          required
        />
        {fieldErrors.description && <p className="tour-field-error">{fieldErrors.description}</p>}
      </label>

      <label className="tour-field">
        <span>Summary</span>
        <input name="summary" value={form.summary} onChange={(e) => update('summary', e.target.value)} />
      </label>

      <label className="tour-field">
        <span>Price</span>
        <input
          name="price"
          type="number"
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
          value={form.duration}
          onChange={(e) => update('duration', e.target.value)}
        />
      </label>

      <label className="tour-field">
        <span>Max group size</span>
        <input
          name="maxGroupSize"
          type="number"
          value={form.maxGroupSize}
          onChange={(e) => update('maxGroupSize', e.target.value)}
        />
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

      <label className="tour-field">
        <span>Image cover URL</span>
        <input
          name="imageCover"
          value={form.imageCover}
          onChange={(e) => update('imageCover', e.target.value)}
          required
        />
        {fieldErrors.imageCover && <p className="tour-field-error">{fieldErrors.imageCover}</p>}
      </label>

      <label className="tour-field">
        <span>Start location</span>
        <input
          name="startLocation"
          value={form.startLocation}
          onChange={(e) => update('startLocation', e.target.value)}
        />
      </label>

      <label className="tour-field tour-field-checkbox">
        <input
          name="isActive"
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => update('isActive', e.target.checked)}
        />
        <span>Active</span>
      </label>

      <div className="tour-form-actions">
        <button type="button" className="neumorphic-button" onClick={onCancel} disabled={submitting}>
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

- [ ] **Step 2: Add form styles to `apps/admin/src/renderer/screens/tours/Tours.css`**

Append to the end of the file:

```css
.tour-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 480px;
  height: 100%;
  overflow-y: auto;
}

.tour-form h2 {
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
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
```

- [ ] **Step 3: Wire `TourForm` into `Tours.tsx`, replacing the placeholder panel content**

Replace `apps/admin/src/renderer/screens/tours/Tours.tsx` entirely with:

```tsx
import { useState } from 'react';
import { TourForm } from './TourForm';
import './Tours.css';

type Mode = 'idle' | 'form';

export function Tours() {
  const [mode, setMode] = useState<Mode>('idle');

  return (
    <div className="tours">
      <div className="tours-idle">
        <h1>Tours</h1>
        <p className="tours-empty">No tours created yet.</p>
        <button className="neumorphic-button" onClick={() => setMode('form')}>
          New Tour
        </button>
      </div>

      <div className={`tours-panel ${mode === 'form' ? 'tours-panel-open' : ''}`}>
        <TourForm onCancel={() => setMode('idle')} onCreated={() => setMode('idle')} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify the full create flow**

Renderer-only changes — no restart needed.

```bash
node _tmp_drive.mjs click "[data-view=tours]"
node _tmp_drive.mjs click-text "New Tour"
node _tmp_drive.mjs shot t4-form-open
```
Expected: the full field list from the Fields table is visible (Title, Description, Summary, Price, Price discount, Duration, Max group size, Difficulty, Image cover URL, Start location, Active checkbox), Cancel and Create Tour buttons at the bottom.

```bash
node _tmp_drive.mjs eval "(() => { function setVal(sel, val) { const el = document.querySelector(sel); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); } setVal('[name=title]', 'Sunset Kayak Tour'); setVal('[name=description]', 'A guided sunset kayaking trip along the coast.'); setVal('[name=price]', '89.5'); setVal('[name=imageCover]', 'https://example.com/kayak.jpg'); return 'filled'; })()"
node _tmp_drive.mjs shot t4-form-filled
node _tmp_drive.mjs click-text "Create Tour"
node _tmp_drive.mjs shot t4-form-success
```
Expected: after clicking Create Tour, a "Tour created." toast appears bottom-right, and the panel slides back out to the idle view ("New Tour" button visible again). (This creates a real row in the dev database — see Global Constraints.)

Now verify the server-validation error path (a value that passes the browser's native `required` check but fails the backend's zod validation):

```bash
node _tmp_drive.mjs click-text "New Tour"
node _tmp_drive.mjs eval "(() => { function setVal(sel, val) { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); } setVal('[name=title]', 'Bad Price Tour'); setVal('[name=description]', 'Testing server validation'); setVal('[name=price]', '-10'); setVal('[name=imageCover]', 'https://example.com/bad.jpg'); return 'filled'; })()"
node _tmp_drive.mjs click-text "Create Tour"
node _tmp_drive.mjs shot t4-form-field-error
```
Expected: a red inline error message appears under the Price field; the panel stays open (does not close); no success toast appears.

Finally, verify dark mode re-themes everything correctly:

```bash
node _tmp_drive.mjs eval "document.documentElement.dataset.theme = 'dark'"
node _tmp_drive.mjs shot t4-form-dark
node _tmp_drive.mjs eval "document.documentElement.dataset.theme = 'light'"
node _tmp_drive.mjs click-text "Cancel"
node _tmp_drive.mjs click "[data-view=dashboard]"
```
Expected: the form, panel, and any visible toast in `t4-form-dark` all show dark backgrounds and light text — nothing stayed hardcoded to the light palette. The last two commands reset the app to a normal state (form closed, back on Dashboard) for future work.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/renderer/screens/tours
git commit -m "feat(admin): TourForm with validation errors and toast feedback"
```
