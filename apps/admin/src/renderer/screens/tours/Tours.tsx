import { useState } from 'react';
import './Tours.css';

type Mode = 'idle' | 'form';

export function Tours() {
  const [mode, setMode] = useState<Mode>('idle');

  return (
    <div className="tours">
      <div className="tours-idle">
        <h1>Tours</h1>
        <p className="tours-empty">No tours created yet.</p>
        <button className="neumorphic-button" onClick={() => setMode('form')}>
          New Tour
        </button>
      </div>

      <div className={`tours-panel ${mode === 'form' ? 'tours-panel-open' : ''}`}>
        <button className="neumorphic-button" onClick={() => setMode('idle')}>
          Cancel
        </button>
      </div>
    </div>
  );
}
