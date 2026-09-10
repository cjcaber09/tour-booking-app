import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { signAccessToken } from '../src/lib/tokens';

const app = createApp();
const testEmailBase = `profile-update-test-${Date.now()}`;
let adminId: string;
let adminToken: string;
let guideId: string;
let guideToken: string;

beforeAll(async () => {
  const [admin, guide] = await Promise.all([
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-admin@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Profile Update Test Admin',
        role: 'ADMIN',
      },
    }),
    prisma.admin.create({
      data: {
        email: `${testEmailBase}-guide@example.com`,
        passwordHash: await hashPassword('correct-horse-battery-staple'),
        name: 'Profile Update Test Guide',
        role: 'GUIDE',
      },
    }),
  ]);
  adminId = admin.id;
  guideId = guide.id;
  adminToken = signAccessToken({ adminId });
  guideToken = signAccessToken({ adminId: guideId });
});

afterAll(async () => {
  await prisma.admin.deleteMany({ where: { id: { in: [adminId, guideId] } } });
  await prisma.$disconnect();
});

describe('PATCH /profile', () => {
  it('rejects a request with no authorization header', async () => {
    const res = await request(app).patch('/profile').send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('updates own name/phone for any role', async () => {
    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ name: 'Updated Guide Name', phone: '+1-555-0100' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Guide Name');
    expect(res.body.phone).toBe('+1-555-0100');
    expect(res.body.role).toBe('GUIDE');
  });

  it('rejects a non-ADMIN admin trying to change their own role (403)', async () => {
    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${guideToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);

    const stillGuide = await prisma.admin.findUnique({ where: { id: guideId } });
    expect(stillGuide?.role).toBe('GUIDE');
  });

  it('allows an ADMIN to change their own role', async () => {
    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'LEAD_GUIDE' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('LEAD_GUIDE');

    // restore, so this admin doesn't lose ADMIN access mid-suite for other tests
    await prisma.admin.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
  });
});
