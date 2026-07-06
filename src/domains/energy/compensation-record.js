/**
 * ESA OS — Energy Domain
 * CompensationRecord
 *
 * Registra a compensação efetiva de créditos na fatura da distribuidora.
 *
 * IMPORTANTE: Sem integração com distribuidora. NÃO conectado ao Dashboard legado.
 */

export const COMPENSATION_STATUS = {
  PENDING:   'PENDING',   // Aguardando confirmação na fatura
  CONFIRMED: 'CONFIRMED', // Confirmado na fatura da distribuidora
  DISPUTED:  'DISPUTED',  // Em disputa / divergência
  REVERSED:  'REVERSED',  // Estornado
};

export class CompensationRecord {
  /**
   * @param {string} operationId          - ID da EnergyOperation
   * @param {string} creditId             - ID do EnergyCredit compensado
   * @param {string} allocationId         - ID da CreditAllocation
   * @param {string} consumerUnitId       - ID da ConsumerUnit
   * @param {string} competence           - Competência da fatura (ex: '2024-05')
   * @param {number} compensatedKwh       - kWh efetivamente compensados
   * @param {string} distributorDocumentRef - Referência do documento da distribuidora
   * @param {number} confirmedAt          - Timestamp de confirmação (ms)
   * @param {Object} metadata             - Dados extras (invoiceRef, taxes)
   */
  constructor(
    operationId           = '',
    creditId              = '',
    allocationId          = '',
    consumerUnitId        = '',
    competence            = '',
    compensatedKwh        = 0,
    distributorDocumentRef = '',
    confirmedAt           = null,
    metadata              = {}
  ) {
    this.id                    = CompensationRecord._generateId();
    this.operationId           = operationId;
    this.creditId              = creditId;
    this.allocationId          = allocationId;
    this.consumerUnitId        = consumerUnitId;
    this.competence            = competence;
    this.compensatedKwh        = compensatedKwh;
    this.distributorDocumentRef = distributorDocumentRef;
    this.confirmedAt           = confirmedAt;
    this.status                = COMPENSATION_STATUS.PENDING;
    this.metadata              = metadata;
    this.createdAt             = Date.now();
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
