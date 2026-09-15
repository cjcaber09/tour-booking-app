import { useState } from 'react';
import { useAuth } from '../states/authStore';
import { useAppSettings } from '../states/appSettingsStore';
import { cn } from '../lib/utils';
import { ROLE_LABELS } from '../lib/roles';
import type { AdminRole } from '../../preload';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  DashboardIcon,
  BookingsIcon,
  CalendarIcon,
  ToursIcon,
  SettingsIcon,
  UsersIcon,
  CustomersIcon,
  AuditIcon,
  ChevronIcon,
  SignOutIcon,
} from './icons';

export type View = 'dashboard' | 'bookings' | 'calendar' | 'tours' | 'customers' | 'settings' | 'users' | 'audit';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const NAV_ITEMS: { view: View; label: string; Icon: typeof DashboardIcon }[] = [
  { view: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { view: 'bookings', label: 'Bookings', Icon: BookingsIcon },
  { view: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { view: 'tours', label: 'Tours', Icon: ToursIcon },
  { view: 'customers', label: 'Customers', Icon: CustomersIcon },
  { view: 'users', label: 'Users', Icon: UsersIcon },
  // import.meta.env.DEV is statically replaced at build time, so Vite/Rollup constant-folds
  // and tree-shakes this branch out of packaged (electron-forge package/make) builds entirely
  // — not just hidden, genuinely absent from production.
  ...(import.meta.env.DEV ? [{ view: 'audit' as const, label: 'Audit', Icon: AuditIcon }] : []),
  { view: 'settings', label: 'Settings', Icon: SettingsIcon },
];

// A view absent from this map is visible to every role (dashboard/bookings/calendar/
// settings). Exported so AppLayout.tsx's renderContent() can enforce the exact same
// rule server-side-of-the-router, rather than trusting nav-hiding alone.
export const VIEW_ROLES: Partial<Record<View, AdminRole[]>> = {
  tours: ['ADMIN', 'STAFF'],
  customers: ['ADMIN', 'STAFF'],
  users: ['ADMIN'],
  audit: ['ADMIN'],
};

export function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapsed }: SidebarProps) {
  const { logout, session } = useAuth();
  const { settings } = useAppSettings();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const admin = session?.admin;
  // Falls back to the same default the AppSettings model uses, so this renders correctly
  // even before the first settings fetch resolves.
  const appName = settings?.appName ?? 'Andy Tours';

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    const allowed = VIEW_ROLES[item.view];
    return !allowed || (admin && allowed.includes(admin.role));
  });

  const navItemClass = (active: boolean) =>
    cn(
      'justify-start gap-3 overflow-hidden whitespace-nowrap px-3 py-2.5 text-left text-sm text-secondary hover:bg-sidebar-hover',
      active && 'bg-surface neu-inset text-stat hover:bg-surface',
    );

  return (
    <aside
      className={cn(
        'box-border flex h-screen shrink-0 flex-col bg-surface px-4 py-6 shadow-[4px_0_12px_var(--color-sidebar-edge-shadow)] transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16 px-3' : 'w-55',
      )}
    >
      <div className="mb-8 overflow-hidden whitespace-nowrap font-display text-xl tracking-[0.05em] text-heading">
        {collapsed ? 'AT' : `${appName} Admin`}
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {visibleNavItems.map(({ view, label, Icon }) => (
          <Button
            key={view}
            variant="ghost"
            data-view={view}
            className={navItemClass(view === activeView)}
            onClick={() => onNavigate(view)}
            title={collapsed ? label : undefined}
          >
            <Icon className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Button>
        ))}
      </nav>

      {admin && (
        <div
          className={cn(
            'mb-2 flex items-center gap-3 overflow-hidden whitespace-nowrap px-1',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? `${admin.name} — ${ROLE_LABELS[admin.role]}` : undefined}
        >
          {admin.avatarUrl ? (
            <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={admin.avatarUrl} alt="" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-shadow-dark)] text-xs font-semibold text-heading opacity-70">
              {admin.name.charAt(0).toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-heading">{admin.name}</span>
              <span className="truncate text-xs text-secondary">{ROLE_LABELS[admin.role]}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button
          variant="ghost"
          className={navItemClass(false)}
          onClick={() => setConfirmingSignOut(true)}
          title={collapsed ? 'Sign out' : undefined}
        >
          <SignOutIcon className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </Button>

        <Button size="icon" onClick={onToggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <ChevronIcon className={collapsed ? 'rotate-180' : ''} />
        </Button>
      </div>

      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out"
          message="Are you sure you want to sign out?"
          confirmLabel="Sign out"
          danger
          onConfirm={() => {
            setConfirmingSignOut(false);
            logout();
          }}
          onCancel={() => setConfirmingSignOut(false)}
        />
      )}
    </aside>
  );
}
