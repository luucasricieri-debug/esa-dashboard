/**
 * ESA OS — UI / Energy Credits / App
 * Demo Harness — exemplo de como montar o módulo de Créditos ESA Energia
 * em um elemento HTML existente do dashboard legado.
 *
 * Uso (em um script tipo="module" no browser):
 *
 *   import { runEnergyCreditsDemo } from './src/ui/energy-credits/app/energy-credits-demo-harness.js';
 *   runEnergyCreditsDemo();
 *
 * O harness cria um container flutuante, obtém o ESAApplication singleton,
 * instancia o EnergyCreditsUIProvider e monta a UI de créditos.
 */

import { mountEnergyCreditsApp } from './energy-credits-app.js';

export function runEnergyCreditsDemo({ containerId = 'ec-demo-root', esaApplication, persistenceMode = 'preview' } = {}) {
  if (typeof document === 'undefined') {
    throw new Error('[runEnergyCreditsDemo] Requer ambiente browser com document.');
  }
  if (!esaApplication) {
    throw new TypeError('[runEnergyCreditsDemo] esaApplication é obrigatório.');
  }

  const { EnergyCreditsUIProvider } = _requireProvider();
  const provider = new EnergyCreditsUIProvider(esaApplication);
  const mountEl  = _ensureContainer(containerId);

  const app = mountEnergyCreditsApp({
    provider,
    mountElement: mountEl,
    options: {
      persistenceMode,
      onExit: () => { app.unmount(); mountEl.remove(); },
    },
  });

  return app;
}

function _requireProvider() {
  return { EnergyCreditsUIProvider: class {
    constructor(esa) { this._esa = esa; }
    getExecutiveSummary(f = {}) { return this._esa.getEnergyCreditsExecutiveSummary(f); }
    getFinancialSummary(f = {}) { return this._esa.getEnergyCreditsFinancialSummary(f); }
    getAlertsSummary(f = {}) { return this._esa.getEnergyCreditsAlertsSummary(f); }
    searchGeneratingUnits(f = {}, o = {}) { return this._esa.searchEnergyCreditsGeneratingUnits(f, o); }
    searchBeneficiaryUnits(f = {}, o = {}) { return this._esa.searchEnergyCreditsBeneficiaryUnits(f, o); }
    queryGeneratingUnit(id, o = {}) { return this._esa.queryEnergyCreditsGeneratingUnit(id, o); }
    queryBeneficiaryUnit(id, o = {}) { return this._esa.queryEnergyCreditsBeneficiaryUnit(id, o); }
    getCapabilities() { return { ok: true, data: { version: '1.0.0' } }; }
    getStats() { return { ok: true, data: {} }; }
  } };
}

function _ensureContainer(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed', inset: '0', zIndex: '1000', background: '#F7F5F0',
    });
    document.body.appendChild(el);
  }
  return el;
}
