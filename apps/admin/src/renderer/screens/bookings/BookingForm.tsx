import { FormEvent, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../../states/authStore';
import { toast } from '../../toast';
import { useRequestError } from '../../lib/useRequestError';
import { trimStrings } from '../../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { BookingDateField } from './BookingDateField';
import { CustomerPicker, type CustomerSelection } from './CustomerPicker';
import { GuideAssignmentField, UNASSIGNED } from './GuideAssignmentField';
import type { CreateBookingPayload, BookingDetail, TourListItem } from '../../../preload';

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
  guideId: string;
  confirmed: boolean;
}

const INITIAL_STATE: FormState = {
  tourId: '',
  participants: '1',
  startDate: '',
  notes: '',
  guideId: UNASSIGNED,
  confirmed: false,
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
    guideId: booking.guide?.id ?? UNASSIGNED,
    // Irrelevant once editing (the checkbox only renders in create mode) — the
    // booking's real status is already set; this is just to satisfy FormState's shape.
    confirmed: false,
  };
}

function deriveCustomerSelection(booking: BookingDetail | undefined): CustomerSelection {
  if (booking) {
    return { mode: 'selected', customer: booking.customer };
  }
  return { mode: 'search' };
}

function validateBookingForm(form: FormState, customer: CustomerSelection): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.tourId) {
    errors.tourId = 'Select a tour.';
  }
  if (!form.startDate) {
    errors.startDate = 'Select a booking date.';
  }
  if (customer.mode === 'search') {
    errors.customerId = 'Select an existing customer or add a new one.';
  }
  return errors;
}

function buildBookingPayload(
  form: FormState,
  customer: CustomerSelection,
  isEditing: boolean,
  canAssignGuide: boolean,
): CreateBookingPayload & { guideId?: string | null } {
  // Widened beyond CreateBookingPayload so `guideId` (an UpdateBookingPayload-only
  // field) can be assigned below — still satisfies both create() and update()'s
  // expected shapes (TS excess-property checks don't fire on a variable passed by
  // reference, only on fresh object literals).
  const payload: CreateBookingPayload & { guideId?: string | null } = {
    tourId: form.tourId,
    participants: Number(form.participants),
    startDate: new Date(form.startDate).toISOString(),
  };

  if (customer.mode === 'new') {
    payload.customer = {
      email: customer.email,
      name: customer.name,
      phone: customer.phone || undefined,
    };
  } else if (customer.mode === 'selected') {
    payload.customerId = customer.customer.id;
  }

  if (form.notes) payload.notes = form.notes;

  // Only ever sent when the field is actually editable (someone who can assign,
  // editing an existing booking) — otherwise this would either be rejected by the
  // backend (GUIDE isn't allowed to touch guideId) or sent during create, which
  // the backend's create schema doesn't even accept.
  if (canAssignGuide && isEditing) {
    payload.guideId = form.guideId === UNASSIGNED ? null : form.guideId;
  }

  // Only relevant during create — editing an existing booking's status goes
  // through the separate Confirm row action instead.
  if (!isEditing) {
    payload.confirmed = form.confirmed;
  }

  return payload;
}

export function BookingForm({ booking, onCancel, onSaved }: BookingFormProps) {
  const isEditing = booking != null;
  const { session } = useAuth();
  // ADMIN/LEAD_GUIDE/STAFF can all assign a guide — only the restricted GUIDE role
  // cannot (matches the backend's own exact-role check on PATCH /:id).
  const canAssignGuide = session != null && session.admin.role !== 'GUIDE';
  const [form, setForm] = useState<FormState>(() => deriveFormState(booking));
  const { fieldErrors, setFieldErrors, handleRequestError } = useRequestError();
  const [submitting, setSubmitting] = useState(false);

  const [tours, setTours] = useState<TourListItem[]>([]);
  const [toursLoading, setToursLoading] = useState(false);

  const [customer, setCustomer] = useState<CustomerSelection>(() => deriveCustomerSelection(booking));

  useEffect(() => {
    if (!session) {
      return;
    }
    setToursLoading(true);
    window.toursAPI
      .list(1, 100, {}, session.accessToken)
      .then((result) => setTours(result.tours))
      .catch(() => toast.error('Could not load tours.'))
      .finally(() => setToursLoading(false));
  }, [session]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }

    const errors = validateBookingForm(form, customer);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      const sanitizedPayload = trimStrings(buildBookingPayload(form, customer, isEditing, canAssignGuide));
      if (isEditing && booking) {
        await window.bookingsAPI.update(booking.id, sanitizedPayload, session.accessToken);
        toast.success('Booking updated.');
      } else {
        await window.bookingsAPI.create(sanitizedPayload, session.accessToken);
        toast.success('Booking created.');
      }
      onSaved();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  let submitLabel: string;
  if (submitting) {
    submitLabel = isEditing ? 'Saving…' : 'Creating…';
  } else {
    submitLabel = isEditing ? 'Save Changes' : 'Create Booking';
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

      <BookingDateField
        value={form.startDate}
        onChange={(value) => update('startDate', value)}
        error={fieldErrors.startDate}
      />

      {!isEditing && (
        <label className="form-field col-span-full flex-row items-center gap-2">
          <input
            name="confirmed"
            type="checkbox"
            checked={form.confirmed}
            onChange={(e) => update('confirmed', e.target.checked)}
          />
          <span>Confirm immediately</span>
        </label>
      )}

      {isEditing && (
        <GuideAssignmentField
          session={session}
          canAssign={canAssignGuide}
          value={form.guideId}
          onChange={(value) => update('guideId', value)}
          assignedGuideName={booking?.guide?.name ?? null}
          error={fieldErrors.guideId}
        />
      )}

      <CustomerPicker session={session} value={customer} onChange={setCustomer} error={fieldErrors.customerId} />

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
          {submitting && <LoaderCircle className="animate-[spin_0.8s_linear_infinite]" size={14} />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
