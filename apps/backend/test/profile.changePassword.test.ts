import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createTestAdmin, deleteTestAdmin, TEST_PASSWORD, DB_HEAVY_TEST_TIMEOUT } from './helpers';

const app = createApp();
const originalPassword = TEST_PASSWORD;
let testEmail: string;
let adminId: string;
let accessToken: string;

beforeAll(async () => {
  ({ id: adminId, email: testEmail, accessToken } = await createTestAdmin('Change Password Test Admin'));
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { adminId } });
  await deleteTestAdmin(adminId);
  await prisma.$disconnect();
});

describe('POST /profile/change-password', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app)
      .post('/profile/change-password')
      .send({ currentPassword: originalPassword, newPassword: 'brand-new-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a wrong current password (401)', async () => {
    const res = await request(app)
      .post('/profile/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'totally-wrong', newPassword: 'brand-new-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('current password is incorrect');
  });

  it('rejects a new password under 8 characters (400)', async () => {
    const res = await request(app)
      .post('/profile/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: originalPassword, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it(
    'changes the password, revokes refresh tokens, and old credentials stop working',
    async () => {
      const loginRes = await request(app).post('/auth/login').send({ email: testEmail, password: originalPassword });
      expect(loginRes.status).toBe(200);
      const oldRefreshToken = loginRes.body.refreshToken as string;

      const changeRes = await request(app)
        .post('/profile/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: originalPassword, newPassword: 'brand-new-password' });
      expect(changeRes.status).toBe(204);

      const oldLoginRes = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: originalPassword });
      expect(oldLoginRes.status).toBe(401);

      const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken: oldRefreshToken });
      expect(refreshRes.status).toBe(401);

      const newLoginRes = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: 'brand-new-password' });
      expect(newLoginRes.status).toBe(200);
    },
    DB_HEAVY_TEST_TIMEOUT,
  );
});
