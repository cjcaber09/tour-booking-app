import { useEffect, useState } from 'react';
import { Pencil, Trash2, PauseCircle, PlayCircle, Eye, Search } from 'lucide-react';
import { TourForm } from './TourForm';
import { TourView } from './TourView';
import { CategoriesDialog } from './CategoriesDialog';
import { useAuth } from '../../states/authStore';
import { useAppSettings } from '../../states/appSettingsStore';
import { useToursListStore, type ToursStatusFilter } from '../../states/toursListStore';
import { useDebouncedRefetch } from '../../lib/useDebouncedRefetch';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Pagination } from '../../Pagination';
import { RowActionsMenu, type RowAction } from '../../RowActionsMenu';
import { cleanIpcErrorMessage } from '../../lib/ipc';
import type { TourListItem } from '../../../preload';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';

const STATUS_TABS: { key: ToursStatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'INACTIVE', label: 'Inactive' },
];

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
  const {
    items: tours,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    statusFilter,
    statusCounts,
    mode,
    panelKey,
    rowLoadingId,
    fetchPage,
    setSearch,
    setStatusFilter,
    openPanel,
    closePanel,
    setRowLoadingId,
    updateItem,
    removeItem,
  } = useToursListStore();

  const [confirmDeleteTour, setConfirmDeleteTour] = useState<TourListItem | null>(null);
  const [confirmSuspendTour, setConfirmSuspendTour] = useState<TourListItem | null>(null);
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);

  // Search and status are sent to the backend (see toursListStore's fetchPage) so
  // they apply across the whole dataset, not just whatever page is currently loaded —
  // `tours` below is already the filtered/paginated result, nothing further to filter client-side.
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'ALL';

  useEffect(() => {
    fetchPage(useToursListStore.getState().page);
    return () => {
      useToursListStore.getState().closePanel();
    };
  }, []);

  useDebouncedRefetch(fetchPage, [search, statusFilter]);

  function handleNewTourClick() {
    openPanel({ kind: 'create' });
  }

  async function handleEditClick(id: string) {
    if (!session || rowLoadingId) {
      return;
    }
    setRowLoadingId(id);
    try {
      const tour = await window.toursAPI.get(id, session.accessToken);
      openPanel({ kind: 'edit', tour });
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
      openPanel({ kind: 'view', tour });
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not load tour.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleSuspendToggleClick(tour: TourListItem) {
    if (rowLoadingId) {
      return;
    }
    // Suspending (taking a tour offline) is confirmed; re-activating isn't — matches
    // the rest of the screen's pattern of only gating the state-degrading direction.
    if (tour.isActive) {
      setConfirmSuspendTour(tour);
    } else {
      void runSuspendToggle(tour);
    }
  }

  async function handleConfirmSuspend() {
    if (!confirmSuspendTour) {
      return;
    }
    const tour = confirmSuspendTour;
    setConfirmSuspendTour(null);
    await runSuspendToggle(tour);
  }

  async function runSuspendToggle(tour: TourListItem) {
    if (!session) {
      return;
    }
    setRowLoadingId(tour.id);
    try {
      await window.toursAPI.update(tour.id, { isActive: !tour.isActive }, session.accessToken);
      toast.success(tour.isActive ? 'Tour suspended.' : 'Tour activated.');
      updateItem(tour.id, (t) => ({ ...t, isActive: !t.isActive }));
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
        await fetchPage(page - 1);
      } else {
        removeItem(tour.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not delete tour.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleSaved() {
    const wasEditing = mode.kind === 'edit';
    closePanel();
    fetchPage(wasEditing ? page : 1);
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-8">
        <div className="screen-header">
          <h1 className="screen-title">Tours</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCategoriesDialogOpen(true)}>
              Categories
            </Button>
            <Button onClick={handleNewTourClick}>New Tour</Button>
          </div>
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && total === 0 && !hasActiveFilter && <p className="status-message">Loading tours…</p>}
        {!error && !loading && total === 0 && !hasActiveFilter && <p className="status-message">No tours created yet.</p>}

        {(total > 0 || hasActiveFilter) && (
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
              {tours.length === 0 ? (
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
                    {tours.map((tour) => {
                      const isRowLoading = rowLoadingId === tour.id;
                      const price = Number(tour.price);
                      const discount = tour.priceDiscount != null ? Number(tour.priceDiscount) : null;
                      const { primary, overflow } = getRowActions(tour, {
                        onView: (t) => handleViewClick(t.id),
                        onEdit: (t) => handleEditClick(t.id),
                        onSuspendToggle: handleSuspendToggleClick,
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
                            <RowActionsMenu
                              primary={primary}
                              overflow={overflow}
                              disabled={isRowLoading}
                              ariaLabel={`More actions for ${tour.title}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} loading={loading} onPageChange={fetchPage} />
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

      {confirmSuspendTour && (
        <ConfirmDialog
          title="Suspend tour"
          message={`Suspend "${confirmSuspendTour.title}"? It will be hidden from new bookings until reactivated.`}
          confirmLabel="Suspend"
          danger
          onConfirm={handleConfirmSuspend}
          onCancel={() => setConfirmSuspendTour(null)}
        />
      )}

      {categoriesDialogOpen && <CategoriesDialog onClose={() => setCategoriesDialogOpen(false)} />}

      <div className={cn('slide-panel', mode.kind !== 'idle' && 'slide-panel-open')}>
        {mode.kind === 'view' ? (
          <TourView key={panelKey} tour={mode.tour} onBack={closePanel} />
        ) : (
          <TourForm
            key={panelKey}
            tour={mode.kind === 'edit' ? mode.tour : undefined}
            onCancel={closePanel}
            onSaved={handleSaved}
          />
        )}
      </div>
    </div>
  );
}
