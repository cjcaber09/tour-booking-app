import { useState } from 'react';
import './ConfirmDialog.css';
import './RecordPaymentDialog.css';

interface RecordPaymentDialogProps {
  booking: { reference: string; totalPrice: number; amountPaid: number };
  onConfirm: (newAmountPaid: number) => void;
  onCancel: () => void;
}

export function RecordPaymentDialog({ booking, onConfirm, onCancel }: RecordPaymentDialogProps) {
  const remaining = booking.totalPrice - booking.amountPaid;
  const [amountReceived, setAmountReceived] = useState('');

  const parsed = Number(amountReceived);
  const isValid = amountReceived.trim() !== '' && !Number.isNaN(parsed) && parsed > 0 && parsed <= remaining;

  return (
    <div className="confirm-dialog-backdrop" onClick={onCancel}>
      <div className="confirm-dialog-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog-title">Record payment</h3>
        <p className="confirm-dialog-message">Recording a payment for {booking.reference}.</p>

        <div className="record-payment-dialog-summary">
          <span>Total price</span>
          <span>${booking.totalPrice.toFixed(2)}</span>
          <span>Already paid</span>
          <span>${booking.amountPaid.toFixed(2)}</span>
          <span>Remaining balance</span>
          <span>${remaining.toFixed(2)}</span>
        </div>

        <label className="record-payment-dialog-field">
          <span>Amount received now</span>
          <input
            type="number"
            min={0}
            max={remaining}
            step="0.01"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            autoFocus
          />
        </label>
        <button
          type="button"
          className="neumorphic-button record-payment-dialog-full-balance-button"
          onClick={() => setAmountReceived(remaining.toFixed(2))}
        >
          Full remaining balance
        </button>
        {!isValid && (
          <p className="record-payment-dialog-error">Enter an amount between $0.01 and ${remaining.toFixed(2)}.</p>
        )}

        <div className="confirm-dialog-actions">
          <button type="button" className="neumorphic-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="neumorphic-button"
            disabled={!isValid}
            onClick={() => onConfirm(booking.amountPaid + parsed)}
          >
            Record payment
          </button>
        </div>
      </div>
    </div>
  );
}
