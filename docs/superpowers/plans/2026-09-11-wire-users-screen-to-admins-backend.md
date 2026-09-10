# Plan: Wire the Users screen to the real /admins backend

## Context

The "Users" screen (`Users.tsx`/`UserForm.tsx`/`UserView.tsx`/`mockUsers.ts`) was built earlier
this session as a UI-only mock with an in-memory store. The real backend (`/admins` — list,
create, update/suspend, delete) was built right after, on the explicit understanding that
wiring the frontend to it was separate follow-up work. This plan is that follow-up: replace
every mock data path with real IPC calls, mirroring this app's existing `toursAPI`/`settingsAPI`
wiring pattern exactly (`preload.ts` types + `contextBridge` block → `window.d.ts` →
`main/backend-client.ts` fetch functions → `main.ts` `ipcMain.handle` blocks).

**Naming note, worth stating explicitly since it's easy to misread**: "Admin"/`/admins` here is
*not* a role restriction. `Admin` is the pre-existing Prisma model (predating this session) that
holds every staff account able to log into this app — it's had `role: AdminRole` (`ADMIN |
LEAD_GUIDE | GUIDE`) as a column from the start; it's just named after the table, not the role.
Creating a "user" through this screen lets the caller pick any of the three roles — a guide, a
lead guide, or a fellow admin — via `createAdminSchema.role`, which is required and not defaulted
to `'ADMIN'`. "Users" is the friendlier sidebar label for exactly this same table; "admins" only
shows up in code/route names because that's the model's actual name in `schema.prisma`.

Two real mismatches between the mock and the real backend need resolving, not just re-wiring:

1. **Password**: the mock form collects Password + Confirm Password. The real `POST /admins`
   generates a one-time `temporaryPassword` server-side and doesn't accept a caller-supplied
   one at all (this was an explicit decision in the backend plan, since there's no email
   infrastructure to build an invite flow instead).
2. **Avatar**: the mock form has an avatar dropzone. `createAdminSchema` has no `avatarUrl`
   field — there's no "set someone else's avatar on creation" capability on the backend, and
   adding one is out of scope for a wiring task.

## Decisions

1. **Drop the avatar dropzone from `UserForm.tsx` entirely.** New admins are created with
   `avatarUrl: null` and can set their own avatar later via the existing
   `Settings → Profile → Avatar` flow (`profileAPI.uploadAvatar`) once they've logged in with
   their temporary password. Adding a "set another admin's avatar at creation" backend
   capability is a separate feature, not wiring.
2. **Show the one-time `temporaryPassword` in-panel, not as a toast.** `toast.ts` auto-dismisses
   after 4 seconds (`AUTO_DISMISS_MS`) — nowhere near enough time to read and copy a password
   that will never be shown again. On successful creation, `UserForm` swaps its field view for a
   success view (inside the same slide-panel) showing the new admin's email + temporary
   password with a copy-to-clipboard button, and an explicit "Done" button. Only clicking
   "Done" closes the panel and refreshes the list — mirrors how GitHub/AWS handle one-time
   secrets (a dedicated acknowledgment step, not a transient notification).
3. **List screen refetches from the server after every mutation**, instead of the mock's
   manual local-array splicing. Mirrors `Tours.tsx`'s `handleSaved` (`fetchTours(1)`) exactly —
   simpler and avoids the list ever drifting from what the server actually has.
4. **List + search + status tabs mirror `Tours.tsx`/`Bookings.tsx`'s actual pattern**, confirmed
   by reading both: despite the backend supporting `role`/`isActive`/`q` query filters, *neither*
   existing list screen actually sends filters to the server — both fetch one page
   (`toursAPI.list(page, limit, token)` / `bookingsAPI.list(page, limit, {}, token)`) and do
   search + status-tab filtering client-side over just that fetched page via `useMemo`. This is
   an established, if imperfect (counts and search only reflect the current page), convention in
   this codebase. `Users.tsx` matches it exactly rather than being "more correct" than its
   siblings — `adminsAPI.list` takes `(page, limit, accessToken)` only, no filters parameter.
5. **Hide Suspend/Activate and Delete on the logged-in admin's own row.** The backend already
   rejects self-edit/self-delete with `400` (`PATCH/DELETE /admins/:id`) — proactively hiding
   those two actions for `user.id === session.admin.id` (leaving just "View") avoids a
   confusing error and matches why the backend guard exists in the first place (self-edits go
   through `/profile` instead).

## Files to delete

- `apps/admin/src/renderer/screens/users/mockUsers.ts` — replaced by `roles.ts` (below); the
  `SEED_USERS` array and the `mockUsersStore`/`setMockUsersStore` module-level store have no
  reason to exist once real data is being fetched.

## Files to create

- `apps/admin/src/renderer/screens/users/roles.ts` — the two constants from `mockUsers.ts` that
  are still genuinely needed, unchanged (note: only `AdminRole` is imported now, not
  `AdminSummary` — that was only needed for `MockUser extends AdminSummary`, which is gone):
  ```ts
  import type { AdminRole } from '../../../preload';

  export const ROLE_LABELS: Record<AdminRole, string> = { ADMIN: 'Admin', LEAD_GUIDE: 'Lead Guide', GUIDE: 'Guide' };
  export const ROLE_BADGE_CLASS: Record<AdminRole, string> = { ADMIN: 'status-completed', LEAD_GUIDE: 'status-ongoing', GUIDE: 'status-pending' };
  ```

## Files to modify

### `apps/admin/src/preload.ts` — new types + `adminsAPI` bridge, appended after `profileAPI`
```ts
export interface AdminListItem extends AdminSummary {
  isActive: boolean;
}
export interface CreateAdminPayload {
  name: string;
  email: string;
  role: AdminRole;
  phone?: string | null;
}
export interface CreateAdminResult extends AdminListItem {
  temporaryPassword: string;
}
export interface UpdateAdminPayload {
  name?: string;
  phone?: string | null;
  role?: AdminRole;
  isActive?: boolean;
}
export interface ListAdminsResult {
  admins: AdminListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

contextBridge.exposeInMainWorld('adminsAPI', {
  list: (page: number, limit: number, accessToken: string): Promise<ListAdminsResult> =>
    ipcRenderer.invoke('admins:list', page, limit, accessToken),
  create: (payload: CreateAdminPayload, accessToken: string): Promise<CreateAdminResult> =>
    ipcRenderer.invoke('admins:create', payload, accessToken),
  update: (id: string, payload: UpdateAdminPayload, accessToken: string): Promise<AdminListItem> =>
    ipcRenderer.invoke('admins:update', id, payload, accessToken),
  delete: (id: string, accessToken: string): Promise<{ id: string }> =>
    ipcRenderer.invoke('admins:delete', id, accessToken),
});
```
(`AdminSummary`/`AdminRole` are already defined earlier in this file from the Settings work —
no changes needed there.)

### `apps/admin/src/renderer/window.d.ts` — mirror the `adminsAPI` shape into the global `Window`
interface, importing the new types, exactly like every existing API object.

### `apps/admin/src/main/backend-client.ts` — four new functions, appended after the existing
`backendChangePassword`:
- `backendListAdmins(page, limit, accessToken)` — `GET /admins?page=&limit=`, `parseJsonOrThrow`
  (same shape as `backendListTours`).
- `backendCreateAdmin(payload, accessToken)` — `POST /admins`, manual status-check +
  `JSON.stringify({status, error, details})` on failure (same shape as `backendCreateTour`, so
  `UserForm`'s `handleRequestError` can parse `.details` into field errors).
- `backendUpdateAdmin(id, payload, accessToken)` — `PATCH /admins/:id`, same manual-error shape
  as `backendUpdateTour`.
- `backendDeleteAdmin(id, accessToken)` — `DELETE /admins/:id`, `parseJsonOrThrow` (same shape
  as `backendDeleteTour`).

### `apps/admin/src/main.ts` — four new `ipcMain.handle` blocks (`admins:list`, `admins:create`,
`admins:update`, `admins:delete`), same try/catch-wrap-and-rethrow shape as every existing
handler, plus the four new imports from `backend-client.ts`.

### `apps/admin/src/renderer/screens/users/Users.tsx` — rewritten to fetch, closely mirroring
`Tours.tsx`'s structure (which was itself read in full for this plan, including its exact
`handleSuspendToggle`/`handleEditClick`/`handleViewClick` bodies):
- `useAuth()` for `session`; `useAppSettings()` for `formatDateTime` (unchanged). `PAGE_SIZE =
  10` module-level constant, same as `Tours.tsx`.
- State: `admins: AdminListItem[]`, `total`, `page`, `totalPages`, `loading`, `error`, `search`,
  `statusFilter` — same shape as `Tours.tsx`'s state, `isActive` replaces `MockUser.status`.
- `fetchAdmins(targetPage)` via `useCallback`: guard `if (!session) return;` first (matches
  every existing fetch handler in this codebase, even though `Users` only ever mounts once
  authenticated), then `window.adminsAPI.list(targetPage, PAGE_SIZE, session.accessToken)`,
  `useEffect(() => fetchAdmins(1), [fetchAdmins])` on mount.
- `statusCounts`/`filteredAdmins` — same `useMemo` client-filter pattern as `Tours.tsx`, keyed
  off `admin.isActive` instead of `tour.isActive` (nearly identical, since `Tour.isActive` is
  the exact field this was modeled on).
- **`handleViewClick(admin: AdminListItem)` stays synchronous** (`setPanelKey((k) => k + 1);
  setMode({ kind: 'view', admin });`) — **deliberately does not** copy `Tours.tsx`'s
  `handleViewClick`, which does an async `window.toursAPI.get(id, token)` because a
  `TourListItem` is a strict subset of `TourDetail`. There is no such gap here: `GET /admins`
  already returns the full `AdminListItem` shape (every field `UserView` needs) per row, and
  there is no separate `GET /admins/:id` endpoint to call even if it wanted one. Copying the
  async-fetch pattern here would be reaching for a nonexistent endpoint.
- `handleSuspendToggle(admin)` and `handleDeleteClick`/`handleConfirmDelete` **must** wrap their
  IPC calls in `try/catch` with `toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : '...')`
  in the `catch`, exactly like `Tours.tsx`'s versions — add a local `cleanIpcErrorMessage` helper
  to this file too (it's a small helper duplicated per-file throughout this codebase, not a
  shared util; `UserForm.tsx` needs its own copy as well, see below).
  - `handleSuspendToggle(admin)`: `window.adminsAPI.update(admin.id, { isActive: !admin.isActive
    }, token)`, `toast.success(...)`, then `fetchAdmins(page)` — mirrors `Tours.tsx`'s
    `handleSuspendToggle` except refetching instead of that one's optimistic local update
    (either is correct; refetching is simpler and this screen has no reason to avoid the extra
    round trip).
  - `handleDeleteClick`/`handleConfirmDelete`: `ConfirmDialog` → `window.adminsAPI.delete(id,
    token)` → `toast.success('User deleted.')` → refetch, reusing `Tours.tsx`'s
    last-item-on-page-triggers-previous-page logic verbatim: `if (admins.length === 1 && page > 1) { await fetchAdmins(page - 1); } else { await fetchAdmins(page); }`.
- `handleCreated()`: **no longer takes a user param** (see Decision 3) — just
  `setMode({ kind: 'idle' }); fetchAdmins(1);`.
- `getRowActions(admin: AdminListItem, currentAdminId: string, handlers: RowActionHandlers): { primary: RowAction | null; overflow: RowAction[] }`
  — `RowAction`'s existing type is unchanged, but the return type's `primary` becomes nullable:
  when `admin.id === currentAdminId`, return `{ primary: null, overflow: [viewAction] }` (no
  suspend/activate, no delete); otherwise the existing suspend/activate + view/delete shape.
  Pass `session!.admin.id` as `currentAdminId` at the call site (the existing
  non-null-assertion-on-`session!.admin` pattern already used in `ProfileTab.tsx`/`SecurityTab.tsx`).
  **The JSX must handle `primary === null`**: wrap the existing unconditional
  `<Button onClick={primary.onClick}>...` in `{primary && (...)}`. TypeScript will actually
  force this — once `primary`'s type includes `null`, the existing unconditional
  `primary.onClick`/`primary.Icon`/`primary.label` accesses stop compiling, so this can't be
  silently skipped.
- Row/table JSX: replace every `user.status === 'ACTIVE'` check with `user.isActive`, replace
  every `MockUser` type reference with `AdminListItem`, add the `.pagination` block (copied
  verbatim from `Tours.tsx`) since real data can exceed one page unlike the 6-row mock.
- **Top-level render states**: the mock's `{users.length === 0 ? <p>No users yet.</p> : (...)}`
  is a real structural gap once fetching is involved — it has no loading or error state at all
  (fine for instant in-memory mock data, not fine for a network call). Replace with `Tours.tsx`'s
  exact three-way pattern: `{error && <p className="status-message status-message-error">{error}</p>}`,
  `{!error && loading && total === 0 && <p className="status-message">Loading users…</p>}`,
  `{!error && !loading && total === 0 && <p className="status-message">No users yet.</p>}`, then
  the existing `{total > 0 && (...)}` block wrapping the toolbar/table/pagination.
- Pull `ROLE_LABELS`/`ROLE_BADGE_CLASS` from the new `roles.ts` instead of `mockUsers.ts`.

### `apps/admin/src/renderer/screens/users/UserForm.tsx` — rewritten:
- Remove `password`/`confirmPassword` state, both password fields, and the mismatch check.
- Remove the entire avatar dropzone block and its state/handlers (Decision 1) —
  `processAvatarFile`/`handleAvatarChange`/`handleAvatarDrop`/`avatarPreviewUrl`/etc. all go.
- Add `useAuth()` for `session.accessToken`.
- Add `createdResult: CreateAdminResult | null` state (Decision 2).
- `handleSubmit`: build `CreateAdminPayload` (`name, email, role, phone: phone || null`), call
  `window.adminsAPI.create(payload, session.accessToken)`, on success `setCreatedResult(result)`
  (do **not** call `onCreated` yet — that's deferred to the "Done" button). This file has no
  IPC error handling today (it was pure mock) — add its own local `cleanIpcErrorMessage` +
  `handleRequestError` pair, copied verbatim from `TourForm.tsx`'s (`401` → toast, `.details` →
  `fieldErrors`, else generic `toast.error`) — a 409 duplicate-email has no `.details`, so it
  surfaces as a generic toast, consistent with how this codebase handles every other
  non-schema-shaped error.
- New success view (renders instead of the form fields when `createdResult` is set): email +
  `temporaryPassword` displayed in a `neu-inset` box (monospace), a "Copy password" button
  (`navigator.clipboard.writeText`, toast confirmation), and a single "Done" button calling
  `onCreated()` (the now-parameterless callback from `Users.tsx`).
- Props: `onCreated: () => void` (signature change from `(user: MockUser) => void`).

### `apps/admin/src/renderer/screens/users/UserView.tsx` — small adaptation:
- Replace `import type { MockUser } from './mockUsers'` with `AdminListItem` from `../../../preload`
  and `ROLE_LABELS`/`ROLE_BADGE_CLASS` from `./roles`.
- Replace the `Status` field's `user.status === 'ACTIVE'` check with `user.isActive`, label
  `'Active' : 'Suspended'` unchanged.

### `apps/admin/src/renderer/layout/AppLayout.tsx` — no changes needed (already renders
`<Users />` from the earlier mock-UI work; the import path and component name don't change).

## Verification plan

This app has no frontend unit tests configured (confirmed: no test files anywhere under
`apps/admin`) — verification is typecheck/lint plus a live manual smoke test, matching how the
Settings and mocked-Users features were verified earlier this session (Playwright over CDP
against the real running Electron app).

1. `node_modules/.bin/tsc --noEmit -p apps/admin/tsconfig.json` (the root-workspace-tsc
   workaround already established this session, since admin's own local `tsc` is too old) — 0
   errors, matching this session's clean baseline.
2. `npm run lint` in `apps/admin` — 0 errors, same pre-existing warnings only.
3. Live smoke test (backend `npm run dev` + admin `electron-forge start --remote-debugging-port`,
   same driver-script approach used all session): log in, open Users — confirm it now shows
   real DB-backed admins (not the 6 mock seed rows), including the logged-in admin's own row
   with Suspend/Delete hidden; click "New User", fill name/email/role/phone (no password
   fields, no avatar dropzone present), submit — confirm the success view shows the real
   `temporaryPassword`, "Copy password" populates the clipboard, "Done" closes the panel and the
   new admin appears in the refetched list; open a new terminal and confirm that returned
   temporary password actually logs in via a raw `POST /auth/login` call; suspend a non-self
   row, confirm the badge/border flips and a toast fires; delete a non-self row, confirm
   `ConfirmDialog` then removal; confirm pagination controls appear once there are enough real
   admins to exceed one page (or note if the seed data is too small to trigger this and it's
   only confirmed by code inspection).
