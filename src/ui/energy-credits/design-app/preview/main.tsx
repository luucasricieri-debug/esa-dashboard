import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { Shell } from '../src/components/Shell';
import '../src/styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="esa-credits-design-app">
      <Shell />
      <Toaster richColors position="bottom-right" />
    </div>
  </StrictMode>,
);
