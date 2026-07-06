/**
 * ESA OS — Assets Domain
 * EVCharger
 *
 * Especialização de Asset para estações de recarga de veículos elétricos.
 * Representa equipamentos Movom e parceiros.
 *
 * Potências previstas: 22 kW, 40 kW, 60 kW, 80 kW, 120 kW e futuras.
 * O catálogo de potências NÃO é enumerado — o campo powerKw é livre.
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado. Sem integração com rede de recarga.
 */

import { Asset } from './asset.js';
import { ASSET_TYPE } from './asset-type.js';
import { ASSET_STATUS } from './asset-status.js';

export const CONNECTOR_TYPE = {
  TYPE_1:     'TYPE_1',     // SAE J1772 — AC monofásico (EUA/Brasil)
  TYPE_2:     'TYPE_2',     // IEC 62196-2 — AC trifásico (Europa/Brasil)
  CCS_1:      'CCS_1',      // Combined Charging System (EUA)
  CCS_2:      'CCS_2',      // Combined Charging System (Europa/Brasil) — DC
  CHADEMO:    'CHADEMO',    // CHAdeMO — DC (Nissan/Mitsubishi)
  GB_T:       'GB_T',       // GB/T — padrão chinês
  NACS:       'NACS',       // Tesla/North American Charging Standard
};

export const CHARGING_MODE = {
  MODE_2: 'MODE_2', // Recarga lenta via tomada doméstica com cabo de controle
  MODE_3: 'MODE_3', // Recarga semi-rápida — wallbox AC
  MODE_4: 'MODE_4', // Recarga rápida — DC
};

export const CHARGING_PROTOCOL = {
  OCPP_1_6: 'OCPP_1_6', // OCPP 1.6
  OCPP_2_0: 'OCPP_2_0', // OCPP 2.0.1
  ISO_15118:'ISO_15118', // ISO 15118 (Plug & Charge)
  PROPRIETARY: 'PROPRIETARY',
};

export class EVCharger extends Asset {
  /**
   * @param {string}   name            - Nome do carregador
   * @param {string}   organizationId  - ID da organização
   * @param {string}   customerId      - ID do cliente/operador
   * @param {number}   powerKw         - Potência de saída (kW)
   * @param {string[]} connectorTypes  - CONNECTOR_TYPE.* disponíveis
   * @param {number}   connectorCount  - Número de conectores/pontos de recarga
   * @param {string}   chargingMode    - CHARGING_MODE.*
   * @param {string}   protocol        - CHARGING_PROTOCOL.*
   * @param {string}   networkProvider - Provedor de rede de recarga
   * @param {boolean}  publicAccess    - Acesso público
   * @param {boolean}  billingEnabled  - Cobrança habilitada
   * @param {string}   serialNumber    - Número de série do equipamento
   * @param {string}   firmwareVersion - Versão de firmware instalada
   * @param {string}   manufacturer    - Fabricante
   * @param {string}   model           - Modelo
   * @param {Object}   metadata        - Dados extras (locationName, amenities)
   */
  constructor(
    name,
    organizationId  = '',
    customerId      = '',
    powerKw         = 0,
    connectorTypes  = [CONNECTOR_TYPE.TYPE_2],
    connectorCount  = 1,
    chargingMode    = CHARGING_MODE.MODE_3,
    protocol        = CHARGING_PROTOCOL.OCPP_1_6,
    networkProvider = '',
    publicAccess    = false,
    billingEnabled  = false,
    serialNumber    = '',
    firmwareVersion = '',
    manufacturer    = '',
    model           = '',
    metadata        = {}
  ) {
    super(
      name,
      ASSET_TYPE.EV_CHARGER,
      organizationId,
      customerId,
      '',
      ASSET_STATUS.PLANNED,
      [],
      null, null, '', null, null, null, null, null, null,
      manufacturer,
      model,
      serialNumber,
      powerKw,
      'kW',
      metadata
    );

    this.powerKw         = powerKw;
    this.connectorTypes  = connectorTypes;
    this.connectorCount  = connectorCount;
    this.chargingMode    = chargingMode;
    this.protocol        = protocol;
    this.networkProvider = networkProvider;
    this.publicAccess    = publicAccess;
    this.billingEnabled  = billingEnabled;
    this.firmwareVersion = firmwareVersion;
  }

  /**
   * @returns {boolean}
   * TODO: Retornar chargingMode === MODE_4
   */
  isFastCharge() {
    // TODO: implementar
    return false;
  }

  /**
   * @param {string} connectorType - CONNECTOR_TYPE.*
   * @returns {boolean}
   * TODO: Retornar connectorTypes.includes(connectorType)
   */
  supportsConnector(connectorType) {
    // TODO: implementar
    return false;
  }

  /** @returns {Object} */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {EVCharger}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new EVCharger('');
  }
}
