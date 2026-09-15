import { useEffect, useState } from 'react';
import { Pencil, DollarSign, CircleCheck, PlayCircle, XCircle, Eye, Search, UserRoundCog } from 'lucide-react';
import { BookingForm } from './BookingForm';
import { BookingView } from './BookingView';
import { useAuth } from '../../states/authStore';
import { useAppSettings } from '../../states/appSettingsStore';
import { useBookingsListStore, type BookingsStatusFilter } from '../../states/bookingsListStore';
import { useDebouncedRefetch } from '../../lib/useDebouncedRefetch';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import { CancelBookingDialog } from '../../CancelBookingDialog';
import { RecordPaymentDialog } from '../../RecordPaymentDialog';
import { AssignGuideDialog } from '../../AssignGuideDialog';
import { Pagination } from '../../Pagination';
import { RowActionsMenu, type RowAction } from '../../RowActionsMenu';
import { cleanIpcErrorMessage } from '../../lib/ipc';
import type {
  BookingListItem,
  BookingDetail,
  BookingStatus,
  PaymentMethod,
  RecordPaymentPayload,
  AssignableGuide,
} from '../../../preload';
import { cn } from '../../lib/utils';
import { isGuideRole } from '../../lib/roles';
import { fileToBase64 } from '../../lib/file';
import { Button } from '../../components/ui/button';

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

function formatDateRange(
  startDate: string,
  finishDate: string,
  formatDate: (input: string) => string,
): { rangeText: string; singleDay: boolean } {
  const start = new Date(startDate);
  const finish = new Date(finishDate);
  if (isSameCalendarDay(start, finish)) {
    return { rangeText: formatDate(startDate), singleDay: true };
  }
  return { rangeText: `${formatDate(startDate)} – ${formatDate(finishDate)}`, singleDay: false };
}

const STATUS_BORDER_CLASS: Record<BookingStatus, string> = {
  PENDING: 'border-pending',
  CONFIRMED: 'border-confirmed',
  ONGOING: 'border-ongoing',
  COMPLETED: 'border-completed',
  CANCELLED: 'border-cancelled',
};

