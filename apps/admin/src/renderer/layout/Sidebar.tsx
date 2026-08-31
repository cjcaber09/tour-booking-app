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
          className="neumorphic-button sidebar-collapse-toggle"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronIcon className={collapsed ? 'sidebar-chevron-collapsed' : ''} />
        </button>
      </div>
    </aside>
  );
}
