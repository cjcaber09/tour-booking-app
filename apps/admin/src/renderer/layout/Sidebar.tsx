import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  DashboardIcon,
  BookingsIcon,
  CalendarIcon,
  ToursIcon,
  SettingsIcon,
  UsersIcon,
  ChevronIcon,
  SignOutIcon,
} from './icons';

export type View = 'dashboard' | 'bookings' | 'calendar' | 'tours' | 'settings' | 'users';

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
  { view: 'settings', label: 'Settings', Icon: SettingsIcon },
  { view: 'users', label: 'Users', Icon: UsersIcon },
];

export function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapsed }: SidebarProps) {
  const { logout } = useAuth();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

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
        {collapsed ? 'AT' : 'Andy Tours Admin'}
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map(({ view, label, Icon }) => (
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
