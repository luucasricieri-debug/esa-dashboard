/**
 * ESA OS — Energy Domain
 * EnergyOperation
 *
 * Entidade central do Energy Domain.
 * Representa uma operação energética administrada pela ESA.
 *
 * Responsabilidades:
 * - Agrupar ativos, contratos, investidores e compradores sob uma operação
 * - Controlar ciclo de vida da operação energética
 * - Preparar vínculos com geração, compensação e liquidação
 *
 * IMPORTANTE: Sem lógica comercial. NÃO conectado ao Dashboard legado.
 */

export const OPERATION_TYPE = {
  SUBSCRIPTION_ENERGY: 'SUBSCRIPTION_ENERGY', // Assinatura de energia (BDGD/GD)
  SELF_CONSUMPTION:    'SELF_CONSUMPTION',     // Autoconsumo remoto
  INVESTMENT_PLANT:    'INVESTMENT_PLANT',     // Usina de investimento
  BATTERY_OPERATION:   'BATTERY_OPERATION',   // Operação de bateria
  EV_CHARGING:         'EV_CHARGING',         // Operação de recarga EV
  FREE_MARKET:         'FREE_MARKET',          // Mercado livre de energia
  OTHER:               'OTHER',
};

export const OPERATION_STATUS = {
  DRAFT:     'DRAFT',     // Em configuração
  ACTIVE:    'ACTIVE',    // Em operação
  SUSPENDED: 'SUSPENDED', // Suspensa temporariamente
  CLOSING:   'CLOSING',   // Em processo de encerramento
  CLOSED:    'CLOSED',    // Encerrada
};

export class EnergyOperation {
  /**
   * @param {string}   name           - Nome da operação (ex: 'GD Curitiba Lote 1')
   * @param {string}   operationType  - OPERATION_TYPE.*
   * @param {string}   organizationId - ID da organização gestora
   * @param {string}   distributor    - Nome da distribuidora (ex: 'Copel')
   * @param {string[]} assetIds       - IDs dos ativos vinculados
   * @param {string[]} contractIds    - IDs dos contratos vinculados
   * @param {string[]} investorIds    - IDs dos investidores
   * @param {string[]} buyerIds       - IDs dos compradores/assinantes
   * @param {number}   startedAt      - Timestamp de início da operação (ms)
   * @param {number}   closedAt       - Timestamp de encerramento (ms, null se ativa)
   * @param {Object}   metadata       - Dados extras (notes, region)
   */
  constructor(
    name           = '',
    operationType  = OPERATION_TYPE.OTHER,
    organizationId = '',
    distributor    = '',
    assetIds       = [],
    contractIds    = [],
    investorIds    = [],
    buyerIds       = [],
    startedAt      = null,
    closedAt       = null,
    metadata       = {}
  ) {
    this.id            = EnergyOperation._generateId();
    this.name          = name;
    this.operationType = operationType;
    this.organizationId = organizationId;
    this.distributor   = distributor;
    this.assetIds      = assetIds;
    this.contractIds   = contractIds;
    this.investorIds   = investorIds;
    this.buyerIds      = buyerIds;
    this.status        = OPERATION_STATUS.DRAFT;
    this.startedAt     = startedAt;
    this.closedAt      = closedAt;
    this.metadata      = metadata;
    this.createdAt     = Date.now();
    this.updatedAt     = Date.now();
  }

  /**
   * @returns {boolean}
   * TODO: Retornar status === ACTIVE
   */
  isActive() {
    // TODO: implementar
    return false;
  }

  /**
   * @param {string} assetId
   * TODO: Adicionar a assetIds se não duplicado
   */
  addAsset(assetId) {
    // TODO: implementar
  }

  /**
   * @param {string} buyerId
   * TODO: Adicionar a buyerIds se não duplicado
   */
  addBuyer(buyerId) {
    // TODO: implementar
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
