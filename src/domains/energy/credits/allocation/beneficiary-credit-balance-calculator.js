/**
 * ESA OS — Energy Domain / Credits / Allocation
 * BeneficiaryCreditBalanceCalculator
 *
 * Calcula o saldo de créditos individual de uma UC beneficiária para um dado mês.
 * Produz BeneficiaryCreditBalanceRecord com alertas operacionais.
 * Saldo negativo bloqueado por padrão (options.allowNegativeBalance = true para permitir).
 * Sem Date.now(). Determinístico.
 */

import { roundKwh, roundMoney }    from '../rounding.js';
import { CreditAllocationResult }  from './credit-allocation-result.js';
import { ALLOCATION_ALERT_CODE, ALLOCATION_THRESHOLDS } from './allocation-alert.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const NUM_FIELDS = ['previousBalanceKwh', 'creditsReceivedKwh', 'creditsCompensatedKwh', 'positiveAdjustmentsKwh', 'negativeAdjustmentsKwh'];

function _validateInput(input) {
  if (!input || typeof input !== 'object') return ['INPUT_REQUIRED'];
  const errors = [];
  if (!input.beneficiaryUnitId) errors.push('beneficiaryUnitId é obrigatório');
  if (!input.referenceMonth || !MONTH_RE.test(input.referenceMonth)) errors.push('referenceMonth inválido (esperado YYYY-MM)');
  for (const f of NUM_FIELDS) {
    const v = input[f];
    if (typeof v !== 'number' || isNaN(v)) errors.push(`${f} deve ser um número`);
    else if (v < 0) errors.push(`${f} não pode ser negativo`);
  }
  return errors;
}

function _computeBalance(input) {
  return (input.previousBalanceKwh    || 0)
       + (input.creditsReceivedKwh    || 0)
       + (input.positiveAdjustmentsKwh || 0)
       - (input.creditsCompensatedKwh || 0)
       - (input.negativeAdjustmentsKwh || 0);
}

function _coverage(balance, avg) {
  if (!avg || avg <= 0) return null;
  return roundMoney(balance / avg);
}

function _status(balance, coverage, thr) {
  const HIGH = thr.HIGH_BALANCE_COVERAGE_MONTHS ?? ALLOCATION_THRESHOLDS.HIGH_BALANCE_COVERAGE_MONTHS;
  if (balance < 0)                    return 'negative';
  if (balance === 0)                  return 'empty';
  if (coverage !== null && coverage > HIGH) return 'high';
  return 'ok';
}

function _buildAlerts(balance, avg, target, planned, coverage, consumption, thr) {
  const alerts = [];
  const HIGH     = thr.HIGH_BALANCE_COVERAGE_MONTHS    ?? ALLOCATION_THRESHOLDS.HIGH_BALANCE_COVERAGE_MONTHS;
  const ABOVE    = thr.CONSUMPTION_ABOVE_AVERAGE_FACTOR ?? ALLOCATION_THRESHOLDS.CONSUMPTION_ABOVE_AVERAGE_FACTOR;

  if (balance < 0) {
    alerts.push({ code: ALLOCATION_ALERT_CODE.NEGATIVE_BALANCE, severity: 'critical',
      message: `Saldo negativo: ${balance} kWh` });
  }
  if (coverage !== null && coverage > HIGH) {
    alerts.push({ code: ALLOCATION_ALERT_CODE.HIGH_BENEFICIARY_CREDIT_BALANCE, severity: 'attention',
      message: `Saldo acumulado superior a ${HIGH} meses da média de consumo (${coverage} meses).` });
  }
  if (target !== null && planned !== null) {
    const available = roundKwh(balance + planned);
    if (available < target) {
      alerts.push({ code: ALLOCATION_ALERT_CODE.LOW_BENEFICIARY_CREDIT_BALANCE, severity: 'risk',
        message: `Saldo disponível + crédito planejado (${available} kWh) inferior ao crédito alvo (${target} kWh).` });
    }
  }
  if (avg > 0 && consumption !== null && typeof consumption === 'number' && consumption > avg * ABOVE) {
    alerts.push({ code: ALLOCATION_ALERT_CODE.CONSUMPTION_ABOVE_AVERAGE, severity: 'attention',
      message: `Consumo real (${consumption} kWh) acima de ${Math.round(ABOVE * 100)}% da média (${avg} kWh).` });
  }
  return alerts;
}

