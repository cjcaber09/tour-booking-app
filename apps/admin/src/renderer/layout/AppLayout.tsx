import { useState } from 'react';
import { Sidebar, type View } from './Sidebar';
import { Dashboard } from '../screens/Dashboard';
import { Settings } from '../screens/settings/Settings';
import { Tours } from '../screens/tours/Tours';
import { Bookings } from '../screens/bookings/Bookings';
import { ComingSoon } from '../screens/ComingSoon';
import { Toaster } from '../Toaster';
import './AppLayout.css';

const SIDEBAR_COLLAPSED_KEY = 'admin.sidebarCollapsed';

function renderContent(activeView: View) {
  switch (activeView) {
    case 'dashboard':
      return <Dashboard />;
    case 'settings':
      return <Settings />;
    case 'tours':
      return <Tours />;
    case 'bookings':
      return <Bookings />;
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
      <Toaster />
    </div>
  );
}
