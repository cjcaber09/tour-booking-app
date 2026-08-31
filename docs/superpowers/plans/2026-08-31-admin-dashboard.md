# Admin Dashboard & Fonts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin app's post-login placeholder with a real Dashboard screen showing mock booking analytics, switch the app's fonts to Bebas Neue (headings/stat numbers) + Open Sans (everything else), and remove the unused Vite-template body padding.

**Architecture:** Pure frontend change inside `apps/admin`'s React renderer — no backend changes. Fonts are self-hosted via `@fontsource` packages and wired through CSS custom properties (`--font-display`, `--font-body`) defined once in `index.css`. The Dashboard is a new screen (`screens/Dashboard.tsx`) that reads static mock data from a sibling file and reuses `useAuth()` the same way `Login.tsx` already does, so `App.tsx` just swaps which screen it renders based on `status`.

**Tech Stack:** React 19, TypeScript, Vite (via Electron Forge's Vite plugin), plain CSS (no CSS framework, no charting library — matches existing Login screen's approach).

## Global Constraints

- Fonts are self-hosted via `@fontsource/bebas-neue` and `@fontsource/open-sans` — no Google Fonts CDN link (Electron offline/CSP reliability).
- Bebas Neue (`--font-display`) is used ONLY for: the Login `<h1>`, the Dashboard title, and stat card numbers. Every other text element uses Open Sans (`--font-body`) — Bebas Neue is display-only/all-caps and unreadable in body copy or form inputs.
- Dashboard analytics are static mock data in one file (`screens/mockAnalytics.ts`). No backend analytics endpoint, no `Booking` data model — explicitly out of scope.
- No sidebar/nav shell — only one authenticated screen exists after this plan.
- No charting library — the trend chart is plain CSS divs.
- No automated tests for this UI, consistent with the existing Login screen's precedent (`docs/superpowers/specs/2026-08-30-admin-login-design.md`'s Testing section: "manual verification of the login screen is sufficient given the scope"). Each task instead ends with a manual visual/text verification step using the existing CDP driver script.
- The admin app is currently running via `npm start -- -- --remote-debugging-port=9223` from `apps/admin` (already launched this session). Vite HMR picks up renderer changes automatically — no restart needed for `.tsx`/`.css` edits.
- Manual verification uses the existing driver script at the repo root, `_tmp_drive.mjs` (connects over CDP to the already-running app):
  - `node _tmp_drive.mjs shot <name>` → screenshot to `%SCREENSHOT_DIR%` (defaults to `C:\Users\Lenovo\AppData\Local\Temp\claude\shots`)
  - `node _tmp_drive.mjs text` → prints `document.body.innerText`
  - `node _tmp_drive.mjs login <email> <password>` → fills and submits the login form
  - Run these from the repo root (`C:\Users\Lenovo\ai-projects\andy-booking-app`).

---

### Task 1: Fonts, CSS variables, and layout cleanup

**Files:**
- Modify: `apps/admin/package.json` (add dependencies)
- Modify: `apps/admin/src/index.css`
- Modify: `apps/admin/src/renderer.tsx`

**Interfaces:**
- Produces: CSS custom properties `--font-display` and `--font-body`, available globally to every component in this app from this task onward (consumed by Task 2 and Task 3).

- [ ] **Step 1: Install the font packages**

Run from the repo root:
```bash
npm install @fontsource/bebas-neue @fontsource/open-sans --workspace=apps/admin
```
Expected: `apps/admin/package.json`'s `dependencies` gains `@fontsource/bebas-neue` and `@fontsource/open-sans`.

- [ ] **Step 2: Rewrite `apps/admin/src/index.css`**

Replace the entire file with:

```css
@import '@fontsource/bebas-neue/index.css';
@import '@fontsource/open-sans/index.css';
@import '@fontsource/open-sans/600.css';

:root {
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

body {
  font-family: var(--font-body);
  margin: 0;
}
```

This removes the old `max-width: 38rem; padding: 2rem;` template leftovers and the old hardcoded font stack, replacing them with the two font variables every other task in this plan relies on. `margin: 0` replaces the old `margin: auto` — auto-centering a max-width column no longer makes sense once there's no max-width.

- [ ] **Step 3: Import `index.css` in the renderer entry point**

