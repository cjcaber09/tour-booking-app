import { LoaderCircle } from 'lucide-react';
import { cn } from './lib/utils';
import { useEscapeToClose } from './lib/useEscapeToClose';
import { Button } from './components/ui/button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // Optional and defaulted so existing callers that don't pass it (Sidebar/Users/
  // Tours/Customers) keep their current close-immediately behavior unchanged — only
  // callers that opt in get the stay-open-with-spinner treatment.
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  submitting = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEscapeToClose(onCancel, submitting);

  return (
    <div className="dialog-backdrop">
      <div className="dialog-backdrop-dismiss" aria-hidden="true" onClick={submitting ? undefined : onCancel} />
      <div className="dialog-card">
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <Button onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button className={cn(danger && 'text-error')} onClick={onConfirm} disabled={submitting}>
            {submitting && <LoaderCircle className="animate-[spin_0.8s_linear_infinite]" size={14} />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
