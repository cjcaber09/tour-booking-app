import { FormEvent, useState } from 'react';
import { Copy, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useAuth } from '../../states/authStore';
import { useRequestError } from '../../lib/useRequestError';
import { trimStrings } from '../../lib/utils';
import { toast } from '../../toast';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ROLE_OPTIONS } from '../../lib/roles';
import type { AdminRole, CreateAdminPayload, CreateAdminResult } from '../../../preload';

interface UserFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

export function UserForm({ onCancel, onCreated }: UserFormProps) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AdminRole>('GUIDE');

  const { fieldErrors, setFieldErrors, handleRequestError } = useRequestError();
  const [submitting, setSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<CreateAdminResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const trimmedPhone = phone.trim();
      const payload: CreateAdminPayload = trimStrings({ name, email, role, phone: trimmedPhone || null });
      const result = await window.adminsAPI.create(payload, session.accessToken);
      setCreatedResult(result);
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyPassword() {
    if (!createdResult) {
      return;
    }
    await navigator.clipboard.writeText(createdResult.temporaryPassword);
    toast.success('Password copied to clipboard.');
  }

  if (createdResult) {
    return (
      <div className="form-grid">
        <h2 className="panel-title">User created</h2>
        <p className="col-span-full text-sm text-muted">
          Share these credentials with {createdResult.name} — the password will not be shown again.
        </p>

        <div className="form-field col-span-full">
          <span>Email</span>
          <p className="neu-inset rounded-xl px-4 py-3 font-mono text-sm text-heading">{createdResult.email}</p>
        </div>

        <div className="form-field col-span-full">
          <span>Temporary password</span>
          <div className="relative">
            <input
              className="neu-field pr-20 font-mono tracking-wide"
              type={showPassword ? 'text' : 'password'}
              value={createdResult.temporaryPassword}
              readOnly
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={handleCopyPassword} aria-label="Copy password">
                <Copy size={16} />
              </Button>
            </div>
          </div>
        </div>

        <p className="col-span-full text-sm text-muted">
          Copy the password above and give it to {createdResult.name} before you continue — you won't be able to
          view it again.
        </p>

        <div className="form-actions">
          <Button type="button" onClick={onCreated}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <h2 className="panel-title">New User</h2>

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
          placeholder="e.g. jordan.reyes@andytours.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {fieldErrors.email && <p className="form-field-error">{fieldErrors.email}</p>}
      </label>

      <label className="form-field">
        <span>Phone</span>
        <input className="neu-field" placeholder="Optional" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>

      <label className="form-field">
        <span>Role</span>
        <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.role && <p className="form-field-error">{fieldErrors.role}</p>}
      </label>

      <div className="form-actions">
        <Button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <LoaderCircle className="animate-[spin_0.8s_linear_infinite]" size={14} />}
          {submitting ? 'Creating…' : 'Create User'}
        </Button>
      </div>
    </form>
  );
}
