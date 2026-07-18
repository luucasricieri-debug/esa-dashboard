/**
 * ESA OS — UI / Energy Credits
 * EnergyCreditsUIProvider
 *
 * Bridge técnica entre a UI de Créditos ESA Energia e as APIs públicas do ESAApplication.
 * Não renderiza tela. Não conecta Firebase diretamente. Não tem estado próprio.
 *
 * Responsabilidades:
 *  1. Traduzir chamadas da UI → ESAApplication public APIs
 *  2. Normalizar todos os resultados para UIResult { ok, data, errors, warnings, metadata }
 *  3. Remover campos proibidos (calculationMemory, password, secret, etc.) antes de retornar
 *
 * Uso:
 *   const provider = new EnergyCreditsUIProvider(esaApplication);
 *   const result   = provider.getExecutiveSummary({ referenceMonth: '2025-06' });
 *   // result: { ok, data, errors, warnings, metadata }
 */

import { UIResult }                      from './energy-credits-ui-result.js';
import { EnergyCreditsUINormalizer }     from './energy-credits-ui-normalizer.js';
import { ENERGY_CREDITS_UI_CAPABILITIES,
         ENERGY_CREDITS_UI_VERSION }      from './energy-credits-ui-contract.js';

export class EnergyCreditsUIProvider {

  constructor(esaApplication) {
    if (!esaApplication || typeof esaApplication !== 'object') {
      throw new TypeError('[EnergyCreditsUIProvider] esaApplication é obrigatório');
    }
    this._esa  = esaApplication;
    this._norm = new EnergyCreditsUINormalizer();
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  _wrap(result) {
    const uir = UIResult.fromApplicationResult(result);
    if (!uir.ok) return uir;
    return UIResult.ok(this._norm.normalize(uir.data), uir.metadata, uir.warnings);
  }

  _fail(code, message, field = null) {
    return UIResult.fail([UIResult.makeError(code, message, field)]);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  getExecutiveSummary(filters = {}) {
    return this._wrap(this._esa.getEnergyCreditsExecutiveSummary(filters));
  }

  getGeneratingUnitSummary(generatingUnitId, filters = {}) {
    return this._wrap(this._esa.getEnergyCreditsGeneratingUnitSummary(generatingUnitId, filters));
  }

  getBeneficiarySummary(beneficiaryUnitId, filters = {}) {
    return this._wrap(this._esa.getEnergyCreditsBeneficiarySummary(beneficiaryUnitId, filters));
  }

  getFinancialSummary(filters = {}) {
    return this._wrap(this._esa.getEnergyCreditsFinancialSummary(filters));
  }

  getAlertsSummary(filters = {}) {
    return this._wrap(this._esa.getEnergyCreditsAlertsSummary(filters));
  }

  // ── Queries de Entidade ───────────────────────────────────────────────────

  queryGeneratingUnit(id, options = {}) {
    return this._wrap(this._esa.queryEnergyCreditsGeneratingUnit(id, options));
  }

  queryBeneficiaryUnit(id, options = {}) {
    return this._wrap(this._esa.queryEnergyCreditsBeneficiaryUnit(id, options));
  }

  searchGeneratingUnits(filters = {}, options = {}) {
    return this._wrap(this._esa.searchEnergyCreditsGeneratingUnits(filters, options));
  }

  searchBeneficiaryUnits(filters = {}, options = {}) {
    return this._wrap(this._esa.searchEnergyCreditsBeneficiaryUnits(filters, options));
  }

  getMonthlyStatement(generatingUnitId, referenceMonth, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsMonthlyStatement(generatingUnitId, referenceMonth, options));
  }

  getGeneratingUnitHistory(generatingUnitId, filters = {}, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsGeneratingUnitHistory(generatingUnitId, filters, options));
  }