function _buildRecord(input, balance, coverage, status, alerts) {
  const id = `beneficiary-credit-balance-${input.beneficiaryUnitId}-${input.referenceMonth}`;
  return {
    id,
    beneficiaryUnitId:             input.beneficiaryUnitId,
    generatingUnitId:              input.generatingUnitId              || null,
    beneficiaryUc:                 input.beneficiaryUc                 || null,
    referenceMonth:                input.referenceMonth,
    previousBalanceKwh:            input.previousBalanceKwh            || 0,
    creditsReceivedKwh:            input.creditsReceivedKwh            || 0,
    creditsCompensatedKwh:         input.creditsCompensatedKwh         || 0,
    positiveAdjustmentsKwh:        input.positiveAdjustmentsKwh        || 0,
    negativeAdjustmentsKwh:        input.negativeAdjustmentsKwh        || 0,
    currentBalanceKwh:             balance,
    averageMonthlyConsumptionKwh:  typeof input.averageMonthlyConsumptionKwh === 'number' ? input.averageMonthlyConsumptionKwh : 0,
    preventiveMarginPercentage:    typeof input.preventiveMarginPercentage   === 'number' ? input.preventiveMarginPercentage   : 0,
    targetCreditKwh:               typeof input.targetCreditKwh              === 'number' ? input.targetCreditKwh              : null,
    allocationPercentage:          typeof input.allocationPercentage         === 'number' ? input.allocationPercentage         : null,
    coverageMonths:                coverage,
    status,
    alerts,
    metadata: { source: 'beneficiary-credit-balance-calculator' },
  };
}

export class BeneficiaryCreditBalanceCalculator {

  calculate(input = {}) {
    const errs = _validateInput(input);
    if (errs.length > 0) {
      return CreditAllocationResult.fail(errs.map(m => CreditAllocationResult.makeError('VALIDATION_ERROR', m)));
    }

    const opts        = (input.options && typeof input.options === 'object') ? input.options : {};
    const allowNeg    = opts.allowNegativeBalance === true;
    const thr         = { ...ALLOCATION_THRESHOLDS, ...(opts.thresholds || {}) };
    const avg         = typeof input.averageMonthlyConsumptionKwh === 'number' ? input.averageMonthlyConsumptionKwh : 0;
    const target      = typeof input.targetCreditKwh              === 'number' ? input.targetCreditKwh              : null;
    const planned     = typeof input.plannedCreditsReceivedKwh    === 'number' ? input.plannedCreditsReceivedKwh    : null;
    const consumption = typeof input.monthlyConsumptionKwh        === 'number' ? input.monthlyConsumptionKwh        : null;

    const currentBalanceKwh = roundKwh(_computeBalance(input));

    if (currentBalanceKwh < 0 && !allowNeg) {
      return CreditAllocationResult.fail([CreditAllocationResult.makeError(
        'NEGATIVE_BALANCE_NOT_ALLOWED',
        `Saldo negativo não permitido: ${currentBalanceKwh} kWh. Use options.allowNegativeBalance = true para permitir.`,
        'currentBalanceKwh',
      )]);
    }

    const coverage = _coverage(currentBalanceKwh, avg);
    const alerts   = _buildAlerts(currentBalanceKwh, avg, target, planned, coverage, consumption, thr);
    const status   = _status(currentBalanceKwh, coverage, thr);
    const record   = _buildRecord(input, currentBalanceKwh, coverage, status, alerts);
    const warnings = alerts.map(a => CreditAllocationResult.makeWarning(a.code, a.message));

    return CreditAllocationResult.ok(record, warnings);
  }
}
