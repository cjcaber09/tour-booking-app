import { LoaderCircle } from 'lucide-react';
import './LoadingOverlay.css';

export function LoadingOverlay() {
  return (
    <div className="loading-overlay">
      <LoaderCircle className="loading-overlay-spinner" size={40} />
    </div>
  );
}
