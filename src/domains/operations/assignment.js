/**
 * ESA OS — Operations Domain
 * Assignment
 *
 * Representa a alocação de uma equipe ou técnico a uma WorkOrder.
 *
 * Responsabilidades:
 * - Registrar quem foi alocado, por quem e quando
 * - Controlar aceitação/rejeição da alocação pelo técnico
 * - Rastrear janela de tempo planejada para o técnico
 * - Preparar notificação de alocação (via Notifications Domain, futuro)
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não integra com Notifications nesta versão.
 */

/**
 * Status de uma alocação.
 */
export const ASSIGNMENT_STATUS = {
  PENDING:  'PENDING',   // Enviada, aguardando confirmação do técnico
  ACCEPTED: 'ACCEPTED',  // Técnico aceitou a alocação
  REJECTED: 'REJECTED',  // Técnico recusou (nova alocação necessária)
  CANCELED: 'CANCELED',  // Alocação cancelada pelo gestor
  COMPLETED:'COMPLETED', // Técnico concluiu o atendimento desta alocação
};

/**
 * Alocação de equipe ou técnico individual a uma WorkOrder.
 */
export class Assignment {
  /**
   * @param {string}      workOrderId    - ID da WorkOrder
   * @param {string}      assignedBy     - UID da Person que realizou a alocação
   * @param {string}      teamId         - ID da FieldTeam (null se alocação individual)
   * @param {string}      technicianId   - ID do Technician (null se alocação de equipe)
   * @param {number}      scheduledStart - Timestamp de início planejado (ms)
   * @param {number}      scheduledEnd   - Timestamp de término planejado (ms)
   * @param {Object}      metadata       - Dados extras (notes, priority, notificationSent)
   */
  constructor(
    workOrderId,
    assignedBy     = '',
    teamId         = null,
    technicianId   = null,
    scheduledStart = null,
    scheduledEnd   = null,
    metadata       = {}
  ) {
    /** @type {string} */
    this.id = Assignment._generateId();

    this.workOrderId   = workOrderId;
    this.assignedBy    = assignedBy;
    this.teamId        = teamId;
    this.technicianId  = technicianId;
    this.scheduledStart = scheduledStart;
    this.scheduledEnd   = scheduledEnd;
    this.metadata      = metadata;

    this.status     = ASSIGNMENT_STATUS.PENDING;
    this.assignedAt = Date.now();

    /** @type {number|null} Preenchido quando o técnico confirma */
    this.acceptedAt = null;

    /** @type {number|null} Preenchido quando o técnico rejeita */
    this.rejectedAt = null;
  }

  /**
   * Registra aceitação da alocação pelo técnico.
   *
   * TODO: Setar status = ACCEPTED, acceptedAt = Date.now()
   * TODO: Disparar evento para atualizar WorkOrder (futuro EventBus)
   */
  accept() {
    // TODO: implementar
  }

  /**
   * Registra rejeição da alocação pelo técnico.
   * @param {string} reason
   *
   * TODO: Setar status = REJECTED, rejectedAt = Date.now()
   * TODO: Armazenar reason em metadata.rejectionReason
   * TODO: Notificar gestor (futuro)
   */
  reject(reason = '') {
    // TODO: implementar
  }

  /**
   * Cancela a alocação pelo gestor.
   * @param {string} reason
   *
   * TODO: Validar que status !== COMPLETED
   * TODO: Setar status = CANCELED
   */
  cancel(reason = '') {
    // TODO: implementar
  }

  /**
   * Verifica se a alocação está ativa.
   * @returns {boolean}
   *
   * TODO: Retornar status === ACCEPTED || status === PENDING
   */
  isActive() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se é alocação de equipe.
   * @returns {boolean}
   *
   * TODO: Retornar teamId !== null
   */
  isTeamAssignment() {
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
   * @returns {Assignment}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Assignment('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
