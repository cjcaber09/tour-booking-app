import { ArrowLeft } from 'lucide-react';
import type { BookingDetail } from '../../../preload';
import './BookingView.css';

interface BookingViewProps {
  booking: BookingDetail;
  onBack: () => void;
}

export function BookingView({ booking, onBack }: BookingViewProps) {
  return (
    <div className="booking-view">
      <button type="button" className="neumorphic-button booking-view-back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>

      <h2>{booking.reference}</h2>

      <div className="booking-view-details">
        <div className="booking-view-field">
          <span className="booking-view-label">Status</span>
          <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
        </div>

        <div className="booking-view-field">
          <span className="booking-view-label">Payment</span>
          <span className={`payment-badge payment-${booking.paymentStatus.toLowerCase()}`}>
            {booking.paymentStatus}
          </span>
        </div>

        <div className="booking-view-field">
          <span className="booking-view-label">Tour</span>
          <span>{booking.tour.title}</span>
        </div>

        <div className="booking-view-field">
          <span className="booking-view-label">Participants</span>
          <span>{booking.participants}</span>
        </div>

        <div className="booking-view-field">
          <span className="booking-view-label">Start date</span>
          <span>{new Date(booking.startDate).toLocaleDateString()}</span>
        </div>

        <div className="booking-view-field">
          <span className="booking-view-label">Total price</span>
          <span>${Number(booking.totalPrice).toFixed(2)}</span>
        </div>

        <div className="booking-view-field">
          <span className="booking-view-label">Amount paid</span>
          <span>${Number(booking.amountPaid).toFixed(2)}</span>
        </div>

        {booking.status === 'CANCELLED' && (
          <>
            <div className="booking-view-field">
              <span className="booking-view-label">Refunded</span>
              <span>{booking.refundAmount != null ? `$${Number(booking.refundAmount).toFixed(2)}` : '—'}</span>
            </div>
            <div className="booking-view-field">
              <span className="booking-view-label">Cancelled at</span>
              <span>{booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString() : '—'}</span>
            </div>
          </>
        )}

        <div className="booking-view-field booking-view-field-full">
          <span className="booking-view-label">Customer</span>
          <span>
            {booking.customer.name} — {booking.customer.email}
            {booking.customer.phone ? ` — ${booking.customer.phone}` : ''}
          </span>
        </div>
      </div>

      {booking.notes && (
        <div className="booking-view-section">
          <span className="booking-view-label">Notes</span>
          <p>{booking.notes}</p>
        </div>
      )}
    </div>
  );
}
