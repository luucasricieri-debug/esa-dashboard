/**
 * ESA OS — CRM Domain
 * Public API (Barrel Export)
 *
 * Ponto de entrada único do domínio CRM.
 * Consumidores externos devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { CRM, Deal, Pipeline, Stage, DEAL_STATUS, PIPELINE_VALUE_UNIT } from '@/domains/crm';
 *   import { crm } from '@/domains/crm';   // instância singleton
 *
 * Responsabilidades:
 * - Re-exportar todas as classes e enums públicos do domínio
 * - Expor a instância singleton da fachada CRM
 * - Manter a API pública estável enquanto os internals evoluem
 * - Não conter lógica de negócio — apenas exports e singleton
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Nenhum código do index.html importa ou depende deste módulo.
 *
 * TODO: Adicionar exports de eventos do domínio (DomainEvent) quando CQRS for adotado
 * TODO: Adicionar exports de validators quando implementados
 * TODO: Versionar a API pública com CHANGELOG ao estabilizar
 */

// ─── Entidades ──────────────────────────────────────────────────────────────
export { Deal, DEAL_STATUS, DEAL_ORIGIN }                           from './deal.js';
export { Pipeline, PIPELINE_VALUE_UNIT }                            from './pipeline.js';
export { Stage, STAGE_TYPE, DEFAULT_STAGES }                        from './stage.js';
export { Activity, ACTIVITY_TYPE, ACTIVITY_STATUS }                 from './activity.js';
export { FollowUp, FOLLOWUP_STATUS, FOLLOWUP_TYPE }                 from './followup.js';
export { Proposal, PROPOSAL_STATUS, PROPOSAL_TYPE }                 from './proposal.js';

// ─── Infraestrutura de domínio ───────────────────────────────────────────────
export { CRMRepository }                                            from './repository.js';
export { CRMMetrics, PipelineSnapshot, METRICS_PERIOD }             from './metrics.js';

// ─── Fachada e singleton ─────────────────────────────────────────────────────
import { CRM } from './crm.js';

export { CRM };

/**
 * Instância singleton da fachada CRM.
 * Use esta instância na aplicação ao invés de instanciar CRM diretamente.
 *
 * TODO: Inicializar via ESAApplication.initialize() no bootstrap
 * TODO: Injetar dependências (repository adapter, event bus) antes de usar
 */
export const crm = new CRM();
