import { createRoot } from 'react-dom/client';
import { App } from './renderer/App';
import './index.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container #app not found');
}

createRoot(container).render(<App />);
