import { create, type UseBoundStore, type StoreApi } from 'zustand';

interface FetchPageResult<TItem, TStatusFilter extends string> {
  items: TItem[];
  total: number;
  page: number;
  totalPages: number;
  // Per-status counts for the tab badges (e.g. "Active (12)") — respects `search` but
  // not `statusFilter` itself, so every tab's count reflects "how many match this
  // search" regardless of which tab is currently selected. Omitted entirely by
  // screens with no status tabs (Customers).
  statusCounts?: Record<TStatusFilter, number>;
}

export interface ListScreenConfig<TItem, TMode, TStatusFilter extends string> {
  idleMode: TMode;
  initialStatusFilter?: TStatusFilter;
  // Only needed by removeItem's totalPages recomputation — Users' screen never calls
  // removeItem (it always refetches after delete instead), so its instantiation omits this.
  pageSize?: number;
  // Receives the store's current search/statusFilter so the backend can filter the
  // FULL dataset (not just whatever page happens to already be loaded) — this is what
  // makes search and status tabs apply globally instead of only to the visible page.
  fetchPage: (page: number, search: string, statusFilter: TStatusFilter) => Promise<FetchPageResult<TItem, TStatusFilter>>;
}

export interface ListScreenState<TItem, TMode, TStatusFilter extends string> {
  items: TItem[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string;
  search: string;
  statusFilter: TStatusFilter;
  statusCounts: Record<TStatusFilter, number>;
  mode: TMode;
  panelKey: number;
  rowLoadingId: string | null;
  fetchPage: (page: number) => Promise<void>;
  setSearch: (search: string) => void;
  setStatusFilter: (filter: TStatusFilter) => void;
  openPanel: (mode: TMode) => void;
  closePanel: () => void;
  setRowLoadingId: (id: string | null) => void;
  updateItem: (id: string, updater: (item: TItem) => TItem) => void;
  // Local optimistic delete: filters the item out and decrements total/totalPages,
  // matching the "delete without a full refetch" behavior Tours/Customers already had.
  // The caller is still responsible for deciding whether to call this or fall back to
  // fetchPage(page - 1) when the deleted row was the last one on a page beyond page 1
  // (removeItem alone can't reduce `page` itself — it only ever removes from the
  // current page's items).
  removeItem: (id: string) => void;
  reset: () => void;
}

/**
 * Factory for the "list screen" shape shared by Bookings/Tours/Customers/Users:
 * a fetched, paginated, server-filtered page of items (search + status filter are
 * sent to the backend, not applied client-side — otherwise they'd only ever cover
 * whatever page happened to already be loaded), a slide-in create/edit/view panel,
 * and a per-row loading flag. Each screen's `Mode` union and `statusFilter` union
 * genuinely differ in shape (see the individual *ListStore.ts files), so both are
 * generic per instantiation rather than hardcoded here. Each screen's own
 * destructive-action confirm-dialog state stays local to that screen's component —
 * small, 1-5 per screen, directly tied to one specific dialog's JSX, not worth
 * forcing into this shared shape.
 *
 * Being a module-level store (not component state) is deliberate: it's what lets
 * search/filter/page survive navigating away from a screen and back, instead of
 * resetting like the old per-component useState did.
 */
export function createListScreenStore<TItem extends { id: string }, TMode, TStatusFilter extends string = never>(
  config: ListScreenConfig<TItem, TMode, TStatusFilter>,
): UseBoundStore<StoreApi<ListScreenState<TItem, TMode, TStatusFilter>>> {
  const initialStatusFilter = config.initialStatusFilter as TStatusFilter;
  const emptyStatusCounts = {} as Record<TStatusFilter, number>;

  return create<ListScreenState<TItem, TMode, TStatusFilter>>()((set, get) => ({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: '',
    search: '',
    statusFilter: initialStatusFilter,
    statusCounts: emptyStatusCounts,
    mode: config.idleMode,
    panelKey: 0,
    rowLoadingId: null,

    fetchPage: async (page) => {
      set({ loading: true, error: '' });
      try {
        const { search, statusFilter } = get();
        const result = await config.fetchPage(page, search, statusFilter);
        set({
          items: result.items,
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          ...(result.statusCounts ? { statusCounts: result.statusCounts } : {}),
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Could not load.' });
      } finally {
        set({ loading: false });
      }
    },

    setSearch: (search) => set({ search }),
    setStatusFilter: (statusFilter) => set({ statusFilter }),

    // Bumps panelKey in the same set() call as mode, so the panel's form/detail
    // component (keyed by panelKey) always remounts fresh when a new item is opened.
    openPanel: (mode) => set((state) => ({ mode, panelKey: state.panelKey + 1 })),
    closePanel: () => set({ mode: config.idleMode }),

    setRowLoadingId: (rowLoadingId) => set({ rowLoadingId }),

    updateItem: (id, updater) =>
      set((state) => ({ items: state.items.map((item) => (item.id === id ? updater(item) : item)) })),

    removeItem: (id) =>
      set((state) => {
        const total = Math.max(0, state.total - 1);
        const totalPages = config.pageSize ? Math.max(1, Math.ceil(total / config.pageSize)) : state.totalPages;
        return { items: state.items.filter((item) => item.id !== id), total, totalPages };
      }),

    reset: () =>
      set({
        items: [],
        total: 0,
        page: 1,
        totalPages: 1,
        loading: false,
        error: '',
        search: '',
        statusFilter: initialStatusFilter,
        statusCounts: emptyStatusCounts,
        mode: config.idleMode,
        panelKey: 0,
        rowLoadingId: null,
      }),
  }));
}