`index.css` is not currently imported anywhere (confirmed by grep — it's dead code from the Forge/Vite template), so without this step none of the above takes effect.

Edit `apps/admin/src/renderer.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './renderer/App';
import './index.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container #app not found');
}

createRoot(container).render(<App />);
```

(Only change: the added `import './index.css';` line.)

- [ ] **Step 4: Manually verify the fonts load and padding is gone**

The app is already running with Vite HMR, so these edits apply live. From the repo root:
```bash
node _tmp_drive.mjs shot 01-fonts-loaded
```
Expected: no error printed; screenshot shows the Login screen still centered via `.login-screen`'s own `height: 100vh` flex layout (not the old body padding — that's expected, Login was never relying on the body padding). Open the screenshot file and confirm there's no visible white margin/border around the grey `.login-screen` background — if there is, the old `body` padding is still cached; hard-reload with `Ctrl+R` in the app window and re-screenshot.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/package.json apps/admin/package-lock.json apps/admin/src/index.css apps/admin/src/renderer.tsx
git commit -m "feat(admin): self-host Bebas Neue + Open Sans, remove template body padding"
```

Note: this repo uses root-level npm workspaces, so the lockfile change may land in the root `package-lock.json` instead of (or in addition to) `apps/admin/package-lock.json` — run `git status` first and stage whichever lockfile actually changed.

---

### Task 2: Apply the display font to the Login screen

**Files:**
- Modify: `apps/admin/src/renderer/screens/Login.css`

**Interfaces:**
- Consumes: `--font-display`, `--font-body` (Task 1).

- [ ] **Step 1: Update `.login-screen`'s font-family and add an `.login-card h1` rule**

In `apps/admin/src/renderer/screens/Login.css`, change:

```css
.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #e0e5ec;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

to:

```css
.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #e0e5ec;
  font-family: var(--font-body);
}
```

(`.login-screen` was hardcoding its own font stack, which would otherwise shadow the `--font-body` inherited from `body` and silently keep the old system font on every element inside Login. This fix is required, not cosmetic.)

Then add a new rule right after `.login-card`'s existing block:

```css
.login-card h1 {
  font-family: var(--font-display);
  font-size: 1.75rem;
  letter-spacing: 0.05em;
  margin: 0;
  text-align: center;
  color: #374151;
}
```

- [ ] **Step 2: Manually verify**

```bash
node _tmp_drive.mjs shot 02-login-fonts
```
Expected: screenshot shows "Andy Tours Admin" in the condensed Bebas Neue style (taller, narrower letterforms than before), while the Email/Password labels and input text remain in Open Sans.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/renderer/screens/Login.css
git commit -m "feat(admin): use Bebas Neue for the Login heading"
```

---

### Task 3: Dashboard screen with mock analytics

**Files:**
- Create: `apps/admin/src/renderer/screens/mockAnalytics.ts`
- Create: `apps/admin/src/renderer/screens/Dashboard.tsx`
- Create: `apps/admin/src/renderer/screens/Dashboard.css`
- Modify: `apps/admin/src/renderer/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `apps/admin/src/renderer/AuthContext.tsx` (`session: AdminSession | null`, `logout: () => Promise<void>`), where `AdminSession.admin` is `{ id: string; email: string; name: string }` (defined in `apps/admin/src/preload.ts`). Consumes `--font-display`/`--font-body` (Task 1).
- Produces: `Dashboard` component (default export style: named export `Dashboard`), rendered by `App.tsx` when `status === 'authenticated'`.

- [ ] **Step 1: Create `apps/admin/src/renderer/screens/mockAnalytics.ts`**

```ts
export interface StatCard {
  label: string;
  value: string;
}

export const stats: StatCard[] = [
  { label: 'Total Bookings', value: '1,284' },
  { label: 'Revenue (This Month)', value: '$48,200' },
  { label: 'Upcoming Tours', value: '12' },
  { label: 'Cancellations', value: '7' },
];

export interface TrendPoint {
  day: string;
  bookings: number;
}

export const bookingsTrend: TrendPoint[] = [
  { day: 'Mon', bookings: 14 },
  { day: 'Tue', bookings: 22 },
  { day: 'Wed', bookings: 18 },
  { day: 'Thu', bookings: 30 },
  { day: 'Fri', bookings: 26 },
  { day: 'Sat', bookings: 34 },
  { day: 'Sun', bookings: 20 },
];

export type BookingStatus = 'Confirmed' | 'Pending' | 'Cancelled';

export interface RecentBooking {
  customer: string;
  tour: string;
  date: string;
  status: BookingStatus;
}

export const recentBookings: RecentBooking[] = [
  { customer: 'Jane Cooper', tour: 'Sunset Harbor Cruise', date: '2026-09-02', status: 'Confirmed' },
  { customer: 'Marcus Lee', tour: 'Old Town Walking Tour', date: '2026-09-03', status: 'Confirmed' },
  { customer: 'Priya Natarajan', tour: 'Whale Watching Excursion', date: '2026-09-04', status: 'Pending' },
  { customer: 'Diego Ramirez', tour: 'Sunset Harbor Cruise', date: '2026-09-05', status: 'Confirmed' },
  { customer: 'Alicia Novak', tour: 'Mountain Vista Hike', date: '2026-09-06', status: 'Cancelled' },
];
```

- [ ] **Step 2: Create `apps/admin/src/renderer/screens/Dashboard.css`**

