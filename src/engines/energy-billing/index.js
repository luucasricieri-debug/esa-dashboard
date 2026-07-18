/**
 * ESA OS — Engines / Energy Billing
 * Public API + Singleton
 */

export { parseCurrency, parseKwhPrice }       from './currency-parser.js';
export { EnergyBillingResult }                from './energy-billing-result.js';
export { buildBillingSnapshot,
         SNAPSHOT_VERSION,
         CALCULATION_SOURCE }                 from './energy-billing-snapshot.js';
export { calculate }                          from './legacy-copel-calculation-adapter.js';
export { EnergyBillingEngine }                from './energy-billing-engine.js';

import { EnergyBillingEngine } from './energy-billing-engine.js';

export const energyBillingEngine = new EnergyBillingEngine();
