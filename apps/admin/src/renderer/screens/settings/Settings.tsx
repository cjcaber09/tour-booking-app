import { useState } from 'react';
import { AppearanceTab } from './AppearanceTab';
import './Settings.css';

type SettingsTab = 'appearance';

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [{ id: 'appearance', label: 'Appearance' }];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  return (
    <div className="settings">
      <h1>Settings</h1>
      <div className="settings-tabs">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${tab.id === activeTab ? 'settings-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="settings-content">{activeTab === 'appearance' && <AppearanceTab />}</div>
    </div>
  );
}
