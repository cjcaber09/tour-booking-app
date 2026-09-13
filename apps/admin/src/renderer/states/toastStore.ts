import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error';
  leaving: boolean;
  persistent?: boolean;
  position?: 'top-right' | 'bottom-right';
}

const EXIT_DURATION_MS = 200;
const AUTO_DISMISS_MS = 4000;

interface ToastState {
  toasts: Toast[];
  push: (
    message: string,
    variant: Toast['variant'],
    options?: { persistent?: boolean; position?: Toast['position'] },
  ) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  push: (message, variant, options) => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { id, message, variant, leaving: false, ...options }] });
    if (!options?.persistent) {
      setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
    }
    return id;
  },

  dismiss: (id) => {
    set({ toasts: get().toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, EXIT_DURATION_MS);
  },
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push(message, 'success'),
  error: (message: string) => useToastStore.getState().push(message, 'error'),
  // Does not auto-dismiss and is rendered in its own top-right stack — used for standing
  // notifications (e.g. "N account(s) need password recovery") rather than transient action
  // confirmations. Returns the toast id so a caller can avoid pushing duplicates.
  persistent: (message: string): string =>
    useToastStore.getState().push(message, 'error', { persistent: true, position: 'top-right' }),
};
