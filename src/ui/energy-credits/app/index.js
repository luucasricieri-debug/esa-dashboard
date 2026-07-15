/**
 * ESA OS — UI / Energy Credits / App
 * Ponto de entrada público do módulo UI de Créditos ESA Energia.
 *
 * Uso:
 *   import { createEnergyCreditsApp, mountEnergyCreditsApp } from './src/ui/energy-credits/app/index.js';
 *   const app = mountEnergyCreditsApp({ provider, mountElement });
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
