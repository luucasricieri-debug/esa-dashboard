/**
 * ESA OS
 * Core Bootstrap
 *
 * Núcleo da plataforma ESA OS.
 * Orquestra a inicialização dos módulos core e das integrações.
 *
 * IMPORTANTE:
 * Não conectar diretamente ao Dashboard legado (index.html).
 * O bridge de integração (CRMLegacyEventBridge) é o único ponto de contato controlado.
 */

import { FirebaseService }       from '../services/firebase.js';
import { eventBus }              from './events/index.js';
import { audit }                 from './audit/index.js';
import { logger }                from './logger/index.js';
import { integrationRegistry,
         CRMAuditIntegration }   from '../integrations/index.js';
import { CRMLegacyEventBridge }    from '../legacy/crm-event-bridge.js';
import { CRMLegacyReadModelHydrator } from '../legacy/crm-read-model-hydrator.js';
import { CRMReadModelIntegration,
         crmReadModel }            from '../read-models/crm/index.js';
import { crmQueryService }         from '../queries/crm/index.js';
import { SolanaCommercialContextBuilder } from '../contexts/solana/index.js';
import { EnergyCreditsService }           from '../domains/energy/credits/index.js';
import { energyCreditsReadModel }         from '../read-models/energy-credits/index.js';
import { energyCreditsQueryService }      from '../queries/energy-credits/index.js';
import { energyCreditsReportService }     from '../reports/energy-credits/index.js';
import { energyCreditsRepository,
         energyCreditsRepositoryHydrator,
         EnergyCreditsFirebaseRepository }  from '../repositories/energy-credits/index.js';
import { energyCreditsImportService,
         EnergyCreditsImportService }        from '../importers/energy-credits/index.js';
import { energyBillingEngine,
         EnergyBillingEngine }               from '../engines/energy-billing/index.js';
import { consumptionAverageCalculator,
         creditAllocationPlanner,
         beneficiaryCreditBalanceCalculator } from '../domains/energy/credits/allocation/index.js';
import { UtilityBillImportService,
         buildBillingInputFromUtilityBillMonthlyRecord } from '../importers/energy-utility-bills/index.js';
import { UtilityBillQueryService }            from '../queries/energy-utility-bills/index.js';
import { energyCreditsCsvTemplateService }    from '../importers/energy-credits/csv-template-service.js';
import { EnergyCreditsUIProvider }            from '../ui/energy-credits/index.js';

class ESAApplication {

  constructor() {
    this.version                  = '2.0.0-alpha';
    this.firebase                 = new FirebaseService();
    this.crmLegacyBridge          = null;
    this.crmReadModelHydrator     = null;
    this._solanaContextBuilder    = null;
    this._energyCreditsService    = null;
    this._utilityBillImportService = null;
    this._utilityBillQueryService  = null;
  }

  initialize() {

    console.log('==================================');
    console.log('ESA OS');
    console.log('Versão:', this.version);
    console.log('Inicializando plataforma...');
    console.log('==================================');

    this.firebase.initialize();

    // Registrar CRMAuditIntegration com Logger singleton (idempotente — seguro se initialize() for chamado novamente)
    if (!integrationRegistry.get('crmAudit')) {
      integrationRegistry.register('crmAudit', new CRMAuditIntegration(eventBus, audit, logger));
    }
    if (!integrationRegistry.get('crmAudit').isStarted()) {
      integrationRegistry.start('crmAudit');
    }

    // CRM Read Model Integration — consome crm:deal:* e mantém projeção em memória
    if (!integrationRegistry.get('crmReadModel')) {
      integrationRegistry.register('crmReadModel', new CRMReadModelIntegration(eventBus, crmReadModel, logger));
    }
    if (!integrationRegistry.get('crmReadModel').isStarted()) {
      integrationRegistry.start('crmReadModel');
    }

    // Bridge para código legado — exposto via window.ESA_OS.crmLegacyBridge
    if (!this.crmLegacyBridge) {
      this.crmLegacyBridge = new CRMLegacyEventBridge(eventBus);
    }

    // Hydrator de hidratação inicial — snapshot legado → CRM Read Model
    if (!this.crmReadModelHydrator) {
      this.crmReadModelHydrator = new CRMLegacyReadModelHydrator(crmReadModel, logger);
    }

    console.log('ESA OS iniciada com sucesso.');

  }

