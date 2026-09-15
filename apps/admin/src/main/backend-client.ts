import type {
  CreateTourPayload,
  UpdateTourPayload,
  UploadImageResult,
  UploadImagesResult,
  ListToursResult,
  TourListFilters,
  TourDetail,
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
  UpdateProfilePayload,
  ChangePasswordPayload,
  UploadAvatarResult,
  AdminRole,
  AdminListItem,
  CreateAdminPayload,
  CreateAdminResult,
  UpdateAdminPayload,
  ListAdminsResult,
  AdminListFilters,
  ListAssignableGuidesResult,
} from '../preload';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

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

async function parseJsonOrThrow(res: Response): Promise<any> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || 'request failed');
  }
  return body;
}

export async function backendLogin(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow(res);
}

export async function backendRefresh(refreshToken: string): Promise<{ accessToken: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return parseJsonOrThrow(res);
}

export async function backendLogout(refreshToken: string): Promise<void> {
  await fetch(`${BACKEND_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

// Fire-and-forget, same as backendLogout above: the backend deliberately returns an identical
// 204 whether or not the email exists (no information leak), and the Login screen shows the
// same generic confirmation message regardless of outcome — there's nothing for the caller to
// branch on.
export async function backendRequestRecovery(email: string): Promise<void> {
  await fetch(`${BACKEND_URL}/auth/request-recovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function backendMe(accessToken: string): Promise<AdminSummary> {
  const res = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendCreateTour(payload: CreateTourPayload, accessToken: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/tours`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendListTours(
  page: number,
  limit: number,
  filters: TourListFilters,
  accessToken: string,
): Promise<ListToursResult> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.q) params.set('q', filters.q);
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));
  const res = await fetch(`${BACKEND_URL}/tours?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendGetTour(id: string, accessToken: string): Promise<TourDetail> {
  const res = await fetch(`${BACKEND_URL}/tours/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendUpdateTour(id: string, payload: UpdateTourPayload, accessToken: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/tours/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendDeleteTour(id: string, accessToken: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/tours/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await parseJsonOrThrow(res);
}

export async function backendUploadImages(
  files: { data: string; filename: string; mimetype: string }[],
  accessToken: string,
): Promise<UploadImagesResult> {
  const formData = new FormData();
  for (const file of files) {
    const buffer = Buffer.from(file.data, 'base64');
    formData.append('images', new Blob([buffer], { type: file.mimetype }), file.filename);
  }

  const res = await fetch(`${BACKEND_URL}/tours/upload-images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendListBookings(
  page: number,
  limit: number,
  filters: BookingListFilters,
  accessToken: string,
): Promise<ListBookingsResult> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.status) params.set('status', filters.status);
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
  if (filters.tourId) params.set('tourId', filters.tourId);
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.q) params.set('q', filters.q);
  const res = await fetch(`${BACKEND_URL}/bookings?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendGetBookingsCalendar(accessToken: string): Promise<CalendarBookingsResult> {
  const res = await fetch(`${BACKEND_URL}/bookings/calendar`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendGetBookingsStats(accessToken: string): Promise<BookingsStatsResult> {
  const res = await fetch(`${BACKEND_URL}/bookings/stats`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendGetBooking(id: string, accessToken: string): Promise<BookingDetail> {
  const res = await fetch(`${BACKEND_URL}/bookings/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendCreateBooking(payload: CreateBookingPayload, accessToken: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendUpdateBooking(
  id: string,
  payload: UpdateBookingPayload,
  accessToken: string,
): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendConfirmBooking(id: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/bookings/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendMarkBookingOngoing(id: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/bookings/${encodeURIComponent(id)}/ongoing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendCancelBooking(
  id: string,
  payload: CancelBookingPayload,
  accessToken: string,
): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/bookings/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendRecordPayment(
  id: string,
  payload: RecordPaymentPayload,
  accessToken: string,
): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/bookings/${encodeURIComponent(id)}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendUploadPaymentProof(
  id: string,
  fileBase64: string,
  filename: string,
  mimetype: string,
  accessToken: string,
): Promise<UploadPaymentProofResult> {
  const buffer = Buffer.from(fileBase64, 'base64');
  const formData = new FormData();
  formData.append('proof', new Blob([buffer], { type: mimetype }), filename);

  const res = await fetch(`${BACKEND_URL}/bookings/${encodeURIComponent(id)}/payments/upload-proof`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendSearchCustomers(q: string, accessToken: string): Promise<SearchCustomersResult> {
  const params = new URLSearchParams({ q });
  const res = await fetch(`${BACKEND_URL}/customers?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendListCustomers(
  page: number,
  limit: number,
  q: string,
  accessToken: string,
): Promise<ListCustomersResult> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set('q', q);
  const res = await fetch(`${BACKEND_URL}/customers?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendGetCustomer(id: string, accessToken: string): Promise<CustomerDetail> {
  const res = await fetch(`${BACKEND_URL}/customers/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendCreateCustomer(
  payload: CreateCustomerPayload,
  accessToken: string,
): Promise<CustomerListItem> {
  const res = await fetch(`${BACKEND_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendUpdateCustomer(
  id: string,
  payload: UpdateCustomerPayload,
  accessToken: string,
): Promise<CustomerListItem> {
  const res = await fetch(`${BACKEND_URL}/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendDeleteCustomer(id: string, accessToken: string): Promise<{ id: string }> {
  const res = await fetch(`${BACKEND_URL}/customers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendListCategories(
  page: number,
  limit: number,
  accessToken: string,
): Promise<ListCategoriesResult> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${BACKEND_URL}/categories?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendCreateCategory(
  payload: CreateCategoryPayload,
  accessToken: string,
): Promise<CategorySummary> {
  const res = await fetch(`${BACKEND_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendUpdateCategory(
  id: string,
  payload: UpdateCategoryPayload,
  accessToken: string,
): Promise<CategorySummary> {
  const res = await fetch(`${BACKEND_URL}/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendDeleteCategory(id: string, accessToken: string): Promise<{ id: string }> {
  const res = await fetch(`${BACKEND_URL}/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendListAudit(accessToken: string): Promise<ListAuditEntriesResult> {
  const res = await fetch(`${BACKEND_URL}/audit`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendUploadImage(
  fileBase64: string,
  filename: string,
  mimetype: string,
  accessToken: string,
): Promise<UploadImageResult> {
  const buffer = Buffer.from(fileBase64, 'base64');
  const formData = new FormData();
  formData.append('image', new Blob([buffer], { type: mimetype }), filename);

  const res = await fetch(`${BACKEND_URL}/tours/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendGetSettings(accessToken: string): Promise<AppSettingsDto> {
  const res = await fetch(`${BACKEND_URL}/settings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendUpdateSettings(
  payload: UpdateAppSettingsPayload,
  accessToken: string,
): Promise<AppSettingsDto> {
  const res = await fetch(`${BACKEND_URL}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendUploadLogo(
  fileBase64: string,
  filename: string,
  mimetype: string,
  accessToken: string,
): Promise<UploadLogoResult> {
  const buffer = Buffer.from(fileBase64, 'base64');
  const formData = new FormData();
  formData.append('logo', new Blob([buffer], { type: mimetype }), filename);

  const res = await fetch(`${BACKEND_URL}/settings/upload-logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendUpdateProfile(payload: UpdateProfilePayload, accessToken: string): Promise<AdminSummary> {
  const res = await fetch(`${BACKEND_URL}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendUploadAvatar(
  fileBase64: string,
  filename: string,
  mimetype: string,
  accessToken: string,
): Promise<UploadAvatarResult> {
  const buffer = Buffer.from(fileBase64, 'base64');
  const formData = new FormData();
  formData.append('avatar', new Blob([buffer], { type: mimetype }), filename);

  const res = await fetch(`${BACKEND_URL}/profile/upload-avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendChangePassword(payload: ChangePasswordPayload, accessToken: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/profile/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
}

export async function backendListAdmins(
  page: number,
  limit: number,
  filters: AdminListFilters,
  accessToken: string,
): Promise<ListAdminsResult> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.q) params.set('q', filters.q);
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));
  const res = await fetch(`${BACKEND_URL}/admins?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendListAssignableGuides(accessToken: string): Promise<ListAssignableGuidesResult> {
  const res = await fetch(`${BACKEND_URL}/admins/assignable-guides`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendCreateAdmin(payload: CreateAdminPayload, accessToken: string): Promise<CreateAdminResult> {
  const res = await fetch(`${BACKEND_URL}/admins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendUpdateAdmin(
  id: string,
  payload: UpdateAdminPayload,
  accessToken: string,
): Promise<AdminListItem> {
  const res = await fetch(`${BACKEND_URL}/admins/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendDeleteAdmin(id: string, accessToken: string): Promise<{ id: string }> {
  const res = await fetch(`${BACKEND_URL}/admins/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendResetAdminPassword(id: string, accessToken: string): Promise<CreateAdminResult> {
  const res = await fetch(`${BACKEND_URL}/admins/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, error: body.error, details: body.details }));
  }
  return body;
}

export async function backendCountAdminRecoveryRequests(accessToken: string): Promise<{ total: number }> {
  const params = new URLSearchParams({ page: '1', limit: '1', hasRecoveryRequest: 'true' });
  const res = await fetch(`${BACKEND_URL}/admins?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await parseJsonOrThrow(res);
  return { total: body.total };
}
