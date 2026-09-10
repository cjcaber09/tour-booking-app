import { LoaderCircle } from 'lucide-react';

export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/25">
      <LoaderCircle className="animate-[spin_0.8s_linear_infinite] text-accent-end" size={40} />
    </div>
  );
}
