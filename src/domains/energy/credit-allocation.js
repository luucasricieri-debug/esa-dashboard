/**
 * ESA OS — Energy Domain
 * CreditAllocation
 *
 * Representa a alocação de créditos de energia a uma unidade consumidora.
 *
 * IMPORTANTE: Sem cálculo automático de rateio. NÃO conectado ao Dashboard legado.
 */

export const ALLOCATION_STATUS = {
  PENDING:   'PENDING',   // Alocado, aguardando confirmação da distribuidora
  CONFIRMED: 'CONFIRMED', // Confirmado pela distribuidora
  REJECTED:  'REJECTED',  // Rejeitado pela distribuidora
  COMPENSATED:'COMPENSATED', // Compensado na fatura
  REVERSED:  'REVERSED',  // Estornado
};

export class CreditAllocation {
  /**
   * @param {string} creditId            - ID do EnergyCredit
   * @param {string} operationId         - ID da EnergyOperation
   * @param {string} consumerUnitId      - ID da ConsumerUnit beneficiária
   * @param {string} buyerId             - ID do comprador/assinante
   * @param {number} allocatedKwh        - kWh alocados a esta unidade
   * @param {number} allocationPercentage - % do crédito alocado (0-100)
   * @param {string} competence          - Competência de aplicação (ex: '2024-05')
   * @param {Object} metadata            - Dados extras (notes, distributorRef)
   */
  constructor(
    creditId            = '',
    operationId         = '',
    consumerUnitId      = '',
    buyerId             = '',
    allocatedKwh        = 0,
    allocationPercentage = 0,
    competence          = '',
    metadata            = {}
  ) {
    this.id                  = CreditAllocation._generateId();
    this.creditId            = creditId;
    this.operationId         = operationId;
    this.consumerUnitId      = consumerUnitId;
    this.buyerId             = buyerId;
    this.allocatedKwh        = allocatedKwh;
    this.allocationPercentage = allocationPercentage;
    this.competence          = competence;
    this.status              = ALLOCATION_STATUS.PENDING;
    this.allocatedAt         = Date.now();
    this.metadata            = metadata;
  }

  /**
   * @returns {boolean}
   * TODO: Retornar status === COMPENSATED
   */
  isCompensated() {
    // TODO: implementar
    return false;
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
