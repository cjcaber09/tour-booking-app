export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error';
  leaving: boolean;
}

type Listener = (toasts: Toast[]) => void;

const EXIT_DURATION_MS = 200;
const AUTO_DISMISS_MS = 4000;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener(toasts));
}

function push(message: string, variant: Toast['variant']) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, message, variant, leaving: false }];
  notify();
  setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
}

function dismiss(id: string) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, EXIT_DURATION_MS);
}

export const toast = {
  success: (message: string) => push(message, 'success'),
  error: (message: string) => push(message, 'error'),
};

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}