  getCoreStats() {
    return {
      version:             this.version,
      firebaseInitialized: this.firebase.isInitialized(),
      integrations:        integrationRegistry.getStats(),
      logger:              logger.getStats(),
    };
  }

  getCRMAuditStats() {
    return integrationRegistry.get('crmAudit')?.getStats() || null;
  }

  getCRMReadModelStats() {
    return {
      integration: integrationRegistry.get('crmReadModel')?.getStats() || null,
      readModel:   crmReadModel.getStats(),
    };
  }

  getCRMMetrics(filters = {}) {
    return crmQueryService.getMetrics(filters).toJSON();
  }

  getCRMPipeline(filters = {}) {
    return crmQueryService.getPipeline(filters).toJSON();
  }

  getCRMStatusSummary(filters = {}) {
    return crmQueryService.getStatusSummary(filters).toJSON();
  }

  queryCRMDeal(dealId) {
    return crmQueryService.getDeal(dealId).toJSON();
  }

  searchCRMDeals(filters = {}) {
    return crmQueryService.searchDeals(filters).toJSON();
  }

  getCRMForecast(filters = {}) {
    return crmQueryService.getForecast(filters).toJSON();
  }

  getCRMExecutiveSummary(filters = {}) {
    return crmQueryService.getExecutiveSummary(filters).toJSON();
  }

  getCRMPipelineHealth(filters = {}, options = {}) {
    return crmQueryService.getPipelineHealth(filters, options).toJSON();
  }

  getCRMCriticalDeals(filters = {}, options = {}) {
    return crmQueryService.getCriticalDeals(filters, options).toJSON();
  }

  getCRMDealsWithoutNextAction(filters = {}, options = {}) {
    return crmQueryService.getDealsWithoutNextAction(filters, options).toJSON();
  }

  getCRMRiskSignals(filters = {}, options = {}) {
    return crmQueryService.getRiskSignals(filters, options).toJSON();
  }

  getCRMCriticalRiskSignals(filters = {}, options = {}) {
    return crmQueryService.getCriticalRiskSignals(filters, options).toJSON();
  }

  getCRMRiskSignalSummary(filters = {}, options = {}) {
    return crmQueryService.getRiskSignalSummary(filters, options).toJSON();
  }

  getCRMActionPriorities(filters = {}, options = {}) {
    return crmQueryService.getActionPriorities(filters, options).toJSON();
  }

  getCRMUrgentActionPriorities(filters = {}, options = {}) {
    return crmQueryService.getUrgentActionPriorities(filters, options).toJSON();
  }

  getCRMActionPrioritySummary(filters = {}, options = {}) {
    return crmQueryService.getActionPrioritySummary(filters, options).toJSON();
  }

  getCRMManagementBrief(filters = {}, options = {}) {
    return crmQueryService.getManagementBrief(filters, options).toJSON();
  }

  getEnergyCreditsService() {
    if (!this._energyCreditsService) {
      this._energyCreditsService = new EnergyCreditsService();
    }
    return this._energyCreditsService;
  }

  // ── Energy Credits Read Model ──────────────────────────────────────────────

  hydrateEnergyCreditsReadModel(snapshot = {}, options = {}) {
    return energyCreditsReadModel.hydrate(snapshot, options);
  }

  getEnergyCreditsReadModelStats() {
    return energyCreditsReadModel.getStats();
  }

  // ── Energy Credits Queries ─────────────────────────────────────────────────

  queryEnergyCreditsGeneratingUnit(id, options = {}) {
    return energyCreditsQueryService.getGeneratingUnit(id, options).toJSON();
  }

  queryEnergyCreditsBeneficiaryUnit(id, options = {}) {
    return energyCreditsQueryService.getBeneficiaryUnit(id, options).toJSON();
  }

  searchEnergyCreditsGeneratingUnits(filters = {}, options = {}) {
    return energyCreditsQueryService.searchGeneratingUnits(filters, options).toJSON();
  }

  searchEnergyCreditsBeneficiaryUnits(filters = {}, options = {}) {
    return energyCreditsQueryService.searchBeneficiaryUnits(filters, options).toJSON();
  }

  getEnergyCreditsMonthlyStatement(generatingUnitId, referenceMonth, options = {}) {
    return energyCreditsQueryService.getMonthlyStatement(generatingUnitId, referenceMonth, options).toJSON();
  }

