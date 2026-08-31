# Tours: Form Layout Polish & Real Image Upload — Design

Date: 2026-08-31

## Purpose

Follow-up to the tours create UI: (1) the form's layout is cramped (fixed `max-width: 480px`
leaving most of the panel empty, every field full-width regardless of content) and its native
number-input spinners render with the browser's default white chrome, breaking dark mode; (2)
`imageCover` is currently a plain URL text field the admin has to paste a link into — this adds
real file upload to Supabase Storage instead.

## Scope

In scope:
- `.tour-form` layout: full available width instead of a fixed max-width, its own left/right
  padding, and a 2-column grid so short fields pair up instead of each taking a full row.
- Removing the native number-input spinner arrows (they can't be reliably re-themed to match
  dark/light palettes; every polished themed app just removes them).
- A new backend endpoint that accepts an image file and uploads it to the existing private
  `andy_booking` Supabase Storage bucket, returning a long-lived signed URL.
- Replacing the "Image cover URL" text field with a file picker + preview in `TourForm`, with the
  upload deferred to submit time (see "Avoiding orphaned uploads" below).

Out of scope:
- Any other file type (this is images only, for `imageCover` only — not the deferred `images[]`
  gallery array).
- Deleting/replacing an already-uploaded tour's image after creation — this is still a create-only
  flow; there's no edit screen for any tour field yet.
- A general-purpose upload endpoint for other entities. This is scoped to tours; if another entity
  needs uploads later, generalize then.

## Avoiding orphaned uploads

Uploading immediately when a file is picked (the original plan) would leave a real file sitting in
Storage forever if the admin then cancels the form or closes the panel without submitting — nothing
would ever reference it, and there's no delete/garbage-collection endpoint. Instead:

- Picking a file only validates it client-side (type/size) and stages the raw `File` in local
  state, showing an instant local preview via `URL.createObjectURL(file)` — **no network call
  yet**.
- Clicking "Create Tour" uploads the staged file first (getting back the signed URL), then
  proceeds with the existing tour-creation call using that URL as `imageCover`. If the upload
  fails, that's shown as the error and the tour is never created.
- A file only ever reaches Storage as an inseparable part of an attempted tour creation — cancelling
  the form before submit never touches the network, so there's nothing to orphan.

## Backend: `POST /tours/upload-image`

- New dependencies: `@supabase/supabase-js`, `multer` (+ `@types/multer` dev dependency) — first
  use of both in this backend.
- `apps/backend/src/lib/supabaseStorage.ts`: creates a Supabase client from the existing
  `SUPABASE_URL`/`SUPABASE_SECRET_KEY` env vars (already in `apps/backend/.env`, unused until now),
  and exports `uploadTourImage(buffer: Buffer, filename: string, mimetype: string): Promise<string>`
  which uploads to a `tours/<uuid>-<sanitized-filename>` path in the `andy_booking` bucket, then
  calls `createSignedUrl` with a 10-year expiry and returns that URL.
  - **Assumption flagged for approval:** because `andy_booking` is private, a plain public URL
    won't load — a signed URL is required. A 10-year expiry is "permanent enough" for this admin
    tool without requiring any schema change (`Tour.imageCover` stays a plain `String`) or an
    on-demand re-signing mechanism anywhere else in the system. If tours are expected to outlive 10
    years in this system, say so and this needs a different approach (e.g. storing the storage path
    and re-signing on every read).
- New route on the existing `toursRouter`: `POST /tours/upload-image`, behind `requireAuth`,
  using `multer` with in-memory storage (`multer.memoryStorage()`) and a 5MB file size limit.
  Validates `req.file` exists, its mimetype is one of `image/jpeg`, `image/png`, `image/webp`,
  `image/gif`, then calls `uploadTourImage` and returns `201 { url: string }`.
- `errorHandler.ts` gets a small addition: a `multer.MulterError` with code `LIMIT_FILE_SIZE`
  returns `400 { error: 'image exceeds 5MB limit' }` instead of falling through to the generic
  `500` — everything else keeps today's behavior.

## Admin wiring (same IPC pattern as `tours:create`)

- `preload.ts`: new `toursAPI.uploadImage(fileBase64: string, filename: string, mimetype: string, accessToken: string): Promise<{ url: string }>`.
- `main.ts`: new `ipcMain.handle('tours:upload-image', ...)`, same try/catch-and-rethrow shape as
  the other handlers.
