import type {
  AdminSession,
  CreateTourPayload,
  UpdateTourPayload,
  UploadImageResult,
  UploadImagesResult,
  ListToursResult,
  TourDetail,
  TourListFilters,
  BookingListFilters,
  ListBookingsResult,
  CalendarBookingsResult,
  BookingsStatsResult,
  BookingDetail,
  CreateBookingPayload,
  UpdateBookingPayload,
  CancelBookingPayload,
  RecordPaymentPayload,
  UploadPaymentProofResult,
  SearchCustomersResult,
  ListCustomersResult,
  CustomerDetail,
  CreateCustomerPayload,
  UpdateCustomerPayload,
  CustomerListItem,
  ListCategoriesResult,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CategorySummary,
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
  AdminListFilters,
  ListAssignableGuidesResult,
} from '../preload';

declare global {
  interface Window {
    authAPI: {
      login: (email: string, password: string) => Promise<AdminSession>;
      getSession: () => Promise<AdminSession | null>;
      logout: () => Promise<void>;
      requestRecovery: (email: string) => Promise<void>;
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
      list: (page: number, limit: number, filters: TourListFilters, accessToken: string) => Promise<ListToursResult>;
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
      stats: (accessToken: string) => Promise<BookingsStatsResult>;
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
      list: (page: number, limit: number, q: string, accessToken: string) => Promise<ListCustomersResult>;
      get: (id: string, accessToken: string) => Promise<CustomerDetail>;
      create: (payload: CreateCustomerPayload, accessToken: string) => Promise<CustomerListItem>;
      update: (id: string, payload: UpdateCustomerPayload, accessToken: string) => Promise<CustomerListItem>;
      delete: (id: string, accessToken: string) => Promise<{ id: string }>;
    };
    categoriesAPI: {
      list: (page: number, limit: number, accessToken: string) => Promise<ListCategoriesResult>;
      create: (payload: CreateCategoryPayload, accessToken: string) => Promise<CategorySummary>;
      update: (id: string, payload: UpdateCategoryPayload, accessToken: string) => Promise<CategorySummary>;
      delete: (id: string, accessToken: string) => Promise<{ id: string }>;
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
      list: (page: number, limit: number, filters: AdminListFilters, accessToken: string) => Promise<ListAdminsResult>;
      listAssignableGuides: (accessToken: string) => Promise<ListAssignableGuidesResult>;
      create: (payload: CreateAdminPayload, accessToken: string) => Promise<CreateAdminResult>;
      update: (id: string, payload: UpdateAdminPayload, accessToken: string) => Promise<AdminListItem>;
      delete: (id: string, accessToken: string) => Promise<{ id: string }>;
      resetPassword: (id: string, accessToken: string) => Promise<CreateAdminResult>;
      countRecoveryRequests: (accessToken: string) => Promise<{ total: number }>;
    };
  }
}

export {};
