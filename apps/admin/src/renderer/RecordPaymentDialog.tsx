import { useState } from 'react';
import { Banknote, FileText, Upload } from 'lucide-react';
import { Button } from './components/ui/button';
import { cn } from './lib/utils';

type PaymentMethod = 'CASH' | 'INVOICE_REFERENCE' | 'FILE';

const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

interface RecordPaymentDialogProps {
  booking: { reference: string; totalPrice: number; amountPaid: number };
  onConfirm: (payload: {
    amount: number;
    method: PaymentMethod;
    invoiceReference?: string;
    file?: File;
  }) => void;
  onCancel: () => void;
}

export function RecordPaymentDialog({ booking, onConfirm, onCancel }: RecordPaymentDialogProps) {
  const remaining = booking.totalPrice - booking.amountPaid;
  const [amountReceived, setAmountReceived] = useState('');
  const [method, setMethod] = useState<'' | PaymentMethod>('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');

  const parsed = Number(amountReceived);
  const isAmountValid = amountReceived.trim() !== '' && !Number.isNaN(parsed) && parsed > 0 && parsed <= remaining;
  const isValid =
    isAmountValid &&
    method !== '' &&
    (method !== 'INVOICE_REFERENCE' || invoiceReference.trim() !== '') &&
    (method !== 'FILE' || file != null);

  function handleFileChange(selected: File | undefined) {
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_PROOF_TYPES.includes(selected.type)) {
      setFileError('Unsupported file type. Use an image or PDF.');
      setFile(null);
      return;
    }
    if (selected.size > MAX_PROOF_BYTES) {
      setFileError('File exceeds the 5MB limit.');
      setFile(null);
      return;
    }
    setFileError('');
    setFile(selected);
  }

  function handleConfirmClick() {
    if (!isValid) {
      return;
    }
    onConfirm({
      amount: parsed,
      method,
      invoiceReference: method === 'INVOICE_REFERENCE' ? invoiceReference.trim() : undefined,
      file: method === 'FILE' ? (file ?? undefined) : undefined,
    });
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog-card w-[min(440px,calc(100vw-3rem))]" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">Record payment</h3>
        <p className="dialog-message">Recording a payment for {booking.reference}.</p>

        <div className="mb-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm text-secondary [&>span:nth-child(even)]:text-right [&>span:nth-child(even)]:font-semibold [&>span:nth-child(even)]:text-heading">
          <span>Total price</span>
          <span>${booking.totalPrice.toFixed(2)}</span>
          <span>Already paid</span>
          <span>${booking.amountPaid.toFixed(2)}</span>
          <span>Remaining balance</span>
          <span>${remaining.toFixed(2)}</span>
        </div>

        <label className="mb-4 flex flex-col gap-2 text-sm text-secondary">
          <span>Amount received now</span>
          <input
            className="neu-field"
            type="number"
            min={0}
            max={remaining}
            step="0.01"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            autoFocus
          />
        </label>

        <div className="mb-4 flex gap-2">
          <Button
            className={cn('flex-1 flex-col gap-1 py-2 text-xs', method === 'CASH' && 'neu-inset')}
            onClick={() => setMethod('CASH')}
          >
            <Banknote size={16} />
            Cash
          </Button>
          <Button
            className={cn('flex-1 flex-col gap-1 py-2 text-xs', method === 'INVOICE_REFERENCE' && 'neu-inset')}
            onClick={() => setMethod('INVOICE_REFERENCE')}
          >
            <FileText size={16} />
            Invoice
          </Button>
          <Button
            className={cn('flex-1 flex-col gap-1 py-2 text-xs', method === 'FILE' && 'neu-inset')}
            onClick={() => setMethod('FILE')}
          >
            <Upload size={16} />
            Upload file
          </Button>
        </div>

        {method === 'INVOICE_REFERENCE' && (
          <label className="mb-2 flex flex-col gap-2 text-sm text-secondary">
            <span>Invoice reference</span>
            <input
              className="neu-field"
              type="text"
              value={invoiceReference}
              onChange={(e) => setInvoiceReference(e.target.value)}
              placeholder="e.g. INV-0042"
              autoFocus
            />
          </label>
        )}

        {method === 'FILE' && (
          <label className="mb-2 flex flex-col gap-2 text-sm text-secondary">
            <span>Proof of payment</span>
            <input
              className="neu-field"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
            {file && <span className="text-xs text-muted">{file.name}</span>}
            {fileError && <span className="text-xs text-error">{fileError}</span>}
          </label>
        )}

        <Button className="mb-6 w-full text-[0.8rem]" onClick={() => setAmountReceived(remaining.toFixed(2))}>
          Full remaining balance
        </Button>
        {!isAmountValid && (
          <p className="m-0 mb-4 text-xs text-error">Enter an amount between $0.01 and ${remaining.toFixed(2)}.</p>
        )}

        <div className="dialog-actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button disabled={!isValid} onClick={handleConfirmClick}>
            Record payment
          </Button>
        </div>
      </div>
    </div>
  );
}
