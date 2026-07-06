/**
 * ESA OS — Operations Domain
 * SLA
 *
 * Modela um Acordo de Nível de Serviço aplicado a WorkOrders.
 *
 * Responsabilidades:
 * - Definir prazos de resposta, início e resolução
 * - Calcular deadlines a partir de uma WorkOrder
 * - Identificar risco e violação de SLA
 * - Suportar alertas proativos de operação
 *
 * Termos:
 *   Response Time  — tempo máximo para aceitar e despachar equipe após abertura
 *   Start Time     — tempo máximo para check-in no local após despacho
 *   Resolution Time — tempo máximo para concluir o serviço após abertura
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Sem lógica implementada nesta versão.
 */

/**
 * Prioridade de SLA — afeta prazos e criticidade de alertas.
 *
 * TODO: Mapear prioridade para cores e comportamentos no dashboard operacional
 */
export const SLA_PRIORITY = {
  LOW:      'LOW',
  MEDIUM:   'MEDIUM',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
};

/**
 * Representa um Acordo de Nível de Serviço configurável.
 */
export class SLA {
  /**
   * @param {string}  name                  - Nome do SLA (ex: 'Emergencial 4h')
   * @param {number}  responseTimeMinutes   - Prazo para despacho após abertura (minutos)
   * @param {number}  startTimeMinutes      - Prazo para check-in após despacho (minutos)
   * @param {number}  resolutionTimeMinutes - Prazo total de resolução desde abertura (minutos)
   * @param {string}  priority              - SLA_PRIORITY.*
   * @param {boolean} active                - SLA ativo e aplicável
   * @param {Object}  metadata              - Dados extras (clientId, contractId)
   */
  constructor(
    name,
    responseTimeMinutes   = 60,
    startTimeMinutes      = 120,
    resolutionTimeMinutes = 480,
    priority              = SLA_PRIORITY.MEDIUM,
    active                = true,
    metadata              = {}
  ) {
    /** @type {string} */
    this.id = SLA._generateId();

    this.name                  = name;
    this.responseTimeMinutes   = responseTimeMinutes;
    this.startTimeMinutes      = startTimeMinutes;
    this.resolutionTimeMinutes = resolutionTimeMinutes;
    this.priority              = priority;
    this.active                = active;
    this.metadata              = metadata;
  }

  /**
   * Calcula o deadline de resposta a partir da abertura da WorkOrder.
   * @param {number} openedAt - Timestamp de abertura (ms)
   * @returns {number} - Timestamp do deadline (ms)
   *
   * TODO: Retornar openedAt + responseTimeMinutes * 60 * 1000
   * TODO: Respeitar horário comercial quando configurado em metadata
   */
  calculateResponseDeadline(openedAt) {
    // TODO: implementar
    return 0;
  }

  /**
   * Calcula o deadline de início a partir do despacho.
   * @param {number} dispatchedAt - Timestamp do despacho (ms)
   * @returns {number} - Timestamp do deadline (ms)
   *
   * TODO: Retornar dispatchedAt + startTimeMinutes * 60 * 1000
   */
  calculateStartDeadline(dispatchedAt) {
    // TODO: implementar
    return 0;
  }

  /**
   * Calcula o deadline de resolução a partir da abertura.
   * @param {number} openedAt - Timestamp de abertura (ms)
   * @returns {number} - Timestamp do deadline (ms)
   *
   * TODO: Retornar openedAt + resolutionTimeMinutes * 60 * 1000
   */
  calculateResolutionDeadline(openedAt) {
    // TODO: implementar
    return 0;
  }

  /**
   * Verifica se a WorkOrder está em risco de violar este SLA.
   * @param {number} openedAt    - Timestamp de abertura (ms)
   * @param {number} [atTime]    - Timestamp de avaliação (padrão: agora)
   * @param {number} [threshold] - % de tempo consumido que aciona o alerta (padrão: 0.8)
   * @returns {boolean}
   *
   * TODO: Verificar se atTime >= deadline * threshold
   * TODO: Usar threshold de 80% como padrão de alerta (20% do prazo restante)
   */
  isAtRisk(openedAt, atTime = Date.now(), threshold = 0.8) {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se o SLA foi violado.
   * @param {number} openedAt - Timestamp de abertura (ms)
   * @param {number} [atTime] - Timestamp de avaliação (padrão: agora)
   * @returns {boolean}
   *
   * TODO: Verificar se atTime > calculateResolutionDeadline(openedAt)
   */
  isViolated(openedAt, atTime = Date.now()) {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {SLA}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new SLA('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
