import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { AppSettingsDto } from '../preload';
import { useAuth } from './AuthContext';

type Status = 'loading' | 'ready' | 'error';
type DateInput = string | number | Date;

interface AppSettingsContextValue {
  settings: AppSettingsDto | null;
  status: Status;
  error: string | null;
  refresh: () => Promise<void>;
  formatCurrency: (amount: number | string) => string;
  formatDate: (input: DateInput) => string;
  formatTime: (input: DateInput) => string;
  formatDateTime: (input: DateInput) => string;
}

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

// Builds the date string manually from Intl parts (rather than trusting a locale's
// native ordering) so it actually follows the admin's chosen dateFormat pattern —
// toLocaleDateString() only respects the browser/system locale, not this setting.
function formatDateWithPattern(input: DateInput, pattern: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(toDate(input));
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  switch (pattern) {
    case 'DD/MM/YYYY':
      return `${map.day}/${map.month}/${map.year}`;
    case 'YYYY-MM-DD':
      return `${map.year}-${map.month}-${map.day}`;
    case 'MM/DD/YYYY':
    default:
      return `${map.month}/${map.day}/${map.year}`;
  }
}

function formatTimeWithPattern(input: DateInput, pattern: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: pattern === '12h',
    timeZone,
  }).format(toDate(input));
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [settings, setSettings] = useState<AppSettingsDto | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const result = await window.settingsAPI.get(session.accessToken);
      setSettings(result);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settings.');
      setStatus('error');
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      refresh();
    }
  }, [session, refresh]);

  // All default pre-fetch to the same values the backend's AppSettings model
  // defaults to, so every formatter here is safe to call from any screen
  // immediately — none of them crash before the first fetch resolves.
  const currency = settings?.currency ?? 'USD';
  const timezone = settings?.timezone ?? 'UTC';
  const dateFormat = settings?.dateFormat ?? 'MM/DD/YYYY';
  const timeFormat = settings?.timeFormat ?? '12h';

  const formatCurrency = useMemo(() => {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    return (amount: number | string) => formatter.format(Number(amount));
  }, [currency]);

  const formatDate = useCallback((input: DateInput) => formatDateWithPattern(input, dateFormat, timezone), [
    dateFormat,
    timezone,
  ]);
  const formatTime = useCallback((input: DateInput) => formatTimeWithPattern(input, timeFormat, timezone), [
    timeFormat,
    timezone,
  ]);
  const formatDateTime = useCallback(
    (input: DateInput) => `${formatDate(input)} ${formatTime(input)}`,
    [formatDate, formatTime],
  );

  return (
    <AppSettingsContext.Provider
      value={{ settings, status, error, refresh, formatCurrency, formatDate, formatTime, formatDateTime }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return ctx;
}