  getBeneficiaryHistory(beneficiaryUnitId, filters = {}, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsBeneficiaryHistory(beneficiaryUnitId, filters, options));
  }

  // ── Allocation & Balance ──────────────────────────────────────────────────

  calculateConsumptionAverage(input = {}) {
    return this._wrap(this._esa.calculateEnergyCreditsConsumptionAverage(input));
  }

  calculateAllocationPlan(input = {}) {
    return this._wrap(this._esa.calculateEnergyCreditsAllocationPlan(input));
  }

  calculateBeneficiaryBalance(input = {}) {
    return this._wrap(this._esa.calculateEnergyCreditsBeneficiaryBalance(input));
  }

  getBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options));
  }

  getBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters = {}, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters, options));
  }

  getAllocationPlan(generatingUnitId, referenceMonth, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsAllocationPlan(generatingUnitId, referenceMonth, options));
  }

  getBeneficiaryConsumptionAverage(beneficiaryUnitId, filters = {}, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsBeneficiaryConsumptionAverage(beneficiaryUnitId, filters, options));
  }

  // ── Billing ───────────────────────────────────────────────────────────────

  calculateBeneficiaryBilling(input = {}) {
    return this._wrap(this._esa.calculateEnergyBeneficiaryBilling(input));
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  getOwnerMonthlyReport(generatingUnitId, referenceMonth, options = {}) {
    return this._wrap(this._esa.buildEnergyCreditsOwnerMonthlyReport(generatingUnitId, referenceMonth, options));
  }

  getBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options = {}) {
    return this._wrap(this._esa.buildEnergyCreditsBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options));
  }

  getEsaInternalMonthlyReport(referenceMonth, options = {}) {
    return this._wrap(this._esa.buildEnergyCreditsEsaInternalMonthlyReport(referenceMonth, options));
  }

  getEsaFinancialMonthlyReport(referenceMonth, options = {}) {
    return this._wrap(this._esa.buildEnergyCreditsEsaFinancialMonthlyReport(referenceMonth, options));
  }

  // ── CSV Import ────────────────────────────────────────────────────────────

  importFromCsv(importType, csvText, options = {}) {
    return this._wrap(this._esa.importEnergyCreditsFromCsv(importType, csvText, options));
  }

  importFromRows(importType, rows, options = {}) {
    return this._wrap(this._esa.importEnergyCreditsFromRows(importType, rows, options));
  }

  // ── CSV Template ──────────────────────────────────────────────────────────

  getCsvTemplate(importType, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsCsvTemplate(importType, options));
  }

  // ── Utility Bill Import ───────────────────────────────────────────────────

  createUtilityBillImport(rawExtraction, options = {}) {
    return this._wrap(this._esa.createEnergyUtilityBillImport(rawExtraction, options));
  }

  matchUtilityBillImport(importId, beneficiaryUnits, options = {}) {
    return this._wrap(this._esa.matchEnergyUtilityBillImport(importId, beneficiaryUnits, options));
  }

  linkUtilityBillToBeneficiary(importId, beneficiaryUnitId, context = {}) {
    return this._wrap(this._esa.linkEnergyUtilityBillToBeneficiary(importId, beneficiaryUnitId, context));
  }

  prepareBeneficiaryFromUtilityBill(importId) {
    return this._wrap(this._esa.prepareEnergyCreditsBeneficiaryFromUtilityBill(importId));
  }

  reviewUtilityBillImport(importId, correctedData, options = {}) {
    return this._wrap(this._esa.reviewEnergyUtilityBillImport(importId, correctedData, options));
  }

  detectUtilityBillDuplicate(importId, existingMonthlyRecords, options = {}) {
    return this._wrap(this._esa.detectEnergyUtilityBillDuplicate(importId, existingMonthlyRecords, options));
  }

  confirmUtilityBillMonthlyRecord(importId, options = {}) {
    return this._wrap(this._esa.confirmEnergyUtilityBillMonthlyRecord(importId, options));
  }

  replaceUtilityBillMonthlyRecord(importId, replacementReason, options = {}) {
    return this._wrap(this._esa.replaceEnergyUtilityBillMonthlyRecord(importId, replacementReason, options));
  }

  discardUtilityBillImport(importId, options = {}) {
    return this._wrap(this._esa.discardEnergyUtilityBillImport(importId, options));
  }

  getUtilityBillImport(importId) {
    return this._wrap(this._esa.getEnergyUtilityBillImport(importId));
  }

  searchUtilityBillImports(filters = {}) {
    return this._wrap(this._esa.searchEnergyUtilityBillImports(filters));
  }

  getUnlinkedUtilityBills(filters = {}) {
    return this._wrap(this._esa.getUnlinkedEnergyUtilityBills(filters));
  }

  getBeneficiaryMonthlyDataSources(beneficiaryUnitId, referenceMonth, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsBeneficiaryMonthlyDataSources(beneficiaryUnitId, referenceMonth, options));
  }

  buildBillingInputFromUtilityBill(monthlyRecord, context = {}) {
    return this._wrap(this._esa.buildEnergyBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context));
  }

  // ── Cadastros ─────────────────────────────────────────────────────────────

  createGeneratingUnit(input, options = {}) {
    return this._wrap(this._esa.createEnergyCreditsGeneratingUnit(input, options));
  }

  createBeneficiaryUnit(input, options = {}) {
    return this._wrap(this._esa.createEnergyCreditsBeneficiaryUnit(input, options));
  }

  updateGeneratingUnit(id, input, options = {}) {
    return this._wrap(this._esa.updateEnergyCreditsGeneratingUnit(id, input, options));
  }

  updateBeneficiaryUnit(id, input, options = {}) {
    return this._wrap(this._esa.updateEnergyCreditsBeneficiaryUnit(id, input, options));
  }

  // ── Commercial Terms ──────────────────────────────────────────────────────

  getGeneratingUnitCommercialTerms(generatingUnitId, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsGeneratingUnitCommercialTerms(generatingUnitId, options));
  }

  updateGeneratingUnitCommercialTerms(generatingUnitId, input, options = {}) {
    return this._wrap(this._esa.updateEnergyCreditsGeneratingUnitCommercialTerms(generatingUnitId, input, options));
  }

  // ── Settlement Recipient ──────────────────────────────────────────────────

  getSettlementRecipient(generatingUnitId, options = {}) {
    return this._wrap(this._esa.getEnergyCreditsSettlementRecipient(generatingUnitId, options));
  }

  updateSettlementRecipient(generatingUnitId, input, options = {}) {
    return this._wrap(this._esa.updateEnergyCreditsSettlementRecipient(generatingUnitId, input, options));
  }

  // ── Invoice Payment ───────────────────────────────────────────────────────

  confirmInvoicePayment(invoiceId, paymentData, options = {}) {
    return this._wrap(this._esa.confirmEnergyCreditsInvoicePayment(invoiceId, paymentData, options));
  }

  reopenInvoicePayment(invoiceId, reason, options = {}) {
    return this._wrap(this._esa.reopenEnergyCreditsInvoicePayment(invoiceId, reason, options));
  }

  // ── Owner Settlement Payment ──────────────────────────────────────────────

  confirmOwnerSettlementPayment(settlementId, paymentData, options = {}) {
    return this._wrap(this._esa.confirmEnergyCreditsOwnerSettlementPayment(settlementId, paymentData, options));
  }

  reopenOwnerSettlementPayment(settlementId, reason, options = {}) {
    return this._wrap(this._esa.reopenEnergyCreditsOwnerSettlementPayment(settlementId, reason, options));
  }

  // ── Meta ──────────────────────────────────────────────────────────────────

  getCapabilities() {
    return UIResult.ok({
      version:      ENERGY_CREDITS_UI_VERSION,
      esaVersion:   this._esa.version || null,
      capabilities: ENERGY_CREDITS_UI_CAPABILITIES,
    });
  }

  getStats() {
    const caps = ENERGY_CREDITS_UI_CAPABILITIES;
    const totalCapabilities = Object.values(caps).reduce((acc, arr) => acc + arr.length, 0);
    return UIResult.ok({
      version:            ENERGY_CREDITS_UI_VERSION,
      esaVersion:         this._esa.version || null,
      capabilityGroups:   Object.keys(caps).length,
      totalCapabilities,
    });
  }

}
