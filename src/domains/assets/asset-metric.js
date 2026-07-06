/**
 * ESA OS — Assets Domain
 * AssetMetric
 *
 * Estrutura genérica de séries temporais para métricas de ativos.
 * Prepara a integração futura com telemetria em tempo real.
 *
 * IMPORTANTE: Sem telemetria real nesta versão. NÃO conectado ao Dashboard legado.
 */

/**
 * Catálogo de métricas previstas por ativo.
 *
 * TODO: Expandir quando Energy Domain e Asset Domain forem integrados
 */
export const ASSET_METRIC_TYPE = {
  GENERATION_KWH:    'GENERATION_KWH',    // Geração de energia (kWh)
  CONSUMPTION_KWH:   'CONSUMPTION_KWH',   // Consumo de energia (kWh)
  POWER_KW:          'POWER_KW',          // Potência instantânea (kW)
  VOLTAGE:           'VOLTAGE',           // Tensão (V)
  CURRENT:           'CURRENT',           // Corrente (A)
  TEMPERATURE:       'TEMPERATURE',       // Temperatura (°C)
  STATE_OF_CHARGE:   'STATE_OF_CHARGE',   // Estado de carga de bateria (%)
  STATE_OF_HEALTH:   'STATE_OF_HEALTH',   // Saúde de bateria (%)
  AVAILABILITY:      'AVAILABILITY',      // Disponibilidade do ativo (%)
  PERFORMANCE_RATIO: 'PERFORMANCE_RATIO', // PR de usina fotovoltaica (%)
};

/**
 * Qualidade do dado medido.
 * TODO: Usar em validações de confiabilidade de telemetria
 */
export const METRIC_QUALITY = {
  MEASURED:   'MEASURED',   // Dado real de medição
  ESTIMATED:  'ESTIMATED',  // Estimativa calculada
  MANUAL:     'MANUAL',     // Inserção manual
  INTERPOLATED:'INTERPOLATED', // Interpolado de lacunas
  INVALID:    'INVALID',    // Dado inválido / descartado
};

/**
 * Ponto de dado de uma série temporal de ativo.
 */
export class AssetMetric {
  /**
   * @param {string} assetId   - ID do ativo
   * @param {string} metric    - ASSET_METRIC_TYPE.*
   * @param {number} value     - Valor medido
   * @param {string} unit      - Unidade (ex: 'kWh', 'kW', 'V', '%')
   * @param {number} timestamp - Timestamp de medição (ms)
   * @param {string} source    - Origem do dado (ex: 'inversor', 'manual', 'api')
   * @param {string} quality   - METRIC_QUALITY.*
   * @param {Object} metadata  - Dados extras (deviceId, rawValue, confidence)
   */
  constructor(
    assetId   = '',
    metric    = '',
    value     = 0,
    unit      = '',
    timestamp = null,
    source    = '',
    quality   = METRIC_QUALITY.MEASURED,
    metadata  = {}
  ) {
    this.id        = AssetMetric._generateId();
    this.assetId   = assetId;
    this.metric    = metric;
    this.value     = value;
    this.unit      = unit;
    this.timestamp = timestamp ?? Date.now();
    this.source    = source;
    this.quality   = quality;
    this.metadata  = metadata;
  }

  /**
   * @returns {boolean}
   * TODO: Retornar quality !== INVALID
   */
  isValid() {
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
