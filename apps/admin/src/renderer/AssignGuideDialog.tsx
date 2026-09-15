import { useEffect, useState } from 'react';
import { useAuth } from './states/authStore';
import { toast } from './toast';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import type { AssignableGuide } from '../preload';

// Same Radix Select.Item empty-string-value workaround BookingForm.tsx already uses.
const UNASSIGNED = 'UNASSIGNED';

interface AssignGuideDialogProps {
  booking: { reference: string; guide: { id: string; name: string } | null };
  onConfirm: (guideId: string | null, guide: AssignableGuide | null) => void;
  onCancel: () => void;
}

export function AssignGuideDialog({ booking, onConfirm, onCancel }: AssignGuideDialogProps) {
  const { session } = useAuth();
  const [guides, setGuides] = useState<AssignableGuide[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [selected, setSelected] = useState(booking.guide?.id ?? UNASSIGNED);

  useEffect(() => {
    if (!session) {
      return;
    }
    setGuidesLoading(true);
    window.adminsAPI
      .listAssignableGuides(session.accessToken)
      .then((result) => setGuides(result.guides))
      .catch(() => toast.error('Could not load guides.'))
      .finally(() => setGuidesLoading(false));
  }, [session]);

  function handleConfirm() {
    if (selected === UNASSIGNED) {
      onConfirm(null, null);
      return;
    }
    onConfirm(selected, guides.find((guide) => guide.id === selected) ?? null);
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">Assign guide</h3>
        <p className="dialog-message">Assign a guide or lead guide to {booking.reference}.</p>
        <label className="mb-2 flex flex-col gap-2 text-sm text-secondary">
          <span>Guide</span>
          <Select value={selected} onValueChange={setSelected} disabled={guidesLoading}>
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
        </label>
        <div className="dialog-actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button disabled={guidesLoading} onClick={handleConfirm}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
