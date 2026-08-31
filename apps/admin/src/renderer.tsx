import { createRoot } from 'react-dom/client';
import { App } from './renderer/App';
import { initTheme } from './renderer/theme';
import './index.css';

initTheme();

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container #app not found');
}

createRoot(container).render(<App />);
