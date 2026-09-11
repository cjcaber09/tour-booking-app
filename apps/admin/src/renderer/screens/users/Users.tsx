import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  PauseCircle,
  PlayCircle,
  Eye,
  Search,
  EllipsisVertical,
  type LucideProps,
} from 'lucide-react';
import { UserForm } from './UserForm';
import { UserView } from './UserView';
import { useAuth } from '../../AuthContext';
import { useAppSettings } from '../../AppSettingsContext';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { AdminListItem } from '../../../preload';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';
import { ROLE_BADGE_CLASS, ROLE_LABELS } from '../../lib/roles';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'view'; admin: AdminListItem };

const PAGE_SIZE = 10;

function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

type StatusTabKey = 'ALL' | 'ACTIVE' | 'SUSPENDED';

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'SUSPENDED', label: 'Suspended' },
];

interface RowAction {
  key: string;
  label: string;
  Icon: ComponentType<LucideProps>;
  onClick: () => void;
  danger?: boolean;
}

interface RowActionHandlers {
  onView: (admin: AdminListItem) => void;
  onSuspendToggle: (admin: AdminListItem) => void;
  onDelete: (admin: AdminListItem) => void;
}

function getRowActions(
  admin: AdminListItem,
  currentAdminId: string,
  handlers: RowActionHandlers,
): { primary: RowAction | null; overflow: RowAction[] } {
  const viewAction: RowAction = { key: 'view', label: 'View', Icon: Eye, onClick: () => handlers.onView(admin) };

  if (admin.id === currentAdminId) {
    return { primary: null, overflow: [viewAction] };
  }

  const primary: RowAction = admin.isActive
    ? { key: 'suspend', label: 'Suspend', Icon: PauseCircle, onClick: () => handlers.onSuspendToggle(admin) }
    : { key: 'activate', label: 'Activate', Icon: PlayCircle, onClick: () => handlers.onSuspendToggle(admin) };

  const overflow: RowAction[] = [
    viewAction,
    { key: 'delete', label: 'Delete', Icon: Trash2, onClick: () => handlers.onDelete(admin), danger: true },
  ];

  return { primary, overflow };
}

