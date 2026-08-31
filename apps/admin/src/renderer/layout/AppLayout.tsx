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
