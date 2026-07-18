/**
 * ESA OS — Energy Domain / Credits / Allocation
 * Public API (Barrel Export)
 *
 * Camada de rateio percentual e saldo individual da UC beneficiária.
 */

export { CreditAllocationResult }                 from './credit-allocation-result.js';
export { ALLOCATION_ALERT_CODE, ALLOCATION_THRESHOLDS } from './allocation-alert.js';
export { BeneficiaryConsumptionAverageCalculator } from './consumption-average-calculator.js';
export { CreditAllocationPlanner }                from './credit-allocation-planner.js';
export { BeneficiaryCreditBalanceCalculator }     from './beneficiary-credit-balance-calculator.js';

import { BeneficiaryConsumptionAverageCalculator } from './consumption-average-calculator.js';
import { CreditAllocationPlanner }                from './credit-allocation-planner.js';
import { BeneficiaryCreditBalanceCalculator }     from './beneficiary-credit-balance-calculator.js';

export const consumptionAverageCalculator       = new BeneficiaryConsumptionAverageCalculator();
export const creditAllocationPlanner            = new CreditAllocationPlanner();
export const beneficiaryCreditBalanceCalculator = new BeneficiaryCreditBalanceCalculator();
