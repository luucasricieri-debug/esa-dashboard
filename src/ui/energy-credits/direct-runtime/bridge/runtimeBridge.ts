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
    // Set by the legacy bridge when real mode is requested
    __ESA_UI_PROVIDER__?: unknown;
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

async function resolveRealProvider(): Promise<EnergyCreditsRuntimeContract> {
  // Real provider requires the ESA UI provider to be available on window.
  // The legacy-bridge.js sets window.__ESA_UI_PROVIDER__ before loading this script.
  if (!window.__ESA_UI_PROVIDER__) {
    console.warn('[ESA-Bridge] ?runtime=real requested but window.__ESA_UI_PROVIDER__ not set — falling back to demo');
    return demoRuntimeProvider;
  }
  try {
    const { createEsaRuntimeProvider } = await import('../providers/esaRuntimeProvider');
    return createEsaRuntimeProvider(window.__ESA_UI_PROVIDER__);
  } catch (err) {
    console.error('[ESA-Bridge] Failed to initialize real provider — falling back to demo', err);
    return demoRuntimeProvider;
  }
}

async function initBridge(): Promise<void> {
  const mode = resolveMode();

  if (mode === 'demo') {
    window.ESA_ENERGY_CREDITS_RUNTIME = demoRuntimeProvider;
  } else {
    window.ESA_ENERGY_CREDITS_RUNTIME = await resolveRealProvider();
  }

  // Dispatch event so energy-credits-v2.html can react once the contract is ready.
  window.dispatchEvent(new CustomEvent('esa:runtime:ready', { detail: { mode: window.ESA_ENERGY_CREDITS_RUNTIME.mode } }));
}

// Run immediately — synchronous assignment for demo, async for real.
// Demo path is guaranteed synchronous so the DC Component can call methods on first render.
if (resolveMode() === 'demo') {
  window.ESA_ENERGY_CREDITS_RUNTIME = demoRuntimeProvider;
  window.dispatchEvent(new CustomEvent('esa:runtime:ready', { detail: { mode: 'demo' } }));
} else {
  initBridge().catch((err) => console.error('[ESA-Bridge] Fatal init error', err));
}
