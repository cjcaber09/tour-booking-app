import { useState } from 'react';
import { Sidebar, type View, VIEW_ROLES } from './Sidebar';
import { Dashboard } from '../screens/Dashboard';
import { Settings } from '../screens/settings/Settings';
import { Tours } from '../screens/tours/Tours';
import { Customers } from '../screens/customers/Customers';
import { Bookings } from '../screens/bookings/Bookings';
import { CalendarPage } from '../screens/calendar/CalendarPage';
import { AuditPage } from '../screens/audit/AuditPage';
import { Users } from '../screens/users/Users';
import { Toaster } from '../Toaster';
import { useAuth } from '../states/authStore';
import { useRecoveryRequestNotice } from '../lib/useRecoveryRequestNotice';
import { useSidebarStore } from '../states/sidebarStore';
import type { AdminRole } from '../../preload';

function renderContent(activeView: View, role: AdminRole | undefined) {
  // Nav buttons for a role-restricted view are already hidden in Sidebar.tsx, and
  // this app has no router — activeView only ever changes via a nav button's
  // onClick — so this is a second, cheap layer rather than the only guard, matching
  // the same reasoning the 'audit' case below already applies for production builds.
  const allowedRoles = VIEW_ROLES[activeView];
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return null;
  }

  switch (activeView) {
    case 'dashboard':
      return <Dashboard />;
    case 'settings':
      return <Settings />;
    case 'tours':
      return <Tours />;
    case 'customers':
      return <Customers />;
    case 'bookings':
      return <Bookings />;
    case 'calendar':
      return <CalendarPage />;
    case 'users':
      return <Users />;
    case 'audit':
      // The nav entry itself is already stripped from packaged builds (see Sidebar.tsx's
      // import.meta.env.DEV gate); this is a second layer so the route can't be reached
      // by any other means in a production build either.
      return import.meta.env.DEV ? <AuditPage /> : null;
  }
}

export function AppLayout() {
  const { session } = useAuth();
  const [activeView, setActiveView] = useState<View>('dashboard');
  const { collapsed, toggleCollapsed } = useSidebarStore();

  useRecoveryRequestNotice(activeView);

  return (
    <div className="flex h-screen">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <main className="flex-1 overflow-y-auto bg-surface">{renderContent(activeView, session?.admin.role)}</main>
      <Toaster />
    </div>
  );
}
