import { useState } from 'react';
import { Button } from './components/ui/button';
import { useAppSettings } from './states/appSettingsStore';

interface CancelBookingDialogProps {
  booking: { reference: string; amountPaid: number };
  onConfirm: (refundAmount: number) => void;
  onCancel: () => void;
}

export function CancelBookingDialog({ booking, onConfirm, onCancel }: CancelBookingDialogProps) {
  const { formatCurrency } = useAppSettings();
  const [refundAmount, setRefundAmount] = useState(String(booking.amountPaid));

  const parsed = Number(refundAmount);
  const isValid = refundAmount.trim() !== '' && !Number.isNaN(parsed) && parsed >= 0 && parsed <= booking.amountPaid;

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">Cancel booking</h3>
        <p className="dialog-message">
          Cancel {booking.reference}? This cannot be undone. Choose how much of the{' '}
          {formatCurrency(booking.amountPaid)} collected to refund.
        </p>
        <label className="mb-2 flex flex-col gap-2 text-sm text-secondary">
          <span>Refund amount</span>
          <input
            className="neu-field"
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
          <p className="m-0 mb-4 text-xs text-error">
            Enter an amount between $0 and {formatCurrency(booking.amountPaid)}.
          </p>
        )}
        <div className="dialog-actions">
          <Button onClick={onCancel}>Keep booking</Button>
          <Button className="text-error" disabled={!isValid} onClick={() => onConfirm(parsed)}>
            Cancel booking
          </Button>
        </div>
      </div>
    </div>
  );
}
