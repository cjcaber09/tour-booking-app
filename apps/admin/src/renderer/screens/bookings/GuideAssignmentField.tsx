import { useEffect, useState } from 'react';
import { toast } from '../../toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type { AdminSession, AssignableGuide } from '../../../preload';

// Radix's Select.Item rejects an empty-string value (it's reserved internally to
// mean "clear back to the placeholder"), so "no guide assigned" needs a real
// sentinel rather than ''. Never collides with an actual admin id, which are UUIDs.
export const UNASSIGNED = 'UNASSIGNED';

interface GuideAssignmentFieldProps {
  session: AdminSession | null;
  canAssign: boolean;
  value: string;
  onChange: (value: string) => void;
  assignedGuideName: string | null;
  error?: string;
}

export function GuideAssignmentField({
  session,
  canAssign,
  value,
  onChange,
  assignedGuideName,
  error,
}: GuideAssignmentFieldProps) {
  const [guides, setGuides] = useState<AssignableGuide[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);

  useEffect(() => {
    if (!session || !canAssign) {
      return;
    }
    setGuidesLoading(true);
    window.adminsAPI
      .listAssignableGuides(session.accessToken)
      .then((result) => setGuides(result.guides))
      .catch(() => toast.error('Could not load guides.'))
      .finally(() => setGuidesLoading(false));
  }, [session, canAssign]);

  if (!canAssign) {
    return (
      <div className="form-field">
        <span>Assigned guide</span>
        <span>{assignedGuideName ?? 'Unassigned'}</span>
      </div>
    );
  }

  return (
    <label className="form-field">
      <span>Assign guide</span>
      <Select value={value} onValueChange={onChange} disabled={guidesLoading}>
        <SelectTrigger>
          <SelectValue placeholder={guidesLoading ? 'Loading guides…' : 'Select a guide'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {guides.map((guide) => (
            <SelectItem key={guide.id} value={guide.id}>
              {guide.name}
              {guide.role === 'LEAD_GUIDE' ? ' (Lead Guide)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="form-field-error">{error}</p>}
    </label>
  );
}
