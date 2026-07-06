/**
 * ESA OS — Assets Domain
 * BatterySystem
 *
 * Especialização de Asset para sistemas de armazenamento de energia.
 *
 * Casos de uso previstos:
 * - Backup de energia
 * - Peak shaving (redução de pico de demanda)
 * - Arbitragem energética (comprar barato, usar caro)
 * - Autoconsumo com geração fotovoltaica
 * - Resposta à demanda (mercado livre)
 *
 * IMPORTANTE: Sem cálculos. NÃO conectado ao Dashboard legado.
 */

import { Asset } from './asset.js';
import { ASSET_TYPE } from './asset-type.js';
import { ASSET_STATUS } from './asset-status.js';

export const BATTERY_CHEMISTRY = {
  LITHIUM_ION:       'LITHIUM_ION',       // Li-Ion (LFP, NMC, NCA)
  LITHIUM_IRON_PHOSPHATE: 'LITHIUM_IRON_PHOSPHATE', // LFP — mais seguro
  LEAD_ACID:         'LEAD_ACID',         // Chumbo-ácido
  FLOW:              'FLOW',              // Bateria de fluxo
  SODIUM_ION:        'SODIUM_ION',        // Íon de sódio (emergente)
  OTHER:             'OTHER',
};

export const BATTERY_OPERATING_MODE = {
  BACKUP:           'BACKUP',            // Backup de emergência
  PEAK_SHAVING:     'PEAK_SHAVING',      // Redução de pico de demanda
  ARBITRAGE:        'ARBITRAGE',         // Arbitragem energética
  SELF_CONSUMPTION: 'SELF_CONSUMPTION',  // Autoconsumo com geração solar
  DEMAND_RESPONSE:  'DEMAND_RESPONSE',   // Resposta à demanda
  HYBRID:           'HYBRID',            // Múltiplos modos
};

export class BatterySystem extends Asset {
  /**
   * @param {string} name                - Nome do sistema
   * @param {string} organizationId      - ID da organização
   * @param {string} customerId          - ID do cliente
   * @param {number} energyCapacityKwh   - Capacidade de energia (kWh)
   * @param {number} powerCapacityKw     - Potência de carga/descarga (kW)
   * @param {string} chemistry           - BATTERY_CHEMISTRY.*
   * @param {number} cycleLife           - Vida útil em ciclos
   * @param {number} stateOfHealth       - Estado de saúde (%, 0-100)
   * @param {number} stateOfCharge       - Estado de carga atual (%, 0-100)
   * @param {number} roundTripEfficiency - Eficiência de ciclo completo (%, 0-100)
   * @param {string} operatingMode       - BATTERY_OPERATING_MODE.*
   * @param {string} manufacturer        - Fabricante
   * @param {string} model               - Modelo
   * @param {Object} metadata            - Dados extras (cellCount, bmsModel)
   */
  constructor(
    name,
    organizationId     = '',
    customerId         = '',
    energyCapacityKwh  = 0,
    powerCapacityKw    = 0,
    chemistry          = BATTERY_CHEMISTRY.LITHIUM_IRON_PHOSPHATE,
    cycleLife          = 0,
    stateOfHealth      = 100,
    stateOfCharge      = 0,
    roundTripEfficiency = 0,
    operatingMode      = BATTERY_OPERATING_MODE.SELF_CONSUMPTION,
    manufacturer       = '',
    model              = '',
    metadata           = {}
  ) {
    super(
      name,
      ASSET_TYPE.BATTERY_SYSTEM,
      organizationId,
      customerId,
      '',
      ASSET_STATUS.PLANNED,
      [],
      null, null, '', null, null, null, null, null, null,
      manufacturer,
      model,
      '',
      energyCapacityKwh,
      'kWh',
      metadata
    );

    this.energyCapacityKwh   = energyCapacityKwh;
    this.powerCapacityKw     = powerCapacityKw;
    this.chemistry           = chemistry;
    this.cycleLife           = cycleLife;
    this.stateOfHealth       = stateOfHealth;
    this.stateOfCharge       = stateOfCharge;
    this.roundTripEfficiency = roundTripEfficiency;
    this.operatingMode       = operatingMode;
  }

  /**
   * @returns {boolean}
   * TODO: Retornar stateOfHealth < 80 (limiar padrão de degradação)
   */
  isDegraded() {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {number}
   * TODO: Retornar energyCapacityKwh * (stateOfCharge / 100)
   */
  getAvailableEnergyKwh() {
    // TODO: implementar
    return 0;
  }

  /** @returns {Object} */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {BatterySystem}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new BatterySystem('');
  }
}
