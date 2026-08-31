# Admin Appearance Settings & Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark theme to the admin app (defaulting to the OS's color scheme, overridable to Light/Dark) and a real Settings screen with an Appearance tab to control it, replacing Settings' current `ComingSoon` placeholder.

**Architecture:** Every hardcoded color across the app's CSS becomes a CSS custom property, defined once at `:root` (light) with a `[data-theme="dark"]` override block, both in `index.css`. A plain TS module (`theme.ts`, no React Context — only one component reads/writes it) resolves the stored preference (`localStorage`) against `window.matchMedia`, sets `data-theme` on `<html>` before React's first paint, and keeps following OS changes live while set to "System." A new Settings screen (tab shell + Appearance tab) is the only consumer of `theme.ts`'s public API.

**Tech Stack:** React 19, TypeScript, plain CSS custom properties — no new dependencies.

## Global Constraints

- No React Context for theme state — `theme.ts` is a plain module (`getStoredTheme`, `setTheme`, `initTheme`), consumed directly by the one component that needs it.
- `initTheme()` must run in `apps/admin/src/renderer.tsx` **before** `createRoot(...).render(...)` — applying `data-theme` before React's first paint avoids a flash of the wrong theme on launch.
- `localStorage` key is exactly `admin.theme`, values are exactly `'system' | 'light' | 'dark'`, default (no stored value) is `'system'`.
- Theme selection is 3-way (System/Light/Dark), applies immediately on click — no save button.
- Box-shadow offsets/blur radii (e.g. `9px 9px 16px`, `6px 6px 12px`) are unchanged between themes — only the shadow *colors* become variables; the neumorphic geometry stays identical.
- Exact CSS variable names and values (light / dark) — every file in this plan uses these names verbatim:

  | Variable | Light | Dark |
  |---|---|---|
  | `--color-bg` | `#e0e5ec` | `#242b3d` |
  | `--color-shadow-dark` | `#a3b1c6` | `#171c29` |
  | `--color-shadow-light` | `#ffffff` | `#2f3852` |
  | `--color-sidebar-edge-shadow` | `rgba(163, 177, 198, 0.4)` | `rgba(0, 0, 0, 0.45)` |
  | `--color-sidebar-hover` | `rgba(163, 177, 198, 0.25)` | `rgba(255, 255, 255, 0.06)` |
  | `--color-text-heading` | `#374151` | `#e5e7eb` |
  | `--color-text-secondary` | `#4b5563` | `#cbd5e1` |
  | `--color-text-muted` | `#6b7280` | `#94a3b8` |
  | `--color-text-stat` | `#1f2937` | `#f8fafc` |
  | `--color-border` | `#c8d0dc` | `#313b52` |
  | `--color-border-strong` | `#d3dae4` | `#3a4560` |
  | `--color-accent-start` | `#7c9cf0` | `#7c9cf0` |
  | `--color-accent-end` | `#4c6ef5` | `#5b7cf5` |
  | `--color-error` | `#b91c1c` | `#f87171` |
  | `--color-status-confirmed-bg` / `-text` | `#d1fae5` / `#065f46` | `#064e3b` / `#6ee7b7` |
  | `--color-status-pending-bg` / `-text` | `#fef3c7` / `#92400e` | `#78350f` / `#fcd34d` |
  | `--color-status-cancelled-bg` / `-text` | `#fee2e2` / `#991b1b` | `#7f1d1d` / `#fca5a5` |

  (`--color-sidebar-edge-shadow` and `--color-sidebar-hover` aren't in the design spec's table — they cover two `rgba()` shadow/hover tints in `Sidebar.css` that the spec's table didn't itemize individually. Same reasoning as every other variable: the geometry stays fixed, only the color needs a light/dark pair.)

- No automated tests for this UI — established precedent for this app. Verification is manual via the existing CDP driver script (`_tmp_drive.mjs`, repo root, untracked — already supports `shot`, `text`, `login`, `click-text`, `click <selector>`, `eval <js>`).
- The admin Electron app is already running (`npm start -- -- --remote-debugging-port=9223` from `apps/admin`), Vite HMR live. Do not start or restart it.

