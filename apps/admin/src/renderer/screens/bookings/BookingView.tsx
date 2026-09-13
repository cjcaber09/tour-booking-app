import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAppSettings } from '../../states/appSettingsStore';
import type { BookingDetail } from '../../../preload';

interface BookingViewProps {
  booking: BookingDetail;
  onBack: () => void;
}

export function BookingView({ booking, onBack }: BookingViewProps) {
  const { formatCurrency, formatDate, formatDateTime } = useAppSettings();

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
          <span>{formatDate(booking.startDate)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Finish date</span>
          <span>{formatDate(booking.finishDate)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Total price</span>
          <span>{formatCurrency(booking.totalPrice)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Amount paid</span>
          <span>{formatCurrency(booking.amountPaid)}</span>
        </div>

        {booking.status === 'CANCELLED' && (
          <>
            <div className="detail-field">
              <span className="detail-label">Refunded</span>
              <span>{booking.refundAmount != null ? formatCurrency(booking.refundAmount) : '—'}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Cancelled at</span>
              <span>{booking.cancelledAt ? formatDateTime(booking.cancelledAt) : '—'}</span>
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
                {booking.payments.map((payment) => (
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
    </div>
  );
}
