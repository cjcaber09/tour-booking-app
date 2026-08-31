# Admin Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible sidebar (Dashboard, Bookings, Tours, Settings, Users) to the admin app, replacing the single-screen `App.tsx` → `Dashboard` render with a proper navigation shell, and move Dashboard's sign-out control into the sidebar.

**Architecture:** A new `AppLayout` component owns which of the 5 views is active (plain React state, no router) and whether the sidebar is collapsed (React state seeded from and written back to `localStorage`). It renders a `Sidebar` (nav + collapse toggle + sign-out) beside a content area that shows either `Dashboard` or a shared `ComingSoon` placeholder. `App.tsx` swaps its authenticated branch from `<Dashboard />` to `<AppLayout />`.

**Tech Stack:** React 19, TypeScript, plain CSS — no new dependencies (no router library, no icon library; 5 nav icons + a chevron + a sign-out icon are hand-written inline SVG components).

## Global Constraints

- No routing library (`react-router` or similar) — `AppLayout` holds `activeView` in plain `useState`. This app is a single Electron window with 5 flat top-level sections and no deep-linking/bookmarking need.
- No icon library — icons live in `apps/admin/src/renderer/layout/icons.tsx` as small inline-SVG React components.
- Bookings, Tours, Settings, and Users all render one shared `ComingSoon` component (different `title` prop each) — not 4 separate screens. None of their backing data models exist yet.
- Sidebar collapsed state persists via `localStorage` key `admin.sidebarCollapsed` (`"true"`/`"false"`). `activeView` does NOT persist — every app launch starts on `'dashboard'`.
- Sidebar width: `220px` expanded, `64px` collapsed. Collapsed = icon-only rail; labels are hidden via conditional rendering (not just visually clipped).
- No automated tests — this app has no test framework for its UI by design (established in the Login and Dashboard slices). Verification is manual via the existing CDP driver script.
- `_tmp_drive.mjs` (repo root, untracked scratch tooling) currently supports `shot`, `text`, `login`, `click-text` only. Task 1 extends it with `click <css-selector>` and `eval <js-expression>` (needed because the collapse toggle and, once collapsed, the nav items themselves have no visible text for `click-text` to match). This file is not part of the shipped app and is never committed — edit it freely, no commit step needed for it.
- The admin Electron app is already running (`npm start -- -- --remote-debugging-port=9223` from `apps/admin`), Vite HMR live. Do not start or restart it.

---

### Task 1: Sidebar navigation shell

**Files:**
- Modify: `_tmp_drive.mjs` (repo root — add `click`/`eval` commands; untracked, no commit)
- Create: `apps/admin/src/renderer/layout/icons.tsx`
- Create: `apps/admin/src/renderer/screens/ComingSoon.tsx`
- Create: `apps/admin/src/renderer/screens/ComingSoon.css`
- Create: `apps/admin/src/renderer/layout/Sidebar.tsx`
- Create: `apps/admin/src/renderer/layout/Sidebar.css`
- Create: `apps/admin/src/renderer/layout/AppLayout.tsx`
- Create: `apps/admin/src/renderer/layout/AppLayout.css`
- Modify: `apps/admin/src/renderer/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `apps/admin/src/renderer/AuthContext.tsx` (`logout: () => Promise<void>`). Consumes `--font-display`/`--font-body`/`.neumorphic-button` (already in `apps/admin/src/index.css`). Consumes `Dashboard` from `apps/admin/src/renderer/screens/Dashboard.tsx` (unchanged in this task).
- Produces: `export type View = 'dashboard' | 'bookings' | 'tours' | 'settings' | 'users';` (defined in `Sidebar.tsx`), `AppLayout` component (rendered by `App.tsx`), `ComingSoon` component (consumed by `AppLayout`, and later reusable if more placeholder screens are needed).

- [ ] **Step 1: Extend the CDP driver with `click` and `eval` commands**

Open `_tmp_drive.mjs` (repo root). Inside the `switch (cmd) { ... }` block in the `run()` function, add two new cases, right after the existing `click-text` case (before `default:`):

```js
    case 'click': {
      const sel = process.argv[3];
      const r = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      }, sel);
      console.log('click', sel, '→', r);
      break;
    }
    case 'eval': {
      const expr = process.argv[3];
      try {
        const result = await page.evaluate(expr);
        console.log(JSON.stringify(result));
      } catch (e) {
        console.log('ERROR:', e.message);
      }
      break;
    }
```

`click` targets a CSS selector directly (needed for icon-only buttons with no matching text). `eval` runs a JS expression in the page and prints the JSON result (needed to read `localStorage` for the persistence check in Step 9). This file is untracked scratch tooling — do not `git add` it.

- [ ] **Step 2: Create `apps/admin/src/renderer/layout/icons.tsx`**

```tsx
interface IconProps {
  className?: string;
}

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function BookingsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <path d="M8 15l2.5 2.5L16 12" />
    </svg>
  );
}

