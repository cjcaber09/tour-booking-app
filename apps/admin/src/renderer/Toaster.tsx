import { useEffect, useState } from 'react';
import { subscribeToasts, type Toast } from './toast';
import { cn } from './lib/utils';

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'translate-y-0 rounded-xl bg-surface px-5 py-3 font-body text-sm text-heading opacity-100 neu-raised transition-[opacity,transform] duration-250 ease-out starting:translate-y-full starting:opacity-0 motion-reduce:transition-[opacity] motion-reduce:duration-200',
            t.variant === 'success' && 'border-l-[3px] border-l-confirmed-foreground',
            t.variant === 'error' && 'border-l-[3px] border-l-error',
            t.leaving && 'translate-y-full opacity-0 duration-200',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
