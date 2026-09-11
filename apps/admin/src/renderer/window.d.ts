import type {
  AdminSession,
  CreateTourPayload,
  UpdateTourPayload,
  UploadImageResult,
  UploadImagesResult,
  ListToursResult,
  TourDetail,
  BookingListFilters,
  ListBookingsResult,
  CalendarBookingsResult,
  BookingDetail,
  CreateBookingPayload,
  UpdateBookingPayload,
  CancelBookingPayload,
  RecordPaymentPayload,
  UploadPaymentProofResult,
  SearchCustomersResult,
  ListAuditEntriesResult,
  AppSettingsDto,
  UpdateAppSettingsPayload,
  UploadLogoResult,
  AdminSummary,
  UpdateProfilePayload,
  ChangePasswordPayload,
  UploadAvatarResult,
  AdminListItem,
  CreateAdminPayload,
  CreateAdminResult,
  UpdateAdminPayload,
  ListAdminsResult,
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
    bookingsAPI: {
      list: (
        page: number,
        limit: number,
        filters: BookingListFilters,
        accessToken: string,
      ) => Promise<ListBookingsResult>;
      get: (id: string, accessToken: string) => Promise<BookingDetail>;
      create: (payload: CreateBookingPayload, accessToken: string) => Promise<unknown>;
      update: (id: string, payload: UpdateBookingPayload, accessToken: string) => Promise<unknown>;
      confirm: (id: string, accessToken: string) => Promise<unknown>;
      ongoing: (id: string, accessToken: string) => Promise<unknown>;
      cancel: (id: string, payload: CancelBookingPayload, accessToken: string) => Promise<unknown>;
      calendar: (accessToken: string) => Promise<CalendarBookingsResult>;
      recordPayment: (id: string, payload: RecordPaymentPayload, accessToken: string) => Promise<BookingDetail>;
      uploadPaymentProof: (
        id: string,
        fileBase64: string,
        filename: string,
        mimetype: string,
        accessToken: string,
      ) => Promise<UploadPaymentProofResult>;
    };
    customersAPI: {
      search: (q: string, accessToken: string) => Promise<SearchCustomersResult>;
    };
    auditAPI: {
      list: (accessToken: string) => Promise<ListAuditEntriesResult>;
    };
    settingsAPI: {
      get: (accessToken: string) => Promise<AppSettingsDto>;
      update: (payload: UpdateAppSettingsPayload, accessToken: string) => Promise<AppSettingsDto>;
      uploadLogo: (
        fileBase64: string,
        filename: string,
        mimetype: string,
        accessToken: string,
      ) => Promise<UploadLogoResult>;
    };
    profileAPI: {
      update: (payload: UpdateProfilePayload, accessToken: string) => Promise<AdminSummary>;
      uploadAvatar: (
        fileBase64: string,
        filename: string,
        mimetype: string,
        accessToken: string,
      ) => Promise<UploadAvatarResult>;
      changePassword: (payload: ChangePasswordPayload, accessToken: string) => Promise<void>;
    };
    adminsAPI: {
      list: (page: number, limit: number, accessToken: string) => Promise<ListAdminsResult>;
      create: (payload: CreateAdminPayload, accessToken: string) => Promise<CreateAdminResult>;
      update: (id: string, payload: UpdateAdminPayload, accessToken: string) => Promise<AdminListItem>;
      delete: (id: string, accessToken: string) => Promise<{ id: string }>;
    };
  }
}

export {};