export function ToursIcon({ className }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polygon points="12,7 14,12 12,17 10,12" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" />
      <path d="M14 20c0-2 1.5-3.5 3.5-3.5S21 18 21 20" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function SignOutIcon({ className }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
```

- [ ] **Step 3: Create `apps/admin/src/renderer/screens/ComingSoon.css`**

```css
.coming-soon {
  padding: 2rem;
}

.coming-soon h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem;
  color: #374151;
}

.coming-soon p {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}
```

- [ ] **Step 4: Create `apps/admin/src/renderer/screens/ComingSoon.tsx`**

```tsx
import './ComingSoon.css';

interface ComingSoonProps {
  title: string;
}

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <h1>{title}</h1>
      <p>This section isn't built yet.</p>
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/admin/src/renderer/layout/Sidebar.css`**

```css
.sidebar {
  display: flex;
  flex-direction: column;
  width: 220px;
  flex-shrink: 0;
  height: 100vh;
  background: #e0e5ec;
  box-shadow: 4px 0 12px rgba(163, 177, 198, 0.4);
  padding: 1.5rem 1rem;
  box-sizing: border-box;
  transition: width 0.2s ease;
}

.sidebar-collapsed {
  width: 64px;
  padding: 1.5rem 0.75rem;
}

.sidebar-brand {
  font-family: var(--font-display);
  font-size: 1.25rem;
  letter-spacing: 0.05em;
  color: #374151;
  margin-bottom: 2rem;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border: none;
  border-radius: 12px;
  background: transparent;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  color: #4b5563;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-align: left;
}

.sidebar-nav-item:hover {
  background: rgba(163, 177, 198, 0.25);
}

.sidebar-nav-item-active {
  background: #e0e5ec;
  box-shadow: inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff;
  color: #1f2937;
}

.sidebar-nav-icon {
  flex-shrink: 0;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid #c8d0dc;
  padding-top: 1rem;
}

.sidebar-collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: none;
  border-radius: 12px;
  background: #e0e5ec;
  box-shadow: 6px 6px 12px #a3b1c6, -6px -6px 12px #ffffff;
  color: #4b5563;
  cursor: pointer;
}

.sidebar-collapse-toggle:active {
  box-shadow: inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #ffffff;
}

.sidebar-chevron-collapsed {
  transform: rotate(180deg);
}
```

- [ ] **Step 6: Create `apps/admin/src/renderer/layout/Sidebar.tsx`**

```tsx
import { useAuth } from '../AuthContext';
import {
  DashboardIcon,
  BookingsIcon,
  ToursIcon,
  SettingsIcon,
  UsersIcon,
  ChevronIcon,
  SignOutIcon,
} from './icons';
import './Sidebar.css';

export type View = 'dashboard' | 'bookings' | 'tours' | 'settings' | 'users';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const NAV_ITEMS: { view: View; label: string; Icon: typeof DashboardIcon }[] = [
  { view: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { view: 'bookings', label: 'Bookings', Icon: BookingsIcon },
  { view: 'tours', label: 'Tours', Icon: ToursIcon },
  { view: 'settings', label: 'Settings', Icon: SettingsIcon },
  { view: 'users', label: 'Users', Icon: UsersIcon },
];

export function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapsed }: SidebarProps) {
  const { logout } = useAuth();

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">{collapsed ? 'AT' : 'Andy Tours Admin'}</div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ view, label, Icon }) => (
          <button
            key={view}
            data-view={view}
            className={`sidebar-nav-item ${view === activeView ? 'sidebar-nav-item-active' : ''}`}
            onClick={() => onNavigate(view)}
            title={collapsed ? label : undefined}
          >
            <Icon className="sidebar-nav-icon" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-nav-item"
          onClick={() => logout()}
          title={collapsed ? 'Sign out' : undefined}
        >
          <SignOutIcon className="sidebar-nav-icon" />
          {!collapsed && <span>Sign out</span>}
        </button>

        <button
          className="sidebar-collapse-toggle"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronIcon className={collapsed ? 'sidebar-chevron-collapsed' : ''} />
        </button>
      </div>
    </aside>
  );
}
```

`data-view` on each nav button gives verification (and any future test) a stable selector that works whether the sidebar is expanded or collapsed, since the visible label text disappears when collapsed.

- [ ] **Step 7: Create `apps/admin/src/renderer/layout/AppLayout.css`**

```css
.app-layout {
  display: flex;
  height: 100vh;
}

.app-layout-content {
  flex: 1;
  overflow-y: auto;
  background: #e0e5ec;
}
```

- [ ] **Step 8: Create `apps/admin/src/renderer/layout/AppLayout.tsx`**

```tsx
import { useState } from 'react';
import { Sidebar, type View } from './Sidebar';
import { Dashboard } from '../screens/Dashboard';
import { ComingSoon } from '../screens/ComingSoon';
import './AppLayout.css';

const SIDEBAR_COLLAPSED_KEY = 'admin.sidebarCollapsed';

