import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  DollarSign,
  CircleCheck,
  PlayCircle,
  XCircle,
  Eye,
  Search,
  EllipsisVertical,
  type LucideProps,
} from 'lucide-react';
import { BookingForm } from './BookingForm';
import { BookingView } from './BookingView';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import { CancelBookingDialog } from '../../CancelBookingDialog';
import { RecordPaymentDialog } from '../../RecordPaymentDialog';
import type {
  BookingListItem,
  BookingDetail,
  BookingStatus,
  PaymentMethod,
  RecordPaymentPayload,
} from '../../../preload';
import { cn } from '../../lib/utils';
import { fileToBase64 } from '../../lib/file';
import { Button } from '../../components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';

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

function isStartDateDue(startDate: string): boolean {
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return start <= today;
}

function isLocked(booking: BookingListItem): boolean {
  return (
    booking.status === 'ONGOING' ||
    booking.status === 'COMPLETED' ||
    (booking.status === 'CONFIRMED' && isStartDateDue(booking.startDate))
  );
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateRange(startDate: string, finishDate: string): { rangeText: string; singleDay: boolean } {
  const start = new Date(startDate);
  const finish = new Date(finishDate);
  if (isSameCalendarDay(start, finish)) {
    return { rangeText: start.toLocaleDateString(), singleDay: true };
  }
  return { rangeText: `${start.toLocaleDateString()} – ${finish.toLocaleDateString()}`, singleDay: false };
}

const STATUS_BORDER_CLASS: Record<BookingStatus, string> = {
  PENDING: 'border-pending',
  CONFIRMED: 'border-confirmed',
  ONGOING: 'border-ongoing',
  COMPLETED: 'border-completed',
  CANCELLED: 'border-cancelled',
};

type StatusTabKey = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED';

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

interface RowAction {
  key: string;
  label: string;
  Icon: ComponentType<LucideProps>;
  onClick: () => void;
  danger?: boolean;
}

interface RowActionHandlers {
  onView: (booking: BookingListItem) => void;
  onEdit: (booking: BookingListItem) => void;
  onConfirm: (booking: BookingListItem) => void;
  onMarkOngoing: (booking: BookingListItem) => void;
  onRecordPayment: (booking: BookingListItem) => void;
  onCancel: (booking: BookingListItem) => void;
}

// Mirrors the exact conditions the table used to gate each action button on, just
// reorganized into "one primary action" plus "everything else in the overflow menu".
function getRowActions(
  booking: BookingListItem,
  handlers: RowActionHandlers,
): { primary: RowAction | null; overflow: RowAction[] } {
  const cancelled = booking.status === 'CANCELLED';
  const locked = isLocked(booking);
  const canEdit = !cancelled && !locked;
  const canRecordPayment = !cancelled && booking.paymentStatus !== 'PAID';
  const canConfirm = booking.status === 'PENDING';
  const canMarkOngoing = booking.status === 'CONFIRMED' && isStartDateDue(booking.startDate);
  const canCancel = !cancelled && !(locked && booking.paymentStatus === 'PAID');

  const viewAction: RowAction = { key: 'view', label: 'View', Icon: Eye, onClick: () => handlers.onView(booking) };
  const editAction: RowAction = { key: 'edit', label: 'Edit', Icon: Pencil, onClick: () => handlers.onEdit(booking) };
  const confirmAction: RowAction = {
    key: 'confirm',
    label: 'Confirm',
    Icon: CircleCheck,
    onClick: () => handlers.onConfirm(booking),
  };
  const markOngoingAction: RowAction = {
    key: 'mark-ongoing',
    label: 'Mark Ongoing',
    Icon: PlayCircle,
    onClick: () => handlers.onMarkOngoing(booking),
  };
  const recordPaymentAction: RowAction = {
    key: 'record-payment',
    label: 'Record Payment',
    Icon: DollarSign,
    onClick: () => handlers.onRecordPayment(booking),
  };
  const cancelAction: RowAction = {
    key: 'cancel',
    label: 'Cancel',
    Icon: XCircle,
    onClick: () => handlers.onCancel(booking),
    danger: true,
  };

  let primary: RowAction | null = null;
  if (canConfirm) primary = confirmAction;
  else if (canRecordPayment) primary = recordPaymentAction;
  else if (canMarkOngoing) primary = markOngoingAction;

  const overflow: RowAction[] = [viewAction];
  if (canEdit) overflow.push(editAction);
  if (canConfirm && primary?.key !== 'confirm') overflow.push(confirmAction);
  if (canRecordPayment && primary?.key !== 'record-payment') overflow.push(recordPaymentAction);
  if (canMarkOngoing && primary?.key !== 'mark-ongoing') overflow.push(markOngoingAction);
  if (canCancel) overflow.push(cancelAction);

  return { primary, overflow };
}

function RowActionsMenu({
  primary,
  overflow,
  isRowLoading,
  menuLabel,
}: {
  primary: RowAction | null;
  overflow: RowAction[];
  isRowLoading: boolean;
  menuLabel: string;
}) {
  return (
    <div className="row-actions justify-end">
      {primary && (
        <Button size="sm" className="action-button" onClick={primary.onClick} disabled={isRowLoading}>
          <primary.Icon size={14} />
          {primary.label}
        </Button>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isRowLoading} aria-label={menuLabel}>
            <EllipsisVertical size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
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
  );
}

export function Bookings() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [panelKey, setPanelKey] = useState(0);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [confirmPendingCancel, setConfirmPendingCancel] = useState<BookingListItem | null>(null);
  const [confirmedCancelBooking, setConfirmedCancelBooking] = useState<BookingListItem | null>(null);
  const [confirmActionBooking, setConfirmActionBooking] = useState<BookingListItem | null>(null);
  const [ongoingActionBooking, setOngoingActionBooking] = useState<BookingListItem | null>(null);
  const [recordPaymentBooking, setRecordPaymentBooking] = useState<BookingListItem | null>(null);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusTabKey>('ALL');

  const statusCounts = useMemo(
    () => ({
      ALL: bookings.length,
      PENDING: bookings.filter((b) => b.status === 'PENDING').length,
      CONFIRMED: bookings.filter((b) => b.status === 'CONFIRMED').length,
      CANCELLED: bookings.filter((b) => b.status === 'CANCELLED').length,
    }),
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (statusFilter !== 'ALL' && booking.status !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        booking.reference.toLowerCase().includes(q) ||
        booking.tour.title.toLowerCase().includes(q) ||
        booking.customer.name.toLowerCase().includes(q)
      );
    });
  }, [bookings, search, statusFilter]);

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

  function handleMarkOngoingClick(booking: BookingListItem) {
    if (rowLoadingId) {
      return;
    }
    setOngoingActionBooking(booking);
  }

  async function handleMarkOngoingConfirm() {
    if (!session || !ongoingActionBooking) {
      return;
    }
    const booking = ongoingActionBooking;
    setOngoingActionBooking(null);
    setRowLoadingId(booking.id);
    try {
      await window.bookingsAPI.ongoing(booking.id, session.accessToken);
      toast.success('Booking marked ongoing.');
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'ONGOING' } : b)));
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not mark booking ongoing.');
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
      // Mirrors the backend's own rule (POST /bookings/:id/cancel): paymentStatus flips to
      // REFUNDED whenever refundAmount > 0, otherwise it's left as whatever it already was.
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? { ...b, status: 'CANCELLED', paymentStatus: refundAmount > 0 ? 'REFUNDED' : b.paymentStatus }
            : b,
        ),
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

  async function handleConfirmRecordPayment(payload: {
    amount: number;
    method: PaymentMethod;
    invoiceReference?: string;
    file?: File;
  }) {
    if (!session || !recordPaymentBooking) {
      return;
    }
    const booking = recordPaymentBooking;
    setRecordPaymentBooking(null);
    setRowLoadingId(booking.id);
    try {
      let proofUrl: string | undefined;
      if (payload.file) {
        const base64 = await fileToBase64(payload.file);
        ({ url: proofUrl } = await window.bookingsAPI.uploadPaymentProof(
          booking.id,
          base64,
          payload.file.name,
          payload.file.type,
          session.accessToken,
        ));
      }
      const recordPayload: RecordPaymentPayload =
        payload.method === 'CASH'
          ? { method: 'CASH', amount: payload.amount }
          : payload.method === 'INVOICE_REFERENCE'
            ? { method: 'INVOICE_REFERENCE', amount: payload.amount, invoiceReference: payload.invoiceReference! }
            : { method: 'FILE', amount: payload.amount, proofUrl: proofUrl! };
      const updated = await window.bookingsAPI.recordPayment(booking.id, recordPayload, session.accessToken);
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

  const bookingRows = filteredBookings.map((booking) => {
    const paid = Number(booking.amountPaid);
    const totalPrice = Number(booking.totalPrice);
    const paidPct = totalPrice > 0 ? Math.min(100, Math.round((paid / totalPrice) * 100)) : 0;
    const { rangeText, singleDay } = formatDateRange(booking.startDate, booking.finishDate);
    const { primary, overflow } = getRowActions(booking, {
      onView: (b) => handleViewClick(b.id),
      onEdit: (b) => handleEditClick(b.id),
      onConfirm: handleConfirmClick,
      onMarkOngoing: handleMarkOngoingClick,
      onRecordPayment: handleRecordPaymentClick,
      onCancel: handleCancelClick,
    });
    return {
      booking,
      isRowLoading: rowLoadingId === booking.id,
      paid,
      totalPrice,
      paidPct,
      rangeText,
      singleDay,
      primary,
      overflow,
    };
  });

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-4 sm:p-8">
        <div className="screen-header">
          <h1 className="screen-title">Bookings</h1>
          <Button onClick={handleNewBookingClick}>New Booking</Button>
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && total === 0 && <p className="status-message">Loading bookings…</p>}
        {!error && !loading && total === 0 && <p className="status-message">No bookings yet.</p>}

        {total > 0 && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  className="neu-field py-2.5 pl-9"
                  placeholder="Search reference, tour, or customer"
                  aria-label="Search bookings"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filter bookings by status">
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
              {filteredBookings.length === 0 ? (
                <p className="status-message m-0">No bookings match your search.</p>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="data-table w-full min-w-[860px]">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Tour &amp; Customer</th>
                          <th>Dates</th>
                          <th>Payment</th>
                          <th>Status</th>
                          <th>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookingRows.map(
                          ({ booking, isRowLoading, paid, totalPrice, paidPct, rangeText, singleDay, primary, overflow }) => (
                            <tr key={booking.id} className={cn('border-l-4', STATUS_BORDER_CLASS[booking.status])}>
                              <td className="table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                                {booking.reference}
                              </td>
                              <td className="table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-heading">{booking.tour.title}</span>
                                  <span className="text-xs text-muted">{booking.tour.id}</span>
                                  <span className="text-secondary">{booking.customer.name}</span>
                                </div>
                              </td>
                              <td className="table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                                <div className="flex flex-col gap-0.5">
                                  <span>{rangeText}</span>
                                  {singleDay && <span className="text-xs text-muted">Single day</span>}
                                </div>
                              </td>
                              <td className="table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                                <div className="flex min-w-28 flex-col gap-1.5">
                                  <span>
                                    <span className="font-semibold text-heading">${paid.toFixed(2)}</span>
                                    <span className="text-muted"> / ${totalPrice.toFixed(2)}</span>
                                  </span>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                                    <div className="h-full rounded-full bg-confirmed" style={{ width: `${paidPct}%` }} />
                                  </div>
                                  {(booking.paymentStatus === 'UNPAID' || booking.paymentStatus === 'REFUNDED') && (
                                    <span className={`payment-badge payment-${booking.paymentStatus.toLowerCase()}`}>
                                      {booking.paymentStatus}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                                <div className="flex flex-col items-start gap-1">
                                  <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                                    {booking.status}
                                  </span>
                                  {booking.cancelledAt && (
                                    <span className="text-xs text-muted">
                                      Cancelled {new Date(booking.cancelledAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <RowActionsMenu
                                  primary={primary}
                                  overflow={overflow}
                                  isRowLoading={isRowLoading}
                                  menuLabel={`More actions for ${booking.reference}`}
                                />
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 md:hidden">
                    {bookingRows.map(
                      ({ booking, isRowLoading, paid, totalPrice, paidPct, rangeText, singleDay, primary, overflow }) => (
                        <div
                          key={booking.id}
                          className={cn(
                            'flex flex-col gap-3 rounded-xl border-l-4 bg-surface p-4 neu-raised-sm',
                            STATUS_BORDER_CLASS[booking.status],
                          )}
                        >
                          <div
                            className="flex cursor-pointer items-start justify-between gap-3"
                            onClick={() => handleViewClick(booking.id)}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted">{booking.reference}</span>
                              <span className="font-semibold text-heading">{booking.tour.title}</span>
                              <span className="text-xs text-muted">{booking.tour.id}</span>
                              <span className="text-sm text-secondary">{booking.customer.name}</span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                                {booking.status}
                              </span>
                              {booking.cancelledAt && (
                                <span className="text-xs text-muted">
                                  Cancelled {new Date(booking.cancelledAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span>{rangeText}</span>
                            {singleDay && <span className="text-xs text-muted">Single day</span>}
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span>
                                <span className="font-semibold text-heading">${paid.toFixed(2)}</span>
                                <span className="text-muted"> / ${totalPrice.toFixed(2)}</span>
                              </span>
                              {(booking.paymentStatus === 'UNPAID' || booking.paymentStatus === 'REFUNDED') && (
                                <span className={`payment-badge payment-${booking.paymentStatus.toLowerCase()}`}>
                                  {booking.paymentStatus}
                                </span>
                              )}
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                              <div className="h-full rounded-full bg-confirmed" style={{ width: `${paidPct}%` }} />
                            </div>
                          </div>

                          <div className="border-t border-border pt-3">
                            <RowActionsMenu
                              primary={primary}
                              overflow={overflow}
                              isRowLoading={isRowLoading}
                              menuLabel={`More actions for ${booking.reference}`}
                            />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </>
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

      {confirmActionBooking && (
        <ConfirmDialog
          title="Confirm booking"
          message={`Confirm ${confirmActionBooking.reference}? The customer's request will be accepted.`}
          confirmLabel="Confirm"
          onConfirm={handleConfirmConfirm}
          onCancel={() => setConfirmActionBooking(null)}
        />
      )}

      {ongoingActionBooking && (
        <ConfirmDialog
          title="Mark booking ongoing"
          message={`Mark ${ongoingActionBooking.reference} as ongoing? Its details can no longer be edited or cancelled once marked.`}
          confirmLabel="Mark Ongoing"
          onConfirm={handleMarkOngoingConfirm}
          onCancel={() => setOngoingActionBooking(null)}
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

      <div className={cn('slide-panel', mode.kind !== 'idle' && 'slide-panel-open')}>
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
