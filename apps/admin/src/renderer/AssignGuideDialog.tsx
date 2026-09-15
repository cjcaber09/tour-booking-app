import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from './states/authStore';
import { toast } from './toast';
import { useEscapeToClose } from './lib/useEscapeToClose';
import { useBackdropDismiss } from './lib/useBackdropDismiss';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import type { AssignableGuide } from '../preload';

// Same Radix Select.Item empty-string-value workaround BookingForm.tsx already uses.
const UNASSIGNED = 'UNASSIGNED';

interface AssignGuideDialogProps {
  booking: { reference: string; guide: { id: string; name: string } | null };
  onConfirm: (guideId: string | null, guide: AssignableGuide | null) => void;
  onCancel: () => void;
  // Parent-controlled: true for as long as onConfirm's request is in flight. Drives
  // the Save button's spinner and keeps the dialog open (and inert) until the parent
  // closes it once the response comes back, so the spinner is actually visible rather
  // than the dialog disappearing the instant Save is clicked.
  submitting: boolean;
}

export function AssignGuideDialog({ booking, onConfirm, onCancel, submitting }: AssignGuideDialogProps) {
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

  useEscapeToClose(onCancel, submitting);
  const backdropRef = useBackdropDismiss(onCancel, submitting);

  return (
    <div className="dialog-backdrop">
      <div ref={backdropRef} className="dialog-backdrop-dismiss" aria-hidden="true" />
      <div className="dialog-card">
        <h3 className="dialog-title">Assign guide</h3>
        <p className="dialog-message">Assign a guide or lead guide to {booking.reference}.</p>
        <label className="mb-2 flex flex-col gap-2 text-sm text-secondary">
          <span>Guide</span>
          <Select value={selected} onValueChange={setSelected} disabled={guidesLoading || submitting}>
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
          <Button onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button disabled={guidesLoading || submitting} onClick={handleConfirm}>
            {submitting && <LoaderCircle className="animate-[spin_0.8s_linear_infinite]" size={14} />}
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
