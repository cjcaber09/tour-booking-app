import type {
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
} from '../preload';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export interface AdminSummary {
  id: string;
  email: string;
  name: string;
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

export async function backendListTours(page: number, limit: number, accessToken: string): Promise<ListToursResult> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${BACKEND_URL}/tours?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendGetTour(id: string, accessToken: string): Promise<TourDetail> {
  const res = await fetch(`${BACKEND_URL}/tours/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseJsonOrThrow(res);
}

export async function backendUpdateTour(id: string, payload: UpdateTourPayload, accessToken: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/tours/${id}`, {
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
  const res = await fetch(`${BACKEND_URL}/tours/${id}`, {
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

export async function backendGetBooking(id: string, accessToken: string): Promise<BookingDetail> {
  const res = await fetch(`${BACKEND_URL}/bookings/${id}`, {
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
  const res = await fetch(`${BACKEND_URL}/bookings/${id}`, {
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
  const res = await fetch(`${BACKEND_URL}/bookings/${id}/confirm`, {
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
  const res = await fetch(`${BACKEND_URL}/bookings/${id}/ongoing`, {
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
  const res = await fetch(`${BACKEND_URL}/bookings/${id}/cancel`, {
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
  const res = await fetch(`${BACKEND_URL}/bookings/${id}/payments`, {
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

  const res = await fetch(`${BACKEND_URL}/bookings/${id}/payments/upload-proof`, {
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
