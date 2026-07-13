/**
 * ESA OS — Energy Domain / Credits
 * EnergyCreditsService
 *
 * Orquestra calculator + validator para produzir resultados de domínio.
 * Sem persistência. Sem acesso a Firebase, window ou localStorage.
 * Sem dependência de Date.now() — usa referenceDate quando necessário.
 * Funções de negócio retornam EnergyCreditsResult, nunca lançam exceção.
 */

import { EnergyCreditsCalculator }           from './calculator.js';
import { EnergyCreditsValidator }            from './validator.js';
import { EnergyCreditsResult }               from './result.js';
import { ALERT_CODE, ALERT_SEVERITY, createAlert } from './alert.js';
import { OPERATIONAL_STATUS, SUBSCRIPTION_STATUS, PAYMENT_STATUS, STATEMENT_STATUS } from './constants.js';
import { roundKwh, roundMoney }              from './rounding.js';

const calc      = new EnergyCreditsCalculator();
const validator = new EnergyCreditsValidator();

function _mkErr(code, message, field = null, metadata = {}) {
  return { code, message, field, metadata };
}

function _mkWarn(code, message, field = null, metadata = {}) {
  return { code, message, field, metadata };
}

function _alert(code, severity, message, targetType, targetId, metadata = {}) {
  return createAlert(code, severity, message, targetType, targetId, metadata);
}

export class EnergyCreditsService {

  createGeneratingUnit(input = {}) {
    const errors = validator.validateGeneratingUnit(input);
    if (errors.length > 0) return EnergyCreditsResult.fail(errors);
    const unit = {
      id:               input.id,
      name:             input.name,
      ownerName:        input.ownerName,
      ownerDocument:    input.ownerDocument    || null,
      uc:               input.uc,
      address:          input.address          || null,
      city:             input.city             || null,
      state:            input.state            || null,
      utilityCompany:   input.utilityCompany,
      pixKey:           input.pixKey           || null,
      installedPower:   input.installedPower   != null ? input.installedPower : null,
      operationalStatus: input.operationalStatus || OPERATIONAL_STATUS.ACTIVE,
      startedAt:        input.startedAt        || null,
      notes:            input.notes            || null,
    };
    return EnergyCreditsResult.ok(unit);
  }

  createBeneficiaryUnit(input = {}) {
    const errors = validator.validateBeneficiaryUnit(input);
    if (errors.length > 0) return EnergyCreditsResult.fail(errors);
    const unit = {
      id:                         input.id,
      generatingUnitId:           input.generatingUnitId,
      name:                       input.name,
      document:                   input.document                   || null,
      uc:                         input.uc,
      averageConsumption12Months: input.averageConsumption12Months != null ? input.averageConsumption12Months : null,
      address:                    input.address                    || null,
      city:                       input.city                       || null,
      state:                      input.state                      || null,
      utilityCompany:             input.utilityCompany,
      subscriptionStatus:         input.subscriptionStatus         || SUBSCRIPTION_STATUS.ACTIVE,
      commercialResponsible:      input.commercialResponsible      || null,
      notes:                      input.notes                      || null,
    };
    return EnergyCreditsResult.ok(unit);
  }

  calculateBeneficiaryMonthlyRecord(input = {}) {
    const { errors, warnings } = this._validateBeneficiaryRecord(input);
    if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);

    const consumption  = input.monthlyConsumptionKwh       || 0;
    const allocated    = input.allocatedKwh                || 0;
    const compensated  = input.compensatedKwh              || 0;
    const pending      = input.pendingKwh                  || 0;
    const esaPrice     = input.esaKwhPrice                 != null ? input.esaKwhPrice                 : 0;
    const tariff       = input.utilityReferenceTariff      != null ? input.utilityReferenceTariff      : 0;
    const prevDiscount = input.previousAccumulatedDiscount || 0;

    const residual      = calc.residualKwh(consumption, compensated);
    const billWithout   = calc.billWithoutEsa(consumption, tariff);
    const esaInvoice    = calc.esaInvoiceAmount(compensated, esaPrice);
    const residualUtil  = calc.residualUtilityAmount(residual, tariff);
    const billWith      = calc.billWithEsa(esaInvoice, residualUtil);
    const monthly       = calc.monthlyDiscount(billWithout, billWith);
    const accumulated   = calc.accumulatedDiscountTotal(prevDiscount, monthly);

