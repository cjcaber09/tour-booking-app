import type {
  CreateTourPayload,
  UpdateTourPayload,
  UploadImageResult,
  UploadImagesResult,
  ListToursResult,
  TourDetail,
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
