import type { CustomerListItem, CustomerDetail } from '../../preload';
import { useAuthStore } from './authStore';
import { createListScreenStore } from './createListScreenStore';

export type CustomersMode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; customer: CustomerListItem }
  | { kind: 'view'; customer: CustomerDetail };

const PAGE_SIZE = 10;

// No statusFilter for Customers — the generic slot defaults to `never` and this
// screen's UI never wires anything to setStatusFilter.
export const useCustomersListStore = createListScreenStore<CustomerListItem, CustomersMode>({
  idleMode: { kind: 'idle' },
  pageSize: PAGE_SIZE,
  fetchPage: async (page, search) => {
    const session = useAuthStore.getState().session;
    if (!session) {
      return { items: [], total: 0, page, totalPages: 1 };
    }
    const result = await window.customersAPI.list(page, PAGE_SIZE, search.trim(), session.accessToken);
    return { items: result.customers, total: result.total, page: result.page, totalPages: result.totalPages };
  },
});
