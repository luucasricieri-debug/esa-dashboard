/**
 * ESA OS — Energy Domain
 * EnergyCredit
 *
 * Representa um lote de créditos de energia gerados por uma usina
 * e registrados na distribuidora para compensação futura.
 *
 * IMPORTANTE: Sem regras de compensação. NÃO conectado ao Dashboard legado.
 */

export const CREDIT_STATUS = {
  AVAILABLE:          'AVAILABLE',           // Disponível para alocação
  PARTIALLY_ALLOCATED:'PARTIALLY_ALLOCATED', // Parcialmente alocado
  FULLY_ALLOCATED:    'FULLY_ALLOCATED',     // Totalmente alocado
  COMPENSATED:        'COMPENSATED',         // Compensado na distribuidora
  EXPIRED:            'EXPIRED',             // Vencido sem compensação
  CANCELED:           'CANCELED',            // Cancelado / estornado
};

export class EnergyCredit {
  /**
   * @param {string} operationId      - ID da EnergyOperation
   * @param {string} generationUnitId - ID da GenerationUnit geradora
   * @param {string} distributor      - Distribuidora de energia
   * @param {string} competence       - Competência de geração (ex: '2024-05')
   * @param {number} originKwh        - kWh originalmente gerados
   * @param {number} availableKwh     - kWh ainda disponíveis para alocação
   * @param {number} allocatedKwh     - kWh alocados a unidades consumidoras
   * @param {number} compensatedKwh   - kWh efetivamente compensados
   * @param {number} expiredKwh       - kWh vencidos sem uso
   * @param {number} expiresAt        - Timestamp de vencimento dos créditos (ms)
   * @param {Object} metadata         - Dados extras (distributorRef, notes)
   */
  constructor(
    operationId      = '',
    generationUnitId = '',
    distributor      = '',
    competence       = '',
    originKwh        = 0,
    availableKwh     = 0,
    allocatedKwh     = 0,
    compensatedKwh   = 0,
    expiredKwh       = 0,
    expiresAt        = null,
    metadata         = {}
  ) {
    this.id               = EnergyCredit._generateId();
    this.operationId      = operationId;
    this.generationUnitId = generationUnitId;
    this.distributor      = distributor;
    this.competence       = competence;
    this.originKwh        = originKwh;
    this.availableKwh     = availableKwh;
    this.allocatedKwh     = allocatedKwh;
    this.compensatedKwh   = compensatedKwh;
    this.expiredKwh       = expiredKwh;
    this.expiresAt        = expiresAt;
    this.status           = CREDIT_STATUS.AVAILABLE;
    this.metadata         = metadata;
    this.createdAt        = Date.now();
    this.updatedAt        = Date.now();
  }

  /**
   * @param {number} [atTime]
   * @returns {boolean}
   * TODO: Retornar expiresAt !== null && atTime > expiresAt
   */
  isExpired(atTime = Date.now()) {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {number}
   * TODO: Retornar availableKwh - allocatedKwh
   */
  getRemainingKwh() {
    // TODO: implementar
    return 0;
  }

  /** @returns {Object} */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
