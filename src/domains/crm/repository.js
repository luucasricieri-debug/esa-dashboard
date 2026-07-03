/**
 * ESA OS — CRM Domain
 * CRMRepository
 *
 * Camada de acesso a dados do domínio CRM.
 * Define o contrato de persistência para todas as entidades do CRM.
 *
 * Responsabilidades:
 * - Abstrair o mecanismo de persistência das entidades de domínio
 * - Prover interface uniforme para operações CRUD em: Deal, Pipeline,
 *   Stage, Activity, FollowUp e Proposal
 * - Ser o único ponto de contato entre o domínio e a camada de dados
 * - Preparar a estrutura para implementação com Firebase RTDB
 *
 * Estratégia de migração:
 *   Fase 1 (atual): todos os métodos são stubs — sem implementação
 *   Fase 2: implementação com Firebase RTDB (espelhando paths do legado)
 *   Fase 3: migração para Firebase Firestore com regras de segurança
 *
 * Paths do legado Firebase que serão mapeados (referência):
 *   crm/deals/{id}                        → Deal
 *   crm/deals/{id}/historico/{key}        → FollowUp
 *   crm/funis/{funilKey}/etapas           → Stage (nomes customizados)
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * NÃO usa Firebase. NÃO altera nenhuma regra comercial existente.
 */

/**
 * Contrato de persistência para o domínio CRM.
 * Todos os métodos são stubs aguardando implementação.
 */
export class CRMRepository {

