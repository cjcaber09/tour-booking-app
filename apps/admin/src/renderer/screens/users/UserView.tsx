import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAppSettings } from '../../AppSettingsContext';
import { ROLE_BADGE_CLASS, ROLE_LABELS, type MockUser } from './mockUsers';

interface UserViewProps {
  user: MockUser;
  onBack: () => void;
}

export function UserView({ user, onBack }: UserViewProps) {
  const { formatDate, formatDateTime } = useAppSettings();

  return (
    <div className="detail-view">
      <Button className="action-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </Button>

      <h2 className="panel-title">{user.name}</h2>

      {user.avatarUrl ? (
        <img className="h-16 w-16 rounded-full object-cover neu-raised-md" src={user.avatarUrl} alt="Avatar" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-shadow-dark)] text-lg font-semibold text-heading opacity-70">
          {user.name.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-field">
          <span className="detail-label">Role</span>
          <span className={`status-badge ${ROLE_BADGE_CLASS[user.role]}`}>{ROLE_LABELS[user.role]}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Status</span>
          <span className={`status-badge ${user.status === 'ACTIVE' ? 'status-confirmed' : 'status-cancelled'}`}>
            {user.status === 'ACTIVE' ? 'Active' : 'Suspended'}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Email</span>
          <span>{user.email}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Phone</span>
          <span>{user.phone ?? '—'}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Member since</span>
          <span>{formatDate(user.createdAt)}</span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Last login</span>
          <span>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</span>
        </div>
      </div>
    </div>
  );
}
