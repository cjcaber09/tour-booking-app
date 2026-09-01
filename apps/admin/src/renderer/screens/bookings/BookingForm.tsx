import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import type { CreateBookingPayload, BookingDetail, TourListItem, CustomerSummary } from '../../../preload';
import './BookingForm.css';

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

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
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

  const [tours, setTours] = useState<TourListItem[]>([]);
  const [toursLoading, setToursLoading] = useState(false);

  const [customerMode, setCustomerMode] = useState<CustomerMode>(booking ? 'selected' : 'search');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(booking?.customer ?? null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerSummary[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
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
      return;
    }
    setCustomerSearching(true);
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
    <form className="booking-form" onSubmit={handleSubmit}>
      <h2>{isEditing ? 'Edit Booking' : 'New Booking'}</h2>

      <label className="booking-field">
        <span>Tour</span>
        <select
          name="tourId"
          value={form.tourId}
          onChange={(e) => update('tourId', e.target.value)}
          disabled={toursLoading}
          required
        >
          <option value="">{toursLoading ? 'Loading tours…' : 'Select a tour'}</option>
          {tours.map((tour) => (
            <option key={tour.id} value={tour.id}>
              {tour.title}
            </option>
          ))}
        </select>
        {fieldErrors.tourId && <p className="booking-field-error">{fieldErrors.tourId}</p>}
      </label>

      <label className="booking-field">
        <span>Participants</span>
        <input
          name="participants"
          type="number"
          min={1}
          value={form.participants}
          onChange={(e) => update('participants', e.target.value)}
          required
        />
        {fieldErrors.participants && <p className="booking-field-error">{fieldErrors.participants}</p>}
      </label>

      <label className="booking-field">
        <span>Start date</span>
        <input
          name="startDate"
          type="date"
          value={form.startDate}
          onChange={(e) => update('startDate', e.target.value)}
          required
        />
        {fieldErrors.startDate && <p className="booking-field-error">{fieldErrors.startDate}</p>}
      </label>

      <div className="booking-field booking-field-full">
        <span>Customer</span>

        {customerMode === 'selected' && selectedCustomer && (
          <div className="booking-customer-card">
            <div>
              <strong>{selectedCustomer.name}</strong>
              <span>{selectedCustomer.email}</span>
              {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
            </div>
            <button type="button" className="neumorphic-button" onClick={handleChangeCustomer}>
              Change
            </button>
          </div>
        )}

        {customerMode === 'search' && (
          <div className="booking-customer-search">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
            />
            {customerSearching && <p className="booking-customer-search-status">Searching…</p>}
            {!customerSearching && customerResults.length > 0 && (
              <ul className="booking-customer-results">
                {customerResults.map((customer) => (
                  <li key={customer.id}>
                    <button type="button" onClick={() => handleSelectCustomer(customer)}>
                      {customer.name} — {customer.email}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="neumorphic-button" onClick={() => setCustomerMode('new')}>
              Add a new customer
            </button>
          </div>
        )}

        {customerMode === 'new' && (
          <div className="booking-customer-new">
            <input
              type="text"
              placeholder="Name"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
            <input
              type="text"
              placeholder="Phone (optional)"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <button type="button" className="neumorphic-button" onClick={() => setCustomerMode('search')}>
              Search instead
            </button>
          </div>
        )}
        {fieldErrors.customerId && <p className="booking-field-error">{fieldErrors.customerId}</p>}
      </div>

      <label className="booking-field booking-field-full">
        <span>Notes</span>
        <textarea
          name="notes"
          placeholder="Optional notes about this booking"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </label>

      <div className="booking-form-actions">
        <button type="button" className="neumorphic-button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="neumorphic-button" disabled={submitting}>
          {submitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Booking'}
        </button>
      </div>
    </form>
  );
}
