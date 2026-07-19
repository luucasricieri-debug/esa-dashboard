// ESA OS — Standalone Provider Bootstrap (Gate 6)
// Inicializa o ESA Core em memória e expõe EnergyCreditsUIProvider em
// window.__ESA_UI_PROVIDER__ para o bridge.js consumir via ?runtime=real.
// Bundled como IIFE por Vite — deve ser carregado ANTES de bridge.js.

import { ESA } from '../../../../core/app.js';
import { EnergyCreditsUIProvider } from '../../energy-credits-ui-provider.js';

declare global {
  interface Window {
    ESA_OS?: unknown;
    __ESA_UI_PROVIDER__?: unknown;
    __ESA_UI_PROVIDER_STATUS__?: { status: 'ready' | 'error'; reason?: string };
    __ESA_UI_PROVIDER_ERROR__?: { code: string; message: string };
  }
}

(function bootstrapStandaloneProvider(): void {
  try {
    (ESA as { initialize(): void }).initialize();
    const UIProviderCtor = EnergyCreditsUIProvider as new (app: unknown) => unknown;
    const provider = new UIProviderCtor(ESA);
    window.__ESA_UI_PROVIDER__ = provider;
    window.ESA_OS = ESA;
    window.__ESA_UI_PROVIDER_STATUS__ = { status: 'ready' };
    window.dispatchEvent(
      new CustomEvent('esa:ui-provider:ready', { detail: { source: 'standalone-bootstrap' } }),
    );
    console.info('[ESA Standalone] provider_initialized');
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'unknown';
    window.__ESA_UI_PROVIDER_STATUS__ = { status: 'error', reason: 'bootstrap_failed' };
    window.__ESA_UI_PROVIDER_ERROR__ = { code: 'bootstrap_failed', message: msg };
    window.dispatchEvent(
      new CustomEvent('esa:ui-provider:error', { detail: { code: 'bootstrap_failed' } }),
    );
    console.error('[ESA Standalone] bootstrap_failed');
  }
})();
