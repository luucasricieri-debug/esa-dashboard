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

class ESAApplication {

  constructor() {
    this.version                = '2.0.0-alpha';
    this.firebase               = new FirebaseService();
    this.crmLegacyBridge        = null;
    this.crmReadModelHydrator   = null;
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

}

export const ESA = new ESAApplication();