---

### Task 1: Theme infrastructure — CSS variables, dark palette, `theme.ts`

**Files:**
- Modify: `apps/admin/src/index.css`
- Modify: `apps/admin/src/renderer/screens/Login.css`
- Modify: `apps/admin/src/renderer/layout/Sidebar.css`
- Modify: `apps/admin/src/renderer/layout/AppLayout.css`
- Modify: `apps/admin/src/renderer/screens/Dashboard.css`
- Modify: `apps/admin/src/renderer/screens/ComingSoon.css`
- Create: `apps/admin/src/renderer/theme.ts`
- Modify: `apps/admin/src/renderer.tsx`

**Interfaces:**
- Produces: every CSS variable in the Global Constraints table, available globally from `apps/admin/src/index.css`. Produces `theme.ts`'s exports: `export type ThemePreference = 'system' | 'light' | 'dark';`, `export function getStoredTheme(): ThemePreference`, `export function setTheme(pref: ThemePreference): void`, `export function initTheme(): void` — all consumed by Task 2's `AppearanceTab.tsx`.

- [ ] **Step 1: Rewrite `apps/admin/src/index.css`**

Replace the entire file with:

```css
@import '@fontsource/bebas-neue/index.css';
@import '@fontsource/open-sans/index.css';
@import '@fontsource/open-sans/600.css';

:root {
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  --color-bg: #e0e5ec;
  --color-shadow-dark: #a3b1c6;
  --color-shadow-light: #ffffff;
  --color-sidebar-edge-shadow: rgba(163, 177, 198, 0.4);
  --color-sidebar-hover: rgba(163, 177, 198, 0.25);
  --color-text-heading: #374151;
  --color-text-secondary: #4b5563;
  --color-text-muted: #6b7280;
  --color-text-stat: #1f2937;
  --color-border: #c8d0dc;
  --color-border-strong: #d3dae4;
  --color-accent-start: #7c9cf0;
  --color-accent-end: #4c6ef5;
  --color-error: #b91c1c;
  --color-status-confirmed-bg: #d1fae5;
  --color-status-confirmed-text: #065f46;
  --color-status-pending-bg: #fef3c7;
  --color-status-pending-text: #92400e;
  --color-status-cancelled-bg: #fee2e2;
  --color-status-cancelled-text: #991b1b;
}

:root[data-theme='dark'] {
  --color-bg: #242b3d;
  --color-shadow-dark: #171c29;
  --color-shadow-light: #2f3852;
  --color-sidebar-edge-shadow: rgba(0, 0, 0, 0.45);
  --color-sidebar-hover: rgba(255, 255, 255, 0.06);
  --color-text-heading: #e5e7eb;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #94a3b8;
  --color-text-stat: #f8fafc;
  --color-border: #313b52;
  --color-border-strong: #3a4560;
  --color-accent-start: #7c9cf0;
  --color-accent-end: #5b7cf5;
  --color-error: #f87171;
  --color-status-confirmed-bg: #064e3b;
  --color-status-confirmed-text: #6ee7b7;
  --color-status-pending-bg: #78350f;
  --color-status-pending-text: #fcd34d;
  --color-status-cancelled-bg: #7f1d1d;
  --color-status-cancelled-text: #fca5a5;
}

body {
  font-family: var(--font-body);
  margin: 0;
}

.neumorphic-button {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 12px;
  background: var(--color-bg);
  box-shadow: 6px 6px 12px var(--color-shadow-dark), -6px -6px 12px var(--color-shadow-light);
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-heading);
  cursor: pointer;
}

.neumorphic-button:active {
  box-shadow: inset 4px 4px 8px var(--color-shadow-dark), inset -4px -4px 8px var(--color-shadow-light);
}

.neumorphic-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Rewrite `apps/admin/src/renderer/screens/Login.css`**

Replace the entire file with:

```css
.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--color-bg);
  font-family: var(--font-body);
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 320px;
  padding: 2.5rem;
  border-radius: 24px;
  background: var(--color-bg);
  box-shadow: 9px 9px 16px var(--color-shadow-dark), -9px -9px 16px var(--color-shadow-light);
}

