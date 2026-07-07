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
import { integrationRegistry,
         CRMAuditIntegration }   from '../integrations/index.js';
import { CRMLegacyEventBridge }  from '../legacy/crm-event-bridge.js';

class ESAApplication {

  constructor() {
    this.version         = '2.0.0-alpha';
    this.firebase        = new FirebaseService();
    this.crmLegacyBridge = null;
  }

  initialize() {

    console.log('==================================');
    console.log('ESA OS');
    console.log('Versão:', this.version);
    console.log('Inicializando plataforma...');
    console.log('==================================');

    this.firebase.initialize();

    // Registrar CRMAuditIntegration (idempotente — seguro se initialize() for chamado novamente)
    if (!integrationRegistry.get('crmAudit')) {
      integrationRegistry.register('crmAudit', new CRMAuditIntegration(eventBus, audit));
    }
    if (!integrationRegistry.get('crmAudit').isStarted()) {
      integrationRegistry.start('crmAudit');
    }

    // Bridge para código legado — exposto via window.ESA_OS.crmLegacyBridge
    if (!this.crmLegacyBridge) {
      this.crmLegacyBridge = new CRMLegacyEventBridge(eventBus);
    }

    console.log('ESA OS iniciada com sucesso.');

  }

}

export const ESA = new ESAApplication();
