/**
 * ESA OS — Energy Domain
 * EnergyMetric
 *
 * Ponto de dado de uma série temporal de métricas de operação energética.
 *
 * IMPORTANTE: Sem cálculos. NÃO conectado ao Dashboard legado.
 */

export const ENERGY_METRIC_TYPE = {
  GENERATED_KWH:    'GENERATED_KWH',    // kWh gerados no período
  ALLOCATED_KWH:    'ALLOCATED_KWH',    // kWh alocados a consumidores
  COMPENSATED_KWH:  'COMPENSATED_KWH',  // kWh compensados na distribuidora
  CREDIT_BALANCE_KWH:'CREDIT_BALANCE_KWH',// Saldo de créditos disponíveis (kWh)
  COMPENSATION_RATE:'COMPENSATION_RATE',// Taxa de compensação (%)
  ENERGY_REVENUE:   'ENERGY_REVENUE',   // Receita de energia (R$)
  MANAGEMENT_REVENUE:'MANAGEMENT_REVENUE',// Receita de gestão ESA (R$)
  OWNER_PAYABLE:    'OWNER_PAYABLE',    // Valor a pagar a proprietários (R$)
  DELINQUENCY_RATE: 'DELINQUENCY_RATE', // Taxa de inadimplência (%)
};

export class EnergyMetric {
  /**
   * @param {string} operationId - ID da EnergyOperation
   * @param {string} metric      - ENERGY_METRIC_TYPE.*
   * @param {number} value       - Valor da métrica
   * @param {string} unit        - Unidade (ex: 'kWh', 'R$', '%')
   * @param {string} competence  - Competência (ex: '2024-05')
   * @param {number} timestamp   - Timestamp de registro (ms)
   * @param {string} source      - Origem do dado ('settlement', 'manual', 'system')
   * @param {Object} metadata    - Dados extras (notes, confidence)
   */
  constructor(
    operationId = '',
    metric      = '',
    value       = 0,
    unit        = '',
    competence  = '',
    timestamp   = null,
    source      = '',
    metadata    = {}
  ) {
    this.id          = EnergyMetric._generateId();
    this.operationId = operationId;
    this.metric      = metric;
    this.value       = value;
    this.unit        = unit;
    this.competence  = competence;
    this.timestamp   = timestamp ?? Date.now();
    this.source      = source;
    this.metadata    = metadata;
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
