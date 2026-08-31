# Admin Dashboard & Fonts — Design

Date: 2026-08-31

## Purpose

The admin app currently ends at login — after authenticating, `App.tsx` renders a bare
placeholder (`Signed in as {name}` + a sign-out button). This spec adds a real landing screen: a
dashboard with sample booking analytics, plus a font update and a layout cleanup that were
requested alongside it.

## Scope

In scope:
- A Dashboard screen shown after successful login, replacing the placeholder.
- Stat cards, a trend chart, and a recent-bookings list, all populated with static mock data.
- App-wide font change: Bebas Neue for headings/stat numbers, Open Sans for body/content text.
- Remove the `body` padding/margin/max-width left over from the Vite template.

Out of scope (explicitly deferred):
- A real backend analytics endpoint or `Booking` data model — neither exists yet (the schema
  only has `Admin`/`RefreshToken`). Mock data lives in one file so it's a single-file swap once
  real data exists.
- A sidebar/nav shell — only one authenticated screen exists today, so navigation chrome with
  nowhere to navigate is premature. Revisit once a second screen is added.
- A charting library — the trend chart is hand-rolled CSS/SVG since the data is static and
  simple; not worth a new dependency yet.

## Fonts

- Add `@fontsource/bebas-neue` and `@fontsource/open-sans` (self-hosted npm packages — no
  external Google Fonts CDN call, which matters for an Electron app's offline reliability and
  CSP).
- `apps/admin/src/index.css` defines:
  ```css
  :root {
    --font-display: 'Bebas Neue', sans-serif;
    --font-body: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  body { font-family: var(--font-body); }
  ```
- `--font-display` is applied to: the Login screen's `<h1>`, the Dashboard's title, and every
  stat card's number. Everything else (labels, inputs, error text, recent-bookings rows) stays
  on `--font-body` — Bebas Neue is all-caps/display-only and unreadable in paragraph or form
  text.

## Layout cleanup

`apps/admin/src/index.css` currently has leftover Vite-template rules on `body`:
`margin: auto; max-width: 38rem; padding: 2rem;`. These are removed. The Login screen already
renders inside its own full-height flex container, so this is a no-op there; it unblocks the
Dashboard from spanning the full window width.

## Dashboard screen

New files:
```
apps/admin/src/renderer/screens/
  Dashboard.tsx
  Dashboard.css
  mockAnalytics.ts
```
`App.tsx`'s authenticated branch renders `<Dashboard />` instead of the inline placeholder.

**`mockAnalytics.ts`** — static sample data, isolated in one file so a real API can replace it
later without touching the component:
```ts
export const stats = [
  { label: 'Total Bookings', value: '1,284' },
  { label: 'Revenue (This Month)', value: '$48,200' },
  { label: 'Upcoming Tours', value: '12' },
  { label: 'Cancellations', value: '7' },
];

export const bookingsTrend = [/* 7 sample values, one per day, last 7 days */];

export const recentBookings = [
  { customer: 'Jane Cooper', tour: 'Sunset Harbor Cruise', date: '2026-09-02', status: 'Confirmed' },
  // a handful more mock rows
];
```

**Layout:**
- Top bar: "Andy Tours Admin" (display font) on the left; admin name + Sign out button on the
  right.
- Stat cards: a 4-column grid (wraps on narrow widths). Each card has a large display-font
  number, a body-font label, and a soft neumorphic shadow matching Login's existing values
  (`box-shadow: 6px 6px 12px #a3b1c6, -6px -6px 12px #ffffff` on the `#e0e5ec` background). The
  number itself stays high-contrast/dark (not muted) so it's legible at a glance — neumorphism's
  low-contrast softness is fine for chrome but not for the figures themselves.
- Trend chart: a simple 7-bar chart built from plain `div`s with inline `height` driven by
  `bookingsTrend` values, day-of-week tick labels underneath. No charting library.
- Recent bookings: a plain list/table, one row per mock booking (customer, tour, date, status
  badge).

## Error handling

None needed for this slice — the screen has no async data fetching (data is a static import), so
there's no loading or error state to design. That arrives when this is wired to a real endpoint.

## Testing

No unit tests, same rationale as the Login slice: this is presentational, static-data UI.
Verified manually by running the admin app and confirming the dashboard renders after login
(driven via the Playwright/CDP setup already used for this app, port 9223).
