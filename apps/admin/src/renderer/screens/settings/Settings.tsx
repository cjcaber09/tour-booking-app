import { useState } from 'react';
import { AppearanceTab } from './AppearanceTab';
import { GeneralTab } from './GeneralTab';
import { ProfileTab } from './ProfileTab';
import { SecurityTab } from './SecurityTab';
import { useAuth } from '../../AuthContext';
import { cn } from '../../lib/utils';

type SettingsTab = 'profile' | 'security' | 'general' | 'appearance';

export function Settings() {
  const { session } = useAuth();
  const isAdmin = session?.admin.role === 'ADMIN';

  const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    ...(isAdmin ? [{ id: 'general' as const, label: 'General' }] : []),
    { id: 'appearance', label: 'Appearance' },
  ];

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="p-8">
      <h1 className="m-0 mb-6 font-display text-[2rem] tracking-[0.05em] text-heading">Settings</h1>
      <div className="mb-6 flex gap-2 border-b border-border">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            className={cn('tab-button', tab.id === activeTab && 'tab-button-active')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="max-w-[640px]">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'general' && isAdmin && <GeneralTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
      </div>
    </div>
  );
}
