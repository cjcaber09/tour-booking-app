import type { TourListItem, TourDetail } from '../../preload';
import { useAuthStore } from './authStore';
import { createListScreenStore } from './createListScreenStore';

export type ToursMode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; tour: TourDetail }
  | { kind: 'view'; tour: TourDetail };

export type ToursStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const PAGE_SIZE = 10;

export const useToursListStore = createListScreenStore<TourListItem, ToursMode, ToursStatusFilter>({
  idleMode: { kind: 'idle' },
  initialStatusFilter: 'ALL',
  pageSize: PAGE_SIZE,
  fetchPage: async (page, search, statusFilter) => {
    const session = useAuthStore.getState().session;
    if (!session) {
      return { items: [], total: 0, page, totalPages: 1 };
    }
    const filters = {
      ...(statusFilter !== 'ALL' ? { isActive: statusFilter === 'ACTIVE' } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
    };
    const result = await window.toursAPI.list(page, PAGE_SIZE, filters, session.accessToken);
    return {
      items: result.tours,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      statusCounts: result.statusCounts,
    };
  },
});
