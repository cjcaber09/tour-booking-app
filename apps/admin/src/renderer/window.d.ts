import type { AdminSession } from '../preload';

declare global {
  interface Window {
    authAPI: {
      login: (email: string, password: string) => Promise<AdminSession>;
      getSession: () => Promise<AdminSession | null>;
      logout: () => Promise<void>;
    };
  }
}

export {};
