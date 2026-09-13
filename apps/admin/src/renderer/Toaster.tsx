import { X } from 'lucide-react';
import { useToastStore, type Toast } from './states/toastStore';
import { cn } from './lib/utils';

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl bg-surface px-5 py-3 font-body text-sm text-heading opacity-100 neu-raised transition-[opacity,transform] duration-250 ease-out starting:translate-y-full starting:opacity-0 motion-reduce:transition-[opacity] motion-reduce:duration-200',
        t.variant === 'success' && 'border-l-[3px] border-l-confirmed-foreground',
        t.variant === 'error' && 'border-l-[3px] border-l-error',
        t.leaving && 'translate-y-full opacity-0 duration-200',
      )}
    >
      <span className="flex-1">{t.message}</span>
      {t.persistent && (
        <button
          type="button"
          onClick={() => onDismiss(t.id)}
          aria-label="Dismiss"
          className="shrink-0 cursor-pointer text-muted hover:text-heading"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  const bottomRightToasts = toasts.filter((t) => (t.position ?? 'bottom-right') === 'bottom-right');
  const topRightToasts = toasts.filter((t) => t.position === 'top-right');

  return (
    <>
      <div className="fixed top-6 right-6 z-[1000] flex flex-col gap-2">
        {topRightToasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
      <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2">
        {bottomRightToasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
}
