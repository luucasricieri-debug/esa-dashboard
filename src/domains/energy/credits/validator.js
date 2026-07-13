/**
 * ESA OS — Energy Domain / Credits
 * EnergyCreditsValidator
 *
 * Validações de domínio do módulo de créditos.
 * Retorna arrays de erros — nunca lança exceção para erros de negócio.
 * Funções são puras: sem estado, sem efeitos colaterais.
 */

import { OPERATIONAL_STATUS, SUBSCRIPTION_STATUS, STATEMENT_STATUS } from './constants.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function _err(code, message, field = null, metadata = {}) {
  return { code, message, field, metadata };
}

function _warn(code, message, field = null, metadata = {}) {
  return { code, message, field, metadata };
}

export class EnergyCreditsValidator {

  validateGeneratingUnit(input) {
    const errors = [];
    if (!input.id)            errors.push(_err('REQUIRED', 'id é obrigatório', 'id'));
    if (!input.name)          errors.push(_err('REQUIRED', 'name é obrigatório', 'name'));
    if (!input.ownerName)     errors.push(_err('REQUIRED', 'ownerName é obrigatório', 'ownerName'));
    if (!input.uc)            errors.push(_err('REQUIRED', 'uc é obrigatório', 'uc'));
    if (!input.utilityCompany) errors.push(_err('REQUIRED', 'utilityCompany é obrigatório', 'utilityCompany'));
    if (input.operationalStatus != null) {
      if (!Object.values(OPERATIONAL_STATUS).includes(input.operationalStatus)) {
        errors.push(_err('INVALID_STATUS',
          `operationalStatus inválido. Válidos: ${Object.values(OPERATIONAL_STATUS).join(', ')}`,
          'operationalStatus'));
      }
    }
    if (input.installedPower != null) {
      if (typeof input.installedPower !== 'number' || isNaN(input.installedPower) || input.installedPower < 0) {
        errors.push(_err('INVALID_VALUE', 'installedPower deve ser número não-negativo', 'installedPower'));
      }
    }
    return errors;
  }

  validateBeneficiaryUnit(input) {
    const errors = [];
    if (!input.id)               errors.push(_err('REQUIRED', 'id é obrigatório', 'id'));
    if (!input.generatingUnitId) errors.push(_err('REQUIRED', 'generatingUnitId é obrigatório', 'generatingUnitId'));
    if (!input.name)             errors.push(_err('REQUIRED', 'name é obrigatório', 'name'));
    if (!input.uc)               errors.push(_err('REQUIRED', 'uc é obrigatório', 'uc'));
    if (!input.utilityCompany)   errors.push(_err('REQUIRED', 'utilityCompany é obrigatório', 'utilityCompany'));
    if (input.subscriptionStatus != null) {
      if (!Object.values(SUBSCRIPTION_STATUS).includes(input.subscriptionStatus)) {
        errors.push(_err('INVALID_STATUS',
          `subscriptionStatus inválido. Válidos: ${Object.values(SUBSCRIPTION_STATUS).join(', ')}`,
          'subscriptionStatus'));
      }
    }
    if (input.averageConsumption12Months != null) {
      if (typeof input.averageConsumption12Months !== 'number' || isNaN(input.averageConsumption12Months) || input.averageConsumption12Months < 0) {
        errors.push(_err('INVALID_VALUE', 'averageConsumption12Months deve ser número não-negativo', 'averageConsumption12Months'));
      }
    }
    return errors;
  }

  validateReferenceMonth(value) {
    if (!value) return _err('REQUIRED', 'referenceMonth é obrigatório', 'referenceMonth');
    if (!MONTH_RE.test(value)) return _err('INVALID_FORMAT', 'referenceMonth deve estar no formato YYYY-MM', 'referenceMonth');
    return null;
  }

  validatePositive(value, field) {
    if (typeof value !== 'number' || isNaN(value) || value < 0) {
      return _err('INVALID_VALUE', `${field} deve ser número não-negativo`, field);
    }
    return null;
  }

  validateAllocationConstraints(allocatedKwh, monthlyConsumptionKwh, availableKwh, options = {}) {
    const errors  = [];
    const warnings = [];
    if (allocatedKwh > monthlyConsumptionKwh) {
      errors.push(_err('ALLOCATION_EXCEEDS_CONSUMPTION',
        `allocatedKwh (${allocatedKwh}) não pode exceder monthlyConsumptionKwh (${monthlyConsumptionKwh})`,
        'allocatedKwh'));
    }
    if (allocatedKwh > availableKwh) {
      if (options.allowOverAllocation) {
        warnings.push(_warn('INSUFFICIENT_BALANCE',
          `Alocados ${allocatedKwh} kWh mas disponível apenas ${availableKwh} kWh`,
          'allocatedKwh'));
      } else {
        errors.push(_err('ALLOCATION_EXCEEDS_BALANCE',
          `allocatedKwh (${allocatedKwh}) excede saldo disponível (${availableKwh})`,
          'allocatedKwh'));
      }
    }
    return { errors, warnings };
  }

  validateCompensation(compensatedKwh, allocatedKwh, field = 'compensatedKwh') {
    if (compensatedKwh > allocatedKwh) {
      return _err('COMPENSATION_EXCEEDS_ALLOCATION',
        `compensatedKwh (${compensatedKwh}) não pode exceder allocatedKwh (${allocatedKwh})`,
        field);
    }
    return null;
  }

  validateStatementStatus(status) {
    if (!Object.values(STATEMENT_STATUS).includes(status)) {
      return _err('INVALID_STATUS',
        `status inválido. Válidos: ${Object.values(STATEMENT_STATUS).join(', ')}`,
        'status');
    }
    return null;
  }

  validateClosedMonth(status, force = false) {
    if (status === STATEMENT_STATUS.CLOSED && !force) {
      return _err('MONTH_CLOSED',
        'Mês fechado não pode ser recalculado sem force=true',
        'status');
    }
    return null;
  }
}
