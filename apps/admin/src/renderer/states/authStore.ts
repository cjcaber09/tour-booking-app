import { create } from 'zustand';
import type { AdminSession } from '../../preload';
import { cleanIpcErrorMessage } from '../lib/ipc';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

// Comfortably under the backend's 15-minute access-token TTL (apps/backend/src/lib/tokens.ts).
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

interface AuthState {
  session: AdminSession | null;
  status: Status;
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

let initialized = false;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => {
  // All session-changing entry points reduce to the same shape: session set (or
  // null) + status derived from it. Only fires the refresh-timer arm/disarm on an
  // actual authenticated <-> unauthenticated transition — a same-state token
  // refresh just updates `session` in place. Deliberately does NOT reach into any
  // other store (that's authOrchestrator.ts's job) to avoid a circular import
  // between authStore.ts and every store that reads its session.
  function applySession(session: AdminSession | null) {
    const wasAuthenticated = get().status === 'authenticated';
    const isAuthenticated = session !== null;
    set({ session, status: isAuthenticated ? 'authenticated' : 'unauthenticated', error: null });
    if (!wasAuthenticated && isAuthenticated) {
      armRefreshTimer();
    } else if (wasAuthenticated && !isAuthenticated) {
      clearRefreshTimer();
    }
  }

  function armRefreshTimer() {
    clearRefreshTimer();
    refreshTimer = setInterval(() => {
      // getSession() never throws (it catches internally and resolves null on any
      // failure) — a missed/expired tick safely degrades to a logout transition.
      window.authAPI.getSession().then(applySession);
    }, REFRESH_INTERVAL_MS);
  }

  function clearRefreshTimer() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  return {
    session: null,
    status: 'loading',
    error: null,

    init: async () => {
      if (initialized) {
        return;
      }
      initialized = true;
      try {
        const restored = await window.authAPI.getSession();
        applySession(restored);
      } catch {
        // Mirrors the main process's own fallback for a failed restore (e.g. an
        // undecryptable session file) — treat it as no session rather than hanging
        // on "loading" forever.
        applySession(null);
      }
    },

    login: async (email, password) => {
      try {
        const session = await window.authAPI.login(email, password);
        applySession(session);
      } catch (err) {
        // Deliberately does NOT go through applySession (that would wipe error
        // right back to null). LoginScreen reads `error` from this store to render
        // the failure message, and its own submit handler's catch block is empty
        // specifically because the message is expected to already be here by the
        // time it runs.
        set({ error: err instanceof Error ? cleanIpcErrorMessage(err.message) : 'login failed' });
        throw err;
      }
    },

    logout: async () => {
      // Always clears local state, even if the IPC call itself fails (e.g. backend
      // unreachable) — matches what clicking "Sign out" implies. A failed backend
      // call does mean the old refresh token isn't revoked server-side, but it will
      // still expire naturally.
      try {
        await window.authAPI.logout();
      } finally {
        applySession(null);
      }
    },

    refreshSession: async () => {
      const restored = await window.authAPI.getSession();
      applySession(restored);
    },
  };
});

// Literal alias so every existing `useAuth()` call site (destructuring session/status/
// error/login/logout/refreshSession) keeps working unchanged after the import-path swap.
export const useAuth = useAuthStore;
