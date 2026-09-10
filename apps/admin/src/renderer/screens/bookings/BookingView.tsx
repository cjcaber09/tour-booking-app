import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { BookingDetail } from '../../../preload';

interface BookingViewProps {
  booking: BookingDetail;
  onBack: () => void;
}

export function BookingView({ booking, onBack }: BookingViewProps) {
  return (
    <div className="detail-view">
      <Button className="action-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </Button>

      <h2 className="panel-title">{booking.reference}</h2>

      <div className="detail-grid">
        <div className="detail-field">
          <span className="detail-label">Status</span>
          <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Payment</span>
          <span className={`payment-badge payment-${booking.paymentStatus.toLowerCase()}`}>
            {booking.paymentStatus}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Tour</span>
          <span>{booking.tour.title}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Participants</span>
          <span>{booking.participants}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Start date</span>
          <span>{new Date(booking.startDate).toLocaleDateString()}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Finish date</span>
          <span>{new Date(booking.finishDate).toLocaleDateString()}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Total price</span>
          <span>${Number(booking.totalPrice).toFixed(2)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Amount paid</span>
          <span>${Number(booking.amountPaid).toFixed(2)}</span>
        </div>

        {booking.status === 'CANCELLED' && (
          <>
            <div className="detail-field">
              <span className="detail-label">Refunded</span>
              <span>{booking.refundAmount != null ? `$${Number(booking.refundAmount).toFixed(2)}` : '—'}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Cancelled at</span>
              <span>{booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString() : '—'}</span>
            </div>
          </>
        )}

        <div className="detail-field col-span-full">
          <span className="detail-label">Customer</span>
          <span>
            {booking.customer.name} — {booking.customer.email}
            {booking.customer.phone ? ` — ${booking.customer.phone}` : ''}
          </span>
        </div>
      </div>

      {booking.notes && (
        <div className="detail-section">
          <span className="detail-label">Notes</span>
          <p>{booking.notes}</p>
        </div>
      )}

      {booking.payments.length > 0 && (
        <div className="detail-section">
          <span className="detail-label">Payment history</span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {booking.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 text-sm text-heading">
                <span>{new Date(payment.createdAt).toLocaleString()}</span>
                <span>${Number(payment.amount).toFixed(2)}</span>
                <span className="text-muted">
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
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
