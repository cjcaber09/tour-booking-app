import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { useAppSettings } from '../../AppSettingsContext';
import { ROLE_LABELS } from '../../lib/roles';
import type { AuditEntry } from '../../../preload';

export function AuditPage() {
  const { session } = useAuth();
  const { formatDate, formatTime } = useAppSettings();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAudit = useCallback(async () => {
    if (!session) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await window.auditAPI.list(session.accessToken);
      setEntries(result.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load audit log.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

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
                {entries.map((entry) => (
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
        )}
      </div>
    </div>
  );
}
