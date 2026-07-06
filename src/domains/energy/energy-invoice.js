/**
 * ESA OS — Energy Domain
 * EnergyInvoice
 *
 * Documento financeiro/energético de uma competência mensal.
 * Representa o que foi gerado, compensado e cobrado ao comprador.
 *
 * IMPORTANTE: Sem cálculos. NÃO conectado ao Dashboard legado.
 */

export const INVOICE_STATUS = {
  DRAFT:    'DRAFT',    // Em elaboração
  ISSUED:   'ISSUED',   // Emitida para o comprador
  PAID:     'PAID',     // Paga
  OVERDUE:  'OVERDUE',  // Vencida e não paga
  CANCELED: 'CANCELED', // Cancelada
  REFUNDED: 'REFUNDED', // Estornada
};

export class EnergyInvoice {
  /**
   * @param {string} operationId    - ID da EnergyOperation
   * @param {string} contractId     - ID do EnergyContract
   * @param {string} consumerUnitId - ID da ConsumerUnit
   * @param {string} competence     - Competência (ex: '2024-05')
   * @param {number} referenceKwh   - kWh de referência contratados
   * @param {number} compensatedKwh - kWh efetivamente compensados
   * @param {number} unitPrice      - Preço unitário por kWh (R$)
   * @param {number} grossAmount    - Valor bruto (R$)
   * @param {number} discountAmount - Desconto concedido (R$)
   * @param {number} managementAmount - Taxa de gestão (R$)
   * @param {number} taxesAmount    - Impostos (R$)
   * @param {number} netAmount      - Valor líquido a cobrar (R$)
   * @param {number} dueDate        - Timestamp de vencimento (ms)
   * @param {Object} metadata       - Dados extras (pixKey, boletoRef, notes)
   */
  constructor(
    operationId    = '',
    contractId     = '',
    consumerUnitId = '',
    competence     = '',
    referenceKwh   = 0,
    compensatedKwh = 0,
    unitPrice      = 0,
    grossAmount    = 0,
    discountAmount = 0,
    managementAmount = 0,
    taxesAmount    = 0,
    netAmount      = 0,
    dueDate        = null,
    metadata       = {}
  ) {
    this.id               = EnergyInvoice._generateId();
    this.operationId      = operationId;
    this.contractId       = contractId;
    this.consumerUnitId   = consumerUnitId;
    this.competence       = competence;
    this.referenceKwh     = referenceKwh;
    this.compensatedKwh   = compensatedKwh;
    this.unitPrice        = unitPrice;
    this.grossAmount      = grossAmount;
    this.discountAmount   = discountAmount;
    this.managementAmount = managementAmount;
    this.taxesAmount      = taxesAmount;
    this.netAmount        = netAmount;
    this.dueDate          = dueDate;
    this.paidAt           = null;
    this.status           = INVOICE_STATUS.DRAFT;
    this.metadata         = metadata;
    this.createdAt        = Date.now();
  }

  /**
   * @param {number} [atTime]
   * @returns {boolean}
   * TODO: Retornar status === OVERDUE || (dueDate < atTime && status === ISSUED)
   */
  isOverdue(atTime = Date.now()) {
    // TODO: implementar
    return false;
  }

  /**
   * @param {number} paidAt
   * TODO: Setar paidAt e status = PAID
   */
  markAsPaid(paidAt = Date.now()) {
    // TODO: implementar
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
