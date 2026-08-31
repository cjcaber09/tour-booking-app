# Admin Appearance Settings & Dark Mode — Design

Date: 2026-08-31

## Purpose

The admin app has one hardcoded light neumorphic palette; Settings is currently just the generic
`ComingSoon` placeholder. This spec adds a real Settings screen with an Appearance tab, and a
dark theme that defaults to following the OS's color scheme.

## Scope

In scope:
- A `theme.ts` module: reads/writes the theme preference, resolves and applies it (light/dark),
  and follows OS theme changes live while set to "System."
- Converting every hardcoded color across the app's CSS into CSS custom properties, with a
  `:root` (light) and a `[data-theme="dark"]` (dark) value set.
- A Settings screen with tab navigation (just "Appearance" for now, structured to add more tabs
  later) and an Appearance tab containing a System / Light / Dark control.
- `AppLayout`'s content switch changes from a 2-way ternary to an explicit `switch` over `View`,
  since it now needs to route to 2 real screens (Dashboard, Settings) instead of 1.

Out of scope (explicitly deferred):
- Any other Settings tab (Account, Notifications, etc.) — only Appearance has content.
- Per-component theme overrides or a user-defined custom palette — light and dark are the only
  two palettes, both fixed.
- Syncing theme preference to the backend/account — it's a local, per-install `localStorage`
  setting, same tier as the sidebar's collapsed state.

## Theme mechanism

`apps/admin/src/renderer/theme.ts` (plain TS module, no React Context — only the Appearance tab
reads/writes it, so a Context would be unused ceremony):

```ts
export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'admin.theme';

export function getStoredTheme(): ThemePreference { /* localStorage.getItem(THEME_KEY) ?? 'system' */ }
export function setTheme(pref: ThemePreference): void { /* write localStorage, then applyTheme(pref) */ }
export function initTheme(): void { /* applyTheme(getStoredTheme()) once, then subscribe matchMedia */ }
```

- `applyTheme` (internal) resolves `'system'` via `window.matchMedia('(prefers-color-scheme:
  dark)').matches` to `'light'`/`'dark'`, then sets `document.documentElement.dataset.theme` to
  that resolved value.
- `initTheme()` is called once from `apps/admin/src/renderer.tsx`, **before** `createRoot(...).render(...)`
  — applying the theme attribute before React's first paint avoids a flash of the wrong theme on
  launch.
- `initTheme()` also attaches a `matchMedia(...).addEventListener('change', () =>
  applyTheme(getStoredTheme()))` listener that runs for the app's whole lifetime. Re-resolving
  through `getStoredTheme()` on every OS change means the listener is a harmless no-op whenever
  the user has explicitly picked Light or Dark — it only actually changes anything while
  `'system'` is the stored preference.

## Color system

Every hardcoded hex color in `index.css`, `Login.css`, `Sidebar.css`, `AppLayout.css`,
`Dashboard.css`, `ComingSoon.css` becomes a CSS variable, defined once at `:root` for light and
overridden under `[data-theme="dark"]`. Box-shadow offsets/blur radii (e.g. `9px 9px 16px`, `6px
6px 12px`) are unchanged between themes — only the two shadow colors become variables, so the
neumorphic geometry stays identical and only the palette shifts.

| Variable | Light | Dark | Used for |
|---|---|---|---|
| `--color-bg` | `#e0e5ec` | `#242b3d` | page/card background |
| `--color-shadow-dark` | `#a3b1c6` | `#171c29` | neumorphic shadow (dark side) |
| `--color-shadow-light` | `#ffffff` | `#2f3852` | neumorphic shadow (light side / highlight) |
| `--color-text-heading` | `#374151` | `#e5e7eb` | headings, nav labels |
| `--color-text-secondary` | `#4b5563` | `#cbd5e1` | body/secondary text |
| `--color-text-muted` | `#6b7280` | `#94a3b8` | labels, captions |
| `--color-text-stat` | `#1f2937` | `#f8fafc` | stat card numbers |
| `--color-border` | `#c8d0dc` | `#313b52` | table/section borders |
| `--color-accent-start` / `--color-accent-end` | `#7c9cf0` / `#4c6ef5` | `#7c9cf0` / `#5b7cf5` | trend bar gradient |
| `--color-error` | `#b91c1c` | `#f87171` | Login error text |
| `--color-status-confirmed-bg` / `-text` | `#d1fae5` / `#065f46` | `#064e3b` / `#6ee7b7` | Confirmed badge |
| `--color-status-pending-bg` / `-text` | `#fef3c7` / `#92400e` | `#78350f` / `#fcd34d` | Pending badge |
| `--color-status-cancelled-bg` / `-text` | `#fee2e2` / `#991b1b` | `#7f1d1d` / `#fca5a5` | Cancelled badge |

`--font-display`/`--font-body` (already in `index.css`) are unaffected — fonts don't change with
theme.

## Settings screen

```
apps/admin/src/renderer/screens/settings/
  Settings.tsx       # tab shell: local activeTab state ('appearance' only for now), tab bar
  Settings.css        # tab bar + content area + the Appearance control's styles
  AppearanceTab.tsx    # System / Light / Dark segmented control
```

- `Settings.tsx` holds `activeTab` in local `useState` (not global `View` state — this is
  Settings-internal navigation, unrelated to the sidebar). Renders a small tab bar (styled
  consistently with the sidebar's nav-item active/hover treatment) above a content area that
  currently only ever shows `<AppearanceTab />`, but the tab-array structure is built to add a
  second tab later without restructuring.
- `AppearanceTab.tsx`: three buttons (System, Light, Dark) in a segmented-control row. Local
  `useState<ThemePreference>(getStoredTheme())` tracks which is visually active (inset shadow,
  same visual language as the sidebar's active nav item). Clicking a button calls `setTheme(pref)`
  immediately (no separate save step) and updates local state to move the active highlight.
- `AppLayout.tsx`'s `activeView === 'dashboard' ? <Dashboard /> : <ComingSoon .../>` ternary
  becomes an explicit `switch (activeView)` with cases for `'dashboard'` → `<Dashboard />`,
  `'settings'` → `<Settings />`, and `'bookings'`/`'tours'`/`'users'` → `<ComingSoon title="..." />`
  each. This was flagged as the natural next step by the prior sidebar work's final review, now
  that a second real screen exists.

## Error handling

None needed — `localStorage` read/write and `matchMedia` are synchronous, always-available
browser APIs in this context; no network calls, no failure modes to design for.

## Testing

No automated tests, consistent with this app's established precedent. Verified manually via the
existing CDP driver: switch to the Appearance tab, click each of System/Light/Dark, screenshot
after each to confirm the whole app (sidebar, Dashboard, Login) actually re-themes, and confirm
`localStorage.getItem('admin.theme')` reflects the choice. System mode is verified by checking
`document.documentElement.dataset.theme` matches `matchMedia('(prefers-color-scheme:
dark)').matches` at the time of the check (can't easily simulate an OS-level theme change from
the driver, so live OS-change-following is verified by reading the code, not by toggling the
actual OS setting).
