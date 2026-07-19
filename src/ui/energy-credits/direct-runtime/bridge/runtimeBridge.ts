// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Bridge — expõe window.ESA_ENERGY_CREDITS_RUNTIME baseado em ?runtime=demo|real
// Carregado como IIFE via <script src="/assets/energy-credits-runtime/bridge.js">
// ============================================================

import type { EnergyCreditsRuntimeContract } from '../contracts/EnergyCreditsRuntimeContract';
import { demoRuntimeProvider } from '../providers/demoRuntimeProvider';

declare global {
  interface Window {
    ESA_ENERGY_CREDITS_RUNTIME: EnergyCreditsRuntimeContract;
    // Set by standalone-bootstrap.js (Gate 6) or legacy-bridge.js before this script runs
    __ESA_UI_PROVIDER__?: unknown;
    // Written before each event so componentDidMount can read outcome if event fired first
    __ESA_RUNTIME_STATUS__?: { status: 'ready' | 'error'; reason?: string };
    // Written by standalone-bootstrap.js before dispatching esa:ui-provider:ready/error
    __ESA_UI_PROVIDER_STATUS__?: { status: 'ready' | 'error'; reason?: string };
    __ESA_UI_PROVIDER_ERROR__?: { code: string; message: string };
  }
}

function resolveMode(): 'demo' | 'real' {
  try {
    const param = new URLSearchParams(window.location.search).get('runtime');
    if (param === 'real') return 'real';
  } catch {
    // not a browser or URLSearchParams unavailable
  }
  return 'demo';
}

async function resolveRealProvider(): Promise<EnergyCreditsRuntimeContract | null> {
  // Real provider requires the ESA UI provider to be available on window.
  // The legacy-bridge.js sets window.__ESA_UI_PROVIDER__ before loading this script.
  if (!window.__ESA_UI_PROVIDER__) {
    console.warn('[ESA-Bridge] ?runtime=real requested but window.__ESA_UI_PROVIDER__ not set');
    return null;
  }
  try {
    const { createEsaRuntimeProvider } = await import('../providers/esaRuntimeProvider');
    return createEsaRuntimeProvider(window.__ESA_UI_PROVIDER__);
  } catch (err) {
    console.error('[ESA-Bridge] Failed to initialize real provider', err);
    return null;
  }
}

async function initBridge(): Promise<void> {
  const mode = resolveMode();

  if (mode === 'demo') {
    window.__ESA_RUNTIME_STATUS__ = { status: 'ready' };
    window.ESA_ENERGY_CREDITS_RUNTIME = demoRuntimeProvider;
    window.dispatchEvent(new CustomEvent('esa:runtime:ready', { detail: { mode: 'demo' } }));
    return;
  }

  const provider = await resolveRealProvider();
  if (provider) {
    window.__ESA_RUNTIME_STATUS__ = { status: 'ready' };
    window.ESA_ENERGY_CREDITS_RUNTIME = provider;
    window.dispatchEvent(new CustomEvent('esa:runtime:ready', { detail: { mode: 'real' } }));
  } else {
    // Never assign demo — dispatch explicit error so UI can show honest state.
    window.__ESA_RUNTIME_STATUS__ = { status: 'error', reason: 'provider_unavailable' };
    window.dispatchEvent(new CustomEvent('esa:runtime:error', { detail: { reason: 'provider_unavailable' } }));
  }
}

// Run immediately — synchronous assignment for demo, async for real.
// Demo path is guaranteed synchronous so the DC Component can call methods on first render.
// Real path: provider-bootstrap.js (IIFE) runs before this script and sets __ESA_UI_PROVIDER__.
// Async fallback via esa:ui-provider:ready covers module-script bootstrap scenarios.
if (resolveMode() === 'demo') {
  window.__ESA_RUNTIME_STATUS__ = { status: 'ready' };
  window.ESA_ENERGY_CREDITS_RUNTIME = demoRuntimeProvider;
  window.dispatchEvent(new CustomEvent('esa:runtime:ready', { detail: { mode: 'demo' } }));
} else {
  const handleFatalError = (err: unknown): void => {
    console.error('[ESA-Bridge] Fatal init error', err);
    window.__ESA_RUNTIME_STATUS__ = { status: 'error', reason: 'init_exception' };
    window.dispatchEvent(
      new CustomEvent('esa:runtime:error', {
        detail: { reason: 'init_exception', error: (err as Error)?.message },
      }),
    );
  };

  window.addEventListener('esa:ui-provider:error', (evt: Event) => {
    const code = (evt as CustomEvent<{ code?: string }>).detail?.code ?? 'provider_error';
    window.__ESA_RUNTIME_STATUS__ = { status: 'error', reason: code };
    window.dispatchEvent(new CustomEvent('esa:runtime:error', { detail: { reason: code } }));
  });

  if (window.__ESA_UI_PROVIDER__) {
    // Sync: provider-bootstrap.js ran as IIFE before this script.
    initBridge().catch(handleFatalError);
  } else {
    // Async: wait for provider-bootstrap loaded as module script.
    window.addEventListener('esa:ui-provider:ready', () => initBridge().catch(handleFatalError), {
      once: true,
    });
    // Safety: if bootstrap already recorded failure synchronously before registering listener.
    if (window.__ESA_UI_PROVIDER_STATUS__?.status === 'error') {
      const reason = window.__ESA_UI_PROVIDER_STATUS__.reason ?? 'provider_error';
      window.__ESA_RUNTIME_STATUS__ = { status: 'error', reason };
      window.dispatchEvent(new CustomEvent('esa:runtime:error', { detail: { reason } }));
    }
  }
}
