/**
 * ESA OS — Energy Domain / Credits
 * Public API (Barrel Export)
 *
 * Ponto de entrada público do módulo Energy Credits.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { EnergyCreditsService, STATEMENT_STATUS } from 'src/domains/energy/credits/index.js'
 */

// Constants
export {
  OPERATIONAL_STATUS,
  SUBSCRIPTION_STATUS,
  PAYMENT_STATUS,
  STATEMENT_STATUS,
  CREDIT_ALLOCATION_STATUS,
} from './constants.js';

// Alerts
export {
  ALERT_CODE,
  ALERT_SEVERITY,
  createAlert,
} from './alert.js';

// Rounding
export { roundKwh, roundMoney } from './rounding.js';

// Result contract
export { EnergyCreditsResult } from './result.js';

// Domain logic
export { EnergyCreditsCalculator } from './calculator.js';
export { EnergyCreditsValidator }  from './validator.js';
export { EnergyCreditsService }    from './service.js';

// Allocation layer
export {
  CreditAllocationResult,
  ALLOCATION_ALERT_CODE,
  ALLOCATION_THRESHOLDS,
  BeneficiaryConsumptionAverageCalculator,
  CreditAllocationPlanner,
  BeneficiaryCreditBalanceCalculator,
  consumptionAverageCalculator,
  creditAllocationPlanner,
  beneficiaryCreditBalanceCalculator,
} from './allocation/index.js';