- `backend-client.ts`: new `backendUploadImage`, which decodes the base64 back to a `Buffer` and
  posts it as `multipart/form-data` using Node's built-in `fetch`/`FormData`/`Blob` (available
  since Node 18 — no new admin-side dependency needed for this half).
- The renderer converts the picked `File` to base64 via `FileReader.readAsDataURL` (simpler than
  manually chunking an `ArrayBuffer`) before sending it over IPC — Electron's IPC only reliably
  carries plain serializable data, and a data URL's base64 payload is a safe, simple string to pass
  through.

## `TourForm` changes

- "Image cover URL" section becomes: a file `<input type="file" accept="image/jpeg,image/png,image/webp,image/gif">`, a thumbnail preview once a file is picked, and an inline error for a rejected file (wrong type or over 5MB) — checked client-side before ever staging the file.
- New local state: `imageFile: File | null` and `imagePreviewUrl: string` (revoked via
  `URL.revokeObjectURL` whenever it's replaced or the form resets, to avoid leaking object URLs).
- "Create Tour" is disabled until `imageFile` is set (replacing the old `required` attribute, since
  there's no longer a text input to require).
- `handleCancel` (from the earlier stale-state fix) additionally clears `imageFile` and revokes
  `imagePreviewUrl`.
- On submit: if `imageFile` is set, call `toursAPI.uploadImage` first; only on success does it
  proceed to build the create-tour payload (`imageCover` set to the returned URL) and call
  `toursAPI.create`, exactly as today. An upload failure shows an error and stops there — the
  create call never fires.

## Layout & styling

- `.tour-form` becomes a `display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem 1.5rem;`
  container with its own `padding: 0 2rem` (in addition to the panel's existing `2rem` padding) —
  no more `max-width: 480px`.
- A new `.tour-field-full { grid-column: 1 / -1; }` class spans both columns for: the `<h2>`
  heading, Title, Description, the Image section, Start location, and the Cancel/Create button
  row.
- Paired two-per-row (no extra class needed, they just fall into the natural 2-column flow):
  Summary + Price, Price discount + Duration, Max group size + Difficulty. The Active checkbox
  gets `.tour-field-full` too — a lone checkbox forced into a half-width column reads oddly next to
  a full-width neighbor.
- Number input spinners removed everywhere in the form:
  ```css
  .tour-field input[type='number']::-webkit-inner-spin-button,
  .tour-field input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .tour-field input[type='number'] {
    -moz-appearance: textfield;
  }
  ```
  (Removing them, rather than attempting to re-theme them, because WebKit's spin-button
  pseudo-elements don't support arbitrary background/color styling reliably — this is the standard
  fix used across themed apps.)

## Input placeholders

Every text/number input in the form gets a `placeholder`, so the field's expected content is
obvious before the admin types anything:

| Field | Placeholder |
|---|---|
| Title | `e.g. Sunset Kayak Tour` |
| Description | `Describe what makes this tour worth booking...` |
| Summary | `A short one-line summary for listings` |
| Price | `0.00` |
| Price discount | `Optional discounted price` |
| Duration (days) | `e.g. 5` |
| Max group size | `e.g. 12` |
| Start location | `e.g. Bali, Indonesia` |

Not applicable: Difficulty (a `<select>` — its existing `—` option already serves this purpose),
the Image file picker (native file inputs don't support placeholder text), and the Active checkbox
(no text content to hint at).

## Error handling

- Client-side file rejection (wrong type / too large): inline message under the Image section,
  file never staged, nothing sent anywhere.
- Upload failure (network, `401`, server-side `400`/`500`): surfaced the same way `TourForm`
  already surfaces non-field errors today (a toast, or the existing 401-specific message) — the
  form stays open with the file still staged so the admin can retry without re-picking it.
- Tour-creation validation errors (post-upload) behave exactly as before this change.

## Testing

No automated tests, consistent with this app's established precedent. Manual verification via the
CDP driver script: pick a valid image and confirm an instant local preview with no network call
yet (checkable by confirming no `tours:upload-image` IPC activity before submit); submit and
confirm the image actually uploads and the created tour's `imageCover` is a working signed URL;
pick an oversized or wrong-type file and confirm an inline client-side error with nothing sent;
cancel after picking a valid file and confirm no upload ever occurred (crosscheck via the Storage
bucket, using the already-available `SUPABASE_SECRET_KEY`, that cancelling added zero new objects
while a real submit added exactly one); confirm the grid layout and spinner removal look correct in
both light and dark mode.
