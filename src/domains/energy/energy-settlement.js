/**
 * ESA OS — Energy Domain
 * EnergySettlement
 *
 * Fechamento e repasse financeiro de uma operação energética por competência.
 *
 * IMPORTANTE: Sem cálculos financeiros. NÃO conectado ao Dashboard legado.
 */

export const SETTLEMENT_STATUS = {
  OPEN:       'OPEN',       // Período em aberto — ainda recebendo dados
  PROCESSING: 'PROCESSING', // Sendo processado (reconciliação de dados)
  REVIEW:     'REVIEW',     // Em revisão pelo time financeiro
  APPROVED:   'APPROVED',   // Aprovado para pagamento
  CLOSED:     'CLOSED',     // Fechado e pago
  REOPENED:   'REOPENED',   // Reaberto por divergência
};

export class EnergySettlement {
  /**
   * @param {string} operationId       - ID da EnergyOperation
   * @param {string} competence        - Competência (ex: '2024-05')
   * @param {number} generatedKwh      - Total gerado na competência
   * @param {number} allocatedKwh      - Total alocado a consumidores
   * @param {number} compensatedKwh    - Total compensado na distribuidora
   * @param {number} invoicedAmount    - Total faturado (R$)
   * @param {number} receivedAmount    - Total recebido (R$)
   * @param {number} managementRevenue - Receita de gestão ESA (R$)
   * @param {number} ownerPayableAmount - Valor a pagar aos proprietários (R$)
   * @param {number} ownerPaidAmount   - Valor já pago aos proprietários (R$)
   * @param {number} closedAt          - Timestamp de fechamento (ms)
   * @param {Object} metadata          - Dados extras (notes, approvedBy)
   */
  constructor(
    operationId       = '',
    competence        = '',
    generatedKwh      = 0,
    allocatedKwh      = 0,
    compensatedKwh    = 0,
    invoicedAmount    = 0,
    receivedAmount    = 0,
    managementRevenue = 0,
    ownerPayableAmount = 0,
    ownerPaidAmount   = 0,
    closedAt          = null,
    metadata          = {}
  ) {
    this.id                = EnergySettlement._generateId();
    this.operationId       = operationId;
    this.competence        = competence;
    this.generatedKwh      = generatedKwh;
    this.allocatedKwh      = allocatedKwh;
    this.compensatedKwh    = compensatedKwh;
    this.invoicedAmount    = invoicedAmount;
    this.receivedAmount    = receivedAmount;
    this.managementRevenue = managementRevenue;
    this.ownerPayableAmount = ownerPayableAmount;
    this.ownerPaidAmount   = ownerPaidAmount;
    this.status            = SETTLEMENT_STATUS.OPEN;
    this.closedAt          = closedAt;
    this.metadata          = metadata;
    this.createdAt         = Date.now();
    this.updatedAt         = Date.now();
  }

  /**
   * @returns {boolean}
   * TODO: Retornar status === CLOSED
   */
  isClosed() {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {number}
   * TODO: Retornar receivedAmount - managementRevenue - ownerPaidAmount
   */
  getBalance() {
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
