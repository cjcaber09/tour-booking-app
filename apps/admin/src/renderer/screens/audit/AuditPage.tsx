import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../states/authStore';
import { useAppSettings } from '../../states/appSettingsStore';
import { Pagination } from '../../Pagination';
import { ROLE_LABELS } from '../../lib/roles';
import type { AuditEntry } from '../../../preload';

const PAGE_SIZE = 10;

export function AuditPage() {
  const { session } = useAuth();
  const { formatDate, formatTime } = useAppSettings();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const fetchAudit = useCallback(async () => {
    if (!session) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await window.auditAPI.list(session.accessToken);
      setEntries(result.entries);
      // The full (capped-at-500) log is fetched in one shot and paginated client-side below —
      // reset to page 1 on every fetch since a refresh can change the total entry count.
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load audit log.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pagedEntries = useMemo(
    () => entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [entries, page],
  );

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-8">
        <div className="screen-header">
          <h1 className="screen-title">Audit Log</h1>
          <button type="button" className="tab-button" onClick={fetchAudit} disabled={loading}>
            Refresh
          </button>
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && entries.length === 0 && <p className="status-message">Loading…</p>}
        {!error && !loading && entries.length === 0 && <p className="status-message">No calls recorded yet.</p>}

        {!error && entries.length > 0 && (
          <>
            <div className="table-container">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.timestamp)}</td>
                      <td>{formatTime(entry.timestamp)}</td>
                      <td>{entry.method}</td>
                      <td>{entry.path}</td>
                      <td>{entry.status}</td>
                      <td>{entry.durationMs} ms</td>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-semibold text-heading">{entry.adminName ?? 'System'}</span>
                          {entry.adminName && entry.adminRole && (
                            <span className="text-xs text-muted">{ROLE_LABELS[entry.adminRole]}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} totalPages={totalPages} loading={loading} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
