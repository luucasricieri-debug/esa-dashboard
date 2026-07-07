/**
 * ESA OS — Integrations
 * Barrel export + singleton
 *
 * Ponto de entrada público da camada de integrações da ESA OS.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { integrationRegistry, CRMAuditIntegration } from 'src/integrations/index.js'
 *
 * As integrações NÃO são iniciadas automaticamente.
 * O bootstrap da aplicação é responsável por chamar:
 *   integrationRegistry.startAll()
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

export { CRMEventMapper }       from './crm-event-mapper.js';
export { CRMAuditIntegration }  from './crm-audit-integration.js';
export { IntegrationRegistry }  from './integration-registry.js';

import { IntegrationRegistry }  from './integration-registry.js';

/**
 * Singleton do registro de integrações da plataforma ESA OS.
 * Use este objeto para registrar e controlar integrações em toda a plataforma.
 *
 * Integrações NÃO são pré-registradas aqui — o bootstrap de cada módulo
 * registra as integrações que precisa após inicializar suas dependências.
 *
 * @type {IntegrationRegistry}
 */
export const integrationRegistry = new IntegrationRegistry();
