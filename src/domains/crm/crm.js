/**
 * ESA OS — CRM Domain
 * CRM (Domain Facade)
 *
 * Classe principal e fachada pública do domínio CRM.
 * É o ponto de entrada único para qualquer consumidor externo
 * que precise interagir com o CRM ESA OS.
 *
 * Responsabilidades:
 * - Inicializar e coordenar todos os componentes do domínio CRM
 * - Expor a API de alto nível do CRM (casos de uso, não entidades brutas)
 * - Encapsular complexidade interna atrás de métodos semânticos
 * - Gerenciar o ciclo de vida do domínio (init, shutdown)
 * - Servir como intermediário entre UI e lógica de domínio
 *
 * Padrão aplicado: Facade
 * Consumidores nunca importam diretamente de deal.js, pipeline.js, etc.
 * Sempre importam de index.js e interagem via instância da classe CRM.
 *
 * Exemplo de uso futuro:
 *   import { crm } from '@/domains/crm';
 *   const deals = await crm.getOpenDeals('venda-ufv');
 *   await crm.moveDeal(dealId, 'negotiation');
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Nenhum método desta classe altera dados do sistema legado.
 */

import { CRMRepository }  from './repository.js';
import { CRMMetrics }     from './metrics.js';

/**
 * Fachada do domínio CRM.
 * Coordena Repository, Metrics e entidades do domínio.
 */
export class CRM {

  constructor() {
    /** @type {CRMRepository} */
    this.repository = new CRMRepository();

    /** @type {CRMMetrics} */
    this.metrics = new CRMMetrics();

    /** @type {boolean} */
    this.initialized = false;

    // TODO: Adicionar referência ao EventBus quando implementado
    // TODO: Adicionar referência ao CacheService quando implementado
  }

  /**
   * Inicializa o domínio CRM: carrega configurações e pipelines.
   * @returns {Promise<void>}
   *
   * TODO: Carregar pipelines via this.repository.getPipelines()
   * TODO: Registrar listeners de eventos de domínio (deal:won, deal:stage-changed)
   * TODO: Integrar com Identity domain para validar permissões na inicialização
   */
  async initialize() {
    // TODO: implementar
    console.log('[ESA CRM] Domain CRM inicializado (modo stub).');
    this.initialized = true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASOS DE USO — DEALS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Cria um novo Deal em um Pipeline.
   * @param {Object} data      - Dados do Deal (vide Deal constructor)
   * @param {string} createdBy - UID da Person criando o Deal
   * @returns {Promise<Deal>}
   *
   * TODO: Validar dados via DealValidator
   * TODO: Verificar permissão CRM_WRITE via Identity domain
   * TODO: Persistir via this.repository.saveDeal()
   * TODO: Disparar evento 'deal:created'
   */
  async createDeal(data, createdBy) {
    // TODO: implementar
    return null;
  }

  /**
   * Retorna todos os deals abertos de um Pipeline.
   * @param {string} pipelineId
   * @returns {Promise<Deal[]>}
   *
   * TODO: Verificar permissão CRM_READ
   * TODO: Filtrar por DEAL_STATUS.OPEN
   * TODO: Aplicar filtro por responsável se Person não for gestão
   */
  async getOpenDeals(pipelineId) {
    // TODO: implementar
    return [];
  }

  /**
   * Move um Deal para outra Stage.
   * @param {string} dealId
   * @param {string} targetStageId
   * @param {string} movedBy
   * @returns {Promise<void>}
   *
   * TODO: Validar transição via Stage.canTransitionTo()
   * TODO: Registrar movimentação no histórico do Deal
   * TODO: Recalcular probability após mudança de etapa
   */
  async moveDeal(dealId, targetStageId, movedBy) {
    // TODO: implementar
  }

  /**
   * Fecha um Deal como ganho.
   * @param {string} dealId
   * @param {number} finalValue
   * @param {string} closedBy
   * @returns {Promise<void>}
   *
   * TODO: Chamar deal.close() e persistir
   * TODO: Disparar evento 'deal:won' para atualizar métricas e metas
   */
  async closeDealAsWon(dealId, finalValue, closedBy) {
    // TODO: implementar
  }

  /**
   * Fecha um Deal como perdido.
   * @param {string} dealId
   * @param {string} reason
   * @param {string} lostBy
   * @returns {Promise<void>}
   *
   * TODO: Chamar deal.markAsLost() e persistir
   * TODO: Disparar evento 'deal:lost' para atualizar métricas
   */
  async closeDealAsLost(dealId, reason, lostBy) {
    // TODO: implementar
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASOS DE USO — FOLLOW-UPS E ACTIVITIES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Registra um follow-up em um Deal.
   * @param {string} dealId
   * @param {Object} data      - Dados do FollowUp
   * @param {string} createdBy - UID da Person
   * @returns {Promise<FollowUp>}
   *
   * TODO: Verificar permissão CRM_WRITE
   * TODO: Persistir via this.repository.saveFollowUp()
   * TODO: Se followup.isWon() ou isLost(), atualizar status do Deal automaticamente
   */
  async addFollowUp(dealId, data, createdBy) {
    // TODO: implementar
    return null;
  }

  /**
   * Registra uma atividade em um Deal.
   * @param {string} dealId
   * @param {Object} data
   * @param {string} createdBy
   * @returns {Promise<Activity>}
   *
   * TODO: Verificar permissão CRM_WRITE
   * TODO: Persistir via this.repository.saveActivity()
   */
  async addActivity(dealId, data, createdBy) {
    // TODO: implementar
    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASOS DE USO — PIPELINES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Retorna todos os Pipelines ativos.
   * @returns {Promise<Pipeline[]>}
   *
   * TODO: Verificar permissão CRM_READ
   * TODO: Cachear resultado para evitar fetches repetidos
   */
  async getPipelines() {
    // TODO: implementar
    return [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASOS DE USO — MÉTRICAS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Retorna snapshot de indicadores de todos os Pipelines.
   * @param {string} period - METRICS_PERIOD.*
   * @returns {Promise<PipelineSnapshot[]>}
   *
   * TODO: Verificar permissão INDICATORS_CRM (apenas gestão)
   * TODO: Usar CRMMetrics.buildAllPipelineSnapshots()
   */
  async getMetrics(period) {
    // TODO: implementar
    return [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASOS DE USO — IMPORTAÇÃO
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Importa Deals a partir de dados CSV parseados.
   * @param {Object[]} rows       - Linhas do CSV já mapeadas
   * @param {string}   pipelineId - Pipeline de destino
   * @param {string}   stageId    - Stage padrão para linhas sem stage definida
   * @param {string}   importedBy - UID da Person importando
   * @returns {Promise<{ imported: number, errors: string[] }>}
   *
   * TODO: Validar cada linha antes de persistir
   * TODO: Usar this.repository.bulkImportDeals() para persistência em lote
   */
  async importDealsFromCSV(rows, pipelineId, stageId, importedBy) {
    // TODO: implementar
    return { imported: 0, errors: [] };
  }
}
