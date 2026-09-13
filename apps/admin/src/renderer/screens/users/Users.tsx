import { useEffect, useState } from 'react';
import { Trash2, PauseCircle, PlayCircle, Eye, Search, KeyRound } from 'lucide-react';
import { UserForm } from './UserForm';
import { UserView } from './UserView';
import { ResetPasswordResult } from './ResetPasswordResult';
import { useAuth } from '../../states/authStore';
import { useAppSettings } from '../../states/appSettingsStore';
import { useUsersListStore, type UsersStatusFilter } from '../../states/usersListStore';
import { useDebouncedRefetch } from '../../lib/useDebouncedRefetch';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Pagination } from '../../Pagination';
import { RowActionsMenu, type RowAction } from '../../RowActionsMenu';
import { cleanIpcErrorMessage } from '../../lib/ipc';
import type { AdminListItem, CreateAdminResult } from '../../../preload';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { ROLE_BADGE_CLASS, ROLE_LABELS } from '../../lib/roles';

const STATUS_TABS: { key: UsersStatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'SUSPENDED', label: 'Suspended' },
];

interface RowActionHandlers {
  onView: (admin: AdminListItem) => void;
  onSuspendToggle: (admin: AdminListItem) => void;
  onResetPassword: (admin: AdminListItem) => void;
  onDelete: (admin: AdminListItem) => void;
}

function getRowActions(
  admin: AdminListItem,
  currentAdminId: string,
  handlers: RowActionHandlers,
): { primary: RowAction | null; overflow: RowAction[] } {
  const viewAction: RowAction = { key: 'view', label: 'View', Icon: Eye, onClick: () => handlers.onView(admin) };

  // Self-service password change already exists via /profile/change-password — reset-password
  // is only ever offered for OTHER accounts, same as the suspend/delete actions below.
  if (admin.id === currentAdminId) {
    return { primary: null, overflow: [viewAction] };
  }

  const primary: RowAction = admin.isActive
    ? { key: 'suspend', label: 'Suspend', Icon: PauseCircle, onClick: () => handlers.onSuspendToggle(admin) }
    : { key: 'activate', label: 'Activate', Icon: PlayCircle, onClick: () => handlers.onSuspendToggle(admin) };

  const overflow: RowAction[] = [
    viewAction,
    {
      key: 'reset-password',
      label: 'Reset Password',
      Icon: KeyRound,
      onClick: () => handlers.onResetPassword(admin),
    },
    { key: 'delete', label: 'Delete', Icon: Trash2, onClick: () => handlers.onDelete(admin), danger: true },
  ];

  return { primary, overflow };
}

