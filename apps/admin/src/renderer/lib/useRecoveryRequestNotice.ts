import { useEffect, useRef } from 'react';
import { useAuth } from '../states/authStore';
import { toast } from '../toast';

// Gated to ADMIN role — only admins can act on a recovery request (see Users.tsx's
// Reset Password action). Checks on mount and whenever the caller's dependency changes (e.g.
// AppLayout passes the active view, so navigating anywhere re-checks); no continuous background
// polling. Tracks the pushed toast's id so a still-pending request doesn't stack duplicate
// persistent toasts across re-checks — dismissing it just hides it until the next check
// re-surfaces it if still pending.
export function useRecoveryRequestNotice(dep: unknown) {
  const { session } = useAuth();
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session || session.admin.role !== 'ADMIN' || toastIdRef.current) {
      return;
    }

    let cancelled = false;
    window.adminsAPI
      .countRecoveryRequests(session.accessToken)
      .then((result) => {
        if (!cancelled && result.total > 0 && !toastIdRef.current) {
          toastIdRef.current = toast.persistent(
            `${result.total} account${result.total === 1 ? '' : 's'} need password recovery — see Users.`,
          );
        }
      })
      .catch(() => {
        // Best-effort notification check; a failed lookup shouldn't surface as a user-facing error.
      });

    return () => {
      cancelled = true;
    };
  }, [session, dep]);
}
