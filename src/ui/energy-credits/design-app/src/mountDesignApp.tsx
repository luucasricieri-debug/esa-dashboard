import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { Shell } from '@/components/Shell';
import '@/styles/index.css';

export function mountDesignApp(element: HTMLElement, options?: { onExit?: () => void }) {
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <div className="esa-credits-design-app">
        <Shell onExit={options?.onExit} />
        <Toaster richColors position="bottom-right" />
      </div>
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}

// Auto-mount when loaded via query string activation
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (params.get('energyCreditsDesignV2') === '1') {
    const host = document.createElement('div');
    host.id = 'esa-credits-design-v2-root';
    document.body.appendChild(host);
    mountDesignApp(host, {
      onExit: () => {
        host.remove();
      },
    });
  }
}
