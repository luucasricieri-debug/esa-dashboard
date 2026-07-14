/**
 * ESA OS — Energy Domain / Credits
 * Alerts
 *
 * Contrato de alertas calculados na apuração mensal.
 * Alertas são observações geradas automaticamente — não bloqueiam o cálculo.
 * Erros que bloqueiam o cálculo são retornados como EnergyCreditsResult.errors.
 */

export const ALERT_CODE = Object.freeze({
  INSUFFICIENT_BALANCE:                  'INSUFFICIENT_BALANCE',
  NEGATIVE_SAVINGS:                      'NEGATIVE_SAVINGS',
  OVER_ALLOCATION_BLOCKED:               'OVER_ALLOCATION_BLOCKED',
  PENDING_COMPENSATION:                  'PENDING_COMPENSATION',
  NO_BENEFICIARIES:                      'NO_BENEFICIARIES',
  ZERO_GENERATION:                       'ZERO_GENERATION',
  ZERO_CONSUMPTION:                      'ZERO_CONSUMPTION',
  MISSING_PRICE:                         'MISSING_PRICE',
  MISSING_TARIFF:                        'MISSING_TARIFF',
  HIGH_BENEFICIARY_CREDIT_BALANCE:       'HIGH_BENEFICIARY_CREDIT_BALANCE',
  LOW_BENEFICIARY_CREDIT_BALANCE:        'LOW_BENEFICIARY_CREDIT_BALANCE',
  ALLOCATION_PERCENTAGE_TOTAL_INVALID:   'ALLOCATION_PERCENTAGE_TOTAL_INVALID',
  CONSUMPTION_ABOVE_AVERAGE:             'CONSUMPTION_ABOVE_AVERAGE',
});

export const ALERT_SEVERITY = Object.freeze({
  INFO:      'info',
  ATTENTION: 'attention',
  RISK:      'risk',
  CRITICAL:  'critical',
});

/**
 * Cria um alerta padronizado.
 *
 * @param {string} code       - ALERT_CODE.*
 * @param {string} severity   - ALERT_SEVERITY.*
 * @param {string} message    - Descrição legível
 * @param {string} targetType - Tipo da entidade afetada ('generatingUnit' | 'beneficiaryUnit')
 * @param {string} targetId   - ID da entidade afetada
 * @param {Object} [metadata] - Dados extras do alerta
 * @returns {{ code, severity, message, targetType, targetId, metadata }}
 */
export function createAlert(code, severity, message, targetType, targetId, metadata = {}) {
  return { code, severity, message, targetType, targetId, metadata };
}
