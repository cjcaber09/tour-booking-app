import { cn } from './lib/utils';
import { Button } from './components/ui/button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button className={cn(danger && 'text-error')} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
