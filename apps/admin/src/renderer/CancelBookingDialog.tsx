import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from './components/ui/button';
import { useAppSettings } from './states/appSettingsStore';
import { useEscapeToClose } from './lib/useEscapeToClose';
import { useBackdropDismiss } from './lib/useBackdropDismiss';

interface CancelBookingDialogProps {
  booking: { reference: string; amountPaid: number };
  onConfirm: (refundAmount: number) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function CancelBookingDialog({ booking, onConfirm, onCancel, submitting }: CancelBookingDialogProps) {
  const { formatCurrency } = useAppSettings();
  const [refundAmount, setRefundAmount] = useState(String(booking.amountPaid));

  const parsed = Number(refundAmount);
  const isValid = refundAmount.trim() !== '' && !Number.isNaN(parsed) && parsed >= 0 && parsed <= booking.amountPaid;

  useEscapeToClose(onCancel, submitting);
  const backdropRef = useBackdropDismiss(onCancel, submitting);

  return (
    <div className="dialog-backdrop">
      <div ref={backdropRef} className="dialog-backdrop-dismiss" aria-hidden="true" />
      <div className="dialog-card">
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
            disabled={submitting}
            autoFocus
          />
        </label>
        {!isValid && (
          <p className="m-0 mb-4 text-xs text-error">
            Enter an amount between $0 and {formatCurrency(booking.amountPaid)}.
          </p>
        )}
        <div className="dialog-actions">
          <Button onClick={onCancel} disabled={submitting}>
            Keep booking
          </Button>
          <Button className="text-error" disabled={!isValid || submitting} onClick={() => onConfirm(parsed)}>
            {submitting && <LoaderCircle className="animate-[spin_0.8s_linear_infinite]" size={14} />}
            Cancel booking
          </Button>
        </div>
      </div>
    </div>
  );
}
