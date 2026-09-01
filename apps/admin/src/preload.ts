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
  imageCover?: string;
  images?: string[];
  summary?: string;
  duration?: number;
  maxGroupSize?: number;
  difficulty?: 'easy' | 'medium' | 'difficult';
  priceDiscount?: number;
  startLocation?: string;
  isActive?: boolean;
}

export type UpdateTourPayload = Partial<CreateTourPayload>;

export interface UploadImageResult {
  url: string;
}

export interface UploadImagesResult {
  urls: string[];
}

export interface TourListItem {
  id: string;
  title: string;
  slug: string;
  price: string;
  priceDiscount: string | null;
  imageCover: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ListToursResult {
  tours: TourListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface TourDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  summary: string | null;
  duration: number | null;
  maxGroupSize: number | null;
  difficulty: 'easy' | 'medium' | 'difficult' | null;
  price: string;
  priceDiscount: string | null;
  ratingsAverage: string;
  ratingsQuantity: number;
  imageCover: string | null;
  images: string[];
  startDates: string[];
  startLocation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categories: CategorySummary[];
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
  update: (id: string, payload: UpdateTourPayload, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('tours:update', id, payload, accessToken),
  delete: (id: string, accessToken: string): Promise<void> => ipcRenderer.invoke('tours:delete', id, accessToken),
  get: (id: string, accessToken: string): Promise<TourDetail> => ipcRenderer.invoke('tours:get', id, accessToken),
  uploadImage: (
    fileBase64: string,
    filename: string,
    mimetype: string,
    accessToken: string,
  ): Promise<UploadImageResult> =>
    ipcRenderer.invoke('tours:upload-image', fileBase64, filename, mimetype, accessToken),
  uploadImages: (
    files: { data: string; filename: string; mimetype: string }[],
    accessToken: string,
  ): Promise<UploadImagesResult> => ipcRenderer.invoke('tours:upload-images', files, accessToken),
  list: (page: number, limit: number, accessToken: string): Promise<ListToursResult> =>
    ipcRenderer.invoke('tours:list', page, limit, accessToken),
});
