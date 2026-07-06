/**
 * ESA OS — Energy Domain
 * EnergyContract
 *
 * Contrato energético vinculado a uma EnergyOperation.
 *
 * IMPORTANTE: Sem fórmulas financeiras. NÃO conectado ao Dashboard legado.
 */

export const ENERGY_CONTRACT_TYPE = {
  SUBSCRIPTION:    'SUBSCRIPTION',    // Assinatura de energia (GD)
  ENERGY_PURCHASE: 'ENERGY_PURCHASE', // Compra de energia
  ENERGY_SALE:     'ENERGY_SALE',     // Venda de energia
  ASSET_MANAGEMENT:'ASSET_MANAGEMENT',// Gestão de ativo
  INVESTMENT:      'INVESTMENT',      // Contrato de investimento
  CO_INVESTMENT:   'CO_INVESTMENT',   // Co-investimento
  OTHER:           'OTHER',
};

export const CONTRACT_STATUS = {
  DRAFT:     'DRAFT',
  ACTIVE:    'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED:'TERMINATED',
  EXPIRED:   'EXPIRED',
};

export class EnergyContract {
  /**
   * @param {string} operationId          - ID da EnergyOperation
   * @param {string} contractType         - ENERGY_CONTRACT_TYPE.*
   * @param {string} customerId           - ID do cliente
   * @param {string} investorId           - ID do investidor (null se não aplicável)
   * @param {string} buyerId              - ID do comprador (null se não aplicável)
   * @param {string} assetId             - ID do ativo vinculado
   * @param {number} startDate            - Timestamp de início (ms)
   * @param {number} endDate              - Timestamp de término (ms, null se indeterminado)
   * @param {number} contractedKwh        - kWh contratados por período
   * @param {number} contractedPercentage - % de energia contratada
   * @param {number} pricePerKwh          - Preço por kWh (R$)
   * @param {number} discountPercentage   - Desconto concedido (%)
   * @param {number} managementFee        - Taxa de gestão (%)
   * @param {Object} metadata             - Dados extras (notes, externalRef)
   */
  constructor(
    operationId          = '',
    contractType         = ENERGY_CONTRACT_TYPE.OTHER,
    customerId           = '',
    investorId           = null,
    buyerId              = null,
    assetId              = null,
    startDate            = null,
    endDate              = null,
    contractedKwh        = 0,
    contractedPercentage = 0,
    pricePerKwh          = 0,
    discountPercentage   = 0,
    managementFee        = 0,
    metadata             = {}
  ) {
    this.id                  = EnergyContract._generateId();
    this.operationId         = operationId;
    this.contractType        = contractType;
    this.customerId          = customerId;
    this.investorId          = investorId;
    this.buyerId             = buyerId;
    this.assetId             = assetId;
    this.startDate           = startDate;
    this.endDate             = endDate;
    this.contractedKwh       = contractedKwh;
    this.contractedPercentage = contractedPercentage;
    this.pricePerKwh         = pricePerKwh;
    this.discountPercentage  = discountPercentage;
    this.managementFee       = managementFee;
    this.status              = CONTRACT_STATUS.DRAFT;
    this.metadata            = metadata;
    this.createdAt           = Date.now();
  }

  /**
   * @param {number} [atTime]
   * @returns {boolean}
   * TODO: Verificar endDate e status
   */
  isActive(atTime = Date.now()) {
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