    if (monthly < 0)    warnings.push(_mkWarn(ALERT_CODE.NEGATIVE_SAVINGS,      `monthlyDiscount negativo (${monthly})`,      'monthlyDiscount'));
    if (pending > 0)    warnings.push(_mkWarn(ALERT_CODE.PENDING_COMPENSATION,   `${pending} kWh pendentes de compensação`,    'pendingKwh'));
    if (!consumption)   warnings.push(_mkWarn(ALERT_CODE.ZERO_CONSUMPTION,       'monthlyConsumptionKwh é zero',               'monthlyConsumptionKwh'));

    const record = this._buildBeneficiaryRecord(input, { residual, billWithout, esaInvoice, residualUtil, billWith, monthly, accumulated });
    return EnergyCreditsResult.ok(record, warnings);
  }

  _validateBeneficiaryRecord(input) {
    const errors   = [];
    const warnings = [];
    const mErr = validator.validateReferenceMonth(input.referenceMonth);
    if (mErr) errors.push(mErr);
    if (!input.beneficiaryUnitId) errors.push(_mkErr('REQUIRED', 'beneficiaryUnitId é obrigatório', 'beneficiaryUnitId'));
    if (!input.generatingUnitId)  errors.push(_mkErr('REQUIRED', 'generatingUnitId é obrigatório',  'generatingUnitId'));

    for (const f of ['monthlyConsumptionKwh', 'allocatedKwh', 'compensatedKwh', 'pendingKwh']) {
      if (input[f] != null) { const e = validator.validatePositive(input[f], f); if (e) errors.push(e); }
    }

    const allocated   = input.allocatedKwh   || 0;
    const compensated = input.compensatedKwh || 0;
    const consumption = input.monthlyConsumptionKwh || 0;
    if (allocated > consumption) {
      errors.push(_mkErr('ALLOCATION_EXCEEDS_CONSUMPTION',
        `allocatedKwh (${allocated}) não pode exceder monthlyConsumptionKwh (${consumption})`, 'allocatedKwh'));
    }
    if (compensated > allocated) {
      errors.push(_mkErr('COMPENSATION_EXCEEDS_ALLOCATION',
        `compensatedKwh (${compensated}) não pode exceder allocatedKwh (${allocated})`, 'compensatedKwh'));
    }
    if (input.esaKwhPrice           == null) warnings.push(_mkWarn(ALERT_CODE.MISSING_PRICE,  'esaKwhPrice ausente',           'esaKwhPrice'));
    if (input.utilityReferenceTariff == null) warnings.push(_mkWarn(ALERT_CODE.MISSING_TARIFF, 'utilityReferenceTariff ausente', 'utilityReferenceTariff'));
    return { errors, warnings };
  }

  _buildBeneficiaryRecord(input, amounts) {
    const { residual, billWithout, esaInvoice, residualUtil, billWith, monthly, accumulated } = amounts;
    return {
      id:                          input.id              || null,
      beneficiaryUnitId:           input.beneficiaryUnitId,
      generatingUnitId:            input.generatingUnitId,
      referenceMonth:              input.referenceMonth,
      monthlyConsumptionKwh:       roundKwh(input.monthlyConsumptionKwh       || 0),
      allocatedKwh:                roundKwh(input.allocatedKwh                || 0),
      compensatedKwh:              roundKwh(input.compensatedKwh              || 0),
      pendingKwh:                  roundKwh(input.pendingKwh                  || 0),
      residualKwh:                 residual,
      esaKwhPrice:                 input.esaKwhPrice           != null ? roundMoney(input.esaKwhPrice)           : null,
      utilityReferenceTariff:      input.utilityReferenceTariff != null ? roundMoney(input.utilityReferenceTariff) : null,
      billWithoutEsa:              billWithout,
      esaInvoiceAmount:            esaInvoice,
      residualUtilityAmount:       residualUtil,
      billWithEsa:                 billWith,
      monthlyDiscount:             monthly,
      previousAccumulatedDiscount: roundMoney(input.previousAccumulatedDiscount || 0),
      accumulatedDiscountTotal:    accumulated,
      paymentStatus:               input.paymentStatus || PAYMENT_STATUS.PENDING,
      dueDate:                     input.dueDate       || null,
      paidAt:                      input.paidAt        || null,
      notes:                       input.notes         || null,
    };
  }

  calculateGeneratingUnitMonthlyRecord(input = {}) {
    const errors   = [];
    const warnings = [];
    const mErr = validator.validateReferenceMonth(input.referenceMonth);
    if (mErr) errors.push(mErr);
    if (!input.generatingUnitId) errors.push(_mkErr('REQUIRED', 'generatingUnitId é obrigatório', 'generatingUnitId'));
    if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);

    const previous   = input.previousAccumulatedKwhBalance || 0;
    const generation = input.monthlyGenerationKwh          || 0;
    const price      = input.purchaseKwhPrice;
    const recs       = Array.isArray(input.beneficiaryRecords) ? input.beneficiaryRecords : [];
    const available  = calc.availableKwhBeforeAllocation(previous, generation);
    const totalAlloc = calc.totalAllocatedKwh(recs);
    const totalComp  = calc.totalCompensatedKwh(recs);
    const currBal    = calc.currentAccumulatedBalance(previous, generation, totalAlloc);
    const ownerRet   = price != null ? calc.monthlyOwnerReturn(totalComp, price) : null;
    const prevOwner  = input.accumulatedOwnerReturn || 0;
    const accumOwner = ownerRet != null ? roundMoney(prevOwner + ownerRet) : null;

    if (!generation)       warnings.push(_mkWarn(ALERT_CODE.ZERO_GENERATION,  'monthlyGenerationKwh é zero',          'monthlyGenerationKwh'));
    if (price == null)     warnings.push(_mkWarn(ALERT_CODE.MISSING_PRICE,    'purchaseKwhPrice ausente',             'purchaseKwhPrice'));
    if (recs.length === 0) warnings.push(_mkWarn(ALERT_CODE.NO_BENEFICIARIES, 'Sem registros de beneficiárias',       'beneficiaryRecords'));

    const record = {
      id:                            input.id             || null,
      generatingUnitId:              input.generatingUnitId,
      referenceMonth:                input.referenceMonth,
      purchaseKwhPrice:              price != null ? roundMoney(price) : null,
      previousAccumulatedKwhBalance: roundKwh(previous),
      monthlyGenerationKwh:          roundKwh(generation),
      availableKwhBeforeAllocation:  available,
      consumedAllocatedKwh:          totalAlloc,
      currentAccumulatedKwhBalance:  currBal,
      monthlyOwnerReturn:            ownerRet,
      accumulatedOwnerReturn:        accumOwner,
      status:                        input.status || STATEMENT_STATUS.OPEN,
      notes:                         input.notes  || null,
    };
    return EnergyCreditsResult.ok(record, warnings);
  }

  calculateMonthlyStatement(input = {}, options = {}) {
    const errors   = [];
    const warnings = [];
    const mErr = validator.validateReferenceMonth(input.referenceMonth);
    if (mErr) errors.push(mErr);
    if (!input.generatingUnitId) errors.push(_mkErr('REQUIRED', 'generatingUnitId é obrigatório', 'generatingUnitId'));

    if (input.status) {
      const cErr = validator.validateClosedMonth(input.status, options.force);
      if (cErr) return EnergyCreditsResult.fail([cErr]);
    }

    if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);

    const previous   = input.previousAccumulatedKwhBalance || 0;
    const generation = input.monthlyGenerationKwh          || 0;
    const price      = input.purchaseKwhPrice;
    const recs       = Array.isArray(input.beneficiaryRecords) ? input.beneficiaryRecords : [];
    const available  = calc.availableKwhBeforeAllocation(previous, generation);
    const totalAlloc = calc.totalAllocatedKwh(recs);

    if (!options.allowOverAllocation && totalAlloc > available) {
      errors.push(_mkErr('OVER_ALLOCATION_BLOCKED',
        `totalAllocatedKwh (${totalAlloc}) excede saldo disponível (${available})`, 'totalAllocatedKwh'));
      return EnergyCreditsResult.fail(errors, warnings);
    }

    const totals = this._computeStatementTotals(recs, previous, generation, totalAlloc, price);
    const alerts = this._buildStatementAlerts(input, totalAlloc, available, options, recs);
    const stmt   = this._buildStatementObject(input, totals, available, alerts);
    return EnergyCreditsResult.ok(stmt, warnings);
  }

  _computeStatementTotals(recs, previous, generation, totalAlloc, price) {
    const totalComp    = calc.totalCompensatedKwh(recs);
    const totalPending = calc.totalPendingKwh(recs);
    const totalResidual = roundKwh(recs.reduce((s, r) => s + (r.residualKwh || 0), 0));
    const currentBal   = calc.currentAccumulatedBalance(previous, generation, totalAlloc);
    const ownerReturn  = price != null ? calc.monthlyOwnerReturn(totalComp, price) : null;
    const esaRevenue   = calc.totalEsaRevenue(recs);
    const spread       = ownerReturn != null ? calc.grossSpread(esaRevenue, ownerReturn) : null;
    return { totalComp, totalPending, totalResidual, currentBal, ownerReturn, esaRevenue, spread };
  }

  _buildStatementAlerts(input, totalAlloc, available, options, recs) {
    const alerts = [];
    const gid    = input.generatingUnitId;
    const gen    = input.monthlyGenerationKwh;
    const price  = input.purchaseKwhPrice;

    if (!gen || gen === 0) alerts.push(_alert(ALERT_CODE.ZERO_GENERATION,  ALERT_SEVERITY.ATTENTION, 'Geração zero',           'generatingUnit', gid));
    if (recs.length === 0) alerts.push(_alert(ALERT_CODE.NO_BENEFICIARIES, ALERT_SEVERITY.ATTENTION, 'Sem beneficiárias',      'generatingUnit', gid));
    if (price == null)     alerts.push(_alert(ALERT_CODE.MISSING_PRICE,    ALERT_SEVERITY.RISK,      'purchaseKwhPrice ausente', 'generatingUnit', gid));

    if (options.allowOverAllocation && totalAlloc > available) {
      alerts.push(_alert(ALERT_CODE.INSUFFICIENT_BALANCE, ALERT_SEVERITY.CRITICAL,
        `Over-allocated: ${totalAlloc} kWh alocados, ${available} kWh disponíveis`,
        'generatingUnit', gid, { totalAllocated: totalAlloc, available }));
    }

    for (const r of recs) {
      const bid = r.beneficiaryUnitId;
      if (r.esaKwhPrice           == null) alerts.push(_alert(ALERT_CODE.MISSING_PRICE,        ALERT_SEVERITY.RISK,      'esaKwhPrice ausente',              'beneficiaryUnit', bid));
      if (r.utilityReferenceTariff == null) alerts.push(_alert(ALERT_CODE.MISSING_TARIFF,       ALERT_SEVERITY.RISK,      'utilityReferenceTariff ausente',   'beneficiaryUnit', bid));
      if (!r.monthlyConsumptionKwh)         alerts.push(_alert(ALERT_CODE.ZERO_CONSUMPTION,     ALERT_SEVERITY.INFO,      'Consumo zero',                     'beneficiaryUnit', bid));
      if ((r.pendingKwh || 0) > 0)          alerts.push(_alert(ALERT_CODE.PENDING_COMPENSATION, ALERT_SEVERITY.ATTENTION, `${r.pendingKwh} kWh pendentes`,    'beneficiaryUnit', bid));
      if ((r.monthlyDiscount || 0) < 0)     alerts.push(_alert(ALERT_CODE.NEGATIVE_SAVINGS,     ALERT_SEVERITY.ATTENTION, 'Economia negativa',                'beneficiaryUnit', bid));
    }
    return alerts;
  }

  _buildStatementObject(input, totals, available, alerts) {
    const recs = Array.isArray(input.beneficiaryRecords) ? input.beneficiaryRecords : [];
    return {
      referenceMonth:               input.referenceMonth,
      generatingUnitId:             input.generatingUnitId,
      totalGenerationKwh:           roundKwh(input.monthlyGenerationKwh          || 0),
      previousBalanceKwh:           roundKwh(input.previousAccumulatedKwhBalance || 0),
      availableKwhBeforeAllocation: available,
      totalAllocatedKwh:            calc.totalAllocatedKwh(recs),
      totalCompensatedKwh:          totals.totalComp,
      totalPendingKwh:              totals.totalPending,
      totalResidualKwh:             totals.totalResidual,
      currentBalanceKwh:            totals.currentBal,
      totalOwnerReturn:             totals.ownerReturn,
      totalEsaRevenue:              totals.esaRevenue,
      grossSpread:                  totals.spread,
      beneficiaryCount:             recs.length,
      alerts,
      metadata: {
        generatedAt: input.referenceDate || null,
        status:      input.status        || STATEMENT_STATUS.OPEN,
        source:      'energy-credits-service',
      },
    };
  }

  validateAllocation(input = {}) {
    const errors   = [];
    const warnings = [];
    const opts      = input.options || {};
    const allocated  = input.allocatedKwh           || 0;
    const consumption = input.monthlyConsumptionKwh || 0;
    const available  = input.availableKwh           || 0;

    const alloc = validator.validateAllocationConstraints(allocated, consumption, available, opts);
    errors.push(...alloc.errors);
    warnings.push(...alloc.warnings);

    if (input.compensatedKwh != null) {
      const cErr = validator.validateCompensation(input.compensatedKwh, allocated);
      if (cErr) errors.push(cErr);
    }

    if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);
    return EnergyCreditsResult.ok({ valid: true }, warnings);
  }

  calculateOwnerSettlement(input = {}) {
    const errors = [];
    const mErr = validator.validateReferenceMonth(input.referenceMonth);
    if (mErr) errors.push(mErr);
    if (!input.generatingUnitId) errors.push(_mkErr('REQUIRED', 'generatingUnitId é obrigatório', 'generatingUnitId'));
    if (!input.ownerName)        errors.push(_mkErr('REQUIRED', 'ownerName é obrigatório',        'ownerName'));
    if (errors.length > 0) return EnergyCreditsResult.fail(errors);

    const consumed     = input.consumedAllocatedKwh || 0;
    const price        = input.purchaseKwhPrice     || 0;
    const gross        = calc.monthlyOwnerReturn(consumed, price);
    const adjustments  = input.adjustments          || 0;
    const net          = roundMoney(gross + adjustments);
    const settlement   = {
      id:                    input.id              || null,
      generatingUnitId:      input.generatingUnitId,
      ownerName:             input.ownerName,
      referenceMonth:        input.referenceMonth,
      consumedAllocatedKwh:  roundKwh(consumed),
      purchaseKwhPrice:      roundMoney(price),
      grossReturn:           gross,
      adjustments:           roundMoney(adjustments),
      netReturn:             net,
      paymentStatus:         input.paymentStatus || PAYMENT_STATUS.PENDING,
      dueDate:               input.dueDate       || null,
      paidAt:                input.paidAt        || null,
    };
    return EnergyCreditsResult.ok(settlement);
  }

  calculateEsaInvoice(input = {}) {
    const errors   = [];
    const warnings = [];
    const mErr = validator.validateReferenceMonth(input.referenceMonth);
    if (mErr) errors.push(mErr);
    if (!input.beneficiaryUnitId) errors.push(_mkErr('REQUIRED', 'beneficiaryUnitId é obrigatório', 'beneficiaryUnitId'));
    if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);

    if (input.esaKwhPrice == null) warnings.push(_mkWarn(ALERT_CODE.MISSING_PRICE, 'esaKwhPrice ausente', 'esaKwhPrice'));

    const compensated = input.compensatedKwh || 0;
    const consumed    = input.consumedKwh    || 0;
    const esaPrice    = input.esaKwhPrice    != null ? input.esaKwhPrice : 0;
    const amount      = calc.esaInvoiceAmount(compensated, esaPrice);
    const invoice     = {
      id:               input.id              || null,
      beneficiaryUnitId: input.beneficiaryUnitId,
      referenceMonth:   input.referenceMonth,
      consumedKwh:      roundKwh(consumed),
      compensatedKwh:   roundKwh(compensated),
      esaKwhPrice:      input.esaKwhPrice != null ? roundMoney(input.esaKwhPrice) : null,
      invoiceAmount:    amount,
      paymentStatus:    input.paymentStatus || PAYMENT_STATUS.PENDING,
      dueDate:          input.dueDate       || null,
      paidAt:           input.paidAt        || null,
    };
    return EnergyCreditsResult.ok(invoice, warnings);
  }
}
