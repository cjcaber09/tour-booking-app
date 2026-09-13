import { useEffect, useState } from 'react';
import { Pencil, Trash2, Eye, Search } from 'lucide-react';
import { CustomerForm } from './CustomerForm';
import { CustomerView } from './CustomerView';
import { useAuth } from '../../states/authStore';
import { useAppSettings } from '../../states/appSettingsStore';
import { useCustomersListStore } from '../../states/customersListStore';
import { useDebouncedRefetch } from '../../lib/useDebouncedRefetch';
import { toast } from '../../toast';
import { LoadingOverlay } from '../../LoadingOverlay';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Pagination } from '../../Pagination';
import { RowActionsMenu, type RowAction } from '../../RowActionsMenu';
import { cleanIpcErrorMessage } from '../../lib/ipc';
import type { CustomerListItem } from '../../../preload';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';

interface RowActionHandlers {
  onView: (customer: CustomerListItem) => void;
  onEdit: (customer: CustomerListItem) => void;
  onDelete: (customer: CustomerListItem) => void;
}

function getRowActions(
  customer: CustomerListItem,
  handlers: RowActionHandlers,
): { primary: RowAction; overflow: RowAction[] } {
  const primary: RowAction = { key: 'view', label: 'View', Icon: Eye, onClick: () => handlers.onView(customer) };

  const overflow: RowAction[] = [
    { key: 'edit', label: 'Edit', Icon: Pencil, onClick: () => handlers.onEdit(customer) },
    { key: 'delete', label: 'Delete', Icon: Trash2, onClick: () => handlers.onDelete(customer), danger: true },
  ];

  return { primary, overflow };
}

export function Customers() {
  const { session } = useAuth();
  const { formatDate } = useAppSettings();
  const {
    items: customers,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    mode,
    panelKey,
    rowLoadingId,
    fetchPage,
    setSearch,
    openPanel,
    closePanel,
    setRowLoadingId,
    removeItem,
  } = useCustomersListStore();

  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState<CustomerListItem | null>(null);

  // Search is sent to the backend (see customersListStore's fetchPage) so it applies
  // across the whole dataset, not just whatever page is currently loaded — `customers`
  // below is already the filtered/paginated result, nothing further to filter client-side.
  const hasActiveFilter = search.trim() !== '';

  useEffect(() => {
    fetchPage(useCustomersListStore.getState().page);
    return () => {
      useCustomersListStore.getState().closePanel();
    };
  }, []);

  useDebouncedRefetch(fetchPage, [search]);

  function handleNewCustomerClick() {
    openPanel({ kind: 'create' });
  }

  function handleEditClick(customer: CustomerListItem) {
    if (rowLoadingId) {
      return;
    }
    openPanel({ kind: 'edit', customer });
  }

  async function handleViewClick(customer: CustomerListItem) {
    if (!session || rowLoadingId) {
      return;
    }
    setRowLoadingId(customer.id);
    try {
      const detail = await window.customersAPI.get(customer.id, session.accessToken);
      openPanel({ kind: 'view', customer: detail });
    } catch (err) {
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not load customer.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleDeleteClick(customer: CustomerListItem) {
    if (rowLoadingId) {
      return;
    }
    setConfirmDeleteCustomer(customer);
  }

  async function handleConfirmDelete() {
    if (!session || !confirmDeleteCustomer) {
      return;
    }
    const customer = confirmDeleteCustomer;
    setConfirmDeleteCustomer(null);
    setRowLoadingId(customer.id);
    try {
      await window.customersAPI.delete(customer.id, session.accessToken);
      toast.success('Customer deleted.');
      if (customers.length === 1 && page > 1) {
        await fetchPage(page - 1);
      } else {
        removeItem(customer.id);
      }
    } catch (err) {
      // Surfaces the server's 409 "cannot delete a customer with existing bookings" message
      // directly rather than a generic failure string — cleanIpcErrorMessage already unwraps
      // it to the backend's own text, since delete errors carry no field-level details to parse.
      toast.error(err instanceof Error ? cleanIpcErrorMessage(err.message) : 'Could not delete customer.');
    } finally {
      setRowLoadingId(null);
    }
  }

  function handleSaved() {
    const wasEditing = mode.kind === 'edit';
    closePanel();
    fetchPage(wasEditing ? page : 1);
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="box-border h-full overflow-y-auto p-8">
        <div className="screen-header">
          <h1 className="screen-title">Customers</h1>
          <Button onClick={handleNewCustomerClick}>New Customer</Button>
        </div>

        {error && <p className="status-message status-message-error">{error}</p>}
        {!error && loading && total === 0 && !hasActiveFilter && <p className="status-message">Loading customers…</p>}
        {!error && !loading && total === 0 && !hasActiveFilter && <p className="status-message">No customers yet.</p>}

        {(total > 0 || hasActiveFilter) && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  className="neu-field py-2.5 pl-9"
                  placeholder="Search name or email"
                  aria-label="Search customers"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-container">
              {customers.length === 0 ? (
                <p className="status-message m-0">No customers match your search.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Created</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => {
                      const isRowLoading = rowLoadingId === customer.id;
                      const { primary, overflow } = getRowActions(customer, {
                        onView: handleViewClick,
                        onEdit: handleEditClick,
                        onDelete: handleDeleteClick,
                      });

                      return (
                        <tr key={customer.id}>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(customer)}>
                            <span className="font-semibold text-heading">{customer.name}</span>
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(customer)}>
                            {customer.email}
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(customer)}>
                            {customer.phone ?? '—'}
                          </td>
                          <td className="table-cell-clickable" onClick={() => handleViewClick(customer)}>
                            {formatDate(customer.createdAt)}
                          </td>
                          <td>
                            <RowActionsMenu
                              primary={primary}
                              overflow={overflow}
                              disabled={isRowLoading}
                              ariaLabel={`More actions for ${customer.name}`}
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

      {confirmDeleteCustomer && (
        <ConfirmDialog
          title="Delete customer"
          message={`Delete "${confirmDeleteCustomer.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteCustomer(null)}
        />
      )}

      <div className={cn('slide-panel', mode.kind !== 'idle' && 'slide-panel-open')}>
        {mode.kind === 'view' ? (
          <CustomerView key={panelKey} customer={mode.customer} onBack={closePanel} />
        ) : (
          <CustomerForm
            key={panelKey}
            customer={mode.kind === 'edit' ? mode.customer : undefined}
            onCancel={closePanel}
            onSaved={handleSaved}
          />
        )}
      </div>
    </div>
  );
}
