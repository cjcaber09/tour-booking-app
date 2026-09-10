import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react';
import { toast } from '../../toast';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type { AdminRole } from '../../../preload';
import type { MockUser } from './mockUsers';

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'LEAD_GUIDE', label: 'Lead Guide' },
  { value: 'GUIDE', label: 'Guide' },
];

const DROPZONE_CLASS =
  'flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted transition-colors duration-150 ease-in-out hover:border-muted';
const DROPZONE_ACTIVE_CLASS = 'border-accent-end text-heading';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface UserFormProps {
  onCancel: () => void;
  onCreated: (user: MockUser) => void;
}

export function UserForm({ onCancel, onCreated }: UserFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AdminRole>('GUIDE');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [isAvatarDragActive, setIsAvatarDragActive] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function processAvatarFile(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError('Unsupported file type. Use JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAvatarError('Image exceeds 5MB limit.');
      return;
    }
    // Only revoke the previous preview when swapping to a different file. This form's
    // created user's avatarUrl literally *is* this blob URL (there's no upload step to
    // mint a permanent one, since this screen is mocked) — a revoke-on-unmount effect
    // would blank out the row's avatar the next time "New User" is opened.
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarError('');
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      processAvatarFile(file);
    }
  }

  function handleAvatarDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsAvatarDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processAvatarFile(file);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    setSubmitting(true);
    try {
      // No backend for this mocked screen — a short delay keeps the "Creating…" state visible.
      await new Promise((resolve) => setTimeout(resolve, 400));

      const user: MockUser = {
        id: crypto.randomUUID(),
        name,
        email,
        role,
        phone: phone || null,
        avatarUrl: avatarPreviewUrl || null,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        status: 'ACTIVE',
      };
      onCreated(user);
      toast.success('User created.');
    } finally {
      setSubmitting(false);
    }
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

      <div className="form-field col-span-full">
        <span>Avatar</span>
        <div
          className={cn(DROPZONE_CLASS, isAvatarDragActive && DROPZONE_ACTIVE_CLASS)}
          role="button"
          tabIndex={0}
          onClick={() => avatarInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              avatarInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsAvatarDragActive(true);
          }}
          onDragLeave={() => setIsAvatarDragActive(false)}
          onDrop={handleAvatarDrop}
        >
          <span>Drag & drop an image here, or click to browse</span>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleAvatarChange}
          className="hidden"
        />
        {avatarPreviewUrl && (
          <img
            className="h-16 w-16 rounded-full object-cover neu-raised-md"
            src={avatarPreviewUrl}
            alt="Avatar preview"
          />
        )}
        {avatarError && <p className="form-field-error">{avatarError}</p>}
      </div>

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
      </label>

      <label className="form-field">
        <span>Password</span>
        <input
          className="neu-field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {fieldErrors.password && <p className="form-field-error">{fieldErrors.password}</p>}
      </label>

      <label className="form-field">
        <span>Confirm password</span>
        <input
          className="neu-field"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
        {fieldErrors.confirmPassword && <p className="form-field-error">{fieldErrors.confirmPassword}</p>}
      </label>

      <div className="form-actions">
        <Button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create User'}
        </Button>
      </div>
    </form>
  );
}