  getEnergyCreditsGeneratingUnitHistory(generatingUnitId, filters = {}, options = {}) {
    return energyCreditsQueryService.getGeneratingUnitMonthlyHistory(generatingUnitId, filters, options).toJSON();
  }

  getEnergyCreditsBeneficiaryHistory(beneficiaryUnitId, filters = {}, options = {}) {
    return energyCreditsQueryService.getBeneficiaryMonthlyHistory(beneficiaryUnitId, filters, options).toJSON();
  }

  getEnergyCreditsExecutiveSummary(filters = {}, options = {}) {
    return energyCreditsQueryService.getExecutiveSummary(filters, options).toJSON();
  }

  getEnergyCreditsGeneratingUnitSummary(generatingUnitId, filters = {}, options = {}) {
    return energyCreditsQueryService.getGeneratingUnitSummary(generatingUnitId, filters, options).toJSON();
  }

  getEnergyCreditsBeneficiarySummary(beneficiaryUnitId, filters = {}, options = {}) {
    return energyCreditsQueryService.getBeneficiarySummary(beneficiaryUnitId, filters, options).toJSON();
  }

  getEnergyCreditsFinancialSummary(filters = {}, options = {}) {
    return energyCreditsQueryService.getFinancialSummary(filters, options).toJSON();
  }

  getEnergyCreditsAlertsSummary(filters = {}, options = {}) {
    return energyCreditsQueryService.getAlertsSummary(filters, options).toJSON();
  }

  getSolanaCommercialContext(filters = {}, options = {}) {
    if (!this._solanaContextBuilder) {
      this._solanaContextBuilder = new SolanaCommercialContextBuilder(crmQueryService);
    }
    return this._solanaContextBuilder.generateContext(filters, options);
  }

  // ── Energy Credits Reports ─────────────────────────────────────────────────

  buildEnergyCreditsOwnerMonthlyReport(generatingUnitId, referenceMonth, options = {}) {
    return energyCreditsReportService.buildOwnerMonthlyReport(generatingUnitId, referenceMonth, options).toJSON();
  }

  buildEnergyCreditsBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options = {}) {
    return energyCreditsReportService.buildBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options).toJSON();
  }

  buildEnergyCreditsEsaInternalMonthlyReport(referenceMonth, options = {}) {
    return energyCreditsReportService.buildEsaInternalMonthlyReport(referenceMonth, options).toJSON();
  }

  buildEnergyCreditsEsaFinancialMonthlyReport(referenceMonth, options = {}) {
    return energyCreditsReportService.buildEsaFinancialMonthlyReport(referenceMonth, options).toJSON();
  }

  // ── Energy Credits Repository ──────────────────────────────────────────────

  getEnergyCreditsRepository() {
    return energyCreditsRepository;
  }

  getEnergyCreditsRepositoryStats() {
    return energyCreditsRepository.getStats();
  }

  hydrateEnergyCreditsFromRepository(options = {}) {
    return energyCreditsRepositoryHydrator.hydrateReadModel(options);
  }

  createEnergyCreditsFirebaseRepository(firebaseClient, options = {}) {
    return new EnergyCreditsFirebaseRepository(firebaseClient, options);
  }

  // ── Energy Credits Import ──────────────────────────────────────────────────

  importEnergyCreditsFromCsv(importType, csvText, options = {}) {
    const opts = this._enrichImportOptions(options);
    return energyCreditsImportService.importFromCsv(importType, csvText, opts);
  }

  importEnergyCreditsFromRows(importType, rows, options = {}) {
    const opts = this._enrichImportOptions(options);
    return energyCreditsImportService.importFromRows(importType, rows, opts);
  }

  createEnergyCreditsImportService(mapper = null, validator = null, parser = null) {
    return new EnergyCreditsImportService(mapper, validator, parser);
  }

  _enrichImportOptions(options) {
    const enriched = Object.assign({}, options);
    if (enriched.persist && !enriched.repository) enriched.repository = energyCreditsRepository;
    if (enriched.hydrateReadModel && !enriched.hydrator) enriched.hydrator = energyCreditsRepositoryHydrator;
    return enriched;
  }

  // ── Energy Billing Engine ──────────────────────────────────────────────────

  getEnergyBillingEngine() {
    return energyBillingEngine;
  }

  calculateEnergyBeneficiaryBilling(input = {}) {
    return energyBillingEngine.calculateBeneficiaryBilling(input);
  }

  // ── Energy Credits Allocation & Balance ────────────────────────────────────

  calculateEnergyCreditsConsumptionAverage(input = {}) {
    return consumptionAverageCalculator.calculate(input);
  }

  calculateEnergyCreditsAllocationPlan(input = {}) {
    return creditAllocationPlanner.planAllocation(input);
  }

  calculateEnergyCreditsBeneficiaryBalance(input = {}) {
    return beneficiaryCreditBalanceCalculator.calculate(input);
  }

  getEnergyCreditsBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options = {}) {
    return energyCreditsQueryService.getBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options).toJSON();
  }

  getEnergyCreditsBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters = {}, options = {}) {
    return energyCreditsQueryService.getBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters, options).toJSON();
  }

  getEnergyCreditsAllocationPlan(generatingUnitId, referenceMonth, options = {}) {
    return energyCreditsQueryService.getCreditAllocationPlan(generatingUnitId, referenceMonth, options).toJSON();
  }

  // ── Energy Utility Bill Import ─────────────────────────────────────────────

  _ensureUtilityBillServices() {
    if (!this._utilityBillImportService) {
      this._utilityBillImportService = new UtilityBillImportService();
      this._utilityBillQueryService  = new UtilityBillQueryService(this._utilityBillImportService);
    }
  }

  getEnergyUtilityBillImportService() {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService;
  }

  createEnergyUtilityBillImport(rawExtraction, options = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.createImport(rawExtraction, options);
  }

  matchEnergyUtilityBillImport(importId, beneficiaryUnits, options = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.matchImport(importId, beneficiaryUnits, options);
  }

  linkEnergyUtilityBillToBeneficiary(importId, beneficiaryUnitId, context = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.linkImportToBeneficiary(importId, beneficiaryUnitId, context);
  }

  prepareEnergyCreditsBeneficiaryFromUtilityBill(importId) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.prepareBeneficiaryFromImport(importId);
  }

  reviewEnergyUtilityBillImport(importId, correctedData, options = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.reviewImport(importId, correctedData, options);
  }

  detectEnergyUtilityBillDuplicate(importId, existingMonthlyRecords, options = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.detectDuplicate(importId, existingMonthlyRecords, options);
  }

  confirmEnergyUtilityBillMonthlyRecord(importId, options = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.confirmMonthlyRecord(importId, options);
  }

  replaceEnergyUtilityBillMonthlyRecord(importId, replacementReason, options = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.replaceMonthlyRecord(importId, replacementReason, options);
  }

  discardEnergyUtilityBillImport(importId, options = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillImportService.discardImport(importId, options);
  }

  getEnergyUtilityBillImport(importId) {
    this._ensureUtilityBillServices();
    return this._utilityBillQueryService.getUtilityBillImport(importId);
  }

  searchEnergyUtilityBillImports(filters = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillQueryService.searchUtilityBillImports(filters);
  }

  getUnlinkedEnergyUtilityBills(filters = {}) {
    this._ensureUtilityBillServices();
    return this._utilityBillQueryService.getUnlinkedUtilityBills(filters);
  }

  buildEnergyBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context = {}) {
    return buildBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context);
  }

  // ── Energy Credits Cadastros ───────────────────────────────────────────────

  createEnergyCreditsGeneratingUnit(input, options = {}) {
    const svc    = this.getEnergyCreditsService();
    const result = svc.createGeneratingUnit(input);
    if (!result.ok || !options.persist) return result;
    const repo = options.repository || energyCreditsRepository;
    repo.saveGeneratingUnit(result.data);
    return result;
  }

  createEnergyCreditsBeneficiaryUnit(input, options = {}) {
    const svc    = this.getEnergyCreditsService();
    const result = svc.createBeneficiaryUnit(input);
    if (!result.ok || !options.persist) return result;
    const repo = options.repository || energyCreditsRepository;
    repo.saveBeneficiaryUnit(result.data);
    return result;
  }

  updateEnergyCreditsGeneratingUnit(id, input, options = {}) {
    let existing = options.existing || null;
    if (options.persist) {
      const repo   = options.repository || energyCreditsRepository;
      const loaded = repo.getGeneratingUnit(id);
      if (!loaded.ok || !loaded.data) {
        return { ok: false, data: null, errors: [{ code: 'GU_NOT_FOUND', message: `UG ${id} não encontrada`, field: 'id', metadata: {} }], warnings: [], metadata: {} };
      }
      existing = loaded.data;
    }
    if (!existing) {
      return { ok: false, data: null, errors: [{ code: 'GU_NOT_FOUND', message: `UG ${id} não encontrada. Forneça options.existing para modo preview.`, field: 'id', metadata: {} }], warnings: [], metadata: {} };
    }
    const updated = Object.assign({}, existing, input, { id });
    if (options.persist) {
      const repo = options.repository || energyCreditsRepository;
      repo.saveGeneratingUnit(updated);
    }
    return { ok: true, data: updated, errors: [], warnings: [], metadata: {} };
  }

  updateEnergyCreditsBeneficiaryUnit(id, input, options = {}) {
    let existing = options.existing || null;
    if (options.persist) {
      const repo   = options.repository || energyCreditsRepository;
      const loaded = repo.getBeneficiaryUnit(id);
      if (!loaded.ok || !loaded.data) {
        return { ok: false, data: null, errors: [{ code: 'UB_NOT_FOUND', message: `UB ${id} não encontrada`, field: 'id', metadata: {} }], warnings: [], metadata: {} };
      }
      existing = loaded.data;
    }
    if (!existing) {
      return { ok: false, data: null, errors: [{ code: 'UB_NOT_FOUND', message: `UB ${id} não encontrada. Forneça options.existing para modo preview.`, field: 'id', metadata: {} }], warnings: [], metadata: {} };
    }
    const updated = Object.assign({}, existing, input, { id });
    if (options.persist) {
      const repo = options.repository || energyCreditsRepository;
      repo.saveBeneficiaryUnit(updated);
    }
    return { ok: true, data: updated, errors: [], warnings: [], metadata: {} };
  }

  // ── Energy Credits Commercial Terms ────────────────────────────────────────

  getEnergyCreditsGeneratingUnitCommercialTerms(generatingUnitId, options = {}) {
    let unit = options.existing || null;
    if (!unit) {
      const q = energyCreditsQueryService.getGeneratingUnit(generatingUnitId, options);
      unit = q.data;
    }
    if (!unit) {
      return { ok: false, data: null, errors: [{ code: 'GU_NOT_FOUND', message: `UG ${generatingUnitId} não encontrada`, field: 'generatingUnitId', metadata: {} }], warnings: [], metadata: {} };
    }
    const terms = {
      generatingUnitId,
      purchasePricePerKwh: unit.purchasePricePerKwh || null,
      effectiveFrom:       unit.effectiveFrom       || null,
      notes:               unit.notes               || null,
    };
    return { ok: true, data: terms, errors: [], warnings: [], metadata: {} };
  }

  updateEnergyCreditsGeneratingUnitCommercialTerms(generatingUnitId, input, options = {}) {
    const COMMERCIAL_FIELDS = ['purchasePricePerKwh', 'effectiveFrom', 'notes'];
    const patch = {};
    for (const f of COMMERCIAL_FIELDS) {
      if (input[f] !== undefined) patch[f] = input[f];
    }
    return this.updateEnergyCreditsGeneratingUnit(generatingUnitId, patch, options);
  }

  // ── Energy Credits Settlement Recipient ────────────────────────────────────

  getEnergyCreditsSettlementRecipient(generatingUnitId, options = {}) {
    let unit = options.existing || null;
    if (!unit) {
      const q = energyCreditsQueryService.getGeneratingUnit(generatingUnitId, options);
      unit = q.data;
    }
    if (!unit) {
      return { ok: false, data: null, errors: [{ code: 'GU_NOT_FOUND', message: `UG ${generatingUnitId} não encontrada`, field: 'generatingUnitId', metadata: {} }], warnings: [], metadata: {} };
    }
    const recipient = {
      generatingUnitId,
      recipientName:     unit.recipientName     || unit.ownerName     || null,
      recipientDocument: unit.recipientDocument || unit.ownerDocument || null,
      pixKeyType:        unit.pixKeyType        || null,
      pixKey:            unit.pixKey            || null,
    };
    return { ok: true, data: recipient, errors: [], warnings: [], metadata: {} };
  }

  updateEnergyCreditsSettlementRecipient(generatingUnitId, input, options = {}) {
    const RECIPIENT_FIELDS = ['recipientName', 'recipientDocument', 'pixKeyType', 'pixKey'];
    const patch = {};
    for (const f of RECIPIENT_FIELDS) {
      if (input[f] !== undefined) patch[f] = input[f];
    }
    return this.updateEnergyCreditsGeneratingUnit(generatingUnitId, patch, options);
  }

  // ── Energy Credits Invoice Payment ─────────────────────────────────────────

  confirmEnergyCreditsInvoicePayment(invoiceId, paymentData, options = {}) {
    let invoice = options.invoice || null;
    if (!invoice && options.persist) {
      const repo   = options.repository || energyCreditsRepository;
      const loaded = repo.getEsaInvoice(invoiceId);
      if (!loaded.ok || !loaded.data) {
        return { ok: false, data: null, errors: [{ code: 'INVOICE_NOT_FOUND', message: `Fatura ${invoiceId} não encontrada`, field: 'invoiceId', metadata: {} }], warnings: [], metadata: {} };
      }
      invoice = loaded.data;
    }
    if (!invoice) {
      return { ok: false, data: null, errors: [{ code: 'INVOICE_NOT_FOUND', message: `Fatura ${invoiceId} não encontrada. Forneça options.invoice para modo preview.`, field: 'invoiceId', metadata: {} }], warnings: [], metadata: {} };
    }
    const confirmed = Object.assign({}, invoice, {
      paymentStatus: 'paid',
      paidAt:        paymentData.paidAt        || options.referenceDate || null,
      paidAmount:    paymentData.paidAmount     != null ? paymentData.paidAmount : (invoice.invoiceAmount || null),
      paymentNotes:  paymentData.paymentNotes   || null,
      paymentMethod: paymentData.paymentMethod  || null,
    });
    if (options.persist) {
      const repo = options.repository || energyCreditsRepository;
      repo.saveEsaInvoice(confirmed);
    }
    return { ok: true, data: confirmed, errors: [], warnings: [], metadata: { action: 'invoice.payment.confirmed' } };
  }

  reopenEnergyCreditsInvoicePayment(invoiceId, reason, options = {}) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return { ok: false, data: null, errors: [{ code: 'REOPEN_REASON_REQUIRED', message: 'Motivo de reabertura é obrigatório', field: 'reason', metadata: {} }], warnings: [], metadata: {} };
    }
    let invoice = options.invoice || null;
    if (!invoice && options.persist) {
      const repo   = options.repository || energyCreditsRepository;
      const loaded = repo.getEsaInvoice(invoiceId);
      if (!loaded.ok || !loaded.data) {
        return { ok: false, data: null, errors: [{ code: 'INVOICE_NOT_FOUND', message: `Fatura ${invoiceId} não encontrada`, field: 'invoiceId', metadata: {} }], warnings: [], metadata: {} };
      }
      invoice = loaded.data;
    }
    if (!invoice) {
      return { ok: false, data: null, errors: [{ code: 'INVOICE_NOT_FOUND', message: `Fatura ${invoiceId} não encontrada. Forneça options.invoice para modo preview.`, field: 'invoiceId', metadata: {} }], warnings: [], metadata: {} };
    }
    const reopened = Object.assign({}, invoice, {
      paymentStatus: 'open',
      paidAt:        null,
      paidAmount:    null,
      paymentNotes:  null,
      paymentMethod: null,
      reopenReason:  reason.trim(),
    });
    if (options.persist) {
      const repo = options.repository || energyCreditsRepository;
      repo.saveEsaInvoice(reopened);
    }
    return { ok: true, data: reopened, errors: [], warnings: [], metadata: { action: 'invoice.payment.reopened' } };
  }

  // ── Energy Credits Owner Settlement Payment ────────────────────────────────

  confirmEnergyCreditsOwnerSettlementPayment(settlementId, paymentData, options = {}) {
    let settlement = options.settlement || null;
    if (!settlement && options.persist) {
      const repo   = options.repository || energyCreditsRepository;
      const loaded = repo.getOwnerSettlement(settlementId);
      if (!loaded.ok || !loaded.data) {
        return { ok: false, data: null, errors: [{ code: 'SETTLEMENT_NOT_FOUND', message: `Repasse ${settlementId} não encontrado`, field: 'settlementId', metadata: {} }], warnings: [], metadata: {} };
      }
      settlement = loaded.data;
    }
    if (!settlement) {
      return { ok: false, data: null, errors: [{ code: 'SETTLEMENT_NOT_FOUND', message: `Repasse ${settlementId} não encontrado. Forneça options.settlement para modo preview.`, field: 'settlementId', metadata: {} }], warnings: [], metadata: {} };
    }
    const confirmed = Object.assign({}, settlement, {
      paymentStatus: 'paid',
      paidAt:        paymentData.paidAt       || options.referenceDate || null,
      paidAmount:    paymentData.paidAmount    != null ? paymentData.paidAmount : (settlement.netReturn || null),
      paymentNotes:  paymentData.paymentNotes  || null,
      paymentMethod: paymentData.paymentMethod || null,
    });
    if (options.persist) {
      const repo = options.repository || energyCreditsRepository;
      repo.saveOwnerSettlement(confirmed);
    }
    return { ok: true, data: confirmed, errors: [], warnings: [], metadata: { action: 'settlement.payment.confirmed' } };
  }

  reopenEnergyCreditsOwnerSettlementPayment(settlementId, reason, options = {}) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return { ok: false, data: null, errors: [{ code: 'REOPEN_REASON_REQUIRED', message: 'Motivo de reabertura é obrigatório', field: 'reason', metadata: {} }], warnings: [], metadata: {} };
    }
    let settlement = options.settlement || null;
    if (!settlement && options.persist) {
      const repo   = options.repository || energyCreditsRepository;
      const loaded = repo.getOwnerSettlement(settlementId);
      if (!loaded.ok || !loaded.data) {
        return { ok: false, data: null, errors: [{ code: 'SETTLEMENT_NOT_FOUND', message: `Repasse ${settlementId} não encontrado`, field: 'settlementId', metadata: {} }], warnings: [], metadata: {} };
      }
      settlement = loaded.data;
    }
    if (!settlement) {
      return { ok: false, data: null, errors: [{ code: 'SETTLEMENT_NOT_FOUND', message: `Repasse ${settlementId} não encontrado. Forneça options.settlement para modo preview.`, field: 'settlementId', metadata: {} }], warnings: [], metadata: {} };
    }
    const reopened = Object.assign({}, settlement, {
      paymentStatus: 'open',
      paidAt:        null,
      paidAmount:    null,
      paymentNotes:  null,
      paymentMethod: null,
      reopenReason:  reason.trim(),
    });
    if (options.persist) {
      const repo = options.repository || energyCreditsRepository;
      repo.saveOwnerSettlement(reopened);
    }
    return { ok: true, data: reopened, errors: [], warnings: [], metadata: { action: 'settlement.payment.reopened' } };
  }

  // ── Energy Credits CSV Template ────────────────────────────────────────────

  getEnergyCreditsCsvTemplate(importType, options = {}) {
    return energyCreditsCsvTemplateService.getTemplate(importType, options);
  }

  // ── Energy Credits Beneficiary Queries ────────────────────────────────────

  getEnergyCreditsBeneficiaryConsumptionAverage(beneficiaryUnitId, filters = {}, options = {}) {
    return energyCreditsQueryService.getBeneficiaryConsumptionAverage(beneficiaryUnitId, filters, options).toJSON();
  }

  getEnergyCreditsBeneficiaryMonthlyDataSources(beneficiaryUnitId, referenceMonth, options = {}) {
    this._ensureUtilityBillServices();
    const historyResult  = energyCreditsQueryService.getBeneficiaryMonthlyHistory(beneficiaryUnitId, referenceMonth ? { referenceMonth } : {}, options).toJSON();
    const importsResult  = this._utilityBillQueryService.searchUtilityBillImports({ beneficiaryUnitId, referenceMonth });
    const monthlyRecords = Array.isArray(historyResult.data) ? historyResult.data : [];
    const utilityBillImports = (importsResult.ok && Array.isArray(importsResult.data)) ? importsResult.data : [];
    return {
      data:     { monthlyRecords, utilityBillImports },
      metadata: { beneficiaryUnitId, referenceMonth, monthlyRecordCount: monthlyRecords.length, utilityBillImportCount: utilityBillImports.length },
      generatedAt: options.referenceDate || null,
    };
  }

  // ── Energy Credits UI Provider ─────────────────────────────────────────────

  getEnergyCreditsUIProvider(options = {}) {
    return new EnergyCreditsUIProvider(this);
  }

}

export const ESA = new ESAApplication();