export function Users() {
  const { session } = useAuth();
  const { formatDateTime } = useAppSettings();
  const {
    items: admins,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    statusFilter,
    statusCounts,
    mode,
    panelKey,
    rowLoadingId,
    fetchPage,
    setSearch,
    setStatusFilter,
    openPanel,
    closePanel,
    setRowLoadingId,
  } = useUsersListStore();

  const [confirmDeleteAdmin, setConfirmDeleteAdmin] = useState<AdminListItem | null>(null);
  const [confirmSuspendAdmin, setConfirmSuspendAdmin] = useState<AdminListItem | null>(null);
  const [confirmResetPasswordAdmin, setConfirmResetPasswordAdmin] = useState<AdminListItem | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<CreateAdminResult | null>(null);

  // Search and status are sent to the backend (see usersListStore's fetchPage) so
  // they apply across the whole dataset, not just whatever page is currently loaded —
  // `admins` below is already the filtered/paginated result, nothing further to filter
  // client-side. Note: server-side search matches name/email only, not role (the old
  // client-side search also matched role text — a minor, accepted narrowing).
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'ALL';

  useEffect(() => {
    fetchPage(useUsersListStore.getState().page);
    return () => {
      useUsersListStore.getState().closePanel();
    };
  }, []);

  useDebouncedRefetch(fetchPage, [search, statusFilter]);

  function handleNewUserClick() {
    openPanel({ kind: 'create' });
  }

  function handleViewClick(admin: AdminListItem) {
    openPanel({ kind: 'view', admin });
  }

  function handleSuspendToggleClick(admin: AdminListItem) {
    if (rowLoadingId) {
      return;
    }
    // Suspending (locking someone out) is confirmed; re-activating isn't — matches
    // the rest of the screen's pattern of only gating the state-degrading direction.
    if (admin.isActive) {
      setConfirmSuspendAdmin(admin);
    } else {
      void runSuspendToggle(admin);
    }
  }

  async function handleConfirmSuspend() {
    if (!confirmSuspendAdmin) {
      return;
    }
    const admin = confirmSuspendAdmin;
    setConfirmSuspendAdmin(null);
    await runSuspendToggle(admin);
  }

  async function runSuspendToggle(admin: AdminListItem) {
    if (!session) {
      return;
    }
    setRowLoadingId(admin.id);
    try {
      await window.adminsAPI.update(admin.id, { isActive: !admin.isActive }, session.accessToken);
      toast.success(admin.isActive ? 'User suspended.' : 'User activated.');
      await fetchPage(page);
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
        await fetchPage(page - 1);
      } else {
        await fetchPage(page);
      }
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not delete user.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleCreated() {
    closePanel();
    fetchPage(1);
  }

  function handleResetPasswordClick(admin: AdminListItem) {
    if (rowLoadingId) {
      return;
    }
    setConfirmResetPasswordAdmin(admin);
  }

  async function handleConfirmResetPassword() {
    if (!session || !confirmResetPasswordAdmin) {
      return;
    }
    const admin = confirmResetPasswordAdmin;
    setConfirmResetPasswordAdmin(null);
    setRowLoadingId(admin.id);
    try {
      const result = await window.adminsAPI.resetPassword(admin.id, session.accessToken);
      setResetPasswordResult(result);
      await fetchPage(page);
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not reset password.');
    } finally {
      setRowLoadingId(null);
    }
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-8">
        <div className="screen-header">
          <h1 className="screen-title">Users</h1>
          <Button onClick={handleNewUserClick}>New User</Button>
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && total === 0 && !hasActiveFilter && <p className="status-message">Loading users…</p>}
        {!error && !loading && total === 0 && !hasActiveFilter && <p className="status-message">No users yet.</p>}

        {(total > 0 || hasActiveFilter) && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  className="neu-field py-2.5 pl-9"
                  placeholder="Search name or email"
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
              {admins.length === 0 ? (
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
                    {admins.map((admin) => {
                      const isRowLoading = rowLoadingId === admin.id;
                      const { primary, overflow } = getRowActions(admin, session!.admin.id, {
                        onView: handleViewClick,
                        onSuspendToggle: handleSuspendToggleClick,
                        onResetPassword: handleResetPasswordClick,
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
                            <div className="flex flex-col items-start gap-1">
                              <span className={`status-badge ${admin.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
                                {admin.isActive ? 'Active' : 'Suspended'}
                              </span>
                              {admin.recoveryRequestedAt != null && (
                                <span className="status-badge status-pending">Recovery requested</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <RowActionsMenu
                              primary={primary}
                              overflow={overflow}
                              disabled={isRowLoading}
                              ariaLabel={`More actions for ${admin.name}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} loading={loading} onPageChange={fetchPage} />
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

      {confirmSuspendAdmin && (
        <ConfirmDialog
          title="Suspend user"
          message={`Suspend "${confirmSuspendAdmin.name}"? They will be signed out and unable to log back in until reactivated.`}
          confirmLabel="Suspend"
          danger
          onConfirm={handleConfirmSuspend}
          onCancel={() => setConfirmSuspendAdmin(null)}
        />
      )}

      {confirmResetPasswordAdmin && (
        <ConfirmDialog
          title="Reset password"
          message={`This will generate a new password and immediately sign ${confirmResetPasswordAdmin.name} out of any active session. Continue?`}
          confirmLabel="Reset Password"
          danger
          onConfirm={handleConfirmResetPassword}
          onCancel={() => setConfirmResetPasswordAdmin(null)}
        />
      )}

      {resetPasswordResult && (
        <ResetPasswordResult result={resetPasswordResult} onClose={() => setResetPasswordResult(null)} />
      )}

      <div className={cn('slide-panel', mode.kind !== 'idle' && 'slide-panel-open')}>
        {mode.kind === 'view' ? (
          <UserView key={panelKey} admin={mode.admin} onBack={closePanel} />
        ) : (
          <UserForm key={panelKey} onCancel={closePanel} onCreated={handleCreated} />
        )}
      </div>
    </div>
  );
}
