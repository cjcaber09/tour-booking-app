import type {
  AdminSession,
  CreateTourPayload,
  UpdateTourPayload,
  UploadImageResult,
  UploadImagesResult,
  ListToursResult,
  TourDetail,
} from '../preload';

declare global {
  interface Window {
    authAPI: {
      login: (email: string, password: string) => Promise<AdminSession>;
      getSession: () => Promise<AdminSession | null>;
      logout: () => Promise<void>;
    };
    toursAPI: {
      create: (payload: CreateTourPayload, accessToken: string) => Promise<unknown>;
      update: (id: string, payload: UpdateTourPayload, accessToken: string) => Promise<unknown>;
      delete: (id: string, accessToken: string) => Promise<void>;
      get: (id: string, accessToken: string) => Promise<TourDetail>;
      uploadImage: (
        fileBase64: string,
        filename: string,
        mimetype: string,
        accessToken: string,
      ) => Promise<UploadImageResult>;
      uploadImages: (
        files: { data: string; filename: string; mimetype: string }[],
        accessToken: string,
      ) => Promise<UploadImagesResult>;
      list: (page: number, limit: number, accessToken: string) => Promise<ListToursResult>;
    };
  }
}

export {};
