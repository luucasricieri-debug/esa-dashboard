/**
 * ESA OS — Energy Domain
 * ConsumptionRecord
 *
 * Registro de consumo de energia de uma unidade consumidora em uma competência.
 *
 * IMPORTANTE: Sem cálculo. NÃO conectado ao Dashboard legado.
 */

export class ConsumptionRecord {
  /**
   * @param {string} operationId     - ID da EnergyOperation
   * @param {string} consumerUnitId  - ID da ConsumerUnit
   * @param {string} competence      - Competência (ex: '2024-05')
   * @param {number} periodStart     - Timestamp início (ms)
   * @param {number} periodEnd       - Timestamp fim (ms)
   * @param {number} consumedKwh     - Consumo total no período (kWh)
   * @param {number} compensatedKwh  - Energia compensada via crédito (kWh)
   * @param {number} billedKwh       - Consumo efetivamente faturado (kWh)
   * @param {string} distributor     - Distribuidora de energia
   * @param {Object} metadata        - Dados extras (invoiceRef, tariff, taxes)
   */
  constructor(
    operationId    = '',
    consumerUnitId = '',
    competence     = '',
    periodStart    = null,
    periodEnd      = null,
    consumedKwh    = 0,
    compensatedKwh = 0,
    billedKwh      = 0,
    distributor    = '',
    metadata       = {}
  ) {
    this.id             = ConsumptionRecord._generateId();
    this.operationId    = operationId;
    this.consumerUnitId = consumerUnitId;
    this.competence     = competence;
    this.periodStart    = periodStart;
    this.periodEnd      = periodEnd;
    this.consumedKwh    = consumedKwh;
    this.compensatedKwh = compensatedKwh;
    this.billedKwh      = billedKwh;
    this.distributor    = distributor;
    this.metadata       = metadata;
    this.recordedAt     = Date.now();
  }

  /**
   * @returns {number}
   * TODO: Retornar compensatedKwh / consumedKwh quando consumedKwh > 0
   */
  getCompensationRate() {
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
