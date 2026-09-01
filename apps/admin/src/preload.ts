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

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface CustomerInput {
  email: string;
  name: string;
  phone?: string;
}

export interface SearchCustomersResult {
  customers: CustomerSummary[];
}

export interface CreateBookingPayload {
  tourId: string;
  participants: number;
  startDate: string;
  customerId?: string;
  customer?: CustomerInput;
  notes?: string;
}

export type UpdateBookingPayload = Partial<CreateBookingPayload> & { amountPaid?: number };

export interface CancelBookingPayload {
  refundAmount: number;
}

export interface BookingListFilters {
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  tourId?: string;
  customerId?: string;
  q?: string;
}

export interface BookingListItem {
  id: string;
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  participants: number;
  startDate: string;
  totalPrice: string;
  amountPaid: string;
  createdAt: string;
  tour: { id: string; title: string };
  customer: { id: string; name: string; email: string };
}

export interface ListBookingsResult {
  bookings: BookingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BookingDetail {
  id: string;
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  participants: number;
  startDate: string;
  totalPrice: string;
  amountPaid: string;
  refundAmount: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  tour: { id: string; title: string; slug: string; imageCover: string | null };
  customer: CustomerSummary;
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

contextBridge.exposeInMainWorld('bookingsAPI', {
  list: (
    page: number,
    limit: number,
    filters: BookingListFilters,
    accessToken: string,
  ): Promise<ListBookingsResult> => ipcRenderer.invoke('bookings:list', page, limit, filters, accessToken),
  get: (id: string, accessToken: string): Promise<BookingDetail> =>
    ipcRenderer.invoke('bookings:get', id, accessToken),
  create: (payload: CreateBookingPayload, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('bookings:create', payload, accessToken),
  update: (id: string, payload: UpdateBookingPayload, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('bookings:update', id, payload, accessToken),
  confirm: (id: string, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('bookings:confirm', id, accessToken),
  cancel: (id: string, payload: CancelBookingPayload, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('bookings:cancel', id, payload, accessToken),
});

contextBridge.exposeInMainWorld('customersAPI', {
  search: (q: string, accessToken: string): Promise<SearchCustomersResult> =>
    ipcRenderer.invoke('customers:search', q, accessToken),
});
