import { useState } from 'react';
import { ArrowLeft, UserRoundCog } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAppSettings } from '../../states/appSettingsStore';
import { useAuth } from '../../states/authStore';
import { toast } from '../../toast';
import { cleanIpcErrorMessage } from '../../lib/ipc';
import { AssignGuideDialog } from '../../AssignGuideDialog';
import type { BookingDetail } from '../../../preload';

interface BookingViewProps {
  booking: BookingDetail;
  onBack: () => void;
  onBookingUpdated?: (updated: BookingDetail) => void;
}

export function BookingView({ booking, onBack, onBookingUpdated }: BookingViewProps) {
  const { formatCurrency, formatDate, formatDateTime } = useAppSettings();
  const { session } = useAuth();
  const [currentBooking, setCurrentBooking] = useState(booking);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Exact role, not isGuideRole() — matches every other action restriction in this
  // app: GUIDE is blocked, LEAD_GUIDE keeps full access.
  const isActionRestrictedGuide = session?.admin.role === 'GUIDE';
  // Matches the backend's own PATCH /:id rule and the Bookings table row-action's
  // gating: assignment only makes sense once the booking is confirmed, not gated on
  // lock state since reassignment should stay possible later (e.g. mid-tour).
  const canAssignGuide =
    !isActionRestrictedGuide && currentBooking.status !== 'PENDING' && currentBooking.status !== 'CANCELLED';

  async function handleConfirmAssignGuide(guideId: string | null) {
    if (!session) {
      return;
    }
    setShowAssignDialog(false);
    setAssigning(true);
    try {
      await window.bookingsAPI.update(currentBooking.id, { guideId }, session.accessToken);
      // update()'s return type isn't precise enough to trust directly — refetch the
      // full, correctly-typed BookingDetail instead.
      const refreshed = await window.bookingsAPI.get(currentBooking.id, session.accessToken);
      toast.success('Guide assigned.');
      setCurrentBooking(refreshed);
      onBookingUpdated?.(refreshed);
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not assign guide.');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="detail-view">
      <Button className="action-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </Button>

      <h2 className="panel-title">{currentBooking.reference}</h2>

      <div className="detail-grid">
        <div className="detail-field">
          <span className="detail-label">Status</span>
          <span className={`status-badge status-${currentBooking.status.toLowerCase()}`}>{currentBooking.status}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Payment</span>
          <span className={`payment-badge payment-${currentBooking.paymentStatus.toLowerCase()}`}>
            {currentBooking.paymentStatus}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Tour</span>
          <span>{currentBooking.tour.title}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Participants</span>
          <span>{currentBooking.participants}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Start date</span>
          <span>{formatDate(currentBooking.startDate)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Finish date</span>
          <span>{formatDate(currentBooking.finishDate)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Total price</span>
          <span>{formatCurrency(currentBooking.totalPrice)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Amount paid</span>
          <span>{formatCurrency(currentBooking.amountPaid)}</span>
        </div>

        {currentBooking.status === 'CANCELLED' && (
          <>
            <div className="detail-field">
              <span className="detail-label">Refunded</span>
              <span>{currentBooking.refundAmount != null ? formatCurrency(currentBooking.refundAmount) : '—'}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Cancelled at</span>
              <span>{currentBooking.cancelledAt ? formatDateTime(currentBooking.cancelledAt) : '—'}</span>
            </div>
          </>
        )}

        <div className="detail-field col-span-full">
          <span className="detail-label">Customer</span>
          <span>
            {currentBooking.customer.name} — {currentBooking.customer.email}
            {currentBooking.customer.phone ? ` — ${currentBooking.customer.phone}` : ''}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Guide</span>
          {canAssignGuide && (
            <Button
              size="sm"
              className="action-button self-start"
              onClick={() => setShowAssignDialog(true)}
              disabled={assigning}
            >
              <UserRoundCog size={14} />
              {currentBooking.guide ? 'Reassign Guide' : 'Assign Guide'}
            </Button>
          )}
          <div className="flex items-center gap-2">
            {currentBooking.guide ? (
              <>
                {currentBooking.guide.avatarUrl ? (
                  <img
                    className="h-8 w-8 rounded-full object-cover"
                    src={currentBooking.guide.avatarUrl}
                    alt={currentBooking.guide.name}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-shadow-dark)] text-xs font-semibold text-heading opacity-70">
                    {currentBooking.guide.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span>{currentBooking.guide.name}</span>
              </>
            ) : (
              <span className="text-muted">Unassigned</span>
            )}
          </div>
        </div>
      </div>

      {currentBooking.notes && (
        <div className="detail-section">
          <span className="detail-label">Notes</span>
          <p>{currentBooking.notes}</p>
        </div>
      )}

      {currentBooking.payments.length > 0 && (
        <div className="detail-section">
          <span className="detail-label">Payment history</span>
          <div className="table-container mt-2">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {currentBooking.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDateTime(payment.createdAt)}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td className="text-muted">
                      {payment.method === 'CASH' && 'Cash'}
                      {payment.method === 'INVOICE_REFERENCE' && `Invoice: ${payment.invoiceReference}`}
                      {payment.method === 'FILE' && (
                        <a
                          href={payment.proofUrl ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent-end underline"
                        >
                          View proof
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAssignDialog && (
        <AssignGuideDialog
          booking={{ reference: currentBooking.reference, guide: currentBooking.guide }}
          onConfirm={(guideId) => handleConfirmAssignGuide(guideId)}
          onCancel={() => setShowAssignDialog(false)}
        />
      )}
    </div>
  );
}
