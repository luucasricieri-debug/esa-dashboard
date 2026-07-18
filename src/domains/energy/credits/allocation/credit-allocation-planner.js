/**
 * ESA OS — Energy Domain / Credits / Allocation
 * CreditAllocationPlanner
 *
 * Calcula o plano de rateio percentual da geração disponível entre UCs beneficiárias.
 * Suporta modo automático (baseado em média e margem preventiva) e modo manual.
 * Reconciliação determinística do resíduo de arredondamento: aplicada à primeira UC (por beneficiaryUnitId).
 * Sem Date.now(). Sem Math.random(). Mesma entrada = mesma saída.
 */

import { roundKwh }               from '../rounding.js';
import { CreditAllocationResult } from './credit-allocation-result.js';
import { ALLOCATION_ALERT_CODE, ALLOCATION_THRESHOLDS } from './allocation-alert.js';

const MAX_MARGIN     = ALLOCATION_THRESHOLDS.MAX_PREVENTIVE_MARGIN_PCT;
const MANUAL_TOL     = ALLOCATION_THRESHOLDS.MANUAL_ALLOCATION_TOLERANCE_PP;

function _roundPct(v) { return Math.round(v * 10000) / 10000; }

function _isManualMode(bens) {
  return bens.length > 0 && bens.every(b => typeof b.manualAllocationPercentage === 'number');
}

function _isPartialManual(bens) {
  const some = bens.some(b => typeof b.manualAllocationPercentage === 'number');
  const all  = bens.every(b => typeof b.manualAllocationPercentage === 'number');
  return some && !all;
}

function _buildEntry(b) {
  const avg     = typeof b.averageMonthlyConsumptionKwh      === 'number' ? b.averageMonthlyConsumptionKwh      : 0;
  const margin  = typeof b.preventiveMarginPercentage         === 'number' ? b.preventiveMarginPercentage         : 0;
  const balance = typeof b.currentBeneficiaryCreditBalanceKwh === 'number' ? b.currentBeneficiaryCreditBalanceKwh : 0;
  const target  = roundKwh(avg * (1 + margin / 100));
  const recommended = roundKwh(Math.max(0, target - balance));
  return {
    beneficiaryUnitId:                  b.beneficiaryUnitId,
    beneficiaryUc:                      b.beneficiaryUc || null,
    averageMonthlyConsumptionKwh:       avg,
    preventiveMarginPercentage:         margin,
    currentBeneficiaryCreditBalanceKwh: balance,
    targetCreditKwh:                    target,
    recommendedCreditsToReceiveKwh:     recommended,
    allocationPercentage:               0,
    plannedCreditsReceivedKwh:          0,
    residueApplied:                     false,
  };
}

function _assignAutoPercentages(items, generation) {
  const total = roundKwh(items.reduce((s, i) => s + i.recommendedCreditsToReceiveKwh, 0));
  for (const item of items) {
    item.allocationPercentage      = total > 0 ? _roundPct(item.recommendedCreditsToReceiveKwh / total * 100) : 0;
    item.plannedCreditsReceivedKwh = total > 0 ? roundKwh(generation * item.allocationPercentage / 100) : 0;
  }
  return total;
}

function _assignManualPercentages(items, generation) {
  for (const item of items) {
    item.allocationPercentage      = item._manualPct;
    item.plannedCreditsReceivedKwh = roundKwh(generation * item.allocationPercentage / 100);
    delete item._manualPct;
  }
}

function _reconcile(items, generation) {
  if (items.length === 0) return;
  const sumPlanned = items.reduce((s, i) => s + i.plannedCreditsReceivedKwh, 0);
  if (sumPlanned === 0) return;
  const residue = roundKwh(generation - sumPlanned);
  if (residue !== 0) {
    items[0].plannedCreditsReceivedKwh = roundKwh(items[0].plannedCreditsReceivedKwh + residue);
    items[0].residueApplied            = true;
  }
}

function _buildMarginWarnings(bens) {
  return bens
    .filter(b => typeof b.preventiveMarginPercentage === 'number' && b.preventiveMarginPercentage > MAX_MARGIN)
    .map(b => CreditAllocationResult.makeWarning(
      ALLOCATION_ALERT_CODE.MAX_PREVENTIVE_MARGIN_EXCEEDED,
      `Margem preventiva ${b.preventiveMarginPercentage}% excede o limite de ${MAX_MARGIN}% para ${b.beneficiaryUnitId}`,
      'preventiveMarginPercentage',
      { beneficiaryUnitId: b.beneficiaryUnitId, margin: b.preventiveMarginPercentage, maxMargin: MAX_MARGIN },
    ));
}

