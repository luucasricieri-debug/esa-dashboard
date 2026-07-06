/**
 * ESA OS — Operations Domain
 * Equipment
 *
 * Representa um equipamento utilizado ou atendido em campo.
 *
 * Responsabilidades:
 * - Modelar equipamentos instalados em clientes ou utilizados pela equipe
 * - Rastrear fabricante, modelo, número de série e garantia
 * - Vincular ao Asset Domain (futuro) e ao cliente
 * - Preparar histórico de manutenções via WorkOrder
 *
 * Tipos cobertos:
 * - Inversor fotovoltaico
 * - Módulo fotovoltaico
 * - Bateria de armazenamento
 * - Carregador de veículo elétrico (EVSE)
 * - Transformador
 * - Quadro elétrico
 * - Medidor de energia
 * - Equipamento do cliente (genérico)
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Sem integração com Firebase ou sistemas externos nesta versão.
 */

/**
 * Tipos de equipamento suportados.
 *
 * TODO: Expandir com subcategorias quando o Asset Domain for criado
 */
export const EQUIPMENT_TYPE = {
  INVERTER:         'INVERTER',          // Inversor fotovoltaico
  SOLAR_PANEL:      'SOLAR_PANEL',       // Módulo fotovoltaico
  BATTERY:          'BATTERY',           // Sistema de bateria
  EV_CHARGER:       'EV_CHARGER',        // Carregador de veículo elétrico
  TRANSFORMER:      'TRANSFORMER',       // Transformador
  ELECTRICAL_PANEL: 'ELECTRICAL_PANEL',  // Quadro de distribuição/automação
  METER:            'METER',             // Medidor de energia
  CUSTOMER_OWNED:   'CUSTOMER_OWNED',    // Equipamento genérico do cliente
  OTHER:            'OTHER',
};

/**
 * Status operacional do equipamento.
 *
 * TODO: Integrar com telemetria em tempo real quando Energy Domain for criado
 */
export const EQUIPMENT_STATUS = {
  OPERATIONAL:    'OPERATIONAL',    // Funcionando normalmente
  DEGRADED:       'DEGRADED',       // Funcionando com desempenho reduzido
  FAULTY:         'FAULTY',         // Com falha — necessita manutenção
  OFFLINE:        'OFFLINE',        // Sem comunicação ou desligado
  DECOMMISSIONED: 'DECOMMISSIONED', // Desativado permanentemente
  UNKNOWN:        'UNKNOWN',        // Status não determinado
};

/**
 * Equipamento instalado ou atendido em campo.
 */
export class Equipment {
  /**
   * @param {string} type           - EQUIPMENT_TYPE.*
   * @param {string} manufacturer   - Fabricante
   * @param {string} model          - Modelo
   * @param {string} serialNumber   - Número de série
   * @param {string} organizationId - ID da organização responsável
   * @param {string} customerId     - ID do cliente proprietário
   * @param {string} assetId        - ID no Asset Domain (futuro)
   * @param {number} installedAt    - Timestamp de instalação (ms)
   * @param {number} warrantyUntil  - Timestamp de vencimento da garantia (ms)
   * @param {string} status         - EQUIPMENT_STATUS.*
   * @param {Object} metadata       - Dados extras (potência, capacidade, firmware, etc.)
   */
  constructor(
    type,
    manufacturer   = '',
    model          = '',
    serialNumber   = '',
    organizationId = '',
    customerId     = '',
    assetId        = '',
    installedAt    = null,
    warrantyUntil  = null,
    status         = EQUIPMENT_STATUS.UNKNOWN,
    metadata       = {}
  ) {
    /** @type {string} */
    this.id = Equipment._generateId();

    this.type           = type;
    this.manufacturer   = manufacturer;
    this.model          = model;
    this.serialNumber   = serialNumber;
    this.organizationId = organizationId;
    this.customerId     = customerId;

    /**
     * @type {string} Referência futura ao Asset Domain.
     * TODO: Sincronizar com Asset Domain quando criado
     */
    this.assetId = assetId;

    this.installedAt   = installedAt;
    this.warrantyUntil = warrantyUntil;
    this.status        = status;
    this.metadata      = metadata;
  }

  /**
   * Verifica se o equipamento está dentro da garantia.
   * @param {number} [atTime] - Timestamp de avaliação (padrão: agora)
   * @returns {boolean}
   *
   * TODO: Retornar warrantyUntil !== null && atTime <= warrantyUntil
   */
  isUnderWarranty(atTime = Date.now()) {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se o equipamento está operacional.
   * @returns {boolean}
   *
   * TODO: Retornar status === EQUIPMENT_STATUS.OPERATIONAL
   */
  isOperational() {
    // TODO: implementar
    return false;
  }

  /**
   * Retorna a idade do equipamento em anos desde a instalação.
   * @returns {number|null}
   *
   * TODO: Calcular (Date.now() - installedAt) em anos
   */
  getAgeYears() {
    // TODO: implementar
    return null;
  }

  /**
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {Equipment}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Equipment(EQUIPMENT_TYPE.OTHER);
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
