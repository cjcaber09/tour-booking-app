# Admin Sidebar Navigation — Design

Date: 2026-08-31

## Purpose

The admin app currently has exactly one authenticated screen (Dashboard), so `App.tsx` renders
it directly with no navigation chrome. This spec adds a collapsible sidebar with 5 sections
(Dashboard, Bookings, Tours, Settings, Users), turning the single-screen app into a real
multi-section shell — the nav structure the original dashboard design deliberately deferred
("only one authenticated screen exists today, so navigation chrome with nowhere to navigate is
premature. Revisit once a second screen is added").

## Scope

In scope:
- A collapsible sidebar: app branding, 5 nav items (icon + label), a collapse toggle, and the
  sign-out action (moved here from Dashboard's top bar, since sign-out is global chrome now,
  not Dashboard-specific).
- Client-side view switching between the 5 sections — no URL routing.
- Dashboard keeps its existing content (stat cards, trend chart, recent bookings) but loses its
  own top bar.
- Bookings, Tours, Settings, and Users each render a shared "coming soon" placeholder screen.
- Collapsed/expanded sidebar state persists across app restarts (`localStorage`).

Out of scope (explicitly deferred):
- Real content for Bookings/Tours/Settings/Users — none of the backing data models
  (`Booking`, `Tour`) or admin-management endpoints exist yet. Each gets a single generic
  placeholder, not 4 bespoke screens.
- A routing library (`react-router` or similar) — 5 flat, top-level sections with no
  deep-linking or bookmarking need (single-window Electron app) don't justify one. Plain React
  state is sufficient and this spec explicitly rejects adding the dependency.
- An icon library (`lucide-react` or similar) — 5 fixed nav icons are hand-written inline SVG
  components instead, consistent with this app's existing precedent of avoiding a charting
  library for the Dashboard's trend chart.
- Nested/sub-navigation within a section (e.g., Settings sub-tabs) — flat top-level nav only.

## Component structure

```
apps/admin/src/renderer/
  layout/
    AppLayout.tsx     # owns activeView + sidebar-collapsed state; renders Sidebar + content
    AppLayout.css
    Sidebar.tsx        # branding, 5 nav buttons, collapse toggle, sign-out
    Sidebar.css
    icons.tsx          # 5 nav icons + collapse-chevron icon, as small inline-SVG components
  screens/
    Dashboard.tsx       # unchanged content, top bar removed
    Dashboard.css        # dashboard-topbar rules removed
    ComingSoon.tsx        # NEW — generic placeholder, takes a `title` prop
    ComingSoon.css
```

`App.tsx`'s authenticated branch changes from `<Dashboard />` to `<AppLayout />`; `AppLayout` is
what decides which screen (`Dashboard` or `ComingSoon`) is currently visible.

## State and interfaces

```ts
type View = 'dashboard' | 'bookings' | 'tours' | 'settings' | 'users';
```

`AppLayout`:
- `const [activeView, setActiveView] = useState<View>('dashboard');` — in-memory only, resets to
  `'dashboard'` on app restart (no need to persist; restarting the app returning to the Dashboard
  is expected desktop-app behavior).
- `const [collapsed, setCollapsed] = useState<boolean>(...)` — initialized by reading
  `localStorage.getItem('admin.sidebarCollapsed')` (`'true'`/`'false'`, default `false`), written
  back on every toggle. This is the one piece of UI state this spec persists.
- Renders `<Sidebar activeView={activeView} onNavigate={setActiveView} collapsed={collapsed} onToggleCollapsed={...} />` next to a content area that renders `<Dashboard />` when `activeView === 'dashboard'` and `<ComingSoon title="..." />` otherwise (title text: "Bookings", "Tours", "Settings", "Users" respectively).

`Sidebar` props:
```ts
interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}
```
Internally calls `useAuth()` for `logout()` (same pattern `Login.tsx`/`Dashboard.tsx` already
use) — sign-out doesn't need to be threaded through props.

`ComingSoon` props:
```ts
interface ComingSoonProps {
  title: string;
}
```
Renders the title (display font, consistent with other screen headings) and a short static
"This section isn't built yet" message. One component, reused 4 times.

## Layout and visuals

- `AppLayout` is a flex row: `Sidebar` + a scrollable content `<main>`, both `height: 100vh`.
- Sidebar expanded width: `220px`. Collapsed width: `64px` (icon-only rail — labels are hidden
  via conditional rendering, not just visually clipped, so collapsed-state markup stays simple).
  Width transitions with a CSS `transition` on `width` for a smooth collapse/expand.
- Nav items: icon + label in a row, `border-radius` pill/rounded-rect highlight on the active
  item and on hover, using the same neumorphic-adjacent palette as the rest of the app
  (`#e0e5ec` background family, `#374151`/`#6b7280` text). Active item gets an inset neumorphic
  shadow (visually "pressed"), consistent with `.neumorphic-button:active` elsewhere in the app.
- Collapse toggle: a chevron icon button pinned to the bottom of the sidebar; rotates 180°
  between states via CSS.
- Sign-out: a `.neumorphic-button`-styled control at the very bottom of the sidebar, below the
  collapse toggle — icon-only when collapsed (reusing the pattern nav items use), icon + "Sign
  out" label when expanded.
- Dashboard's own `.dashboard-topbar` (title + admin name + sign-out) is deleted — the sidebar
  now provides wayfinding and sign-out globally, so Dashboard's content starts directly with the
  stat cards.

## Error handling

None needed — this is static UI/local state with no async operations of its own (sign-out
already has error handling in `AuthContext`, unchanged by this spec).

## Testing

No automated tests, consistent with this app's established precedent (Login and Dashboard
slices both rely on manual verification only — no test framework exists for this app's UI).
Verified manually via the existing CDP driver script: expand/collapse toggle, click through all
5 nav items, confirm Dashboard content and placeholder screens render, confirm collapsed state
survives an app restart.