```css
.dashboard {
  min-height: 100vh;
  background: #e0e5ec;
  padding: 2rem;
  box-sizing: border-box;
}

.dashboard-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.dashboard-topbar h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.05em;
  margin: 0;
  color: #374151;
}

.dashboard-topbar-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #4b5563;
  font-size: 0.875rem;
}

.dashboard-topbar-actions button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 12px;
  background: #e0e5ec;
  box-shadow: 6px 6px 12px #a3b1c6, -6px -6px 12px #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}

.dashboard-topbar-actions button:active {
  box-shadow: inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.5rem;
  border-radius: 20px;
  background: #e0e5ec;
  box-shadow: 9px 9px 16px #a3b1c6, -9px -9px 16px #ffffff;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2.5rem;
  letter-spacing: 0.03em;
  color: #1f2937;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.dashboard-trend,
.dashboard-recent {
  padding: 1.5rem;
  border-radius: 20px;
  background: #e0e5ec;
  box-shadow: 9px 9px 16px #a3b1c6, -9px -9px 16px #ffffff;
  margin-bottom: 2rem;
}

.dashboard-trend h2,
.dashboard-recent h2 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  letter-spacing: 0.03em;
  margin: 0 0 1rem;
  color: #374151;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  height: 160px;
}

.trend-bar-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  height: 100%;
}

.trend-bar {
  width: 100%;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #7c9cf0, #4c6ef5);
  min-height: 4px;
}

.trend-bar-label {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.recent-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  color: #374151;
}

.recent-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  color: #6b7280;
  font-weight: 600;
  border-bottom: 1px solid #c8d0dc;
}

.recent-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #d3dae4;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-confirmed {
  background: #d1fae5;
  color: #065f46;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-cancelled {
  background: #fee2e2;
  color: #991b1b;
}
```

- [ ] **Step 3: Create `apps/admin/src/renderer/screens/Dashboard.tsx`**

```tsx
import { useAuth } from '../AuthContext';
import { stats, bookingsTrend, recentBookings } from './mockAnalytics';
import './Dashboard.css';

export function Dashboard() {
  const { session, logout } = useAuth();
  const maxBookings = Math.max(...bookingsTrend.map((point) => point.bookings));

  return (
    <div className="dashboard">
      <header className="dashboard-topbar">
        <h1>Andy Tours Admin</h1>
        <div className="dashboard-topbar-actions">
          <span>{session?.admin.name}</span>
          <button onClick={() => logout()}>Sign out</button>
        </div>
      </header>

      <section className="dashboard-stats">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="dashboard-trend">
        <h2>Bookings — last 7 days</h2>
        <div className="trend-chart">
          {bookingsTrend.map((point) => (
            <div className="trend-bar-column" key={point.day}>
              <div
                className="trend-bar"
                style={{ height: `${(point.bookings / maxBookings) * 100}%` }}
              />
              <span className="trend-bar-label">{point.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-recent">
        <h2>Recent bookings</h2>
        <table className="recent-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Tour</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentBookings.map((booking) => (
              <tr key={`${booking.customer}-${booking.date}`}>
                <td>{booking.customer}</td>
                <td>{booking.tour}</td>
                <td>{booking.date}</td>
                <td>
                  <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                    {booking.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Wire `Dashboard` into `App.tsx`**

Replace `apps/admin/src/renderer/App.tsx` entirely with:

```tsx
import { AuthProvider, useAuth } from './AuthContext';
import { LoginScreen } from './screens/Login';
import { Dashboard } from './screens/Dashboard';

function AppShell() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div>Loading…</div>;
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  return <Dashboard />;
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
```

(`AppShell` no longer needs `session`/`logout` itself — `Dashboard` reads those from `useAuth()` directly, the same pattern `LoginScreen` already uses.)

- [ ] **Step 5: Reseed a known test password**

The seeded admin's real password isn't recoverable (bcrypt hash) and isn't recorded anywhere, so verification needs a known password. This is dev-only seed data, not a production credential. Run from the repo root:

```bash
npm run seed:admin --workspace=apps/backend -- andy@andytours.local "dev-test-password-123" "Andy"
```
Expected output: `Admin ready: andy@andytours.local (<uuid>)`.

- [ ] **Step 6: Manually verify the Dashboard renders after login**

```bash
node _tmp_drive.mjs login andy@andytours.local dev-test-password-123
node _tmp_drive.mjs shot 03-dashboard
node _tmp_drive.mjs text
```
Expected: the `text` output contains `Andy Tours Admin`, `Total Bookings`, `1,284`, `Revenue (This Month)`, `Bookings — last 7 days`, `Recent bookings`, and `Jane Cooper`. The screenshot shows four stat cards, a 7-bar chart, and a 5-row table, all on the grey neumorphic background with no leftover body padding around the edges.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/renderer/screens/mockAnalytics.ts apps/admin/src/renderer/screens/Dashboard.tsx apps/admin/src/renderer/screens/Dashboard.css apps/admin/src/renderer/App.tsx
git commit -m "feat(admin): dashboard screen with mock analytics"
```

---

## Post-plan cleanup (not a task — do after Task 3's commit, don't commit as part of this feature)

`_tmp_drive.mjs` at the repo root is untracked scratch tooling reused across this session for manual verification. It's not part of this plan's scope to formalize it into a project skill, but if it keeps getting reused, suggest running `/run-skill-generator` afterward to turn it into `apps/admin/.claude/skills/run-admin/`.