.login-card h1 {
  font-family: var(--font-display);
  font-size: 1.75rem;
  letter-spacing: 0.05em;
  margin: 0;
  text-align: center;
  color: var(--color-text-heading);
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.login-field input {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 12px;
  background: var(--color-bg);
  box-shadow: inset 4px 4px 8px var(--color-shadow-dark), inset -4px -4px 8px var(--color-shadow-light);
  outline: none;
  font-size: 1rem;
  color: var(--color-text-heading);
}

.login-error {
  color: var(--color-error);
  font-size: 0.875rem;
  margin: 0;
}
```

(`.login-field input` gains an explicit `color: var(--color-text-heading);` — it had no color rule before, silently relying on the browser's default black text, which would be unreadable typed into a dark input background. This is required for dark mode to actually work here, not a stylistic extra.)

- [ ] **Step 3: Rewrite `apps/admin/src/renderer/layout/Sidebar.css`**

Replace the entire file with:

```css
.sidebar {
  display: flex;
  flex-direction: column;
  width: 220px;
  flex-shrink: 0;
  height: 100vh;
  background: var(--color-bg);
  box-shadow: 4px 0 12px var(--color-sidebar-edge-shadow);
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
  color: var(--color-text-heading);
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
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-align: left;
}

.sidebar-nav-item:hover {
  background: var(--color-sidebar-hover);
}

.sidebar-nav-item-active {
  background: var(--color-bg);
  box-shadow: inset 4px 4px 8px var(--color-shadow-dark), inset -4px -4px 8px var(--color-shadow-light);
  color: var(--color-text-stat);
}

.sidebar-nav-icon {
  flex-shrink: 0;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--color-border);
  padding-top: 1rem;
}

.sidebar-collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.sidebar-chevron-collapsed {
  transform: rotate(180deg);
}
```

- [ ] **Step 4: Update `apps/admin/src/renderer/layout/AppLayout.css`**

Replace the entire file with:

```css
.app-layout {
  display: flex;
  height: 100vh;
}

.app-layout-content {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg);
}
```

- [ ] **Step 5: Rewrite `apps/admin/src/renderer/screens/Dashboard.css`**

Replace the entire file with:

```css
.dashboard {
  padding: 2rem;
  box-sizing: border-box;
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
  background: var(--color-bg);
  box-shadow: 9px 9px 16px var(--color-shadow-dark), -9px -9px 16px var(--color-shadow-light);
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2.5rem;
  letter-spacing: 0.03em;
  color: var(--color-text-stat);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.dashboard-trend,
.dashboard-recent {
  padding: 1.5rem;
  border-radius: 20px;
  background: var(--color-bg);
  box-shadow: 9px 9px 16px var(--color-shadow-dark), -9px -9px 16px var(--color-shadow-light);
  margin-bottom: 2rem;
}

.dashboard-trend h2,
.dashboard-recent h2 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  letter-spacing: 0.03em;
  margin: 0 0 1rem;
  color: var(--color-text-heading);
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
  background: linear-gradient(180deg, var(--color-accent-start), var(--color-accent-end));
  min-height: 4px;
}

.trend-bar-label {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.recent-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  color: var(--color-text-heading);
}

.recent-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  color: var(--color-text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}

.recent-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border-strong);
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-confirmed {
  background: var(--color-status-confirmed-bg);
  color: var(--color-status-confirmed-text);
}

.status-pending {
  background: var(--color-status-pending-bg);
  color: var(--color-status-pending-text);
}

.status-cancelled {
  background: var(--color-status-cancelled-bg);
  color: var(--color-status-cancelled-text);
}
```

- [ ] **Step 6: Rewrite `apps/admin/src/renderer/screens/ComingSoon.css`**

Replace the entire file with:

```css
.coming-soon {
  padding: 2rem;
}

.coming-soon h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem;
  color: var(--color-text-heading);
}

.coming-soon p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0;
}
```

- [ ] **Step 7: Create `apps/admin/src/renderer/theme.ts`**

```ts
export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'admin.theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function getStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setTheme(pref: ThemePreference): void {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
}

