import { create } from 'zustand';
import type { AppSettingsDto } from '../../preload';
import { useAuthStore } from './authStore';

type Status = 'loading' | 'ready' | 'error';
type DateInput = string | number | Date;

// All defaults pre-fetch to the same values the backend's AppSettings model defaults
// to, so every formatter here is safe to call from any screen immediately — none of
// them crash before the first fetch resolves.
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_DATE_FORMAT = 'MM/DD/YYYY';
const DEFAULT_TIME_FORMAT = '12h';

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

interface AppSettingsState {
  settings: AppSettingsDto | null;
  status: Status;
  error: string | null;
  refresh: () => Promise<void>;
  reset: () => void;
  formatCurrency: (amount: number | string) => string;
  formatDate: (input: DateInput) => string;
  formatTime: (input: DateInput) => string;
  formatDateTime: (input: DateInput) => string;
}

// Rebuilt only when settings.currency changes (see refresh()), not on every call —
// mirrors the useMemo the old Context used, since formatCurrency is called often
// (e.g. twice per row in the Bookings table).
let currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: DEFAULT_CURRENCY });
let cachedCurrency = DEFAULT_CURRENCY;

function currencyFormatterFor(currency: string): Intl.NumberFormat {
  if (currency !== cachedCurrency) {
    cachedCurrency = currency;
    currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  }
  return currencyFormatter;
}

export const useAppSettingsStore = create<AppSettingsState>()((set, get) => ({
  settings: null,
  status: 'loading',
  error: null,

  refresh: async () => {
    const session = useAuthStore.getState().session;
    if (!session) {
      return;
    }
    set({ status: 'loading', error: null });
    try {
      const result = await window.settingsAPI.get(session.accessToken);
      set({ settings: result, status: 'ready' });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not load settings.', status: 'error' });
    }
  },

  reset: () => set({ settings: null, status: 'loading', error: null }),

  formatCurrency: (amount) => {
    const currency = get().settings?.currency ?? DEFAULT_CURRENCY;
    return currencyFormatterFor(currency).format(Number(amount));
  },

  formatDate: (input) => {
    const { settings } = get();
    return formatDateWithPattern(input, settings?.dateFormat ?? DEFAULT_DATE_FORMAT, settings?.timezone ?? DEFAULT_TIMEZONE);
  },

  formatTime: (input) => {
    const { settings } = get();
    return formatTimeWithPattern(input, settings?.timeFormat ?? DEFAULT_TIME_FORMAT, settings?.timezone ?? DEFAULT_TIMEZONE);
  },

  formatDateTime: (input) => `${get().formatDate(input)} ${get().formatTime(input)}`,
}));

// Literal alias so every existing `useAppSettings()` call site keeps working unchanged
// after the import-path swap.
export const useAppSettings = useAppSettingsStore;
