/**
 * ESA OS — Energy Domain / Credits / Allocation
 * BeneficiaryConsumptionAverageCalculator
 *
 * Calcula a média histórica de consumo de uma UC beneficiária.
 * Janela configurável (default 12 meses). Sem Date.now(). Determinístico.
 */

import { roundKwh }               from '../rounding.js';
import { CreditAllocationResult } from './credit-allocation-result.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function _isValidRecord(r) {
  return (
    r && typeof r === 'object' &&
    typeof r.referenceMonth === 'string' && MONTH_RE.test(r.referenceMonth) &&
    typeof r.consumptionKwh === 'number' && isFinite(r.consumptionKwh) && r.consumptionKwh >= 0
  );
}

function _filterAndSort(history, referenceMonth) {
  const valid  = (Array.isArray(history) ? history : []).filter(_isValidRecord);
  let sorted   = [...valid].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
  if (referenceMonth && MONTH_RE.test(referenceMonth)) {
    sorted = sorted.filter(r => r.referenceMonth <= referenceMonth);
  }
  return sorted;
}

function _emptyResult(beneficiaryUnitId, monthWindow, referenceMonth) {
  return CreditAllocationResult.ok({
    beneficiaryUnitId,
    monthsConsidered:              0,
    totalConsumptionKwh:           0,
    averageMonthlyConsumptionKwh:  0,
    historyFrom:                   null,
    historyTo:                     null,
    metadata:                      { monthWindow, referenceMonth },
  });
}

export class BeneficiaryConsumptionAverageCalculator {

  calculate(input = {}) {
    const { beneficiaryUnitId, monthlyConsumptionHistory, options = {} } = input || {};
    const { monthWindow = 12, referenceMonth = null } = options;

    if (!beneficiaryUnitId || typeof beneficiaryUnitId !== 'string') {
      return CreditAllocationResult.fail([
        CreditAllocationResult.makeError('REQUIRED', 'beneficiaryUnitId é obrigatório', 'beneficiaryUnitId'),
      ]);
    }

    const sorted = _filterAndSort(monthlyConsumptionHistory, referenceMonth);
    const window = sorted.slice(-Math.max(1, Math.floor(monthWindow || 12)));
    const monthsConsidered = window.length;

    if (monthsConsidered === 0) return _emptyResult(beneficiaryUnitId, monthWindow, referenceMonth);

    const totalConsumptionKwh         = roundKwh(window.reduce((s, r) => s + r.consumptionKwh, 0));
    const averageMonthlyConsumptionKwh = roundKwh(totalConsumptionKwh / monthsConsidered);

    return CreditAllocationResult.ok({
      beneficiaryUnitId,
      monthsConsidered,
      totalConsumptionKwh,
      averageMonthlyConsumptionKwh,
      historyFrom: window[0].referenceMonth,
      historyTo:   window[window.length - 1].referenceMonth,
      metadata:    { monthWindow, referenceMonth },
    });
  }
}
