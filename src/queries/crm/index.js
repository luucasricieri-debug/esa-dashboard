/**
 * ESA OS — Queries / CRM
 * Public API (Barrel Export + Singleton)
 *
 * Ponto de entrada público do CRM Query Service.
 * Consumidores devem importar exclusivamente deste arquivo.
 *
 * Singleton exportado:
 *   crmQueryService — camada de consulta gerencial somente leitura
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O singleton usa os mesmos crmReadModel e crmMetrics do Read Model CRM.
 */

export { CRMQueryService }      from './crm-query-service.js';
export { CRMQueryResult }       from './crm-query-result.js';
export { CRMPipelineAnalyzer,
         AGING_THRESHOLDS }     from './crm-pipeline-analyzer.js';

import { CRMQueryService }          from './crm-query-service.js';
import { crmReadModel, crmMetrics } from '../../read-models/crm/index.js';

/**
 * Singleton do CRM Query Service da plataforma ESA OS.
 * Usa os singletons crmReadModel e crmMetrics como fonte.
 * @type {CRMQueryService}
 */
export const crmQueryService = new CRMQueryService(crmReadModel, crmMetrics);
