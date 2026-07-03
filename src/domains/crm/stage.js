/**
 * ESA OS — CRM Domain
 * Stage
 *
 * Representa uma etapa dentro de um Pipeline.
 * Cada Stage define uma posição no fluxo comercial pela qual um Deal percorre.
 *
 * Responsabilidades:
 * - Modelar os atributos de uma etapa de funil
 * - Definir a ordem de exibição (order) dentro do Pipeline
 * - Classificar a natureza da etapa (aberta, ganha, perdida)
 * - Prover critérios de transição entre etapas (gates futuros)
 *
 * Etapas padronizadas do CRM ESA OS:
 *   Lead → Qualificação → Diagnóstico → Proposta → Negociação
 *   → Fechado Ganho | Fechado Perdido
 *
 * Cada Pipeline pode customizar nomes, adicionar ou remover etapas
 * intermediárias, mas os tipos Terminal (WON / LOST) são obrigatórios.
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O legado define etapas como arrays de strings por funil (CRM_FUNIS).
 * Esta arquitetura substitui esse modelo por entidades estruturadas.
 */

/**
 * Tipos possíveis de Stage, determinando o comportamento no Pipeline.
 *
 * TODO: Adicionar tipo PAUSED quando suporte a deals pausados for implementado
 */
export const STAGE_TYPE = {
  /** Etapa ativa — Deal em progressão normal */
  OPEN: 'open',
  /** Etapa terminal positiva — Deal fechado com sucesso */
  WON: 'won',
  /** Etapa terminal negativa — Deal perdido ou descartado */
  LOST: 'lost',
};

/**
 * Catálogo de etapas padrão do CRM ESA OS.
 * Representa o funil genérico base. Cada Pipeline pode derivar variações.
 *
 * TODO: Persistir catálogo no banco e permitir criação via painel de admin
 * TODO: Suportar etapas obrigatórias (não puláveis) via flag `required`
 */
export const DEFAULT_STAGES = [
  { id: 'lead',           label: 'Lead',              order: 1, type: STAGE_TYPE.OPEN },
  { id: 'qualification',  label: 'Qualificação',      order: 2, type: STAGE_TYPE.OPEN },
  { id: 'diagnosis',      label: 'Diagnóstico',       order: 3, type: STAGE_TYPE.OPEN },
  { id: 'proposal',       label: 'Proposta',          order: 4, type: STAGE_TYPE.OPEN },
  { id: 'negotiation',    label: 'Negociação',        order: 5, type: STAGE_TYPE.OPEN },
  { id: 'closed_won',     label: 'Fechado Ganho',     order: 6, type: STAGE_TYPE.WON  },
  { id: 'closed_lost',    label: 'Fechado Perdido',   order: 7, type: STAGE_TYPE.LOST },
];

/**
 * Representa uma etapa de funil no CRM ESA OS.
 */
export class Stage {
  /**
   * @param {string} id          - Identificador único da etapa (ex: 'proposal')
   * @param {string} label       - Nome exibível (ex: 'Proposta')
   * @param {number} order       - Posição no Pipeline (1 = primeira)
   * @param {string} type        - Tipo: STAGE_TYPE.OPEN | WON | LOST
   * @param {string} pipelineId  - ID do Pipeline ao qual pertence
   * @param {Object} config      - Configurações específicas da etapa
   */
  constructor(id, label, order, type = STAGE_TYPE.OPEN, pipelineId = '', config = {}) {
    this.id = id;
    this.label = label;
    this.order = order;
    this.type = type;
    this.pipelineId = pipelineId;
    this.config = config;
  }

  /**
   * Verifica se esta etapa é uma etapa terminal (WON ou LOST).
   * @returns {boolean}
   *
   * TODO: Disparar evento 'stage:terminal-reached' quando Deal chegar aqui
   */
  isTerminal() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se esta etapa representa um Deal ganho.
   * @returns {boolean}
   */
  isWon() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se esta etapa representa um Deal perdido.
   * @returns {boolean}
   */
  isLost() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se a transição para a etapa alvo é permitida.
   * @param {Stage} targetStage
   * @returns {boolean}
   *
   * TODO: Implementar gates de transição (ex: exigir Proposta antes de Negociação)
   * TODO: Suportar transição reversa (regressão de etapa) com log de motivo
   */
  canTransitionTo(targetStage) {
    // TODO: implementar lógica de gates e regras de transição
    return false;
  }

  /**
   * Serializa a Stage para objeto plano.
   * @returns {Object}
   *
   * TODO: Integrar com StageRepository
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói uma Stage a partir de objeto serializado.
   * @param {Object} data
   * @returns {Stage}
   *
   * TODO: Validar campos obrigatórios e tipo antes de instanciar
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Stage('', '', 0);
  }
}
