import type { BookingListItem, BookingDetail } from '../../preload';
import { useAuthStore } from './authStore';
import { createListScreenStore } from './createListScreenStore';

export type BookingsMode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; booking: BookingDetail }
  | { kind: 'view'; booking: BookingDetail };

export type BookingsStatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED';

const PAGE_SIZE = 10;

export const useBookingsListStore = createListScreenStore<BookingListItem, BookingsMode, BookingsStatusFilter>({
  idleMode: { kind: 'idle' },
  initialStatusFilter: 'ALL',
  pageSize: PAGE_SIZE,
  fetchPage: async (page, search, statusFilter) => {
    const session = useAuthStore.getState().session;
    if (!session) {
      return { items: [], total: 0, page, totalPages: 1 };
    }
    const filters = {
      ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
    };
    const result = await window.bookingsAPI.list(page, PAGE_SIZE, filters, session.accessToken);
    return {
      items: result.bookings,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      statusCounts: result.statusCounts,
    };
  },
});
