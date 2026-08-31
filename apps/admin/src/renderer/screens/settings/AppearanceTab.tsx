import { useState } from 'react';
import { getStoredTheme, setTheme, type ThemePreference } from '../../theme';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceTab() {
  const [selected, setSelected] = useState<ThemePreference>(getStoredTheme());

  function handleSelect(value: ThemePreference) {
    setTheme(value);
    setSelected(value);
  }

  return (
    <div>
      <p className="settings-field-label">Theme</p>
      <div className="appearance-control">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`appearance-option ${option.value === selected ? 'appearance-option-active' : ''}`}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
