import './index.css';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Toaster } from 'sonner';
import { EsaProviderContext } from './lib/esa/EsaProviderContext';
import type { EsaProvider } from './lib/esa/EsaProviderContext';
import { Shell } from './components/esa/Shell';

export interface MountOptions {
  mountElement: HTMLElement;
  provider: EsaProvider;
  options?: {
    defaultView?: string;
    locale?: string;
    persistenceMode?: 'preview' | 'live';
    onExit?: () => void;
  };
}

let _root: Root | null = null;

export function mountEnergyCreditsReactApp({ mountElement, provider, options: _options }: MountOptions): () => void {
  if (_root) {
    _root.unmount();
    _root = null;
  }

  const root = createRoot(mountElement);
  _root = root;

  root.render(
    <StrictMode>
      <EsaProviderContext.Provider value={provider}>
        <Shell />
        <Toaster position="top-right" richColors />
      </EsaProviderContext.Provider>
    </StrictMode>,
  );

  return () => {
    root.unmount();
    _root = null;
  };
}
