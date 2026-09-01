import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
import { TourForm } from './TourForm';
import { TourView } from './TourView';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { TourListItem, TourDetail } from '../../../preload';
import './Tours.css';

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

export function Tours() {
  const { session } = useAuth();
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
    <div className="tours">
      <div className="tours-content">
        <div className="tours-header">
          <h1>Tours</h1>
          <button className="neumorphic-button" onClick={handleNewTourClick}>
            New Tour
          </button>
        </div>

        {error && <p className="tours-status tours-status-error">{error}</p>}
        {!error && loading && total === 0 && <p className="tours-status">Loading tours…</p>}
        {!error && !loading && total === 0 && <p className="tours-empty">No tours created yet.</p>}

        {total > 0 && (
          <>
            <table className="tours-table">
              <thead>
                <tr>
                  <th aria-hidden="true"></th>
                  <th>Title</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {tours.map((tour) => (
                  <tr key={tour.id}>
                    <td className="tours-table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                      {tour.imageCover ? (
                        <img className="tours-table-thumb" src={tour.imageCover} alt="" />
                      ) : (
                        <div className="tours-table-thumb tours-table-thumb-placeholder" />
                      )}
                    </td>
                    <td className="tours-table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                      {tour.title}
                    </td>
                    <td className="tours-table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                      ${Number(tour.price).toFixed(2)}
                    </td>
                    <td className="tours-table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                      <span className={`status-badge ${tour.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
                        {tour.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="tours-table-cell-clickable" onClick={() => handleViewClick(tour.id)}>
                      {new Date(tour.createdAt).toLocaleDateString()}
                    </td>
                    <td className="tours-row-actions">
                      <button
                        type="button"
                        className="neumorphic-button tours-edit-button"
                        onClick={() => handleEditClick(tour.id)}
                        disabled={rowLoadingId === tour.id}
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="neumorphic-button tours-edit-button"
                        onClick={() => handleSuspendToggle(tour)}
                        disabled={rowLoadingId === tour.id}
                      >
                        {tour.isActive ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                        {tour.isActive ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="neumorphic-button tours-edit-button tours-delete-button"
                        onClick={() => handleDeleteClick(tour)}
                        disabled={rowLoadingId === tour.id}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="tours-pagination">
                <button
                  className="neumorphic-button tours-page-arrow"
                  onClick={() => goToPage(page - 1)}
                  disabled={loading || page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={`neumorphic-button tours-page-button ${n === page ? 'tours-page-button-active' : ''}`}
                    onClick={() => goToPage(n)}
                    disabled={loading || n === page}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="neumorphic-button tours-page-arrow"
                  onClick={() => goToPage(page + 1)}
                  disabled={loading || page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
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

      <div className={`tours-panel ${mode.kind !== 'idle' ? 'tours-panel-open' : ''}`}>
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
