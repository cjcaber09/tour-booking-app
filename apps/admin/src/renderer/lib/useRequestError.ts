import { useCallback, useState } from 'react';
import { toast } from '../toast';
import { cleanIpcErrorMessage } from './ipc';

export function useRequestError(fallbackMessage = 'Could not complete request.') {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleRequestError = useCallback(
    (err: unknown) => {
      const raw = err instanceof Error ? cleanIpcErrorMessage(err.message) : 'request failed';
      try {
        const parsed = JSON.parse(raw) as { status?: number; error?: string; details?: Record<string, string[]> };
        if (parsed.status === 401) {
          toast.error('Session expired, please log in again.');
        } else if (parsed.details) {
          const flat: Record<string, string> = {};
          for (const [field, messages] of Object.entries(parsed.details)) {
            if (messages?.[0]) {
              flat[field] = messages[0];
            }
          }
          setFieldErrors(flat);
        } else {
          toast.error(parsed.error || fallbackMessage);
        }
      } catch {
        toast.error(raw || fallbackMessage);
      }
    },
    [fallbackMessage],
  );

  return { fieldErrors, setFieldErrors, handleRequestError };
}