function _validateInput(input) {
  if (!input || typeof input !== 'object') return 'INPUT_REQUIRED';
  if (!input.generatingUnitId)    return 'GENERATING_UNIT_ID_REQUIRED';
  if (!Array.isArray(input.beneficiaries)) return 'BENEFICIARIES_REQUIRED';
  if (typeof input.generationAvailableKwh !== 'number' || isNaN(input.generationAvailableKwh)) {
    return 'GENERATION_AVAILABLE_KWH_REQUIRED';
  }
  return null;
}

function _buildOutput(generatingUnitId, referenceMonth, generation, items, mode, totalRecommended) {
  const totalPlanned = roundKwh(items.reduce((s, i) => s + i.plannedCreditsReceivedKwh, 0));
  return { generatingUnitId, referenceMonth, generationAvailableKwh: generation, mode, totalRecommendedCreditsKwh: totalRecommended, beneficiaries: items, totalPlannedCreditsKwh: totalPlanned };
}

export class CreditAllocationPlanner {

  planAllocation(input = {}) {
    const inputErr = _validateInput(input);
    if (inputErr) {
      return CreditAllocationResult.fail([CreditAllocationResult.makeError(inputErr, `${inputErr} é obrigatório`)]);
    }
    const { generatingUnitId, referenceMonth = null, generationAvailableKwh, beneficiaries } = input;
    const generation = roundKwh(Math.max(0, generationAvailableKwh));
    const sorted     = [...beneficiaries].sort((a, b) => (a.beneficiaryUnitId || '').localeCompare(b.beneficiaryUnitId || ''));
    const warnings   = _buildMarginWarnings(beneficiaries);

    if (_isPartialManual(sorted)) {
      return CreditAllocationResult.fail([CreditAllocationResult.makeError(
        ALLOCATION_ALERT_CODE.PARTIAL_MANUAL_ALLOCATION_NOT_ALLOWED,
        'Todas as beneficiárias devem ter percentual manual definido, ou nenhuma. Mistura não é permitida.',
        'manualAllocationPercentage',
      )], warnings);
    }

    return _isManualMode(sorted)
      ? this._planManual(generatingUnitId, referenceMonth, generation, sorted, warnings)
      : this._planAuto(generatingUnitId, referenceMonth, generation, sorted, warnings);
  }

  _planAuto(generatingUnitId, referenceMonth, generation, sorted, warnings) {
    const items          = sorted.map(_buildEntry);
    const totalRecommended = _assignAutoPercentages(items, generation);
    _reconcile(items, generation);
    return CreditAllocationResult.ok(
      _buildOutput(generatingUnitId, referenceMonth, generation, items, 'auto', totalRecommended),
      warnings,
    );
  }

  _planManual(generatingUnitId, referenceMonth, generation, sorted, warnings) {
    const sumPct = sorted.reduce((s, b) => s + (b.manualAllocationPercentage || 0), 0);
    if (Math.abs(sumPct - 100) > MANUAL_TOL) {
      return CreditAllocationResult.fail([CreditAllocationResult.makeError(
        ALLOCATION_ALERT_CODE.ALLOCATION_PERCENTAGE_TOTAL_INVALID,
        `Soma dos percentuais manuais é ${_roundPct(sumPct)}% — esperado 100% ± ${MANUAL_TOL}pp`,
        'manualAllocationPercentage',
        { sum: _roundPct(sumPct), tolerance: MANUAL_TOL },
      )], warnings);
    }
    const items = sorted.map(b => { const e = _buildEntry(b); e._manualPct = b.manualAllocationPercentage; return e; });
    _assignManualPercentages(items, generation);
    _reconcile(items, generation);
    const totalRecommended = roundKwh(items.reduce((s, i) => s + i.recommendedCreditsToReceiveKwh, 0));
    return CreditAllocationResult.ok(
      _buildOutput(generatingUnitId, referenceMonth, generation, items, 'manual', totalRecommended),
      warnings,
    );
  }
}
