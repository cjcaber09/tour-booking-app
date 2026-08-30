import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  adminId: string;
}

function requireSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, requireSecret('JWT_ACCESS_SECRET'), { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, requireSecret('JWT_ACCESS_SECRET')) as AccessTokenPayload;
}

export function signRefreshToken(adminId: string): string {
  return jwt.sign({ adminId }, requireSecret('JWT_REFRESH_SECRET'), { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): { adminId: string } {
  return jwt.verify(token, requireSecret('JWT_REFRESH_SECRET')) as { adminId: string };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}
