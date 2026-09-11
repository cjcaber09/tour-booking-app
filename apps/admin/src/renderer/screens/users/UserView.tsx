import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAppSettings } from '../../AppSettingsContext';
import type { AdminListItem } from '../../../preload';
import { ROLE_BADGE_CLASS, ROLE_LABELS } from '../../lib/roles';

interface UserViewProps {
  admin: AdminListItem;
  onBack: () => void;
}

export function UserView({ admin, onBack }: UserViewProps) {
  const { formatDate, formatDateTime } = useAppSettings();

  return (
    <div className="detail-view">
      <Button className="action-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </Button>

      <h2 className="panel-title">{admin.name}</h2>

      {admin.avatarUrl ? (
        <img className="h-16 w-16 rounded-full object-cover neu-raised-md" src={admin.avatarUrl} alt="Avatar" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-shadow-dark)] text-lg font-semibold text-heading opacity-70">
          {admin.name.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-field">
          <span className="detail-label">Role</span>
          <span className={`status-badge ${ROLE_BADGE_CLASS[admin.role]}`}>{ROLE_LABELS[admin.role]}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Status</span>
          <span className={`status-badge ${admin.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
            {admin.isActive ? 'Active' : 'Suspended'}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Email</span>
          <span>{admin.email}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Phone</span>
          <span>{admin.phone ?? '—'}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Member since</span>
          <span>{formatDate(admin.createdAt)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Last login</span>
          <span>{admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : '—'}</span>
        </div>
      </div>
    </div>
  );
}
