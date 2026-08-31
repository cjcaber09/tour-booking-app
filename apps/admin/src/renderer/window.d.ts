import type { AdminSession, CreateTourPayload } from '../preload';

declare global {
  interface Window {
    authAPI: {
      login: (email: string, password: string) => Promise<AdminSession>;
      getSession: () => Promise<AdminSession | null>;
      logout: () => Promise<void>;
    };
    toursAPI: {
      create: (payload: CreateTourPayload, accessToken: string) => Promise<unknown>;
    };
  }
}

export {};
