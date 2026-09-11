import type { AdminRole } from '../../preload';

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: 'Admin',
  LEAD_GUIDE: 'Lead Guide',
  GUIDE: 'Guide',
  STAFF: 'Staff',
};

export const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: 'ADMIN', label: ROLE_LABELS.ADMIN },
  { value: 'LEAD_GUIDE', label: ROLE_LABELS.LEAD_GUIDE },
  { value: 'GUIDE', label: ROLE_LABELS.GUIDE },
  { value: 'STAFF', label: ROLE_LABELS.STAFF },
];

// Reuses the existing booking/tour status-badge color classes rather than adding dedicated
// role tokens.
export const ROLE_BADGE_CLASS: Record<AdminRole, string> = {
  ADMIN: 'status-completed',
  LEAD_GUIDE: 'status-ongoing',
  GUIDE: 'status-pending',
  STAFF: 'status-confirmed',
};
