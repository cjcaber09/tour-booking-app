import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, DollarSign, CircleCheck, XCircle } from 'lucide-react';
import { BookingForm } from './BookingForm';
import { BookingView } from './BookingView';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import { CancelBookingDialog } from '../../CancelBookingDialog';
import { RecordPaymentDialog } from '../../RecordPaymentDialog';
import type { BookingListItem, BookingDetail } from '../../../preload';
import './Bookings.css';

type Mode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; booking: BookingDetail }
  | { kind: 'view'; booking: BookingDetail };
const PAGE_SIZE = 10;

function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

export function Bookings() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [panelKey, setPanelKey] = useState(0);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [confirmPendingCancel, setConfirmPendingCancel] = useState<BookingListItem | null>(null);
  const [confirmedCancelBooking, setConfirmedCancelBooking] = useState<BookingListItem | null>(null);
  const [confirmActionBooking, setConfirmActionBooking] = useState<BookingListItem | null>(null);
  const [recordPaymentBooking, setRecordPaymentBooking] = useState<BookingListItem | null>(null);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchBookings = useCallback(
    async (targetPage: number) => {
      if (!session) {
        return;
      }
      setLoading(true);
      setError('');
      try {
        const result = await window.bookingsAPI.list(targetPage, PAGE_SIZE, {}, session.accessToken);
        setBookings(result.bookings);
        setTotal(result.total);
        setPage(result.page);
        setTotalPages(result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load bookings.');
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    fetchBookings(1);
  }, [fetchBookings]);

  function handleNewBookingClick() {
    setPanelKey((k) => k + 1);
    setMode({ kind: 'create' });
  }

  async function handleEditClick(id: string) {
    if (!session || rowLoadingId) {
      return;
    }
    setRowLoadingId(id);
    try {
      const booking = await window.bookingsAPI.get(id, session.accessToken);
      setPanelKey((k) => k + 1);
      setMode({ kind: 'edit', booking });
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not load booking.');
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
      const booking = await window.bookingsAPI.get(id, session.accessToken);
      setPanelKey((k) => k + 1);
      setMode({ kind: 'view', booking });
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not load booking.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleConfirmClick(booking: BookingListItem) {
    if (rowLoadingId) {
      return;
    }
    setConfirmActionBooking(booking);
  }

  async function handleConfirmConfirm() {
    if (!session || !confirmActionBooking) {
      return;
    }
    const booking = confirmActionBooking;
    setConfirmActionBooking(null);
    setRowLoadingId(booking.id);
    try {
      await window.bookingsAPI.confirm(booking.id, session.accessToken);
      toast.success('Booking confirmed.');
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'CONFIRMED' } : b)));
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not confirm booking.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleCancelClick(booking: BookingListItem) {
    if (rowLoadingId) {
      return;
    }
    if (booking.status === 'PENDING') {
      setConfirmPendingCancel(booking);
    } else {
      setConfirmedCancelBooking(booking);
    }
  }

  async function handleConfirmPendingCancel() {
    if (!session || !confirmPendingCancel) {
      return;
    }
    const booking = confirmPendingCancel;
    setConfirmPendingCancel(null);
    await runCancel(booking, Number(booking.amountPaid));
  }

  async function handleConfirmedCancel(refundAmount: number) {
    if (!confirmedCancelBooking) {
      return;
    }
    const booking = confirmedCancelBooking;
    setConfirmedCancelBooking(null);
    await runCancel(booking, refundAmount);
  }

  async function runCancel(booking: BookingListItem, refundAmount: number) {
    if (!session) {
      return;
    }
    setRowLoadingId(booking.id);
    try {
      await window.bookingsAPI.cancel(booking.id, { refundAmount }, session.accessToken);
      toast.success('Booking cancelled.');
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: 'CANCELLED' } : b)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not cancel booking.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleRecordPaymentClick(booking: BookingListItem) {
    if (rowLoadingId) {
      return;
    }
    setRecordPaymentBooking(booking);
  }

  async function handleConfirmRecordPayment(newAmountPaid: number) {
    if (!session || !recordPaymentBooking) {
      return;
    }
    const booking = recordPaymentBooking;
    setRecordPaymentBooking(null);
    setRowLoadingId(booking.id);
    try {
      const updated = (await window.bookingsAPI.update(
        booking.id,
        { amountPaid: newAmountPaid },
        session.accessToken,
      )) as { paymentStatus: BookingListItem['paymentStatus']; amountPaid: string };
      toast.success('Payment recorded.');
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id ? { ...b, amountPaid: updated.amountPaid, paymentStatus: updated.paymentStatus } : b,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not record payment.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleSaved() {
    const wasEditing = mode.kind === 'edit';
    setMode({ kind: 'idle' });
    fetchBookings(wasEditing ? page : 1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    fetchBookings(nextPage);
  }

  return (
    <div className="bookings">
      <div className="bookings-content">
        <div className="bookings-header">
          <h1>Bookings</h1>
          <button className="neumorphic-button" onClick={handleNewBookingClick}>
            New Booking
          </button>
        </div>

        {error && <p className="bookings-status bookings-status-error">{error}</p>}
        {!error && loading && total === 0 && <p className="bookings-status">Loading bookings…</p>}
        {!error && !loading && total === 0 && <p className="bookings-empty">No bookings yet.</p>}

        {total > 0 && (
          <>
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Tour</th>
                  <th>Customer</th>
                  <th>Start Date</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="bookings-table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                      {booking.reference}
                    </td>
                    <td className="bookings-table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                      {booking.tour.title}
                    </td>
                    <td className="bookings-table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                      {booking.customer.name}
                    </td>
                    <td className="bookings-table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                      {new Date(booking.startDate).toLocaleDateString()}
                    </td>
                    <td className="bookings-table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                      <div className="bookings-payment-cell">
                        <span>
                          ${Number(booking.amountPaid).toFixed(2)} / ${Number(booking.totalPrice).toFixed(2)}
                        </span>
                        <span className={`payment-badge payment-${booking.paymentStatus.toLowerCase()}`}>
                          {booking.paymentStatus}
                        </span>
                      </div>
                    </td>
                    <td className="bookings-table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                      <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                    </td>
                    <td className="bookings-row-actions">
                      <button
                        type="button"
                        className="neumorphic-button bookings-action-button"
                        onClick={() => handleEditClick(booking.id)}
                        disabled={rowLoadingId === booking.id || booking.status === 'CANCELLED'}
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="neumorphic-button bookings-action-button"
                        onClick={() => handleRecordPaymentClick(booking)}
                        disabled={rowLoadingId === booking.id || booking.status === 'CANCELLED'}
                      >
                        <DollarSign size={14} />
                        Record Payment
                      </button>
                      {booking.status === 'PENDING' && (
                        <button
                          type="button"
                          className="neumorphic-button bookings-action-button"
                          onClick={() => handleConfirmClick(booking)}
                          disabled={rowLoadingId === booking.id}
                        >
                          <CircleCheck size={14} />
                          Confirm
                        </button>
                      )}
                      {booking.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          className="neumorphic-button bookings-action-button bookings-cancel-button"
                          onClick={() => handleCancelClick(booking)}
                          disabled={rowLoadingId === booking.id}
                        >
                          <XCircle size={14} />
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="bookings-pagination">
                <button
                  className="neumorphic-button bookings-page-arrow"
                  onClick={() => goToPage(page - 1)}
                  disabled={loading || page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={`neumorphic-button bookings-page-button ${n === page ? 'bookings-page-button-active' : ''}`}
                    onClick={() => goToPage(n)}
                    disabled={loading || n === page}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="neumorphic-button bookings-page-arrow"
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

      {confirmActionBooking && (
        <ConfirmDialog
          title="Confirm booking"
          message={`Confirm ${confirmActionBooking.reference}? The customer's request will be accepted.`}
          confirmLabel="Confirm"
          onConfirm={handleConfirmConfirm}
          onCancel={() => setConfirmActionBooking(null)}
        />
      )}

      {confirmPendingCancel && (
        <ConfirmDialog
          title="Cancel booking"
          message={
            Number(confirmPendingCancel.amountPaid) > 0
              ? `Cancel ${confirmPendingCancel.reference}? This was never confirmed, so the $${Number(confirmPendingCancel.amountPaid).toFixed(2)} paid so far will be marked as fully refunded.`
              : `Cancel ${confirmPendingCancel.reference}? This cannot be undone.`
          }
          confirmLabel="Cancel booking"
          danger
          onConfirm={handleConfirmPendingCancel}
          onCancel={() => setConfirmPendingCancel(null)}
        />
      )}

      {confirmedCancelBooking && (
        <CancelBookingDialog
          booking={{
            reference: confirmedCancelBooking.reference,
            amountPaid: Number(confirmedCancelBooking.amountPaid),
          }}
          onConfirm={handleConfirmedCancel}
          onCancel={() => setConfirmedCancelBooking(null)}
        />
      )}

      {recordPaymentBooking && (
        <RecordPaymentDialog
          booking={{
            reference: recordPaymentBooking.reference,
            totalPrice: Number(recordPaymentBooking.totalPrice),
            amountPaid: Number(recordPaymentBooking.amountPaid),
          }}
          onConfirm={handleConfirmRecordPayment}
          onCancel={() => setRecordPaymentBooking(null)}
        />
      )}

      <div className={`bookings-panel ${mode.kind !== 'idle' ? 'bookings-panel-open' : ''}`}>
        {mode.kind === 'view' ? (
          <BookingView key={panelKey} booking={mode.booking} onBack={() => setMode({ kind: 'idle' })} />
        ) : (
          <BookingForm
            key={panelKey}
            booking={mode.kind === 'edit' ? mode.booking : undefined}
            onCancel={() => setMode({ kind: 'idle' })}
            onSaved={handleSaved}
          />
        )}
      </div>
    </div>
  );
}
