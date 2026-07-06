/**
 * ESA OS — Assets Domain
 * SolarPlant
 *
 * Especialização de Asset para usinas fotovoltaicas.
 * Adiciona campos específicos de geração solar.
 *
 * IMPORTANTE: Sem lógica de geração. NÃO conectado ao Dashboard legado.
 */

import { Asset } from './asset.js';
import { ASSET_TYPE } from './asset-type.js';
import { ASSET_STATUS } from './asset-status.js';

export const HOMOLOGATION_STATUS = {
  NOT_STARTED:  'NOT_STARTED',  // Homologação ainda não iniciada
  IN_PROGRESS:  'IN_PROGRESS',  // Em andamento na distribuidora
  APPROVED:     'APPROVED',     // Aprovada pela distribuidora
  REJECTED:     'REJECTED',     // Recusada — necessita correção
  CONNECTED:    'CONNECTED',    // Conectada à rede
};

export const GRID_CONNECTION_TYPE = {
  LOW_VOLTAGE:    'LOW_VOLTAGE',    // Baixa tensão (até 1 kV)
  MEDIUM_VOLTAGE: 'MEDIUM_VOLTAGE', // Média tensão (1 kV a 69 kV)
};

export class SolarPlant extends Asset {
  /**
   * @param {string} name                       - Nome da usina
   * @param {string} organizationId             - ID da organização
   * @param {string} customerId                 - ID do cliente
   * @param {number} installedPowerKw           - Potência fotovoltaica instalada (kWp)
   * @param {number} inverterPowerKw            - Potência do(s) inversor(es) (kW)
   * @param {number} moduleCount                - Quantidade de módulos
   * @param {number} inverterCount              - Quantidade de inversores
   * @param {number} estimatedMonthlyGenerationKwh  - Geração mensal estimada (kWh)
   * @param {number} estimatedAnnualGenerationKwh   - Geração anual estimada (kWh)
   * @param {string} connectionType             - GRID_CONNECTION_TYPE.*
   * @param {string} distributor                - Distribuidora de energia
   * @param {string} consumerUnit               - Unidade consumidora vinculada
   * @param {string} generationUnit             - Unidade geradora registrada
   * @param {string} homologationStatus         - HOMOLOGATION_STATUS.*
   * @param {number} gridConnectionDate         - Timestamp de conexão com a rede (ms)
   * @param {Object} metadata                   - Dados extras (orientation, tilt, shading)
   */
  constructor(
    name,
    organizationId              = '',
    customerId                  = '',
    installedPowerKw            = 0,
    inverterPowerKw             = 0,
    moduleCount                 = 0,
    inverterCount               = 0,
    estimatedMonthlyGenerationKwh = 0,
    estimatedAnnualGenerationKwh  = 0,
    connectionType              = GRID_CONNECTION_TYPE.LOW_VOLTAGE,
    distributor                 = '',
    consumerUnit                = '',
    generationUnit              = '',
    homologationStatus          = HOMOLOGATION_STATUS.NOT_STARTED,
    gridConnectionDate          = null,
    metadata                    = {}
  ) {
    super(
      name,
      ASSET_TYPE.SOLAR_PLANT,
      organizationId,
      customerId,
      '',                       // code — gerado externamente
      ASSET_STATUS.PLANNED,
      [],                       // ownerIds
      null,                     // projectId
      null,                     // contractId
      '',                       // address
      null,                     // latitude
      null,                     // longitude
      null,                     // commissionedAt
      null,                     // installedAt
      null,                     // acquisitionValue
      null,                     // currentValue
      '',                       // manufacturer
      '',                       // model
      '',                       // serialNumber
      installedPowerKw,         // capacity
      'kWp',                    // capacityUnit
      metadata
    );

    this.installedPowerKw             = installedPowerKw;
    this.inverterPowerKw              = inverterPowerKw;
    this.moduleCount                  = moduleCount;
    this.inverterCount                = inverterCount;
    this.estimatedMonthlyGenerationKwh = estimatedMonthlyGenerationKwh;
    this.estimatedAnnualGenerationKwh  = estimatedAnnualGenerationKwh;
    this.connectionType               = connectionType;
    this.distributor                  = distributor;
    this.consumerUnit                 = consumerUnit;
    this.generationUnit               = generationUnit;
    this.homologationStatus           = homologationStatus;
    this.gridConnectionDate           = gridConnectionDate;
  }

  /**
   * @returns {boolean}
   * TODO: Retornar homologationStatus === APPROVED || CONNECTED
   */
  isHomologated() {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {boolean}
   * TODO: Retornar homologationStatus === CONNECTED
   */
  isConnectedToGrid() {
    // TODO: implementar
    return false;
  }

  /**
   * Calcula Performance Ratio estimado.
   * @param {number} actualGenerationKwh
   * @param {number} irradianceKwhPerM2
   * @returns {number|null}
   *
   * TODO: PR = actualGenerationKwh / (installedPowerKw * irradianceKwhPerM2)
   * TODO: Sem implementação nesta versão
   */
  estimatePerformanceRatio(actualGenerationKwh, irradianceKwhPerM2) {
    // TODO: implementar
    return null;
  }

  /** @returns {Object} */
  toJSON() {
    // TODO: implementar (incluir campos da superclasse)
    return {};
  }

  /**
   * @param {Object} data
   * @returns {SolarPlant}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new SolarPlant('');
  }
}
