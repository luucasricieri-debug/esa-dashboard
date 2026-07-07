/**
 * ESA OS — Read Models / CRM
 * Public API (Barrel Export + Singletons)
 *
 * Ponto de entrada público do Read Model CRM.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Singletons exportados:
 *   crmReadModel — projeção em memória dos Deals CRM
 *   crmMetrics   — métricas derivadas sobre crmReadModel
 *
 * A integração com o Event Bus NÃO é iniciada automaticamente.
 * O bootstrap da aplicação é responsável por instanciar e iniciar
 * CRMReadModelIntegration com eventBus e crmReadModel injetados.
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

export { CRMReadModel }            from './crm-read-model.js';
export { CRMReadModelIntegration } from './crm-read-model-integration.js';
export { CRMMetrics }              from './crm-metrics.js';

import { CRMReadModel } from './crm-read-model.js';
import { CRMMetrics }   from './crm-metrics.js';

/**
 * Singleton do Read Model CRM da plataforma ESA OS.
 * @type {CRMReadModel}
 */
export const crmReadModel = new CRMReadModel();

/**
 * Singleton de métricas CRM — usa crmReadModel como fonte.
 * @type {CRMMetrics}
 */
export const crmMetrics = new CRMMetrics(crmReadModel);