  constructor() {
    // TODO: Receber adapter de persistência via injeção de dependência
    // TODO: Suportar FirebaseAdapter, InMemoryAdapter (testes) e MockAdapter
    this._adapter = null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DEALS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Busca um Deal pelo id.
   * @param {string} id
   * @returns {Promise<Deal | null>}
   *
   * TODO: Implementar via fbGet('crm/deals/' + id)
   * TODO: Mapear resultado para instância de Deal via Deal.fromJSON()
   */
  async getDeal(id) {
    // TODO: implementar
    return null;
  }

  /**
   * Busca todos os Deals de um Pipeline.
   * @param {string} pipelineId
   * @returns {Promise<Deal[]>}
   *
   * TODO: Implementar com filtro por pipelineId
   * TODO: Suportar paginação para pipelines com muitos deals
   */
  async getDealsByPipeline(pipelineId) {
    // TODO: implementar
    return [];
  }

  /**
   * Busca todos os Deals sob responsabilidade de uma Person.
   * @param {string} responsibleUid
   * @returns {Promise<Deal[]>}
   *
   * TODO: Implementar índice secundário por responsibleUid
   */
  async getDealsByResponsible(responsibleUid) {
    // TODO: implementar
    return [];
  }

  /**
   * Persiste um Deal (cria ou atualiza).
   * @param {Deal} deal
   * @returns {Promise<void>}
   *
   * TODO: Implementar via fbSet('crm/deals/' + deal.id, deal.toJSON())
   * TODO: Validar o Deal antes de salvar
   */
  async saveDeal(deal) {
    // TODO: implementar
  }

  /**
   * Remove um Deal pelo id.
   * @param {string} id
   * @returns {Promise<void>}
   *
   * TODO: Soft delete — marcar como deletado ao invés de remover fisicamente
   * TODO: Verificar permissão antes de deletar
   */
  async deleteDeal(id) {
    // TODO: implementar
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FOLLOW-UPS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Busca todos os FollowUps de um Deal.
   * @param {string} dealId
   * @returns {Promise<FollowUp[]>}
   *
   * TODO: Implementar via fbGet('crm/deals/' + dealId + '/historico')
   * TODO: Ordenar por createdAt ascendente (cronológico)
   */
  async getFollowUpsByDeal(dealId) {
    // TODO: implementar
    return [];
  }

  /**
   * Persiste um FollowUp vinculado a um Deal.
   * @param {FollowUp} followup
   * @returns {Promise<void>}
   *
   * TODO: Implementar via fbSet('crm/deals/' + followup.dealId + '/historico/' + followup.id)
   */
  async saveFollowUp(followup) {
    // TODO: implementar
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ACTIVITIES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Busca todas as Activities de um Deal.
   * @param {string} dealId
   * @returns {Promise<Activity[]>}
   *
   * TODO: Implementar via fbGet('crm/deals/' + dealId + '/activities')
   */
  async getActivitiesByDeal(dealId) {
    // TODO: implementar
    return [];
  }

  /**
   * Busca Activities pendentes de um responsável (para painel de tarefas futuro).
   * @param {string} responsibleUid
   * @returns {Promise<Activity[]>}
   *
   * TODO: Filtrar por status = SCHEDULED e ordenar por scheduledAt
   */
  async getPendingActivitiesByResponsible(responsibleUid) {
    // TODO: implementar
    return [];
  }

  /**
   * Persiste uma Activity vinculada a um Deal.
   * @param {Activity} activity
   * @returns {Promise<void>}
   *
   * TODO: Implementar via fbSet('crm/deals/' + activity.dealId + '/activities/' + activity.id)
   */
  async saveActivity(activity) {
    // TODO: implementar
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PIPELINES E STAGES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Busca todos os Pipelines da organização.
   * @returns {Promise<Pipeline[]>}
   *
   * TODO: Implementar via fbGet('crm/pipelines')
   * TODO: Filtrar pipelines arquivados (active = false) por padrão
   */
  async getPipelines() {
    // TODO: implementar
    return [];
  }

  /**
   * Busca um Pipeline pelo id.
   * @param {string} pipelineId
   * @returns {Promise<Pipeline | null>}
   *
   * TODO: Incluir stages na resposta (join ou fetch separado)
   */
  async getPipeline(pipelineId) {
    // TODO: implementar
    return null;
  }

  /**
   * Persiste um Pipeline e suas Stages.
   * @param {Pipeline} pipeline
   * @returns {Promise<void>}
   *
   * TODO: Implementar via fbSet('crm/pipelines/' + pipeline.id, pipeline.toJSON())
   * TODO: Persistir stages em lote
   */
  async savePipeline(pipeline) {
    // TODO: implementar
  }

  /**
   * Atualiza o nome de uma Stage em um Pipeline.
   * @param {string} pipelineId
   * @param {string} stageId
   * @param {string} newLabel
   * @returns {Promise<void>}
   *
   * TODO: Implementar via fbPatch('crm/pipelines/' + pipelineId + '/stages/' + stageId)
   * TODO: Durante migração, espelhar também em crm/funis/{funilKey}/etapas para compatibilidade legada
   */
  async updateStageLabel(pipelineId, stageId, newLabel) {
    // TODO: implementar
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PROPOSALS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Busca todas as Proposals de um Deal.
   * @param {string} dealId
   * @returns {Promise<Proposal[]>}
   *
   * TODO: Implementar via fbGet('crm/deals/' + dealId + '/proposals')
   * TODO: Ordenar por version descendente (mais recente primeiro)
   */
  async getProposalsByDeal(dealId) {
    // TODO: implementar
    return [];
  }

  /**
   * Persiste uma Proposal.
   * @param {Proposal} proposal
   * @returns {Promise<void>}
   *
   * TODO: Implementar via fbSet('crm/deals/' + proposal.dealId + '/proposals/' + proposal.id)
   */
  async saveProposal(proposal) {
    // TODO: implementar
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BULK / IMPORT
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Importa múltiplos Deals em lote (ex: via CSV).
   * @param {Deal[]} deals
   * @returns {Promise<{ imported: number, errors: string[] }>}
   *
   * TODO: Implementar importação em batches para evitar timeout
   * TODO: Validar cada Deal antes de persistir e coletar erros individuais
   */
  async bulkImportDeals(deals) {
    // TODO: implementar
    return { imported: 0, errors: [] };
  }
}