export function initTheme(): void {
  applyTheme(getStoredTheme());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme(getStoredTheme());
  });
}
```

- [ ] **Step 8: Wire `initTheme()` into `apps/admin/src/renderer.tsx`**

Replace the file's contents with:

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './renderer/App';
import { initTheme } from './renderer/theme';
import './index.css';

initTheme();

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container #app not found');
}

createRoot(container).render(<App />);
```

`initTheme()` runs before `createRoot(...).render(...)` so `data-theme` is set on `<html>` before React's first paint — otherwise there'd be a flash of the light theme before it switches to dark on every launch when the resolved theme is dark.

- [ ] **Step 9: Manually verify the CSS variable system and dark palette**

No UI control exists yet (Task 2 builds it) — verify by forcing the `data-theme` attribute directly via the driver's `eval` command. The app is already running with Vite HMR, so these edits apply live. From the repo root:

```bash
node _tmp_drive.mjs shot t1-before
node _tmp_drive.mjs eval "document.documentElement.dataset.theme = 'dark'"
node _tmp_drive.mjs shot t1-forced-dark
```
Expected: `t1-before` looks unchanged from before this task (light palette, since `initTheme()` just resolved to whatever `t1-before`'s environment already was). `t1-forced-dark` shows the whole visible screen (sidebar + whatever content area is active) switched to the dark palette — dark slate-blue backgrounds, light text, dark-adjusted shadows — with every visible surface (sidebar, cards/content, buttons) re-themed, not just some of them. Open both screenshots and compare.

```bash
node _tmp_drive.mjs click "[data-view=bookings]"
node _tmp_drive.mjs shot t1-forced-dark-bookings
```
Expected: the `ComingSoon` placeholder screen is also dark-themed (proves the variable system isn't Dashboard-specific).

```bash
node _tmp_drive.mjs eval "document.documentElement.dataset.theme = 'light'"
node _tmp_drive.mjs click "[data-view=dashboard]"
```
Reset back to light and Dashboard, leaving the app in a normal state for the next task.

- [ ] **Step 10: Commit**

```bash
git add apps/admin/src/index.css apps/admin/src/renderer/screens/Login.css apps/admin/src/renderer/layout/Sidebar.css apps/admin/src/renderer/layout/AppLayout.css apps/admin/src/renderer/screens/Dashboard.css apps/admin/src/renderer/screens/ComingSoon.css apps/admin/src/renderer/theme.ts apps/admin/src/renderer.tsx
git commit -m "feat(admin): CSS variable theming system with light/dark palettes"
```

---

### Task 2: Settings screen with Appearance tab

**Files:**
- Create: `apps/admin/src/renderer/screens/settings/Settings.tsx`
- Create: `apps/admin/src/renderer/screens/settings/Settings.css`
- Create: `apps/admin/src/renderer/screens/settings/AppearanceTab.tsx`
- Modify: `apps/admin/src/renderer/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `ThemePreference`, `getStoredTheme`, `setTheme` from `apps/admin/src/renderer/theme.ts` (Task 1). Consumes the CSS variables from Task 1 (`--color-*`, `--font-*`).
- Produces: `Settings` component (named export), rendered by `AppLayout.tsx` when `activeView === 'settings'`.

- [ ] **Step 1: Create `apps/admin/src/renderer/screens/settings/Settings.css`**

```css
.settings {
  padding: 2rem;
}

.settings h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.05em;
  margin: 0 0 1.5rem;
  color: var(--color-text-heading);
}

.settings-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1.5rem;
}

.settings-tab {
  padding: 0.625rem 1rem;
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.settings-tab:hover {
  color: var(--color-text-heading);
}

.settings-tab-active {
  color: var(--color-text-heading);
  border-bottom-color: var(--color-accent-end);
}

.settings-content {
  max-width: 480px;
}

.settings-field-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem;
}

.appearance-control {
  display: flex;
  gap: 0.5rem;
  padding: 0.375rem;
  border-radius: 14px;
  background: var(--color-bg);
  box-shadow: inset 3px 3px 6px var(--color-shadow-dark), inset -3px -3px 6px var(--color-shadow-light);
  width: fit-content;
}

