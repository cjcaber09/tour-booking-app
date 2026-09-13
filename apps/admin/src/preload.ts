import { contextBridge, ipcRenderer } from 'electron';

export type AdminRole = 'ADMIN' | 'LEAD_GUIDE' | 'GUIDE' | 'STAFF';

export interface AdminSummary {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
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
  categoryIds?: string[];
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

export interface TourListFilters {
  q?: string;
  isActive?: boolean;
}

export interface ListToursResult {
  tours: TourListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: { ALL: number; ACTIVE: number; INACTIVE: number };
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface ListCategoriesResult {
  categories: CategorySummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCategoryPayload {
  name: string;
}

export type UpdateCategoryPayload = CreateCategoryPayload;

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

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
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

export interface CustomerListItem extends CustomerSummary {
  createdAt: string;
  updatedAt: string;
}

export interface ListCustomersResult {
  customers: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerDetail extends CustomerListItem {
  bookings: BookingListItem[];
}

export interface CreateCustomerPayload {
  name: string;
  email: string;
  phone?: string | null;
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

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

export type PaymentMethod = 'CASH' | 'INVOICE_REFERENCE' | 'FILE';

export interface PaymentRecord {
  id: string;
  amount: string;
  method: PaymentMethod;
  invoiceReference: string | null;
  proofUrl: string | null;
  createdAt: string;
}

export type RecordPaymentPayload =
  | { method: 'CASH'; amount: number }
  | { method: 'INVOICE_REFERENCE'; amount: number; invoiceReference: string }
  | { method: 'FILE'; amount: number; proofUrl: string };

export interface UploadPaymentProofResult {
  url: string;
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
  finishDate: string;
  totalPrice: string;
  amountPaid: string;
  createdAt: string;
  cancelledAt: string | null;
  tour: { id: string; title: string };
  customer: { id: string; name: string; email: string };
}

export interface ListBookingsResult {
  bookings: BookingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  // ALL is every status combined, not just these 3 — ONGOING/COMPLETED have no tab.
  statusCounts: { ALL: number; PENDING: number; CONFIRMED: number; CANCELLED: number };
}

export interface CalendarBookingsResult {
  bookings: BookingListItem[];
  from: string;
  to: string;
}

export interface BookingsStatsResult {
  totalBookings: number;
  upcomingBookings: number;
  cancellationsThisMonth: number;
  revenueThisMonth: string;
  bookingsTrend: { date: string; count: number }[];
}

export interface BookingDetail {
  id: string;
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  participants: number;
  startDate: string;
  finishDate: string;
  totalPrice: string;
  amountPaid: string;
  refundAmount: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  tour: { id: string; title: string; slug: string; imageCover: string | null };
  customer: CustomerSummary;
  payments: PaymentRecord[];
}

contextBridge.exposeInMainWorld('authAPI', {
  login: (email: string, password: string): Promise<AdminSession> =>
    ipcRenderer.invoke('auth:login', email, password),
  getSession: (): Promise<AdminSession | null> => ipcRenderer.invoke('auth:getSession'),
  logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
  requestRecovery: (email: string): Promise<void> => ipcRenderer.invoke('auth:request-recovery', email),
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
  list: (page: number, limit: number, filters: TourListFilters, accessToken: string): Promise<ListToursResult> =>
    ipcRenderer.invoke('tours:list', page, limit, filters, accessToken),
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
  ongoing: (id: string, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('bookings:ongoing', id, accessToken),
  cancel: (id: string, payload: CancelBookingPayload, accessToken: string): Promise<unknown> =>
    ipcRenderer.invoke('bookings:cancel', id, payload, accessToken),
  calendar: (accessToken: string): Promise<CalendarBookingsResult> =>
    ipcRenderer.invoke('bookings:calendar', accessToken),
  stats: (accessToken: string): Promise<BookingsStatsResult> =>
    ipcRenderer.invoke('bookings:stats', accessToken),
  recordPayment: (id: string, payload: RecordPaymentPayload, accessToken: string): Promise<BookingDetail> =>
    ipcRenderer.invoke('bookings:record-payment', id, payload, accessToken),
  uploadPaymentProof: (
    id: string,
    fileBase64: string,
    filename: string,
    mimetype: string,
    accessToken: string,
  ): Promise<UploadPaymentProofResult> =>
    ipcRenderer.invoke('bookings:upload-payment-proof', id, fileBase64, filename, mimetype, accessToken),
});

contextBridge.exposeInMainWorld('customersAPI', {
  search: (q: string, accessToken: string): Promise<SearchCustomersResult> =>
    ipcRenderer.invoke('customers:search', q, accessToken),
  list: (page: number, limit: number, q: string, accessToken: string): Promise<ListCustomersResult> =>
    ipcRenderer.invoke('customers:list', page, limit, q, accessToken),
  get: (id: string, accessToken: string): Promise<CustomerDetail> =>
    ipcRenderer.invoke('customers:get', id, accessToken),
  create: (payload: CreateCustomerPayload, accessToken: string): Promise<CustomerListItem> =>
    ipcRenderer.invoke('customers:create', payload, accessToken),
  update: (id: string, payload: UpdateCustomerPayload, accessToken: string): Promise<CustomerListItem> =>
    ipcRenderer.invoke('customers:update', id, payload, accessToken),
  delete: (id: string, accessToken: string): Promise<{ id: string }> =>
    ipcRenderer.invoke('customers:delete', id, accessToken),
});

contextBridge.exposeInMainWorld('categoriesAPI', {
  list: (page: number, limit: number, accessToken: string): Promise<ListCategoriesResult> =>
    ipcRenderer.invoke('categories:list', page, limit, accessToken),
  create: (payload: CreateCategoryPayload, accessToken: string): Promise<CategorySummary> =>
    ipcRenderer.invoke('categories:create', payload, accessToken),
  update: (id: string, payload: UpdateCategoryPayload, accessToken: string): Promise<CategorySummary> =>
    ipcRenderer.invoke('categories:update', id, payload, accessToken),
  delete: (id: string, accessToken: string): Promise<{ id: string }> =>
    ipcRenderer.invoke('categories:delete', id, accessToken),
});

export interface AuditEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  adminId: string | null;
  adminName: string | null;
  adminRole: AdminRole | null;
}

export interface ListAuditEntriesResult {
  entries: AuditEntry[];
}

contextBridge.exposeInMainWorld('auditAPI', {
  list: (accessToken: string): Promise<ListAuditEntriesResult> => ipcRenderer.invoke('audit:list', accessToken),
});

export interface AppSettingsDto {
  id: string;
  key: string;
  appName: string;
  companyName: string;
  logoUrl: string | null;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  language: string;
  currency: string;
  fiscalYearStartMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAppSettingsPayload {
  appName?: string;
  companyName?: string;
  logoUrl?: string | null;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  language?: string;
  currency?: string;
  fiscalYearStartMonth?: number;
}

export interface UploadLogoResult {
  url: string;
}

contextBridge.exposeInMainWorld('settingsAPI', {
  get: (accessToken: string): Promise<AppSettingsDto> => ipcRenderer.invoke('settings:get', accessToken),
  update: (payload: UpdateAppSettingsPayload, accessToken: string): Promise<AppSettingsDto> =>
    ipcRenderer.invoke('settings:update', payload, accessToken),
  uploadLogo: (
    fileBase64: string,
    filename: string,
    mimetype: string,
    accessToken: string,
  ): Promise<UploadLogoResult> => ipcRenderer.invoke('settings:upload-logo', fileBase64, filename, mimetype, accessToken),
});

export interface UpdateProfilePayload {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: AdminRole;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UploadAvatarResult {
  url: string;
}

contextBridge.exposeInMainWorld('profileAPI', {
  update: (payload: UpdateProfilePayload, accessToken: string): Promise<AdminSummary> =>
    ipcRenderer.invoke('profile:update', payload, accessToken),
  uploadAvatar: (
    fileBase64: string,
    filename: string,
    mimetype: string,
    accessToken: string,
  ): Promise<UploadAvatarResult> =>
    ipcRenderer.invoke('profile:upload-avatar', fileBase64, filename, mimetype, accessToken),
  changePassword: (payload: ChangePasswordPayload, accessToken: string): Promise<void> =>
    ipcRenderer.invoke('profile:change-password', payload, accessToken),
});

export interface AdminListItem extends AdminSummary {
  isActive: boolean;
  recoveryRequestedAt: string | null;
}

export interface CreateAdminPayload {
  name: string;
  email: string;
  role: AdminRole;
  phone?: string | null;
}

export interface CreateAdminResult extends AdminListItem {
  temporaryPassword: string;
}

export interface UpdateAdminPayload {
  name?: string;
  phone?: string | null;
  role?: AdminRole;
  isActive?: boolean;
}

export interface AdminListFilters {
  q?: string;
  isActive?: boolean;
}

export interface ListAdminsResult {
  admins: AdminListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: { ALL: number; ACTIVE: number; SUSPENDED: number };
}

contextBridge.exposeInMainWorld('adminsAPI', {
  list: (page: number, limit: number, filters: AdminListFilters, accessToken: string): Promise<ListAdminsResult> =>
    ipcRenderer.invoke('admins:list', page, limit, filters, accessToken),
  create: (payload: CreateAdminPayload, accessToken: string): Promise<CreateAdminResult> =>
    ipcRenderer.invoke('admins:create', payload, accessToken),
  update: (id: string, payload: UpdateAdminPayload, accessToken: string): Promise<AdminListItem> =>
    ipcRenderer.invoke('admins:update', id, payload, accessToken),
  delete: (id: string, accessToken: string): Promise<{ id: string }> =>
    ipcRenderer.invoke('admins:delete', id, accessToken),
  resetPassword: (id: string, accessToken: string): Promise<CreateAdminResult> =>
    ipcRenderer.invoke('admins:reset-password', id, accessToken),
  countRecoveryRequests: (accessToken: string): Promise<{ total: number }> =>
    ipcRenderer.invoke('admins:count-recovery-requests', accessToken),
});
