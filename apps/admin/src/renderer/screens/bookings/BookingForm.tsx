import { FormEvent, useEffect, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar } from '../../components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import type { CreateBookingPayload, BookingDetail, TourListItem, CustomerSummary } from '../../../preload';

interface BookingFormProps {
  booking?: BookingDetail;
  onCancel: () => void;
  onSaved: () => void;
}

interface FormState {
  tourId: string;
  participants: string;
  startDate: string;
  notes: string;
}

const INITIAL_STATE: FormState = {
  tourId: '',
  participants: '1',
  startDate: '',
  notes: '',
};

const DATE_FORMAT = 'yyyy-MM-dd';

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function parseFormDate(value: string): Date {
  return parse(value, DATE_FORMAT, new Date());
}

function deriveFormState(booking: BookingDetail | undefined): FormState {
  if (!booking) {
    return INITIAL_STATE;
  }
  return {
    tourId: booking.tour.id,
    participants: String(booking.participants),
    startDate: toDateInputValue(booking.startDate),
    notes: booking.notes ?? '',
  };
}

function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

type CustomerMode = 'search' | 'selected' | 'new';

export function BookingForm({ booking, onCancel, onSaved }: BookingFormProps) {
  const isEditing = booking != null;
  const { session } = useAuth();
  const [form, setForm] = useState<FormState>(() => deriveFormState(booking));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [tours, setTours] = useState<TourListItem[]>([]);
  const [toursLoading, setToursLoading] = useState(false);

  const [customerMode, setCustomerMode] = useState<CustomerMode>(booking ? 'selected' : 'search');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(booking?.customer ?? null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerSummary[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [isCustomerResultsOpen, setIsCustomerResultsOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ email: '', name: '', phone: '' });

  useEffect(() => {
    if (!session) {
      return;
    }
    setToursLoading(true);
    window.toursAPI
      .list(1, 100, session.accessToken)
      .then((result) => setTours(result.tours))
      .catch(() => toast.error('Could not load tours.'))
      .finally(() => setToursLoading(false));
  }, [session]);

  useEffect(() => {
    if (customerMode !== 'search' || !session || customerQuery.trim().length < 2) {
      setCustomerResults([]);
      setIsCustomerResultsOpen(false);
      return;
    }
    setCustomerSearching(true);
    setIsCustomerResultsOpen(true);
    const handle = setTimeout(() => {
      window.customersAPI
        .search(customerQuery.trim(), session.accessToken)
        .then((result) => setCustomerResults(result.customers))
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [customerMode, customerQuery, session]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSelectCustomer(customer: CustomerSummary) {
    setSelectedCustomer(customer);
    setCustomerMode('selected');
    setIsCustomerResultsOpen(false);
  }

  function handleChangeCustomer() {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setCustomerResults([]);
    setCustomerMode('search');
  }

  function handleRequestError(err: unknown) {
    const raw = err instanceof Error ? cleanIpcErrorMessage(err.message) : 'request failed';
    try {
      const parsed = JSON.parse(raw) as {
        status?: number;
        error?: string;
        details?: Record<string, string[]>;
      };
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
        toast.error(parsed.error || 'Could not complete request.');
      }
    } catch {
      toast.error(raw || 'Could not complete request.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    if (!form.tourId) {
      setFieldErrors({ tourId: 'Select a tour.' });
      return;
    }
    if (!form.startDate) {
      setFieldErrors({ startDate: 'Select a booking date.' });
      return;
    }
    if (customerMode === 'search' && !selectedCustomer) {
      setFieldErrors({ customerId: 'Select an existing customer or add a new one.' });
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      const payload: CreateBookingPayload = {
        tourId: form.tourId,
        participants: Number(form.participants),
        startDate: new Date(form.startDate).toISOString(),
      };

      if (customerMode === 'new') {
        payload.customer = {
          email: newCustomer.email,
          name: newCustomer.name,
          phone: newCustomer.phone || undefined,
        };
      } else if (selectedCustomer) {
        payload.customerId = selectedCustomer.id;
      }

      if (form.notes) payload.notes = form.notes;

      if (isEditing && booking) {
        await window.bookingsAPI.update(booking.id, payload, session.accessToken);
        toast.success('Booking updated.');
      } else {
        await window.bookingsAPI.create(payload, session.accessToken);
        toast.success('Booking created.');
      }
      onSaved();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <h2 className="panel-title">{isEditing ? 'Edit Booking' : 'New Booking'}</h2>

      <label className="form-field">
        <span>Tour</span>
        <Select value={form.tourId} onValueChange={(value) => update('tourId', value)} disabled={toursLoading}>
          <SelectTrigger>
            <SelectValue placeholder={toursLoading ? 'Loading tours…' : 'Select a tour'} />
          </SelectTrigger>
          <SelectContent>
            {tours.map((tour) => (
              <SelectItem key={tour.id} value={tour.id}>
                {tour.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.tourId && <p className="form-field-error">{fieldErrors.tourId}</p>}
      </label>

      <label className="form-field">
        <span>Participants</span>
        <input
          className="neu-field"
          name="participants"
          type="number"
          min={1}
          value={form.participants}
          onChange={(e) => update('participants', e.target.value)}
          required
        />
        {fieldErrors.participants && <p className="form-field-error">{fieldErrors.participants}</p>}
      </label>

      <label className="form-field">
        <span>Booking Date</span>
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="neu-field flex items-center justify-between text-left">
              <span className={form.startDate ? '' : 'text-muted'}>
                {form.startDate ? format(parseFormDate(form.startDate), 'PPP') : 'Select a date'}
              </span>
              <CalendarIcon className="h-4 w-4 shrink-0 text-secondary" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={form.startDate ? parseFormDate(form.startDate) : undefined}
              onSelect={(date) => {
                if (date) {
                  update('startDate', format(date, DATE_FORMAT));
                  setIsDatePickerOpen(false);
                }
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {fieldErrors.startDate && <p className="form-field-error">{fieldErrors.startDate}</p>}
      </label>

      <div className="form-field col-span-full">
        <span>Customer</span>

        {customerMode === 'selected' && selectedCustomer && (
          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface p-3 neu-inset">
            <div className="flex flex-col gap-0.5 text-[0.8125rem] text-secondary">
              <strong className="text-[0.9375rem] text-heading">{selectedCustomer.name}</strong>
              <span>{selectedCustomer.email}</span>
              {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
            </div>
            <Button onClick={handleChangeCustomer}>Change</Button>
          </div>
        )}

        {customerMode === 'search' && (
          <div className="flex flex-col gap-2.5">
            <Popover open={isCustomerResultsOpen} onOpenChange={setIsCustomerResultsOpen}>
              <PopoverAnchor asChild>
                <input
                  className="neu-field"
                  type="text"
                  placeholder="Search by name or email…"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  onFocus={() => {
                    if (customerResults.length > 0) {
                      setIsCustomerResultsOpen(true);
                    }
                  }}
                />
              </PopoverAnchor>
              <PopoverContent
                className="max-h-60 w-[var(--radix-popper-anchor-width)] overflow-y-auto p-2"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                {customerSearching && <p className="px-1 py-1.5 text-[0.8125rem] text-muted">Searching…</p>}
                {!customerSearching && customerResults.length === 0 && (
                  <p className="px-1 py-1.5 text-[0.8125rem] text-muted">No matching customers.</p>
                )}
                {!customerSearching && customerResults.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {customerResults.map((customer) => (
                      <Button
                        key={customer.id}
                        variant="ghost"
                        className="w-full justify-start rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-normal text-heading"
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        {customer.name} — {customer.email}
                      </Button>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Button className="self-start" onClick={() => setCustomerMode('new')}>
              Add a new customer
            </Button>
          </div>
        )}

        {customerMode === 'new' && (
          <div className="flex flex-col gap-2.5">
            <input
              className="neu-field"
              type="text"
              placeholder="Name"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <input
              className="neu-field"
              type="email"
              placeholder="Email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
            <input
              className="neu-field"
              type="text"
              placeholder="Phone (optional)"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <Button className="self-start" onClick={() => setCustomerMode('search')}>
              Search instead
            </Button>
          </div>
        )}
        {fieldErrors.customerId && <p className="form-field-error">{fieldErrors.customerId}</p>}
      </div>

      <label className="form-field col-span-full">
        <span>Notes</span>
        <textarea
          className="neu-field min-h-20 resize-y"
          name="notes"
          placeholder="Optional notes about this booking"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </label>

      <div className="form-actions">
        <Button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Booking'}
        </Button>
      </div>
    </form>
  );
}
