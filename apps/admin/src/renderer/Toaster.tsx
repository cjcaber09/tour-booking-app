import { useEffect, useState } from 'react';
import { subscribeToasts, type Toast } from './toast';
import './Toaster.css';

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.variant} ${t.leaving ? 'toast-leaving' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
