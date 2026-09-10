import { useState } from 'react';
import { getStoredTheme, setTheme, type ThemePreference } from '../../theme';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';

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
      <p className="m-0 mb-3 text-sm font-semibold text-muted">Theme</p>
      <div className="flex w-fit gap-2 rounded-[14px] bg-surface p-1.5 shadow-[inset_3px_3px_6px_var(--color-shadow-dark),inset_-3px_-3px_6px_var(--color-shadow-light)]">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            className={cn(
              'rounded-[10px] px-4 py-2 text-sm text-secondary',
              option.value === selected && 'bg-surface text-heading neu-raised-md',
            )}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
