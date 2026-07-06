/**
 * ESA OS — Assets Domain
 * Asset
 *
 * Entidade base de todos os ativos energéticos da plataforma ESA OS.
 *
 * Responsabilidades:
 * - Modelar identidade, localização e características físicas de um ativo
 * - Registrar ciclo de vida (planejado → operacional → descomissionado)
 * - Ser a base para SolarPlant, BatterySystem e EVCharger
 * - Preparar vínculos com Energy, Operations, Financial, Engineering, Investors
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado. Sem Firebase nesta versão.
 */

import { ASSET_TYPE } from './asset-type.js';
import { ASSET_STATUS } from './asset-status.js';

export class Asset {
  /**
   * @param {string}   name            - Nome do ativo (ex: 'UFV Curitiba 1')
   * @param {string}   type            - ASSET_TYPE.*
   * @param {string}   organizationId  - ID da organização gestora
   * @param {string}   customerId      - ID do cliente proprietário/beneficiário
   * @param {string}   code            - Código interno do ativo (ex: 'UFV-001')
   * @param {string}   status          - ASSET_STATUS.*
   * @param {string[]} ownerIds        - IDs dos AssetOwner vinculados
   * @param {string}   projectId       - ID do projeto de engenharia (futuro)
   * @param {string}   contractId      - ID do contrato de serviço/O&M (futuro)
   * @param {string}   address         - Endereço do ativo
   * @param {number}   latitude        - Latitude (recebida como parâmetro — sem GPS)
   * @param {number}   longitude       - Longitude
   * @param {number}   commissionedAt  - Timestamp de comissionamento (ms)
   * @param {number}   installedAt     - Timestamp de instalação (ms)
   * @param {number}   acquisitionValue - Valor de aquisição (R$)
   * @param {number}   currentValue    - Valor atual do ativo (R$)
   * @param {string}   manufacturer    - Fabricante
   * @param {string}   model           - Modelo
   * @param {string}   serialNumber    - Número de série
   * @param {number}   capacity        - Capacidade nominal
   * @param {string}   capacityUnit    - Unidade da capacidade (ex: 'kWp', 'kWh', 'kW')
   * @param {Object}   metadata        - Dados extras
   */
  constructor(
    name,
    type             = ASSET_TYPE.OTHER,
    organizationId   = '',
    customerId       = '',
    code             = '',
    status           = ASSET_STATUS.PLANNED,
    ownerIds         = [],
    projectId        = null,
    contractId       = null,
    address          = '',
    latitude         = null,
    longitude        = null,
    commissionedAt   = null,
    installedAt      = null,
    acquisitionValue = null,
    currentValue     = null,
    manufacturer     = '',
    model            = '',
    serialNumber     = '',
    capacity         = null,
    capacityUnit     = '',
    metadata         = {}
  ) {
    /** @type {string} */
    this.id = Asset._generateId();

    this.name            = name;
    this.type            = type;
    this.organizationId  = organizationId;
    this.customerId      = customerId;
    this.code            = code;
    this.status          = status;
    this.ownerIds        = ownerIds;
    this.projectId       = projectId;
    this.contractId      = contractId;
    this.address         = address;
    this.latitude        = latitude;
    this.longitude       = longitude;
    this.commissionedAt  = commissionedAt;
    this.installedAt     = installedAt;
    this.acquisitionValue = acquisitionValue;
    this.currentValue    = currentValue;
    this.manufacturer    = manufacturer;
    this.model           = model;
    this.serialNumber    = serialNumber;
    this.capacity        = capacity;
    this.capacityUnit    = capacityUnit;
    this.metadata        = metadata;
    this.createdAt       = Date.now();
    this.updatedAt       = Date.now();
  }

  /**
   * @returns {boolean}
   * TODO: Delegar para isActiveStatus(this.status)
   */
  isOperational() {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {boolean}
   * TODO: Delegar para isTerminalStatus(this.status)
   */
  isDecommissioned() {
    // TODO: implementar
    return false;
  }

  /**
   * @param {string} status - ASSET_STATUS.*
   * TODO: Validar transição; atualizar updatedAt
   */
  transitionTo(status) {
    // TODO: implementar
  }

  /**
   * @param {string} ownerId
   * TODO: Adicionar a ownerIds se não duplicado
   */
  addOwner(ownerId) {
    // TODO: implementar
  }

  /**
   * @param {string} ownerId
   * TODO: Remover de ownerIds
   */
  removeOwner(ownerId) {
    // TODO: implementar
  }

  /**
   * Retorna idade do ativo em anos desde a instalação.
   * @returns {number|null}
   * TODO: Calcular a partir de installedAt
   */
  getAgeYears() {
    // TODO: implementar
    return null;
  }

  /** @returns {Object} */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {Asset}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new Asset('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
