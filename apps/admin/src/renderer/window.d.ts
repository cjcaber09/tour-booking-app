import type { AdminSession, CreateTourPayload, UploadImageResult } from '../preload';

declare global {
  interface Window {
    authAPI: {
      login: (email: string, password: string) => Promise<AdminSession>;
      getSession: () => Promise<AdminSession | null>;
      logout: () => Promise<void>;
    };
    toursAPI: {
      create: (payload: CreateTourPayload, accessToken: string) => Promise<unknown>;
      uploadImage: (
        fileBase64: string,
        filename: string,
        mimetype: string,
        accessToken: string,
      ) => Promise<UploadImageResult>;
    };
  }
}

export {};
