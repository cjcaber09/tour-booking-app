import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../../states/authStore';
import { useAppSettings } from '../../states/appSettingsStore';
import { toast } from '../../toast';
import { useRequestError } from '../../lib/useRequestError';
import { cn, trimStrings } from '../../lib/utils';
import { fileToBase64 } from '../../lib/file';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ROLE_LABELS, ROLE_OPTIONS } from '../../lib/roles';
import type { AdminRole, UpdateProfilePayload } from '../../../preload';

const DROPZONE_CLASS =
  'flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted transition-colors duration-150 ease-in-out hover:border-muted';
const DROPZONE_ACTIVE_CLASS = 'border-accent-end text-heading';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ProfileTab() {
  const { session, refreshSession } = useAuth();
  const { formatDate, formatDateTime } = useAppSettings();
  const admin = session!.admin;
  const isAdmin = admin.role === 'ADMIN';

  const [name, setName] = useState(admin.name);
  const [phone, setPhone] = useState(admin.phone ?? '');
  const [role, setRole] = useState<AdminRole>(admin.role);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [uploadedAvatar, setUploadedAvatar] = useState<{ file: File; url: string } | null>(null);
  const [isAvatarDragActive, setIsAvatarDragActive] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { fieldErrors, setFieldErrors, handleRequestError } = useRequestError('Could not save profile.');
  const [submitting, setSubmitting] = useState(false);

  const currentAvatarUrl = avatarPreviewUrl || admin.avatarUrl || '';

  function processAvatarFile(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError('Unsupported file type. Use JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAvatarError('Image exceeds 5MB limit.');
      return;
    }
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarError('');
    setAvatarFile(file);
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
    if (!session) {
      return;
    }
    setSubmitting(true);
    setFieldErrors({});

    try {
      const trimmedPhone = phone.trim();
      const payload: UpdateProfilePayload = trimStrings({ name, phone: trimmedPhone || null });
      if (isAdmin && role !== admin.role) {
        payload.role = role;
      }

      if (avatarFile) {
        if (uploadedAvatar && uploadedAvatar.file === avatarFile) {
          payload.avatarUrl = uploadedAvatar.url;
        } else {
          const base64 = await fileToBase64(avatarFile);
          const { url } = await window.profileAPI.uploadAvatar(
            base64,
            avatarFile.name,
            avatarFile.type,
            session.accessToken,
          );
          setUploadedAvatar({ file: avatarFile, url });
          payload.avatarUrl = url;
        }
      }

      await window.profileAPI.update(payload, session.accessToken);
      await refreshSession();
      toast.success('Profile saved.');
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid grid-cols-2 gap-x-6 gap-y-4" onSubmit={handleSubmit}>
      <label className="form-field col-span-full">
        <span>Name</span>
        <input className="neu-field" value={name} onChange={(e) => setName(e.target.value)} required />
        {fieldErrors.name && <p className="form-field-error">{fieldErrors.name}</p>}
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
        {currentAvatarUrl && (
          <img
            className="h-16 w-16 rounded-full object-cover neu-raised-md"
            src={currentAvatarUrl}
            alt="Avatar preview"
          />
        )}
        {avatarError && <p className="form-field-error">{avatarError}</p>}
      </div>

      <label className="form-field">
        <span>Phone</span>
        <input className="neu-field" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {fieldErrors.phone && <p className="form-field-error">{fieldErrors.phone}</p>}
      </label>

      <div className="form-field">
        <span>Position</span>
        {isAdmin ? (
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
        ) : (
          <span className="neu-inset flex items-center rounded-xl bg-surface px-4 py-3 text-heading">
            {ROLE_LABELS[admin.role]}
          </span>
        )}
      </div>

      <div className="detail-field">
        <span className="detail-label">Email</span>
        <span>{admin.email}</span>
      </div>

      <div className="detail-field">
        <span className="detail-label">Member since</span>
        <span>{formatDate(admin.createdAt)}</span>
      </div>

      <div className="detail-field">
        <span className="detail-label">Last login</span>
        <span>{admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : '—'}</span>
      </div>

      <div className="form-actions">
        <Button type="submit" disabled={submitting}>
          {submitting && <LoaderCircle className="animate-[spin_0.8s_linear_infinite]" size={14} />}
          {submitting ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
