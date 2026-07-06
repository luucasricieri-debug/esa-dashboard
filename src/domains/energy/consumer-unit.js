/**
 * ESA OS — Energy Domain
 * ConsumerUnit
 *
 * Representa uma unidade consumidora beneficiária de créditos de energia.
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado. Sem lógica tarifária.
 */

export const TARIFF_CLASS = {
  RESIDENTIAL:       'RESIDENTIAL',
  COMMERCIAL:        'COMMERCIAL',
  INDUSTRIAL:        'INDUSTRIAL',
  RURAL:             'RURAL',
  PUBLIC_POWER:      'PUBLIC_POWER',
  PUBLIC_LIGHTING:   'PUBLIC_LIGHTING',
  OTHER:             'OTHER',
};

export const CONNECTION_TYPE = {
  MONOPHASIC:  'MONOPHASIC',  // Monofásico
  BIPHASIC:    'BIPHASIC',    // Bifásico
  TRIPHASIC:   'TRIPHASIC',   // Trifásico
};

export class ConsumerUnit {
  /**
   * @param {string}  distributor            - Distribuidora (ex: 'Copel')
   * @param {string}  unitNumber             - Número da unidade consumidora
   * @param {string}  installationNumber     - Número de instalação
   * @param {string}  holderName             - Nome do titular
   * @param {string}  organizationId         - ID da organização gestora
   * @param {string}  customerId             - ID do cliente
   * @param {string}  buyerId                - ID do comprador/assinante
   * @param {string}  address                - Endereço da unidade
   * @param {string}  tariffClass            - TARIFF_CLASS.*
   * @param {string}  voltageGroup           - Grupo de tensão ('A' ou 'B')
   * @param {string}  connectionType         - CONNECTION_TYPE.*
   * @param {number}  averageConsumptionKwh  - Consumo médio mensal (kWh)
   * @param {boolean} active                 - Unidade ativa
   * @param {Object}  metadata               - Dados extras (cpfCnpj ref, notes)
   */
  constructor(
    distributor           = '',
    unitNumber            = '',
    installationNumber    = '',
    holderName            = '',
    organizationId        = '',
    customerId            = '',
    buyerId               = '',
    address               = '',
    tariffClass           = TARIFF_CLASS.RESIDENTIAL,
    voltageGroup          = 'B',
    connectionType        = CONNECTION_TYPE.MONOPHASIC,
    averageConsumptionKwh = 0,
    active                = true,
    metadata              = {}
  ) {
    this.id                    = ConsumerUnit._generateId();
    this.distributor           = distributor;
    this.unitNumber            = unitNumber;
    this.installationNumber    = installationNumber;
    this.holderName            = holderName;
    this.organizationId        = organizationId;
    this.customerId            = customerId;
    this.buyerId               = buyerId;
    this.address               = address;
    this.tariffClass           = tariffClass;
    this.voltageGroup          = voltageGroup;
    this.connectionType        = connectionType;
    this.averageConsumptionKwh = averageConsumptionKwh;
    this.active                = active;
    this.metadata              = metadata;
    this.createdAt             = Date.now();
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
