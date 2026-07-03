/**
 * ESA OS — CRM Domain
 * Pipeline
 *
 * Representa um funil de vendas completo no CRM ESA OS.
 * Agrupa Stages ordenadas e define o fluxo que um Deal percorre.
 *
 * Responsabilidades:
 * - Modelar um funil com suas etapas ordenadas
 * - Gerenciar o conjunto de Deals ativos em cada Stage
 * - Prover indicadores de volume e valor por etapa
 * - Suportar múltiplos pipelines simultâneos por organização
 * - Permitir customização de nomes e ordem de etapas
 *
 * Pipelines mapeados do Dashboard legado (referência para migração):
 *   venda_ufv         → Venda UFV           (9 etapas)
 *   eletromobilidade  → Eletromobilidade    (9 etapas)
 *   copel             → Análise Copel       (11 etapas)
 *   assinatura_energia→ Assinatura Energia  (8 etapas, valor em kWh)
 *   pre_vendas        → Pré-vendas          (6 etapas)
 *   om                → Funil O&M           (7 etapas)
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * A migração dos funis legados para esta estrutura será feita
 * em etapa futura pelo PipelineMigrationService.
 */

import { DEFAULT_STAGES } from './stage.js';

/**
 * Unidade de valor padrão para cada tipo de pipeline.
 *
 * TODO: Mover para configuração de Pipeline ao invés de hardcode
 */
export const PIPELINE_VALUE_UNIT = {
  BRL: 'BRL',   // Reais — padrão para todos os pipelines, exceto assinatura
  KWH: 'kWh',   // Quilowatt-hora — usado em Assinatura de Energia
};

/**
 * Representa um funil de vendas no CRM ESA OS.
 */
export class Pipeline {
  /**
   * @param {string}   id           - Identificador único do pipeline (ex: 'venda-ufv')
   * @param {string}   name         - Nome exibível (ex: 'Venda UFV')
   * @param {number}   order        - Posição de exibição na lista de pipelines
   * @param {Stage[]}  stages       - Etapas ordenadas do funil
   * @param {string}   valueUnit    - Unidade de valor: PIPELINE_VALUE_UNIT.*
   * @param {boolean}  active       - Se false, pipeline está arquivado
   * @param {Object}   config       - Configurações específicas do pipeline
   */
  constructor(
    id,
    name,
    order = 0,
    stages = [],
    valueUnit = PIPELINE_VALUE_UNIT.BRL,
    active = true,
    config = {}
  ) {
    this.id = id;
    this.name = name;
    this.order = order;
    this.stages = stages;
    this.valueUnit = valueUnit;
    this.active = active;
    this.config = config;
  }

  /**
   * Retorna as etapas ordenadas por `order` ascendente.
   * @returns {Stage[]}
   *
   * TODO: Memoizar resultado para evitar re-sorting em cada chamada
   */
  getOrderedStages() {
    // TODO: implementar sort por stage.order
    return [];
  }

  /**
   * Busca uma Stage pelo id dentro deste Pipeline.
   * @param {string} stageId
   * @returns {Stage | null}
   */
  findStage(stageId) {
    // TODO: implementar
    return null;
  }

  /**
   * Retorna as etapas abertas (tipo OPEN), excluindo terminais.
   * @returns {Stage[]}
   *
   * TODO: Usar na renderização do Kanban para exibir apenas colunas ativas
   */
  getOpenStages() {
    // TODO: implementar filtro por STAGE_TYPE.OPEN
    return [];
  }

  /**
   * Adiciona uma nova Stage ao Pipeline.
   * @param {Stage} stage
   *
   * TODO: Validar que o id da stage é único dentro do pipeline
   * TODO: Recalcular order de todas as stages após inserção
   * TODO: Persistir alteração via PipelineRepository
   */
  addStage(stage) {
    // TODO: implementar
  }

  /**
   * Remove uma Stage do Pipeline pelo id.
   * @param {string} stageId
   *
   * TODO: Bloquear remoção se houver Deals ativos nesta Stage
   * TODO: Permitir migração dos Deals para outra Stage antes de remover
   */
  removeStage(stageId) {
    // TODO: implementar
  }

  /**
   * Renomeia uma Stage existente.
   * @param {string} stageId
   * @param {string} newLabel
   *
   * TODO: Registrar histórico de renomeações para auditoria
   * TODO: Sincronizar com legado via PipelineMigrationService durante migração
   */
  renameStage(stageId, newLabel) {
    // TODO: implementar
  }

  /**
   * Reordena as Stages a partir de um array de ids na nova ordem desejada.
   * @param {string[]} orderedStageIds
   *
   * TODO: Atualizar o campo `order` de cada Stage e persistir
   */
  reorderStages(orderedStageIds) {
    // TODO: implementar
  }

  /**
   * Retorna o total de Deals em andamento neste Pipeline.
   * @param {Deal[]} deals - Deals já filtrados para este pipeline
   * @returns {number}
   *
   * TODO: Receber deals via injeção ao invés de parâmetro
   */
  countActiveDeals(deals = []) {
    // TODO: implementar
    return 0;
  }

  /**
   * Retorna o valor total em negociação (deals com status OPEN).
   * @param {Deal[]} deals
   * @returns {{ amount: number, unit: string }}
   *
   * TODO: Usar deal.getEffectiveValue() para respeitar a unidade do pipeline
   */
  getTotalValue(deals = []) {
    // TODO: implementar
    return { amount: 0, unit: this.valueUnit };
  }

  /**
   * Verifica se o Pipeline usa kWh como unidade de valor.
   * @returns {boolean}
   */
  isKwhPipeline() {
    // TODO: implementar
    return false;
  }

  /**
   * Serializa o Pipeline para objeto plano.
   * @returns {Object}
   *
   * TODO: Integrar com PipelineRepository
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói um Pipeline a partir de objeto serializado.
   * @param {Object} data
   * @returns {Pipeline}
   *
   * TODO: Reidratar stages a partir dos ids
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Pipeline('', '');
  }

  /**
   * Cria um Pipeline com as etapas padrão do CRM ESA OS.
   * @param {string} id
   * @param {string} name
   * @returns {Pipeline}
   *
   * TODO: Usar como fábrica para novos pipelines criados via painel de admin
   */
  static createDefault(id, name) {
    // TODO: implementar instanciando DEFAULT_STAGES
    return new Pipeline(id, name, 0, []);
  }
}
