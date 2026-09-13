import { FormEvent, useState } from 'react';
import { useAuth } from '../../states/authStore';
import { toast } from '../../toast';
import { cleanIpcErrorMessage } from '../../lib/ipc';
import { Button } from '../../components/ui/button';

export function SecurityTab() {
  const { session } = useAuth();
  const admin = session!.admin;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function resetFields() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setFieldErrors({});

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    setSubmitting(true);
    try {
      await window.profileAPI.changePassword({ currentPassword, newPassword }, session.accessToken);
      resetFields();
      toast.success('Password changed.');
    } catch (err) {
      const raw = err instanceof Error ? cleanIpcErrorMessage(err.message) : 'request failed';
      try {
        const parsed = JSON.parse(raw) as { status?: number; error?: string; details?: Record<string, string[]> };
        if (parsed.status === 401) {
          setFieldErrors({ currentPassword: parsed.error || 'Current password is incorrect.' });
        } else if (parsed.details) {
          const flat: Record<string, string> = {};
          for (const [field, messages] of Object.entries(parsed.details)) {
            if (messages?.[0]) {
              flat[field] = messages[0];
            }
          }
          setFieldErrors(flat);
        } else {
          toast.error(parsed.error || 'Could not change password.');
        }
      } catch {
        toast.error(raw || 'Could not change password.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="detail-field">
        <span className="detail-label">Email</span>
        <span>{admin.email}</span>
      </div>

      <form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
        <h3 className="m-0 text-sm font-semibold text-muted">Change password</h3>

        <label className="form-field">
          <span>Current password</span>
          <input
            className="neu-field"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          {fieldErrors.currentPassword && <p className="form-field-error">{fieldErrors.currentPassword}</p>}
        </label>

        <label className="form-field">
          <span>New password</span>
          <input
            className="neu-field"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          {fieldErrors.newPassword && <p className="form-field-error">{fieldErrors.newPassword}</p>}
        </label>

        <label className="form-field">
          <span>Confirm new password</span>
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
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Change Password'}
          </Button>
        </div>
      </form>
    </div>
  );
}
