import { FormEvent, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../../states/authStore';
import { toast } from '../../toast';
import { useRequestError } from '../../lib/useRequestError';
import { trimStrings } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import type { CustomerListItem, CreateCustomerPayload } from '../../../preload';

interface CustomerFormProps {
  customer?: CustomerListItem;
  onCancel: () => void;
  onSaved: () => void;
}

export function CustomerForm({ customer, onCancel, onSaved }: CustomerFormProps) {
  const isEditing = customer != null;
  const { session } = useAuth();
  const [name, setName] = useState(customer?.name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');

  const { fieldErrors, handleRequestError } = useRequestError();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setSubmitting(true);
    try {
      const trimmedPhone = phone.trim();
      const payload: CreateCustomerPayload = trimStrings({ name, email, phone: trimmedPhone || null });
      if (isEditing && customer) {
        await window.customersAPI.update(customer.id, payload, session.accessToken);
        toast.success('Customer updated.');
      } else {
        await window.customersAPI.create(payload, session.accessToken);
        toast.success('Customer created.');
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
      <h2 className="panel-title">{isEditing ? 'Edit Customer' : 'New Customer'}</h2>

      <label className="form-field col-span-full">
        <span>Name</span>
        <input
          className="neu-field"
          placeholder="e.g. Jordan Reyes"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {fieldErrors.name && <p className="form-field-error">{fieldErrors.name}</p>}
      </label>

      <label className="form-field col-span-full">
        <span>Email</span>
        <input
          className="neu-field"
          type="email"
          placeholder="e.g. jordan.reyes@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {fieldErrors.email && <p className="form-field-error">{fieldErrors.email}</p>}
      </label>

      <label className="form-field col-span-full">
        <span>Phone</span>
        <input className="neu-field" placeholder="Optional" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {fieldErrors.phone && <p className="form-field-error">{fieldErrors.phone}</p>}
      </label>

      <div className="form-actions">
        <Button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <LoaderCircle className="animate-[spin_0.8s_linear_infinite]" size={14} />}
          {submitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
}
