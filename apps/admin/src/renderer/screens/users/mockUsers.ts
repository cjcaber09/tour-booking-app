import type { AdminRole, AdminSummary } from '../../../preload';

export type MockUserStatus = 'ACTIVE' | 'SUSPENDED';

export interface MockUser extends AdminSummary {
  status: MockUserStatus;
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: 'Admin',
  LEAD_GUIDE: 'Lead Guide',
  GUIDE: 'Guide',
};

// Reuses the existing booking/tour status-badge color classes rather than adding dedicated
// role tokens — this screen is mocked, so it borrows colors instead of growing shared CSS.
export const ROLE_BADGE_CLASS: Record<AdminRole, string> = {
  ADMIN: 'status-completed',
  LEAD_GUIDE: 'status-ongoing',
  GUIDE: 'status-pending',
};

const SEED_USERS: MockUser[] = [
  {
    id: 'seed-1',
    name: 'Amara Osei',
    email: 'amara.osei@andytours.com',
    role: 'ADMIN',
    phone: '+1 (415) 555-0182',
    avatarUrl: null,
    createdAt: '2023-11-02T09:00:00.000Z',
    lastLoginAt: '2026-09-10T14:22:00.000Z',
    status: 'ACTIVE',
  },
  {
    id: 'seed-2',
    name: 'Theo Marchetti',
    email: 'theo.marchetti@andytours.com',
    role: 'LEAD_GUIDE',
    phone: '+1 (206) 555-0147',
    avatarUrl: null,
    createdAt: '2024-02-14T09:00:00.000Z',
    lastLoginAt: '2026-09-09T08:05:00.000Z',
    status: 'ACTIVE',
  },
  {
    id: 'seed-3',
    name: 'Priya Chandrasekaran',
    email: 'priya.chandra@andytours.com',
    role: 'LEAD_GUIDE',
    phone: null,
    avatarUrl: null,
    createdAt: '2024-05-20T09:00:00.000Z',
    lastLoginAt: '2026-08-28T11:40:00.000Z',
    status: 'ACTIVE',
  },
  {
    id: 'seed-4',
    name: 'Rafael Tavares',
    email: 'rafael.tavares@andytours.com',
    role: 'GUIDE',
    phone: '+1 (305) 555-0193',
    avatarUrl: null,
    createdAt: '2024-08-09T09:00:00.000Z',
    lastLoginAt: null,
    status: 'ACTIVE',
  },
  {
    id: 'seed-5',
    name: 'Ingrid Solberg',
    email: 'ingrid.solberg@andytours.com',
    role: 'GUIDE',
    phone: '+1 (720) 555-0166',
    avatarUrl: null,
    createdAt: '2024-09-30T09:00:00.000Z',
    lastLoginAt: '2026-07-15T16:10:00.000Z',
    status: 'SUSPENDED',
  },
  {
    id: 'seed-6',
    name: 'Kenji Watanabe',
    email: 'kenji.watanabe@andytours.com',
    role: 'GUIDE',
    phone: null,
    avatarUrl: null,
    createdAt: '2025-01-12T09:00:00.000Z',
    lastLoginAt: '2026-08-31T10:00:00.000Z',
    status: 'ACTIVE',
  },
];

// Module-level store (not React state) so the mock list survives navigating away from and
// back to the Users screen within the same app session — AppLayout has no keep-alive, so a
// plain useState seeded fresh on every mount would silently forget every change. Resets only
// on a full app restart; still no IPC/backend involved.
export let mockUsersStore: MockUser[] = [...SEED_USERS];

export function setMockUsersStore(next: MockUser[]) {
  mockUsersStore = next;
}
