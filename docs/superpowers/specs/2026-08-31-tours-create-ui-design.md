# Tours: Create UI — Design

Date: 2026-08-31

## Purpose

The Tours tab is currently the generic `ComingSoon` placeholder. This spec adds a real Tours
screen with a "New Tour" button that opens a create form, wired through to the `POST /tours`
backend endpoint (see `docs/superpowers/specs/2026-08-31-tours-create-api-design.md`). It also
introduces two new UI primitives this app doesn't have yet — a sliding content panel and a toast
notification system — both built to fit the app's existing conventions rather than pulling in a
new dependency.

## Scope

In scope:
- `Tours.tsx`: replaces `ComingSoon` for the `tours` view. Toggles between an idle state ("New
  Tour" button) and a form state (the create form, slid in from the left).
- `TourForm.tsx`: a controlled form covering the required fields plus the common optional
  scalar fields — no array or relational fields (see "Fields" below).
- `toast.ts` + `Toaster.tsx`: a small, reusable toast notification system, mounted once in
  `AppLayout`, callable from anywhere via `toast.success(...)`/`toast.error(...)`.
- The three-layer IPC wiring (`backend-client.ts` → `main.ts` → `preload.ts`/`window.d.ts`) needed
  to call `POST /tours` from the renderer, following the exact pattern `auth:login` already
  established.
- `Tours.css` covering the panel, form, and toast styles, using the existing `--color-*`/
  `--font-*` CSS variables so both themes work with no extra work.

Out of scope (explicitly deferred):
- `images` (array of URLs), `startDates` (array of datetimes), and `categoryIds` — all need a
  multi-value or multi-select input this app has no precedent for, and `categoryIds` additionally
  has no listing endpoint to power a picker with. Revisit once `GET /categories` exists.
- Any tours *list* view. There's no `GET /tours` endpoint yet; after a successful create, the UI
  shows a confirmation and returns to the idle state — nothing is persisted or displayed beyond
  that session interaction.
- A general-purpose modal/dialog component. The slide panel here is scoped to the Tours content
  area (no backdrop, sidebar stays interactive) — it is not a reusable modal primitive.
- Editing, deleting, or viewing a tour. Create-only, matching the backend.

## Screen structure

```
apps/admin/src/renderer/screens/tours/
  Tours.tsx       # idle/form state toggle, owns the slide transition
  Tours.css       # panel, idle state, form field styles, toast styles
  TourForm.tsx    # the controlled form + submit handling
```

`Tours.tsx` holds `const [mode, setMode] = useState<'idle' | 'form'>('idle')`. The idle view is an
`<h1>Tours</h1>` heading (matching `Settings.tsx`'s pattern), the line "No tours created yet.",
and the "New Tour" button (`onClick={() => setMode('form')}`). The form view is `<TourForm
onCancel={...} onCreated={...} />`; `onCreated` calls `toast.success('Tour created.')` and sets
`mode` back to `'idle'`.

## Slide panel mechanics

`.tours` is `position: relative; overflow: hidden`, acting as the sliding viewport. The form
panel is layered on top via `position: absolute; inset: 0`:

```css
.tours-panel {
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  transition: transform 280ms cubic-bezier(0.23, 1, 0.32, 1);
  background: var(--color-bg);
}

.tours-panel-open {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .tours-panel {
    transition: opacity 200ms ease;
    transform: none;
    opacity: 0;
  }
  .tours-panel-open {
    opacity: 1;
  }
}
```

Closing (Cancel, or after a successful create) removes `.tours-panel-open`, which — because this
is a `transition` on `transform`, not a `@keyframes` animation — retargets smoothly even if
clicked mid-slide. The close transition is shortened to 180ms (`.tours-panel:not(.tours-panel-open)
{ transition-duration: 180ms; }`) since there's nothing left for the user to read once it's
leaving. No backdrop or dimming is used — this is an in-place content panel, not a modal, so the
sidebar and its nav remain fully usable while the form is open. Buttons inside the panel keep this
app's existing neumorphic inset-shadow `:active` treatment (same as every other button in the
app) rather than adding a `scale()` press effect, so pressed-state feedback stays visually
consistent app-wide.

## Fields (`TourForm.tsx`)

| Field | Input | Required |
|---|---|---|
| `title` | text | yes |
| `description` | textarea | yes |
| `price` | number | yes |
| `imageCover` | text (URL) | yes |
| `summary` | text | no |
| `duration` | number | no |
| `maxGroupSize` | number | no |
| `difficulty` | select — labeled "Easy"/"Medium"/"Difficult", values `easy`/`medium`/`difficult` (matching the backend enum exactly) | no |
| `priceDiscount` | number | no |
| `startLocation` | text | no |
| `isActive` | checkbox, default checked | no |

All controlled via a single `useState` object, following `AppearanceTab`'s pattern of simple local
state rather than a form library (no form library exists in this app, and this field count doesn't
justify adding one). No client-side re-implementation of the zod rules from the backend — the
server is the single source of truth for validation. On submit, a `400` response's `details` object
(the backend sends `parsed.error.flatten().fieldErrors` directly as `details` — i.e. `details`
*is* the field-name-to-messages map, not `{ fieldErrors: {...} }`) is mapped directly to per-field
error text shown under each input. Non-validation failures (network error, `401`, `500`) show an
error toast instead, since they aren't attributable to one field.

## Toast notifications

`apps/admin/src/renderer/toast.ts` — a plain module, no React Context, matching `theme.ts`'s
established precedent for module-level UI state in this app:

```ts
export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error';
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener(toasts));
}

function push(message: string, variant: Toast['variant']) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, message, variant }];
  notify();
  setTimeout(() => dismiss(id), 4000);
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
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

`Toaster.tsx` subscribes via `subscribeToasts` in a `useEffect`, renders the current list
stacked bottom-right, and lets each toast exit via a CSS transition (`opacity` + `translateY`,
`ease-out`, ~250ms) — matching Sonner's use of transitions over keyframes so rapidly-added toasts
don't restart each other's animation. `Toaster` is mounted once in `AppLayout.tsx`, alongside
`<Sidebar>`/`<main>`, so `toast.success(...)`/`toast.error(...)` can be called from any screen
without threading props or context.

## Wiring: renderer → main process → backend

Matches the existing `auth:login` chain exactly:

**The one wrinkle:** Electron's IPC error channel only reliably carries a string (`Error.message`)
end to end — confirmed by `AuthContext.tsx`'s existing `cleanIpcErrorMessage`, which already has to
strip Electron's `"Error invoking remote method '...'"` wrapper off `err.message`, since that's the
only field that survives the round trip. A `400`'s `details` (the field-name-to-messages map the
backend sends directly as `details`, not nested under a `.fieldErrors` key) is structured data, so
it has to travel inside that same string:

- `apps/admin/src/main/backend-client.ts` — new function, deliberately not reusing
  `parseJsonOrThrow` (which discards everything but `body.error`) because this call needs
  `body.details` too:
  ```ts
  export async function backendCreateTour(payload: unknown, accessToken: string): Promise<unknown> {
    const res = await fetch(`${BACKEND_URL}/tours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(JSON.stringify({ error: body.error, details: body.details }));
    }
    return body;
  }
  ```
- `apps/admin/src/main.ts` — new handler, same try/catch-and-rethrow shape `auth:login` uses:
  `ipcMain.handle('tours:create', async (_event, payload, accessToken) => { try { return await backendCreateTour(payload, accessToken); } catch (err) { throw new Error(err instanceof Error ? err.message : 'create failed'); } })`.
  The JSON string survives as `err.message` through this rethrow unchanged.
- `apps/admin/src/preload.ts` + `window.d.ts` — new `toursAPI.create(payload, accessToken)` exposed via `contextBridge`, typed in `window.d.ts` the same way `authAPI` is.
- `Tours.tsx`/`TourForm.tsx` gets `accessToken` from `useAuth().session.accessToken` (already available — `AuthContext` already holds it for the logged-in admin). `TourForm`'s catch block runs the same `cleanIpcErrorMessage`-style strip, then attempts `JSON.parse` on the result: if it parses to `{ error, details }`, `details` itself drives the inline field errors (one entry per invalid field, each an array of messages); if parsing fails (a plain-text message — network error, generic 500, etc.), the whole string is shown as an error toast instead.

## Error handling

- **Field validation (400 with `details`)**: mapped to inline per-field errors in `TourForm`.
- **Auth failure (401)**: shouldn't normally happen (the screen requires a logged-in session to
  reach), but if the access token expired mid-session, show an error toast with a generic
  "session expired, please log in again" message — no silent retry/refresh loop is added here,
  since none of this app's existing screens do that either.
- **Network/500**: error toast with the backend's error message, or a generic fallback if the
  request didn't even reach the server.

## Testing

No automated tests, consistent with this app's established precedent (per the dark-mode and
sidebar specs before it). Verified manually via the existing CDP driver script (`_tmp_drive.mjs`):
open the panel and screenshot the slide-in, submit a full valid payload and confirm the success
toast + return to idle, submit with a missing required field and confirm inline errors appear,
and confirm dark mode re-themes the panel/form/toasts correctly (all styling goes through existing
CSS variables, so this should require no extra work — verify it isn't accidentally missed).
