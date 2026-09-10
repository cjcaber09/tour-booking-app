import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  PauseCircle,
  PlayCircle,
  Eye,
  Search,
  EllipsisVertical,
  type LucideProps,
} from 'lucide-react';
import { TourForm } from './TourForm';
import { TourView } from './TourView';
import { useAuth } from '../../AuthContext';
import { useAppSettings } from '../../AppSettingsContext';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { TourListItem, TourDetail } from '../../../preload';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';

type Mode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; tour: TourDetail }
  | { kind: 'view'; tour: TourDetail };
const PAGE_SIZE = 10;

function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

type StatusTabKey = 'ALL' | 'ACTIVE' | 'INACTIVE';

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'INACTIVE', label: 'Inactive' },
];

interface RowAction {
  key: string;
  label: string;
  Icon: ComponentType<LucideProps>;
  onClick: () => void;
  danger?: boolean;
}

interface RowActionHandlers {
  onView: (tour: TourListItem) => void;
  onEdit: (tour: TourListItem) => void;
  onSuspendToggle: (tour: TourListItem) => void;
  onDelete: (tour: TourListItem) => void;
}

function getRowActions(tour: TourListItem, handlers: RowActionHandlers): { primary: RowAction; overflow: RowAction[] } {
  const primary: RowAction = tour.isActive
    ? { key: 'suspend', label: 'Suspend', Icon: PauseCircle, onClick: () => handlers.onSuspendToggle(tour) }
    : { key: 'activate', label: 'Activate', Icon: PlayCircle, onClick: () => handlers.onSuspendToggle(tour) };

  const overflow: RowAction[] = [
    { key: 'view', label: 'View', Icon: Eye, onClick: () => handlers.onView(tour) },
    { key: 'edit', label: 'Edit', Icon: Pencil, onClick: () => handlers.onEdit(tour) },
    { key: 'delete', label: 'Delete', Icon: Trash2, onClick: () => handlers.onDelete(tour), danger: true },
  ];

  return { primary, overflow };
}

