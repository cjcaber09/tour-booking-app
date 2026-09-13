import { useState } from 'react';
import { Sidebar, type View } from './Sidebar';
import { Dashboard } from '../screens/Dashboard';
import { Settings } from '../screens/settings/Settings';
import { Tours } from '../screens/tours/Tours';
import { Customers } from '../screens/customers/Customers';
import { Bookings } from '../screens/bookings/Bookings';
import { CalendarPage } from '../screens/calendar/CalendarPage';
import { AuditPage } from '../screens/audit/AuditPage';
import { Users } from '../screens/users/Users';
import { Toaster } from '../Toaster';
import { useRecoveryRequestNotice } from '../lib/useRecoveryRequestNotice';
import { useSidebarStore } from '../states/sidebarStore';

function renderContent(activeView: View) {
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
      <main className="flex-1 overflow-y-auto bg-surface">{renderContent(activeView)}</main>
      <Toaster />
    </div>
  );
}