const VIEW_TITLES: Record<Exclude<View, 'dashboard'>, string> = {
  bookings: 'Bookings',
  tours: 'Tours',
  settings: 'Settings',
  users: 'Users',
};

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
      <main className="app-layout-content">
        {activeView === 'dashboard' ? (
          <Dashboard />
        ) : (
          <ComingSoon title={VIEW_TITLES[activeView]} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Wire `AppLayout` into `App.tsx`**

Replace `apps/admin/src/renderer/App.tsx` entirely with:

```tsx
import { AuthProvider, useAuth } from './AuthContext';
import { LoginScreen } from './screens/Login';
import { AppLayout } from './layout/AppLayout';

function AppShell() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div>Loading…</div>;
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  return <AppLayout />;
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
```

- [ ] **Step 10: Manually verify the full sidebar flow**

The app is already running with Vite HMR — these edits apply live. If not already signed in, run `node _tmp_drive.mjs login andy@andytours.local dev-test-password-123` first (same test admin seeded in the dashboard plan). From the repo root:

```bash
node _tmp_drive.mjs shot 01-sidebar-expanded
```
Expected: sidebar on the left (~220px), "Andy Tours Admin" brand, 5 nav items with "Dashboard" visually highlighted (inset shadow) as active, Dashboard's stat cards/chart/table to the right. Open the screenshot and confirm this.

```bash
node _tmp_drive.mjs click "[data-view=bookings]"
node _tmp_drive.mjs shot 02-sidebar-bookings
```
Expected: "Bookings" nav item now highlighted instead of "Dashboard"; content area shows the ComingSoon placeholder ("Bookings" heading + "This section isn't built yet."). Repeat similarly for `[data-view=tours]`, `[data-view=settings]`, `[data-view=users]` if you want extra confidence, but at minimum confirm one of them renders correctly — the other three use the identical code path.

```bash
node _tmp_drive.mjs click .sidebar-collapse-toggle
node _tmp_drive.mjs shot 03-sidebar-collapsed
```
Expected: sidebar has shrunk to a narrow icon-only rail (~64px), no labels visible, brand shows "AT".

```bash
node _tmp_drive.mjs eval "localStorage.getItem('admin.sidebarCollapsed')"
```
Expected output: `"true"`.

```bash
node _tmp_drive.mjs click "[data-view=dashboard]"
node _tmp_drive.mjs shot 04-sidebar-collapsed-dashboard
```
Expected: still collapsed, but content area now shows the Dashboard again (confirms icon-only nav buttons are still clickable via `data-view`, not just visually present).

```bash
node _tmp_drive.mjs click .sidebar-collapse-toggle
```
Re-expand, leaving the app in a normal state.

- [ ] **Step 11: Commit**

```bash
git add apps/admin/src/renderer/layout apps/admin/src/renderer/screens/ComingSoon.tsx apps/admin/src/renderer/screens/ComingSoon.css apps/admin/src/renderer/App.tsx
git commit -m "feat(admin): collapsible sidebar navigation shell"
```

(`_tmp_drive.mjs` is intentionally not staged — it's untracked scratch tooling.)

---

### Task 2: Move Dashboard's top bar into the sidebar (cleanup)

**Files:**
- Modify: `apps/admin/src/renderer/screens/Dashboard.tsx`
- Modify: `apps/admin/src/renderer/screens/Dashboard.css`

**Interfaces:**
- Consumes: nothing new — `Dashboard` no longer needs `useAuth()` at all once its own top bar (the only thing that used `session`/`logout`) is removed. The sidebar (Task 1, already shipped) now owns sign-out globally.

Dashboard currently renders its own `<header className="dashboard-topbar">` with the app title and a sign-out button — redundant now that the sidebar (Task 1) provides both. This task removes it.

- [ ] **Step 1: Remove the top bar from `apps/admin/src/renderer/screens/Dashboard.tsx`**

Replace the file's contents with:

```tsx
import { stats, bookingsTrend, recentBookings } from './mockAnalytics';
import './Dashboard.css';

export function Dashboard() {
  const maxBookings = Math.max(...bookingsTrend.map((point) => point.bookings));

  return (
    <div className="dashboard">
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

(Removed: the `useAuth` import, the `session`/`logout` destructure, and the entire `<header className="dashboard-topbar">…</header>` block. Everything else — stats, trend chart, recent bookings — is unchanged.)

- [ ] **Step 2: Remove the now-unused top-bar CSS and the page background from `apps/admin/src/renderer/screens/Dashboard.css`**

The page background (`#e0e5ec`) is now supplied by `.app-layout-content` (Task 1's `AppLayout.css`), so `.dashboard` itself only needs padding. Change:

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
```

to:

```css
.dashboard {
  padding: 2rem;
  box-sizing: border-box;
}
```

Everything below `.dashboard-stats` in the file is unchanged — only these first four rules are touched.

- [ ] **Step 3: Manually verify**

```bash
node _tmp_drive.mjs click "[data-view=dashboard]"
node _tmp_drive.mjs shot 05-dashboard-no-topbar
```
Expected: Dashboard's stat cards are now the first thing in the content area (no title/sign-out row above them), sidebar unchanged on the left, no visible double background or padding seam between the sidebar's content area and the Dashboard's own padding.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/renderer/screens/Dashboard.tsx apps/admin/src/renderer/screens/Dashboard.css
git commit -m "refactor(admin): remove Dashboard's top bar, now owned by the sidebar"
```
