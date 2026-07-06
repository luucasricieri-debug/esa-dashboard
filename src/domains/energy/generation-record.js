/**
 * ESA OS — Energy Domain
 * GenerationRecord
 *
 * Registro de geração de energia de uma unidade geradora em uma competência.
 *
 * IMPORTANTE: Sem cálculo. NÃO conectado ao Dashboard legado.
 */

export class GenerationRecord {
  /**
   * @param {string} operationId      - ID da EnergyOperation
   * @param {string} assetId          - ID do ativo gerador
   * @param {string} generationUnitId - ID da GenerationUnit
   * @param {string} competence       - Competência (ex: '2024-05')
   * @param {number} periodStart      - Timestamp início do período (ms)
   * @param {number} periodEnd        - Timestamp fim do período (ms)
   * @param {number} generatedKwh     - Total gerado no período (kWh)
   * @param {number} injectedKwh      - Total injetado na rede (kWh)
   * @param {number} selfConsumedKwh  - Total autoconsumido (kWh)
   * @param {string} source           - Origem do dado ('meter', 'inverter', 'manual')
   * @param {Object} metadata         - Dados extras (invoiceRef, confirmed)
   */
  constructor(
    operationId      = '',
    assetId          = '',
    generationUnitId = '',
    competence       = '',
    periodStart      = null,
    periodEnd        = null,
    generatedKwh     = 0,
    injectedKwh      = 0,
    selfConsumedKwh  = 0,
    source           = '',
    metadata         = {}
  ) {
    this.id               = GenerationRecord._generateId();
    this.operationId      = operationId;
    this.assetId          = assetId;
    this.generationUnitId = generationUnitId;
    this.competence       = competence;
    this.periodStart      = periodStart;
    this.periodEnd        = periodEnd;
    this.generatedKwh     = generatedKwh;
    this.injectedKwh      = injectedKwh;
    this.selfConsumedKwh  = selfConsumedKwh;
    this.source           = source;
    this.metadata         = metadata;
    this.recordedAt       = Date.now();
  }

  /**
   * @returns {number}
   * TODO: Retornar generatedKwh — (injectedKwh + selfConsumedKwh)
   */
  getLossKwh() {
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
