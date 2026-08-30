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
