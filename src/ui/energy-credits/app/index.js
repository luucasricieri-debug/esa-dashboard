/**
 * ESA OS — UI / Energy Credits / App
 *
 * @deprecated DEPRECATED CANDIDATE — DO NOT MOUNT
 *
 * Esta UI DOM/manual foi substituída pelo módulo React oficial
 * (src/ui/energy-credits/react-app). Será removida após validação
 * completa do módulo React integrado ao dashboard.
 *
 * NÃO usar esta UI no mount. NÃO reintroduzir no dashboard legado.
 * Use legacy-bridge.js + react-app/src/entry/energy-credits-entry.tsx.
 */

export { EnergyCreditsApp, createEnergyCreditsApp, mountEnergyCreditsApp } from './energy-credits-app.js';
export { createEnergyCreditsRouter, EC_ROUTE_REGISTRY }                     from './energy-credits-router.js';
export { createEnergyCreditsState }                                          from './energy-credits-state.js';
export {
  formatCurrencyBRL,
  formatKwh,
  formatPercentage,
  formatReferenceMonth,
  formatDateBR,
  formatCoverageMonths,
  formatDocument,
  formatNumber,
  currentReferenceMonth,
} from './energy-credits-formatters.js';
export { NAV_SECTIONS, ROUTE_LABELS, getRouteLabel, ICONS } from './energy-credits-navigation.js';
