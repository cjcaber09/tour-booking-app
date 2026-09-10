import { useState } from 'react';
import { AppearanceTab } from './AppearanceTab';
import { cn } from '../../lib/utils';

type SettingsTab = 'appearance';

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [{ id: 'appearance', label: 'Appearance' }];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

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
      <div className="max-w-[480px]">{activeTab === 'appearance' && <AppearanceTab />}</div>
    </div>
  );
}
