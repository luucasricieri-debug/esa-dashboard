/**
 * ESA OS — Read Models / CRM
 * CRMMetrics
 *
 * Calcula métricas derivadas sobre o estado do CRMReadModel.
 * Usa dependency injection — não instancia o Read Model internamente.
 *
 * Métricas disponíveis:
 * - Conversion Rate: Vendido / total
 * - Win Rate: Vendido / (Vendido + Perdido)
 * - Loss Rate: Perdido / (Vendido + Perdido)
 * - Paused Rate: Pausado / total
 * - Forecast: valor ponderado por status
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa Event Bus. Lê apenas do CRMReadModel.
 */

/**
 * Pesos aplicados ao valor de cada deal no cálculo de forecast.
 * Fixos nesta Sprint — configuráveis em versões futuras.
 */
const FORECAST_WEIGHTS = {
  'Vendido':      1.00,
  'Em andamento': 0.50,
  'Pausado':      0.20,
  'Perdido':      0.00,
  'Sem status':   0.25,
};

const DEFAULT_WEIGHT = 0.25;

/**
 * Calculadora de métricas CRM.
 */
export class CRMMetrics {
  /**
   * @param {CRMReadModel} readModel - Instância do Read Model (injetada)
   */
  constructor(readModel) {
    this._readModel = readModel;
  }

  // ── Taxa de conversão ─────────────────────────────────────────────────────

  /**
   * Conversão: Deals com status "Vendido" sobre o total.
   *
   * @param {Object} filters - Filtros passados para getDeals()
   * @returns {{ total: number, converted: number, rate: number }}
   */
  getConversionRate(filters = {}) {
    const deals     = this._readModel.getDeals(filters);
    const total     = deals.length;
    const converted = deals.filter((d) => d.status === 'Vendido').length;
    return {
      total,
      converted,
      rate: total === 0 ? 0 : (converted / total) * 100,
    };
  }

  // ── Win Rate ──────────────────────────────────────────────────────────────

  /**
   * Win Rate: Vendido / (Vendido + Perdido).
   * Denominator considera apenas deals com decisão (Vendido ou Perdido).
   *
   * @param {Object} filters
   * @returns {{ decided: number, won: number, rate: number }}
   */
  getWinRate(filters = {}) {
    const deals   = this._readModel.getDeals(filters);
    const decided = deals.filter((d) => d.status === 'Vendido' || d.status === 'Perdido').length;
    const won     = deals.filter((d) => d.status === 'Vendido').length;
    return {
      decided,
      won,
      rate: decided === 0 ? 0 : (won / decided) * 100,
    };
  }

  // ── Loss Rate ─────────────────────────────────────────────────────────────

  /**
   * Loss Rate: Perdido / (Vendido + Perdido).
   *
   * @param {Object} filters
   * @returns {{ decided: number, lost: number, rate: number }}
   */
  getLossRate(filters = {}) {
    const deals   = this._readModel.getDeals(filters);
    const decided = deals.filter((d) => d.status === 'Vendido' || d.status === 'Perdido').length;
    const lost    = deals.filter((d) => d.status === 'Perdido').length;
    return {
      decided,
      lost,
      rate: decided === 0 ? 0 : (lost / decided) * 100,
    };
  }

  // ── Paused Rate ───────────────────────────────────────────────────────────

  /**
   * Paused Rate: Pausado / total.
   *
   * @param {Object} filters
   * @returns {{ total: number, paused: number, rate: number }}
   */
  getPausedRate(filters = {}) {
    const deals  = this._readModel.getDeals(filters);
    const total  = deals.length;
    const paused = deals.filter((d) => d.status === 'Pausado').length;
    return {
      total,
      paused,
      rate: total === 0 ? 0 : (paused / total) * 100,
    };
  }

  // ── Forecast ──────────────────────────────────────────────────────────────

  /**
   * Forecast básico: soma ponderada dos valores dos deals por status.
   *
   * Pesos:
   *   Vendido       → 1.00
   *   Em andamento  → 0.50
   *   Pausado       → 0.20
   *   Perdido       → 0.00
   *   Sem status    → 0.25
   *   outros        → 0.25
   *
   * @param {Object} filters
   * @returns {{ totalValue: number, weightedValue: number, dealCount: number, byStatus: Object }}
   */
  getForecast(filters = {}) {
    const deals         = this._readModel.getDeals(filters);
    let   totalValue    = 0;
    let   weightedValue = 0;
    const byStatus      = {};

    for (const deal of deals) {
      const status = deal.status || 'Sem status';
      const value  = Number(deal.valor) || 0;
      const weight = FORECAST_WEIGHTS[status] !== undefined ? FORECAST_WEIGHTS[status] : DEFAULT_WEIGHT;
      const wv     = value * weight;

      totalValue    += value;
      weightedValue += wv;

      if (!byStatus[status]) {
        byStatus[status] = { count: 0, totalValue: 0, weight, weightedValue: 0 };
      }

      byStatus[status].count++;
      byStatus[status].totalValue    += value;
      byStatus[status].weightedValue += wv;
    }

    return { totalValue, weightedValue, dealCount: deals.length, byStatus };
  }
}
