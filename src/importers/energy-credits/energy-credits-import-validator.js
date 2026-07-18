/**
 * ESA OS — Importers / Energy Credits
 * Validator: verifica entidades mapeadas antes da persistência.
 *
 * NÃO lança exceptions.
 * Retorna erros e warnings estruturados.
 * NÃO acessa Firebase, filesystem ou rede.
 */

import { EnergyCreditsImportResult } from './energy-credits-import-result.js';
import { ENERGY_CREDITS_IMPORT_TYPE } from './import-types.js';

const T = ENERGY_CREDITS_IMPORT_TYPE;

function _err(code, message, row = null, field = null, value = null) {
  return EnergyCreditsImportResult.makeError(code, message, row, field, value);
}

function _warn(code, message, row = null, field = null, value = null) {
  return EnergyCreditsImportResult.makeWarning(code, message, row, field, value);
}

function _requireField(entity, field, row) {
  const v = entity[field];
  if (v === null || v === undefined || v === '') {
    return _err('REQUIRED_FIELD', `Campo obrigatório ausente: ${field}`, row, field, v);
  }
  return null;
}

function _requirePositiveNumber(entity, field, row) {
  const v = entity[field];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || isNaN(v)) return _err('INVALID_NUMBER', `Campo deve ser número: ${field}`, row, field, v);
  if (v < 0) return _warn('NEGATIVE_NUMBER', `Número negativo em: ${field}`, row, field, v);
  return null;
}

function _requireMonth(entity, field, row) {
  const v = entity[field];
  if (!v || typeof v !== 'string' || !/^\d{4}-\d{2}$/.test(v)) {
    return _err('INVALID_MONTH', `Campo deve ser YYYY-MM: ${field}`, row, field, v);
  }
  return null;
}

export class EnergyCreditsImportValidator {

  validate(importType, entity, rowIndex = null) {
    switch (importType) {
      case T.GENERATING_UNITS:                return this._validateGeneratingUnit(entity, rowIndex);
      case T.BENEFICIARY_UNITS:               return this._validateBeneficiaryUnit(entity, rowIndex);
      case T.GENERATING_UNIT_MONTHLY_RECORDS: return this._validateGeneratingUnitMonthlyRecord(entity, rowIndex);
      case T.BENEFICIARY_MONTHLY_RECORDS:     return this._validateBeneficiaryMonthlyRecord(entity, rowIndex);
      default:
        return { ok: false, errors: [_err('UNKNOWN_TYPE', `Tipo desconhecido: ${importType}`, rowIndex)], warnings: [] };
    }
  }

  _validateGeneratingUnit(entity, rowIndex) {
    const errors   = [];
    const warnings = [];
    if (!entity.id) warnings.push(_warn('MISSING_ID', 'Unidade geradora sem ID — será gerado automaticamente', rowIndex, 'id'));
    if (!entity.name) warnings.push(_warn('MISSING_NAME', 'Campo name está ausente', rowIndex, 'name'));
    if (!entity.uc && !entity.id) errors.push(_err('MISSING_IDENTIFIER', 'É necessário id ou uc para identificar a unidade geradora', rowIndex, 'uc'));
    return { ok: errors.length === 0, errors, warnings };
  }

  _validateBeneficiaryUnit(entity, rowIndex) {
    const errors   = [];
    const warnings = [];
    if (!entity.id) warnings.push(_warn('MISSING_ID', 'Unidade beneficiária sem ID — será gerado automaticamente', rowIndex, 'id'));
    if (!entity.name) warnings.push(_warn('MISSING_NAME', 'Campo name está ausente', rowIndex, 'name'));
    if (!entity.uc && !entity.id) errors.push(_err('MISSING_IDENTIFIER', 'É necessário id ou uc para identificar a unidade beneficiária', rowIndex, 'uc'));
    return { ok: errors.length === 0, errors, warnings };
  }

  _validateGeneratingUnitMonthlyRecord(entity, rowIndex) {
    const errors   = [];
    const warnings = [];
    const monthErr = _requireMonth(entity, 'referenceMonth', rowIndex);
    if (monthErr) errors.push(monthErr);
    if (!entity.generatingUnitId && !entity.id) {
      errors.push(_err('MISSING_IDENTIFIER', 'É necessário generatingUnitId ou id para o registro mensal', rowIndex, 'generatingUnitId'));
    }
    const numFields = ['previousBalanceKwh', 'monthlyGenerationKwh', 'purchasePricePerKwh'];
    for (const f of numFields) {
      const w = _requirePositiveNumber(entity, f, rowIndex);
      if (w) (w.code === 'INVALID_NUMBER' ? errors : warnings).push(w);
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  _validateBeneficiaryMonthlyRecord(entity, rowIndex) {
    const errors   = [];
    const warnings = [];
    const monthErr = _requireMonth(entity, 'referenceMonth', rowIndex);
    if (monthErr) errors.push(monthErr);
    if (!entity.beneficiaryUnitId && !entity.id) {
      errors.push(_err('MISSING_IDENTIFIER', 'É necessário beneficiaryUnitId ou id para o registro mensal', rowIndex, 'beneficiaryUnitId'));
    }
    const numFields = ['monthlyConsumptionKwh', 'allocatedKwh', 'compensatedKwh', 'esaPricePerKwh', 'utilityTariffPerKwh'];
    for (const f of numFields) {
      const w = _requirePositiveNumber(entity, f, rowIndex);
      if (w) (w.code === 'INVALID_NUMBER' ? errors : warnings).push(w);
    }
    return { ok: errors.length === 0, errors, warnings };
  }
}