export function Tours() {
  const { session } = useAuth();
  const { formatCurrency, formatDate } = useAppSettings();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [panelKey, setPanelKey] = useState(0);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [confirmDeleteTour, setConfirmDeleteTour] = useState<TourListItem | null>(null);
  const [tours, setTours] = useState<TourListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusTabKey>('ALL');

  const statusCounts = useMemo(
    () => ({
      ALL: tours.length,
      ACTIVE: tours.filter((t) => t.isActive).length,
      INACTIVE: tours.filter((t) => !t.isActive).length,
    }),
    [tours],
  );

  const filteredTours = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tours.filter((tour) => {
      if (statusFilter === 'ACTIVE' && !tour.isActive) return false;
      if (statusFilter === 'INACTIVE' && tour.isActive) return false;
      if (!q) return true;
      return tour.title.toLowerCase().includes(q) || tour.slug.toLowerCase().includes(q);
    });
  }, [tours, search, statusFilter]);

  const fetchTours = useCallback(
    async (targetPage: number) => {
      if (!session) {
        return;
      }
      setLoading(true);
      setError('');
      try {
        const result = await window.toursAPI.list(targetPage, PAGE_SIZE, session.accessToken);
        setTours(result.tours);
        setTotal(result.total);
        setPage(result.page);
        setTotalPages(result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load tours.');
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    fetchTours(1);
  }, [fetchTours]);

  function handleNewTourClick() {
    setPanelKey((k) => k + 1);
    setMode({ kind: 'create' });
  }

  async function handleEditClick(id: string) {
    if (!session || rowLoadingId) {
      return;
    }
    setRowLoadingId(id);
    try {
      const tour = await window.toursAPI.get(id, session.accessToken);
      setPanelKey((k) => k + 1);
      setMode({ kind: 'edit', tour });
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not load tour.');
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleViewClick(id: string) {
    if (!session || rowLoadingId) {
      return;
    }
    setRowLoadingId(id);
    try {
      const tour = await window.toursAPI.get(id, session.accessToken);
      setPanelKey((k) => k + 1);
      setMode({ kind: 'view', tour });
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not load tour.');
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleSuspendToggle(tour: TourListItem) {
    if (!session || rowLoadingId) {
      return;
    }
    setRowLoadingId(tour.id);
    try {
      await window.toursAPI.update(tour.id, { isActive: !tour.isActive }, session.accessToken);
      toast.success(tour.isActive ? 'Tour suspended.' : 'Tour activated.');
      setTours((prev) => prev.map((t) => (t.id === tour.id ? { ...t, isActive: !t.isActive } : t)));
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not update tour status.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleDeleteClick(tour: TourListItem) {
    if (rowLoadingId) {
      return;
    }
    setConfirmDeleteTour(tour);
  }

  async function handleConfirmDelete() {
    if (!session || !confirmDeleteTour) {
      return;
    }
    const tour = confirmDeleteTour;
    setConfirmDeleteTour(null);
    setRowLoadingId(tour.id);
    try {
      await window.toursAPI.delete(tour.id, session.accessToken);
      toast.success('Tour deleted.');
      if (tours.length === 1 && page > 1) {
        await fetchTours(page - 1);
      } else {
        const newTotal = total - 1;
        setTours((prev) => prev.filter((t) => t.id !== tour.id));
        setTotal(newTotal);
        setTotalPages(Math.max(1, Math.ceil(newTotal / PAGE_SIZE)));
      }
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not delete tour.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleSaved() {
    const wasEditing = mode.kind === 'edit';
    setMode({ kind: 'idle' });
    fetchTours(wasEditing ? page : 1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    fetchTours(nextPage);
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-8">
        <div className="screen-header">
          <h1 className="screen-title">Tours</h1>
          <Button onClick={handleNewTourClick}>New Tour</Button>
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && total === 0 && <p className="status-message">Loading tours…</p>}
        {!error && !loading && total === 0 && <p className="status-message">No tours created yet.</p>}

        {total > 0 && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  className="neu-field py-2.5 pl-9"
                  placeholder="Search title or slug"
                  aria-label="Search tours"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1" role="tablist" aria-label="Filter tours by status">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === tab.key}
                    className={cn('tab-button', statusFilter === tab.key && 'tab-button-active')}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    {tab.label} ({statusCounts[tab.key]})
                  </button>
                ))}
              </div>
            </div>

            <div className="table-container">
              {filteredTours.length === 0 ? (
                <p className="status-message m-0">No tours match your search.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tour</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTours.map((tour) => {
                      const isRowLoading = rowLoadingId === tour.id;
                      const price = Number(tour.price);
                      const discount = tour.priceDiscount != null ? Number(tour.priceDiscount) : null;
                      const { primary, overflow } = getRowActions(tour, {
                        onView: (t) => handleViewClick(t.id),
                        onEdit: (t) => handleEditClick(t.id),
                        onSuspendToggle: handleSuspendToggle,
                        onDelete: handleDeleteClick,
                      });

                      return (
                        <tr
                          key={tour.id}
                          className={cn('border-l-4', tour.isActive ? 'border-confirmed' : 'border-cancelled')}
                        >
                          <td className="table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                            <div className="flex items-center gap-3">
                              {tour.imageCover ? (
                                <img
                                  className="block h-9 w-12 shrink-0 rounded-lg object-cover"
                                  src={tour.imageCover}
                                  alt=""
                                />
                              ) : (
                                <div className="h-9 w-12 shrink-0 rounded-lg bg-[var(--color-shadow-dark)] opacity-40" />
                              )}
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-heading">{tour.title}</span>
                                <span className="text-xs text-muted">{tour.slug}</span>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                            {discount != null ? (
                              <div className="flex items-baseline gap-2">
                                <span className="font-semibold text-heading">{formatCurrency(discount)}</span>
                                <span className="text-xs text-muted line-through">{formatCurrency(price)}</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-heading">{formatCurrency(price)}</span>
                            )}
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                            <span className={`status-badge ${tour.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
                              {tour.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                            {formatDate(tour.createdAt)}
                          </td>
                          <td>
                            <div className="row-actions justify-end">
                              <Button
                                size="sm"
                                className="action-button"
                                onClick={primary.onClick}
                                disabled={isRowLoading}
                              >
                                <primary.Icon size={14} />
                                {primary.label}
                              </Button>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isRowLoading}
                                    aria-label={`More actions for ${tour.title}`}
                                  >
                                    <EllipsisVertical size={16} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-44 p-1">
                                  <div role="menu" className="flex flex-col">
                                    {overflow.map((action) => (
                                      <button
                                        key={action.key}
                                        type="button"
                                        role="menuitem"
                                        disabled={isRowLoading}
                                        className={cn(
                                          'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-heading hover:bg-sidebar-hover disabled:cursor-not-allowed disabled:opacity-60',
                                          action.danger && 'text-error',
                                        )}
                                        onClick={action.onClick}
                                      >
                                        <action.Icon size={14} />
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <Button
                  className="page-arrow"
                  onClick={() => goToPage(page - 1)}
                  disabled={loading || page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    className={cn('page-button', n === page && 'page-button-active')}
                    onClick={() => goToPage(n)}
                    disabled={loading || n === page}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  className="page-arrow"
                  onClick={() => goToPage(page + 1)}
                  disabled={loading || page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {rowLoadingId && <LoadingOverlay />}

      {confirmDeleteTour && (
        <ConfirmDialog
          title="Delete tour"
          message={`Delete "${confirmDeleteTour.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteTour(null)}
        />
      )}

      <div className={cn('slide-panel', mode.kind !== 'idle' && 'slide-panel-open')}>
        {mode.kind === 'view' ? (
          <TourView key={panelKey} tour={mode.tour} onBack={() => setMode({ kind: 'idle' })} />
        ) : (
          <TourForm
            key={panelKey}
            tour={mode.kind === 'edit' ? mode.tour : undefined}
            onCancel={() => setMode({ kind: 'idle' })}
            onSaved={handleSaved}
          />
        )}
      </div>
    </div>
  );
}
