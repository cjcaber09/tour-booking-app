import type { AdminListItem } from '../../preload';
import { useAuthStore } from './authStore';
import { createListScreenStore } from './createListScreenStore';

export type UsersMode = { kind: 'idle' } | { kind: 'create' } | { kind: 'view'; admin: AdminListItem };

export type UsersStatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED';

const PAGE_SIZE = 10;

// No pageSize passed — Users always calls fetchPage() to refresh after a delete
// rather than removeItem(), so removeItem's totalPages recomputation is never used here.
export const useUsersListStore = createListScreenStore<AdminListItem, UsersMode, UsersStatusFilter>({
  idleMode: { kind: 'idle' },
  initialStatusFilter: 'ALL',
  fetchPage: async (page, search, statusFilter) => {
    const session = useAuthStore.getState().session;
    if (!session) {
      return { items: [], total: 0, page, totalPages: 1 };
    }
    const filters = {
      ...(statusFilter !== 'ALL' ? { isActive: statusFilter === 'ACTIVE' } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
    };
    const result = await window.adminsAPI.list(page, PAGE_SIZE, filters, session.accessToken);
    return {
      items: result.admins,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      statusCounts: result.statusCounts,
    };
  },
});
