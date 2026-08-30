import { describe, it, expect, beforeAll } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../src/lib/tokens';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});

describe('tokens', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken({ adminId: 'admin-1' });
    expect(verifyAccessToken(token).adminId).toBe('admin-1');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken('admin-1');
    expect(verifyRefreshToken(token).adminId).toBe('admin-1');
  });

  it('hashes a token deterministically', () => {
    const token = 'some-refresh-token';
    expect(hashToken(token)).toBe(hashToken(token));
  });
});
