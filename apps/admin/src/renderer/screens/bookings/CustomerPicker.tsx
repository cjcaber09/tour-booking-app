import { useEffect, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '../../components/ui/popover';
import { Button } from '../../components/ui/button';
import type { AdminSession, CustomerSummary } from '../../../preload';

export type CustomerSelection =
  | { mode: 'search' }
  | { mode: 'selected'; customer: CustomerSummary }
  | { mode: 'new'; email: string; name: string; phone: string };

interface CustomerPickerProps {
  session: AdminSession | null;
  value: CustomerSelection;
  onChange: (value: CustomerSelection) => void;
  error?: string;
}

export function CustomerPicker({ session, value, onChange, error }: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);

  useEffect(() => {
    if (value.mode !== 'search' || !session || query.trim().length < 2) {
      setResults([]);
      setIsResultsOpen(false);
      return;
    }
    setSearching(true);
    setIsResultsOpen(true);
    const handle = setTimeout(() => {
      window.customersAPI
        .search(query.trim(), session.accessToken)
        .then((result) => setResults(result.customers))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [value.mode, query, session]);

  function selectCustomer(customer: CustomerSummary) {
    setIsResultsOpen(false);
    onChange({ mode: 'selected', customer });
  }

  function changeCustomer() {
    setQuery('');
    setResults([]);
    onChange({ mode: 'search' });
  }

  function updateNewCustomer(patch: Partial<{ email: string; name: string; phone: string }>) {
    if (value.mode !== 'new') {
      return;
    }
    onChange({ ...value, ...patch });
  }

  return (
    <div className="form-field col-span-full">
      <span>Customer</span>

      {value.mode === 'selected' && (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-surface p-3 neu-inset">
          <div className="flex flex-col gap-0.5 text-[0.8125rem] text-secondary">
            <strong className="text-[0.9375rem] text-heading">{value.customer.name}</strong>
            <span>{value.customer.email}</span>
            {value.customer.phone && <span>{value.customer.phone}</span>}
          </div>
          <Button onClick={changeCustomer}>Change</Button>
        </div>
      )}

      {value.mode === 'search' && (
        <div className="flex flex-col gap-2.5">
          <Popover open={isResultsOpen} onOpenChange={setIsResultsOpen}>
            <PopoverAnchor asChild>
              <input
                className="neu-field"
                type="text"
                placeholder="Search by name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (results.length > 0) {
                    setIsResultsOpen(true);
                  }
                }}
              />
            </PopoverAnchor>
            <PopoverContent
              className="max-h-60 w-[var(--radix-popper-anchor-width)] overflow-y-auto p-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {searching && <p className="px-1 py-1.5 text-[0.8125rem] text-muted">Searching…</p>}
              {!searching && results.length === 0 && (
                <p className="px-1 py-1.5 text-[0.8125rem] text-muted">No matching customers.</p>
              )}
              {!searching && results.length > 0 && (
                <div className="flex flex-col gap-1">
                  {results.map((customer) => (
                    <Button
                      key={customer.id}
                      variant="ghost"
                      className="w-full justify-start rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-normal text-heading"
                      onClick={() => selectCustomer(customer)}
                    >
                      {customer.name} — {customer.email}
                    </Button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button className="self-start" onClick={() => onChange({ mode: 'new', email: '', name: '', phone: '' })}>
            Add a new customer
          </Button>
        </div>
      )}

      {value.mode === 'new' && (
        <div className="flex flex-col gap-2.5">
          <input
            className="neu-field"
            type="text"
            placeholder="Name"
            value={value.name}
            onChange={(e) => updateNewCustomer({ name: e.target.value })}
            required
          />
          <input
            className="neu-field"
            type="email"
            placeholder="Email"
            value={value.email}
            onChange={(e) => updateNewCustomer({ email: e.target.value })}
            required
          />
          <input
            className="neu-field"
            type="text"
            placeholder="Phone (optional)"
            value={value.phone}
            onChange={(e) => updateNewCustomer({ phone: e.target.value })}
          />
          <Button className="self-start" onClick={() => onChange({ mode: 'search' })}>
            Search instead
          </Button>
        </div>
      )}
      {error && <p className="form-field-error">{error}</p>}
    </div>
  );
}
