import { useMemo, useState, type ComponentType } from 'react';
import { Trash2, PauseCircle, PlayCircle, Eye, Search, EllipsisVertical, type LucideProps } from 'lucide-react';
import { UserForm } from './UserForm';
import { UserView } from './UserView';
import { useAppSettings } from '../../AppSettingsContext';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';
import { ROLE_BADGE_CLASS, ROLE_LABELS, mockUsersStore, setMockUsersStore, type MockUser } from './mockUsers';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'view'; user: MockUser };

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
  onView: (user: MockUser) => void;
  onSuspendToggle: (user: MockUser) => void;
  onDelete: (user: MockUser) => void;
}

function getRowActions(user: MockUser, handlers: RowActionHandlers): { primary: RowAction; overflow: RowAction[] } {
  const primary: RowAction =
    user.status === 'ACTIVE'
      ? { key: 'suspend', label: 'Suspend', Icon: PauseCircle, onClick: () => handlers.onSuspendToggle(user) }
      : { key: 'activate', label: 'Activate', Icon: PlayCircle, onClick: () => handlers.onSuspendToggle(user) };

  const overflow: RowAction[] = [
    { key: 'view', label: 'View', Icon: Eye, onClick: () => handlers.onView(user) },
    { key: 'delete', label: 'Delete', Icon: Trash2, onClick: () => handlers.onDelete(user), danger: true },
  ];

  return { primary, overflow };
}

// Simulated latency so loading/toast states read the same as the IPC-backed screens, even
// though there's no backend behind this mocked screen.
function mockDelay() {
  return new Promise((resolve) => setTimeout(resolve, 350));
}

export function Users() {
  const { formatDateTime } = useAppSettings();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [panelKey, setPanelKey] = useState(0);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<MockUser | null>(null);
  const [users, setUsers] = useState<MockUser[]>(() => mockUsersStore);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusTabKey>('ALL');

  const statusCounts = useMemo(
    () => ({
      ALL: users.length,
      ACTIVE: users.filter((u) => u.status === 'ACTIVE').length,
      SUSPENDED: users.filter((u) => u.status === 'SUSPENDED').length,
    }),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== 'ALL' && user.status !== statusFilter) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        ROLE_LABELS[user.role].toLowerCase().includes(q)
      );
    });
  }, [users, search, statusFilter]);

  function updateUsers(next: MockUser[]) {
    setUsers(next);
    setMockUsersStore(next);
  }

  function handleNewUserClick() {
    setPanelKey((k) => k + 1);
    setMode({ kind: 'create' });
  }

  function handleViewClick(user: MockUser) {
    setPanelKey((k) => k + 1);
    setMode({ kind: 'view', user });
  }

  async function handleSuspendToggle(user: MockUser) {
    if (rowLoadingId) {
      return;
    }
    setRowLoadingId(user.id);
    try {
      await mockDelay();
      const nextStatus: MockUser['status'] = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      updateUsers(users.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
      toast.success(nextStatus === 'SUSPENDED' ? 'User suspended.' : 'User activated.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleDeleteClick(user: MockUser) {
    if (rowLoadingId) {
      return;
    }
    setConfirmDeleteUser(user);
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteUser) {
      return;
    }
    const user = confirmDeleteUser;
    setConfirmDeleteUser(null);
    setRowLoadingId(user.id);
    try {
      await mockDelay();
      updateUsers(users.filter((u) => u.id !== user.id));
      toast.success('User deleted.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleCreated(user: MockUser) {
    updateUsers([user, ...users]);
    setMode({ kind: 'idle' });
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-8">
        <div className="screen-header">
          <h1 className="screen-title">Users</h1>
          <Button onClick={handleNewUserClick}>New User</Button>
        </div>

        {users.length === 0 ? (
          <p className="status-message">No users yet.</p>
        ) : (
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
              {filteredUsers.length === 0 ? (
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
                    {filteredUsers.map((user) => {
                      const isRowLoading = rowLoadingId === user.id;
                      const { primary, overflow } = getRowActions(user, {
                        onView: handleViewClick,
                        onSuspendToggle: handleSuspendToggle,
                        onDelete: handleDeleteClick,
                      });

                      return (
                        <tr
                          key={user.id}
                          className={cn('border-l-4', user.status === 'ACTIVE' ? 'border-confirmed' : 'border-cancelled')}
                        >
                          <td className="table-cell-clickable" onClick={() => handleViewClick(user)}>
                            <div className="flex items-center gap-3">
                              {user.avatarUrl ? (
                                <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={user.avatarUrl} alt="" />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-shadow-dark)] text-xs font-semibold text-heading opacity-70">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-heading">{user.name}</span>
                                <span className="text-xs text-muted">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(user)}>
                            <span className={`status-badge ${ROLE_BADGE_CLASS[user.role]}`}>
                              {ROLE_LABELS[user.role]}
                            </span>
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(user)}>
                            {user.phone ?? '—'}
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(user)}>
                            {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(user)}>
                            <span
                              className={`status-badge ${user.status === 'ACTIVE' ? 'status-confirmed' : 'status-cancelled'}`}
                            >
                              {user.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions justify-end">
                              <Button
                                size="sm"
                                className="action-button"
                                onClick={primary.onClick}
                                disabled={isRowLoading}
                              >
                                <primary.Icon size={14} />
                                {primary.label}
                              </Button>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isRowLoading}
                                    aria-label={`More actions for ${user.name}`}
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
          </>
        )}
      </div>

      {rowLoadingId && <LoadingOverlay />}

      {confirmDeleteUser && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete "${confirmDeleteUser.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteUser(null)}
        />
      )}

      <div className={cn('slide-panel', mode.kind !== 'idle' && 'slide-panel-open')}>
        {mode.kind === 'view' ? (
          <UserView key={panelKey} user={mode.user} onBack={() => setMode({ kind: 'idle' })} />
        ) : (
          <UserForm key={panelKey} onCancel={() => setMode({ kind: 'idle' })} onCreated={handleCreated} />
        )}
      </div>
    </div>
  );
}