const STATUS_TABS: { key: BookingsStatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

interface RowActionHandlers {
  onView: (booking: BookingListItem) => void;
  onEdit: (booking: BookingListItem) => void;
  onConfirm: (booking: BookingListItem) => void;
  onMarkOngoing: (booking: BookingListItem) => void;
  onRecordPayment: (booking: BookingListItem) => void;
  onCancel: (booking: BookingListItem) => void;
  onAssignGuide: (booking: BookingListItem) => void;
}

interface RowActionContext {
  // Exact role === 'GUIDE' only — deliberately distinct from isGuide/isGuideRole()
  // (which also matches LEAD_GUIDE) used elsewhere in this file for the table-vs-grid
  // layout decision. LEAD_GUIDE keeps the full, unrestricted action set.
  isActionRestrictedGuide: boolean;
  currentAdminId: string | undefined;
}

// Mirrors the exact conditions the table used to gate each action button on, just
// reorganized into "one primary action" plus "everything else in the overflow menu".
function getRowActions(
  booking: BookingListItem,
  handlers: RowActionHandlers,
  context: RowActionContext,
): { primary: RowAction | null; overflow: RowAction[] } {
  const cancelled = booking.status === 'CANCELLED';
  const locked = isLocked(booking);
  // Explicit `!= null` guard: without it, an *unassigned* booking's `guide?.id`
  // (undefined) would spuriously match if currentAdminId were ever undefined —
  // shouldn't happen given this screen only renders once authenticated, but cheap
  // to rule out entirely.
  const isAssignedToMe = context.currentAdminId != null && booking.guide?.id === context.currentAdminId;
  const canEdit = !context.isActionRestrictedGuide && !cancelled && !locked;
  const canRecordPayment = !context.isActionRestrictedGuide && !cancelled && booking.paymentStatus !== 'PAID';
  const canConfirm = !context.isActionRestrictedGuide && booking.status === 'PENDING';
  const canMarkOngoing =
    (!context.isActionRestrictedGuide || isAssignedToMe) &&
    booking.status === 'CONFIRMED' &&
    isStartDateDue(booking.startDate);
  const canCancel =
    (!context.isActionRestrictedGuide || isAssignedToMe) && !cancelled && !(locked && booking.paymentStatus === 'PAID');
  // Assignment only makes sense once the booking is confirmed (matches the backend's
  // own PATCH /:id rule) — deliberately not gated on `locked` too, since reassigning a
  // guide (e.g. the original one becomes unavailable mid-tour) should stay possible
  // regardless of lock state, same as the Edit-form picker already allows.
  const canAssignGuide = !context.isActionRestrictedGuide && !cancelled && booking.status !== 'PENDING';

  const viewAction: RowAction = { key: 'view', label: 'View', Icon: Eye, onClick: () => handlers.onView(booking) };
  const editAction: RowAction = { key: 'edit', label: 'Edit', Icon: Pencil, onClick: () => handlers.onEdit(booking) };
  const confirmAction: RowAction = {
    key: 'confirm',
    label: 'Confirm',
    Icon: CircleCheck,
    onClick: () => handlers.onConfirm(booking),
  };
  const hasAssignedGuide = booking.guide != null;
  const markOngoingAction: RowAction = {
    key: 'mark-ongoing',
    label: 'Mark Ongoing',
    Icon: PlayCircle,
    onClick: () => handlers.onMarkOngoing(booking),
    disabled: !hasAssignedGuide,
    disabledReason: hasAssignedGuide ? undefined : 'Assign a guide before marking this booking ongoing',
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
  const assignGuideAction: RowAction = {
    key: 'assign-guide',
    label: 'Assign Guide',
    Icon: UserRoundCog,
    onClick: () => handlers.onAssignGuide(booking),
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
  if (canAssignGuide) overflow.push(assignGuideAction);
  if (canCancel) overflow.push(cancelAction);

  return { primary, overflow };
}

interface BookingRow {
  booking: BookingListItem;
  isRowLoading: boolean;
  paid: number;
  totalPrice: number;
  paidPct: number;
  rangeText: string;
  singleDay: boolean;
  primary: RowAction | null;
  overflow: RowAction[];
}

// The single "block" used both by the narrow-width card list every role already saw,
// and by guides' always-on grid view (see isGuide in Bookings() below) — one card
// definition, two different wrapping layouts around it.
function BookingCard({
  row,
  onView,
  formatDate,
  formatCurrency,
}: {
  row: BookingRow;
  onView: (id: string) => void;
  formatDate: (input: string) => string;
  formatCurrency: (amount: number | string) => string;
}) {
  const { booking, isRowLoading, paid, totalPrice, paidPct, rangeText, singleDay, primary, overflow } = row;
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border-l-4 bg-surface p-4 neu-raised-sm',
        STATUS_BORDER_CLASS[booking.status],
      )}
    >
      <div className="flex cursor-pointer items-start justify-between gap-3" onClick={() => onView(booking.id)}>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{booking.reference}</span>
          <span className="font-semibold text-heading">{booking.tour.title}</span>
          <span className="text-xs text-muted">{booking.tour.id}</span>
          <span className="text-sm text-secondary">{booking.customer.name}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
          {booking.cancelledAt && (
            <span className="text-xs text-muted">Cancelled {formatDate(booking.cancelledAt)}</span>
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
            <span className="font-semibold text-heading">{formatCurrency(paid)}</span>
            <span className="text-muted"> / {formatCurrency(totalPrice)}</span>
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
          disabled={isRowLoading}
          ariaLabel={`More actions for ${booking.reference}`}
        />
      </div>
    </div>
  );
}

export function Bookings() {
  const { session } = useAuth();
  const isGuide = isGuideRole(session?.admin.role);
  // Exact role, not isGuideRole() — action restriction is GUIDE-only, LEAD_GUIDE
  // keeps full access, unlike the layout decision above.
  const isActionRestrictedGuide = session?.admin.role === 'GUIDE';
  const currentAdminId = session?.admin.id;
  const { formatCurrency, formatDate } = useAppSettings();
  const {
    items: bookings,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    statusFilter,
    mode,
    statusCounts,
    panelKey,
    rowLoadingId,
    fetchPage,
    setSearch,
    setStatusFilter,
    openPanel,
    closePanel,
    setRowLoadingId,
    updateItem,
  } = useBookingsListStore();

  const [confirmPendingCancel, setConfirmPendingCancel] = useState<BookingListItem | null>(null);
  const [confirmedCancelBooking, setConfirmedCancelBooking] = useState<BookingListItem | null>(null);
  const [confirmActionBooking, setConfirmActionBooking] = useState<BookingListItem | null>(null);
  const [ongoingActionBooking, setOngoingActionBooking] = useState<BookingListItem | null>(null);
  const [recordPaymentBooking, setRecordPaymentBooking] = useState<BookingListItem | null>(null);
  const [assignGuideBooking, setAssignGuideBooking] = useState<BookingListItem | null>(null);

  // Search and status are sent to the backend (see bookingsListStore's fetchPage) so
  // they apply across the whole dataset, not just whatever page is currently loaded —
  // `bookings` below is already the filtered/paginated result, nothing further to filter client-side.
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'ALL';

  useEffect(() => {
    // Refetches whatever page the store is already on (persisted across navigation)
    // rather than hardcoding page 1 — fetchPage never blanks items first, so stale-
    // but-valid rows stay visible while this resolves in the background.
    fetchPage(useBookingsListStore.getState().page);
    return () => {
      // The panel's content (BookingForm/BookingView) is local and would remount
      // blank anyway, so an open panel shouldn't survive navigating away.
      useBookingsListStore.getState().closePanel();
    };
  }, []);

  useDebouncedRefetch(fetchPage, [search, statusFilter]);

  function handleNewBookingClick() {
    openPanel({ kind: 'create' });
  }

  async function handleEditClick(id: string) {
    if (!session || rowLoadingId) {
      return;
    }
    setRowLoadingId(id);
    try {
      const booking = await window.bookingsAPI.get(id, session.accessToken);
      openPanel({ kind: 'edit', booking });
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
      openPanel({ kind: 'view', booking });
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
      updateItem(booking.id, (b) => ({ ...b, status: 'CONFIRMED' }));
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
      updateItem(booking.id, (b) => ({ ...b, status: 'ONGOING' }));
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
      updateItem(booking.id, (b) => ({
        ...b,
        status: 'CANCELLED',
        paymentStatus: refundAmount > 0 ? 'REFUNDED' : b.paymentStatus,
      }));
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
      updateItem(booking.id, (b) => ({ ...b, amountPaid: updated.amountPaid, paymentStatus: updated.paymentStatus }));
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not record payment.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleAssignGuideClick(booking: BookingListItem) {
    if (rowLoadingId) {
      return;
    }
    setAssignGuideBooking(booking);
  }

  async function handleConfirmAssignGuide(guideId: string | null, guide: AssignableGuide | null) {
    if (!session || !assignGuideBooking) {
      return;
    }
    const booking = assignGuideBooking;
    setAssignGuideBooking(null);
    setRowLoadingId(booking.id);
    try {
      await window.bookingsAPI.update(booking.id, { guideId }, session.accessToken);
      toast.success('Guide assigned.');
      updateItem(booking.id, (b) => ({
        ...b,
        guide: guide ? { id: guide.id, name: guide.name, avatarUrl: guide.avatarUrl } : null,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not assign guide.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleSaved() {
    const wasEditing = mode.kind === 'edit';
    closePanel();
    fetchPage(wasEditing ? page : 1);
  }

  // Called by BookingView after it assigns a guide itself — keeps the open panel
  // showing the fresh booking (openPanel remounts BookingView via panelKey rather than
  // closing it) and syncs the same change into the list row behind it, so the table
  // doesn't show a stale guide until the next fetchPage.
  function handleBookingUpdatedFromView(updated: BookingDetail) {
    openPanel({ kind: 'view', booking: updated });
    updateItem(updated.id, (b) => ({
      ...b,
      guide: updated.guide ? { id: updated.guide.id, name: updated.guide.name, avatarUrl: updated.guide.avatarUrl } : null,
    }));
  }

  const bookingRows = bookings.map((booking) => {
    const paid = Number(booking.amountPaid);
    const totalPrice = Number(booking.totalPrice);
    const paidPct = totalPrice > 0 ? Math.min(100, Math.round((paid / totalPrice) * 100)) : 0;
    const { rangeText, singleDay } = formatDateRange(booking.startDate, booking.finishDate, formatDate);
    const { primary, overflow } = getRowActions(
      booking,
      {
        onView: (b) => handleViewClick(b.id),
        onEdit: (b) => handleEditClick(b.id),
        onConfirm: handleConfirmClick,
        onMarkOngoing: handleMarkOngoingClick,
        onRecordPayment: handleRecordPaymentClick,
        onCancel: handleCancelClick,
        onAssignGuide: handleAssignGuideClick,
      },
      { isActionRestrictedGuide, currentAdminId },
    );
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
          {!isActionRestrictedGuide && <Button onClick={handleNewBookingClick}>New Booking</Button>}
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && total === 0 && !hasActiveFilter && <p className="status-message">Loading bookings…</p>}
        {!error && !loading && total === 0 && !hasActiveFilter && <p className="status-message">No bookings yet.</p>}

        {(total > 0 || hasActiveFilter) && (
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
              {bookings.length === 0 ? (
                <p className="status-message m-0">No bookings match your search.</p>
              ) : (
                <>
                  {!isGuide && (
                    <div className="hidden overflow-x-auto md:block">
                      <table className="data-table w-full min-w-[860px]">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Tour &amp; Customer</th>
                            <th>Dates</th>
                            <th>Payment</th>
                            <th>Guide</th>
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
                                      <span className="font-semibold text-heading">{formatCurrency(paid)}</span>
                                      <span className="text-muted"> / {formatCurrency(totalPrice)}</span>
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
                                  {booking.guide ? (
                                    booking.guide.avatarUrl ? (
                                      <img
                                        className="h-6 w-6 rounded-full object-cover"
                                        src={booking.guide.avatarUrl}
                                        alt={booking.guide.name}
                                        title={booking.guide.name}
                                      />
                                    ) : (
                                      <div
                                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-shadow-dark)] text-xs font-semibold text-heading opacity-70"
                                        title={booking.guide.name}
                                        aria-label={booking.guide.name}
                                      >
                                        {booking.guide.name.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-xs text-muted">—</span>
                                  )}
                                </td>
                                <td className="table-cell-clickable" onClick={() => handleViewClick(booking.id)}>
                                  <div className="flex flex-col items-start gap-1">
                                    <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                                      {booking.status}
                                    </span>
                                    {booking.cancelledAt && (
                                      <span className="text-xs text-muted">
                                        Cancelled {formatDate(booking.cancelledAt)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <RowActionsMenu
                                    primary={primary}
                                    overflow={overflow}
                                    disabled={isRowLoading}
                                    ariaLabel={`More actions for ${booking.reference}`}
                                    menuClassName="w-48 p-1"
                                  />
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!isGuide && (
                    <div className="flex flex-col gap-3 md:hidden">
                      {bookingRows.map((row) => (
                        <BookingCard
                          key={row.booking.id}
                          row={row}
                          onView={handleViewClick}
                          formatDate={formatDate}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </div>
                  )}

                  {isGuide && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {bookingRows.map((row) => (
                        <BookingCard
                          key={row.booking.id}
                          row={row}
                          onView={handleViewClick}
                          formatDate={formatDate}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} loading={loading} onPageChange={fetchPage} />
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
              ? `Cancel ${confirmPendingCancel.reference}? This was never confirmed, so the ${formatCurrency(confirmPendingCancel.amountPaid)} paid so far will be marked as fully refunded.`
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

      {assignGuideBooking && (
        <AssignGuideDialog
          booking={{ reference: assignGuideBooking.reference, guide: assignGuideBooking.guide }}
          onConfirm={handleConfirmAssignGuide}
          onCancel={() => setAssignGuideBooking(null)}
        />
      )}

      <div className={cn('slide-panel', mode.kind !== 'idle' && 'slide-panel-open')}>
        {mode.kind === 'view' ? (
          <BookingView
            key={panelKey}
            booking={mode.booking}
            onBack={closePanel}
            onBookingUpdated={handleBookingUpdatedFromView}
          />
        ) : (
          <BookingForm
            key={panelKey}
            booking={mode.kind === 'edit' ? mode.booking : undefined}
            onCancel={closePanel}
            onSaved={handleSaved}
          />
        )}
      </div>
    </div>
  );
}
