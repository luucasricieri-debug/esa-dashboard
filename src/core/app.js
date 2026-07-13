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

class ESAApplication {

  constructor() {
    this.version                  = '2.0.0-alpha';
    this.firebase                 = new FirebaseService();
    this.crmLegacyBridge          = null;
    this.crmReadModelHydrator     = null;
    this._solanaContextBuilder    = null;
    this._energyCreditsService    = null;
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

}

export const ESA = new ESAApplication();
