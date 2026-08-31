import { contextBridge, ipcRenderer } from 'electron';

export interface AdminSummary {
  id: string;
  email: string;
  name: string;
}

export interface AdminSession {
  accessToken: string;
  admin: AdminSummary;
}

export interface CreateTourPayload {
  title: string;
  description: string;
  price: number;
  imageCover: string;
  summary?: string;
  duration?: number;
  maxGroupSize?: number;
  difficulty?: 'easy' | 'medium' | 'difficult';
  priceDiscount?: number;
  startLocation?: string;
  isActive?: boolean;
}

export interface UploadImageResult {
  url: string;
}

contextBridge.exposeInMainWorld('authAPI', {
  login: (email: string, password: string): Promise<AdminSession> =>
    ipcRenderer.invoke('auth:login', email, password),
  getSession: (): Promise<AdminSession | null> => ipcRenderer.invoke('auth:getSession'),
  logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
});

contextBridge.exposeInMainWorld('toursAPI', {
  create: (payload: CreateTourPayload, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('tours:create', payload, accessToken),
  uploadImage: (
    fileBase64: string,
    filename: string,
    mimetype: string,
    accessToken: string,
  ): Promise<UploadImageResult> =>
    ipcRenderer.invoke('tours:upload-image', fileBase64, filename, mimetype, accessToken),
});
