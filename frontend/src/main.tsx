import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './osmont.css';
import { initOsmontMotion } from './osmontMotion';

// Apply saved theme before first paint (visual only).
if (localStorage.getItem('journal-mod-theme') === 'light') document.documentElement.classList.remove('dark');
else document.documentElement.classList.add('dark');
initOsmontMotion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