.appearance-option {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.appearance-option-active {
  background: var(--color-bg);
  box-shadow: 4px 4px 8px var(--color-shadow-dark), -4px -4px 8px var(--color-shadow-light);
  color: var(--color-text-heading);
}
```

- [ ] **Step 2: Create `apps/admin/src/renderer/screens/settings/AppearanceTab.tsx`**

```tsx
import { useState } from 'react';
import { getStoredTheme, setTheme, type ThemePreference } from '../../theme';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceTab() {
  const [selected, setSelected] = useState<ThemePreference>(getStoredTheme());

  function handleSelect(value: ThemePreference) {
    setTheme(value);
    setSelected(value);
  }

  return (
    <div>
      <p className="settings-field-label">Theme</p>
      <div className="appearance-control">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`appearance-option ${option.value === selected ? 'appearance-option-active' : ''}`}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/admin/src/renderer/screens/settings/Settings.tsx`**

```tsx
import { useState } from 'react';
import { AppearanceTab } from './AppearanceTab';
import './Settings.css';

type SettingsTab = 'appearance';

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [{ id: 'appearance', label: 'Appearance' }];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  return (
    <div className="settings">
      <h1>Settings</h1>
      <div className="settings-tabs">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${tab.id === activeTab ? 'settings-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="settings-content">{activeTab === 'appearance' && <AppearanceTab />}</div>
    </div>
  );
}
```

- [ ] **Step 4: Wire `Settings` into `AppLayout.tsx`, replacing the ternary with a `switch`**

Replace `apps/admin/src/renderer/layout/AppLayout.tsx` entirely with:

```tsx
import { useState } from 'react';
import { Sidebar, type View } from './Sidebar';
import { Dashboard } from '../screens/Dashboard';
import { Settings } from '../screens/settings/Settings';
import { ComingSoon } from '../screens/ComingSoon';
import './AppLayout.css';

const SIDEBAR_COLLAPSED_KEY = 'admin.sidebarCollapsed';

function renderContent(activeView: View) {
  switch (activeView) {
    case 'dashboard':
      return <Dashboard />;
    case 'settings':
      return <Settings />;
    case 'bookings':
      return <ComingSoon title="Bookings" />;
    case 'tours':
      return <ComingSoon title="Tours" />;
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

(`VIEW_TITLES` is gone — each `ComingSoon` case now passes its own literal `title`, and `Settings`/`Dashboard` no longer go through `ComingSoon` at all.)

- [ ] **Step 5: Manually verify the Appearance tab end-to-end**

```bash
node _tmp_drive.mjs click "[data-view=settings]"
node _tmp_drive.mjs shot t2-settings-appearance
```
Expected: a real Settings screen — "Settings" title, an "Appearance" tab (only one, but visually a tab), and a System/Light/Dark segmented control with "System" highlighted as active (assuming no prior theme choice was stored).

```bash
node _tmp_drive.mjs click-text "Dark"
node _tmp_drive.mjs shot t2-dark-selected
node _tmp_drive.mjs eval "localStorage.getItem('admin.theme')"
```
Expected: the whole app (sidebar included) switches to the dark palette immediately; "Dark" is now the highlighted option; `eval` output is exactly `"dark"`.

```bash
node _tmp_drive.mjs click "[data-view=dashboard]"
node _tmp_drive.mjs shot t2-dashboard-dark
```
Expected: Dashboard renders correctly in dark mode (stat cards, trend chart, table all re-themed) — confirms the choice persists across navigating away from Settings.

```bash
node _tmp_drive.mjs click "[data-view=settings]"
node _tmp_drive.mjs click-text "Light"
node _tmp_drive.mjs eval "localStorage.getItem('admin.theme')"
```
Expected: `eval` output is exactly `"light"`, app returns to the light palette. Leave it on Light (or System) so the app is in a normal state afterward.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/renderer/screens/settings apps/admin/src/renderer/layout/AppLayout.tsx
git commit -m "feat(admin): Settings screen with Appearance tab (System/Light/Dark)"
```
