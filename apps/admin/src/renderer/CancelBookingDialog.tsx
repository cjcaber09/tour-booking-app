import { useState } from 'react';
import './ConfirmDialog.css';
import './CancelBookingDialog.css';

interface CancelBookingDialogProps {
  booking: { reference: string; amountPaid: number };
  onConfirm: (refundAmount: number) => void;
  onCancel: () => void;
}

export function CancelBookingDialog({ booking, onConfirm, onCancel }: CancelBookingDialogProps) {
  const [refundAmount, setRefundAmount] = useState(String(booking.amountPaid));

  const parsed = Number(refundAmount);
  const isValid = refundAmount.trim() !== '' && !Number.isNaN(parsed) && parsed >= 0 && parsed <= booking.amountPaid;

  return (
    <div className="confirm-dialog-backdrop" onClick={onCancel}>
      <div className="confirm-dialog-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog-title">Cancel booking</h3>
        <p className="confirm-dialog-message">
          Cancel {booking.reference}? This cannot be undone. Choose how much of the ${booking.amountPaid.toFixed(2)}{' '}
          collected to refund.
        </p>
        <label className="cancel-booking-dialog-field">
          <span>Refund amount</span>
          <input
            type="number"
            min={0}
            max={booking.amountPaid}
            step="0.01"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            autoFocus
          />
        </label>
        {!isValid && (
          <p className="cancel-booking-dialog-error">Enter an amount between $0 and ${booking.amountPaid.toFixed(2)}.</p>
        )}
        <div className="confirm-dialog-actions">
          <button type="button" className="neumorphic-button" onClick={onCancel}>
            Keep booking
          </button>
          <button
            type="button"
            className="neumorphic-button confirm-dialog-danger-button"
            disabled={!isValid}
            onClick={() => onConfirm(parsed)}
          >
            Cancel booking
          </button>
        </div>
      </div>
    </div>
  );
}