export function Users() {
  const { session } = useAuth();
  const { formatDateTime } = useAppSettings();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [panelKey, setPanelKey] = useState(0);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [confirmDeleteAdmin, setConfirmDeleteAdmin] = useState<AdminListItem | null>(null);
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusTabKey>('ALL');

  const statusCounts = useMemo(
    () => ({
      ALL: admins.length,
      ACTIVE: admins.filter((a) => a.isActive).length,
      SUSPENDED: admins.filter((a) => !a.isActive).length,
    }),
    [admins],
  );

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();
    return admins.filter((admin) => {
      if (statusFilter === 'ACTIVE' && !admin.isActive) return false;
      if (statusFilter === 'SUSPENDED' && admin.isActive) return false;
      if (!q) return true;
      return (
        admin.name.toLowerCase().includes(q) ||
        admin.email.toLowerCase().includes(q) ||
        ROLE_LABELS[admin.role].toLowerCase().includes(q)
      );
    });
  }, [admins, search, statusFilter]);

  const fetchAdmins = useCallback(
    async (targetPage: number) => {
      if (!session) {
        return;
      }
      setLoading(true);
      setError('');
      try {
        const result = await window.adminsAPI.list(targetPage, PAGE_SIZE, session.accessToken);
        setAdmins(result.admins);
        setTotal(result.total);
        setPage(result.page);
        setTotalPages(result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load users.');
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    fetchAdmins(1);
  }, [fetchAdmins]);

  function handleNewUserClick() {
    setPanelKey((k) => k + 1);
    setMode({ kind: 'create' });
  }

  function handleViewClick(admin: AdminListItem) {
    setPanelKey((k) => k + 1);
    setMode({ kind: 'view', admin });
  }

  async function handleSuspendToggle(admin: AdminListItem) {
    if (!session || rowLoadingId) {
      return;
    }
    setRowLoadingId(admin.id);
    try {
      await window.adminsAPI.update(admin.id, { isActive: !admin.isActive }, session.accessToken);
      toast.success(admin.isActive ? 'User suspended.' : 'User activated.');
      await fetchAdmins(page);
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not update user status.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleDeleteClick(admin: AdminListItem) {
    if (rowLoadingId) {
      return;
    }
    setConfirmDeleteAdmin(admin);
  }

  async function handleConfirmDelete() {
    if (!session || !confirmDeleteAdmin) {
      return;
    }
    const admin = confirmDeleteAdmin;
    setConfirmDeleteAdmin(null);
    setRowLoadingId(admin.id);
    try {
      await window.adminsAPI.delete(admin.id, session.accessToken);
      toast.success('User deleted.');
      if (admins.length === 1 && page > 1) {
        await fetchAdmins(page - 1);
      } else {
        await fetchAdmins(page);
      }
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not delete user.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleCreated() {
    setMode({ kind: 'idle' });
    fetchAdmins(1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    fetchAdmins(nextPage);
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-8">
        <div className="screen-header">
          <h1 className="screen-title">Users</h1>
          <Button onClick={handleNewUserClick}>New User</Button>
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && total === 0 && <p className="status-message">Loading users…</p>}
        {!error && !loading && total === 0 && <p className="status-message">No users yet.</p>}

        {total > 0 && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  className="neu-field py-2.5 pl-9"
                  placeholder="Search name, email, or role"
                  aria-label="Search users"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1" role="tablist" aria-label="Filter users by status">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === tab.key}
                    className={cn('tab-button', statusFilter === tab.key && 'tab-button-active')}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    {tab.label} ({statusCounts[tab.key]})
                  </button>
                ))}
              </div>
            </div>

            <div className="table-container">
              {filteredAdmins.length === 0 ? (
                <p className="status-message m-0">No users match your search.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Last Login</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdmins.map((admin) => {
                      const isRowLoading = rowLoadingId === admin.id;
                      const { primary, overflow } = getRowActions(admin, session!.admin.id, {
                        onView: handleViewClick,
                        onSuspendToggle: handleSuspendToggle,
                        onDelete: handleDeleteClick,
                      });

                      return (
                        <tr
                          key={admin.id}
                          className={cn('border-l-4', admin.isActive ? 'border-confirmed' : 'border-cancelled')}
                        >
                          <td className="table-cell-clickable" onClick={() => handleViewClick(admin)}>
                            <div className="flex items-center gap-3">
                              {admin.avatarUrl ? (
                                <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={admin.avatarUrl} alt="" />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-shadow-dark)] text-xs font-semibold text-heading opacity-70">
                                  {admin.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-heading">{admin.name}</span>
                                <span className="text-xs text-muted">{admin.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(admin)}>
                            <span className={`status-badge ${ROLE_BADGE_CLASS[admin.role]}`}>
                              {ROLE_LABELS[admin.role]}
                            </span>
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(admin)}>
                            {admin.phone ?? '—'}
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(admin)}>
                            {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : '—'}
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(admin)}>
                            <span className={`status-badge ${admin.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
                              {admin.isActive ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions justify-end">
                              {primary && (
                                <Button
                                  size="sm"
                                  className="action-button"
                                  onClick={primary.onClick}
                                  disabled={isRowLoading}
                                >
                                  <primary.Icon size={14} />
                                  {primary.label}
                                </Button>
                              )}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isRowLoading}
                                    aria-label={`More actions for ${admin.name}`}
                                  >
                                    <EllipsisVertical size={16} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-44 p-1">
                                  <div role="menu" className="flex flex-col">
                                    {overflow.map((action) => (
                                      <button
                                        key={action.key}
                                        type="button"
                                        role="menuitem"
                                        disabled={isRowLoading}
                                        className={cn(
                                          'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-heading hover:bg-sidebar-hover disabled:cursor-not-allowed disabled:opacity-60',
                                          action.danger && 'text-error',
                                        )}
                                        onClick={action.onClick}
                                      >
                                        <action.Icon size={14} />
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <Button
                  className="page-arrow"
                  onClick={() => goToPage(page - 1)}
                  disabled={loading || page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    className={cn('page-button', n === page && 'page-button-active')}
                    onClick={() => goToPage(n)}
                    disabled={loading || n === page}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  className="page-arrow"
                  onClick={() => goToPage(page + 1)}
                  disabled={loading || page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {rowLoadingId && <LoadingOverlay />}

      {confirmDeleteAdmin && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete "${confirmDeleteAdmin.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteAdmin(null)}
        />
      )}

      <div className={cn('slide-panel', mode.kind !== 'idle' && 'slide-panel-open')}>
        {mode.kind === 'view' ? (
          <UserView key={panelKey} admin={mode.admin} onBack={() => setMode({ kind: 'idle' })} />
        ) : (
          <UserForm key={panelKey} onCancel={() => setMode({ kind: 'idle' })} onCreated={handleCreated} />
        )}
      </div>
    </div>
  );
}
