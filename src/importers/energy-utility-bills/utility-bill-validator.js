/**
 * ESA OS — Importers / Energy Utility Bills
 * UtilityBillValidator
 *
 * Valida a extração normalizada. Retorna erros estruturados e warnings.
 * Não lança exception para erros esperados de importação.
 */

import { UtilityBillResult }     from './utility-bill-result.js';
import { UTILITY_BILL_ERROR_CODE } from './utility-bill-types.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _err(code, message, field, value = null) {
  return UtilityBillResult.makeError(code, message, field, value !== null ? { value } : {});
}

function _warn(code, message, field) {
  return UtilityBillResult.makeWarning(code, message, field);
}

function _isNonNegNum(v) {
  return v === null || v === undefined || (typeof v === 'number' && !isNaN(v) && v >= 0);
}

function _validateComponents(components, errors) {
  if (!components || typeof components !== 'object') return;
  const fields = ['te', 'tusd', 'fioB', 'bandeira', 'cip', 'taxes', 'otherCharges'];
  for (const f of fields) {
    const v = components[f];
    if (v !== null && v !== undefined && (typeof v !== 'number' || isNaN(v) || v < 0)) {
      errors.push(_err('INVALID_COMPONENT', `Componente ${f} inválido: deve ser >= 0`, `components.${f}`, v));
    }
  }
}

function _validateId(normalized, errors) {
  if (normalized.id) return;
  errors.push(_err(
    UTILITY_BILL_ERROR_CODE.UTILITY_BILL_IDENTIFIER_REQUIRED,
    'Não foi possível gerar id determinístico: uc, referenceMonth e utilityCompany são necessários',
    'id',
  ));
}

function _validateMonth(normalized, errors) {
  if (!normalized.referenceMonth) {
    errors.push(_err('INVALID_REFERENCE_MONTH', 'referenceMonth é obrigatório (YYYY-MM)', 'referenceMonth'));
    return;
  }
  if (!MONTH_RE.test(normalized.referenceMonth)) {
    errors.push(_err('INVALID_REFERENCE_MONTH', `referenceMonth inválido: "${normalized.referenceMonth}"`, 'referenceMonth', normalized.referenceMonth));
  }
}

function _validateUc(normalized, errors) {
  if (!normalized.uc) {
    errors.push(_err('UTILITY_BILL_UC_REQUIRED', 'uc é obrigatório', 'uc'));
  }
}

function _validateNumericFields(normalized, errors) {
  const { monthlyConsumptionKwh, minimumBillableKwh, totalUtilityBillAmount } = normalized;
  if (!_isNonNegNum(monthlyConsumptionKwh)) {
    errors.push(_err('INVALID_CONSUMPTION', 'monthlyConsumptionKwh deve ser >= 0', 'monthlyConsumptionKwh', monthlyConsumptionKwh));
  }
  if (!_isNonNegNum(minimumBillableKwh)) {
    errors.push(_err('INVALID_MINIMUM_BILLABLE', 'minimumBillableKwh deve ser >= 0', 'minimumBillableKwh', minimumBillableKwh));
  }
  if (!_isNonNegNum(totalUtilityBillAmount)) {
    errors.push(_err('INVALID_TOTAL_AMOUNT', 'totalUtilityBillAmount deve ser >= 0', 'totalUtilityBillAmount', totalUtilityBillAmount));
  }
}

function _validateUtilityCompany(normalized, warnings) {
  if (!normalized.utilityCompany) {
    warnings.push(_warn('UTILITY_COMPANY_MISSING', 'utilityCompany ausente: matching por UC pode ser impreciso', 'utilityCompany'));
  }
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class UtilityBillValidator {

  validate(normalized) {
    if (!normalized || typeof normalized !== 'object') {
      return UtilityBillResult.fail([
        _err(UTILITY_BILL_ERROR_CODE.INVALID_UTILITY_BILL_EXTRACTION, 'Extraction normalizada é obrigatória', null),
      ]);
    }
    const errors   = [];
    const warnings = [];

    _validateId(normalized, errors);
    _validateMonth(normalized, errors);
    _validateUc(normalized, errors);
    _validateNumericFields(normalized, errors);
    _validateComponents(normalized.components, errors);
    _validateUtilityCompany(normalized, warnings);

    return errors.length > 0
      ? UtilityBillResult.fail(errors, warnings)
      : UtilityBillResult.ok(normalized, warnings);
  }
}
