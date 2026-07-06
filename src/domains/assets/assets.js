/**
 * ESA OS — Assets Domain
 * Assets (Facade)
 *
 * Fachada pública do Assets Domain.
 * Único ponto de entrada para gestão de ativos energéticos.
 *
 * Responsabilidades:
 * - Criar e registrar ativos (SolarPlant, BatterySystem, EVCharger)
 * - Gerenciar proprietários e documentos de ativos
 * - Registrar métricas de desempenho
 * - Prover consultas operacionais
 * - Delegar persistência ao AssetRepository
 *
 * Padrão: Facade
 * Consumo: import { assets } from 'src/domains/assets/index.js'
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado.
 * Sem integração com Energy, Operations, Financial nesta versão.
 */

import { AssetRepository }  from './asset-repository.js';
import { Asset }            from './asset.js';
import { SolarPlant }       from './solar-plant.js';
import { BatterySystem }    from './battery-system.js';
import { EVCharger }        from './ev-charger.js';
import { AssetOwner }       from './asset-owner.js';
import { AssetDocument }    from './asset-document.js';
import { AssetMetric }      from './asset-metric.js';
import { ASSET_STATUS, ACTIVE_STATUSES } from './asset-status.js';

export class Assets {
  constructor() {
    /** @type {AssetRepository} */
    this._repository = new AssetRepository();
  }

  /**
   * Cria um ativo genérico.
   * @param {Object} params
   * @returns {Promise<Asset>}
   *
   * TODO: Validar campos obrigatórios (name, type, organizationId)
   * TODO: Persistir via _repository.saveAsset()
   */
  async createAsset(params = {}) {
    // TODO: implementar
    return new Asset('');
  }

  /**
   * Registra uma usina fotovoltaica.
   * @param {Object} params
   * @returns {Promise<SolarPlant>}
   *
   * TODO: Criar SolarPlant e persistir
   * TODO: Gerar code sequencial para a organização
   */
  async registerSolarPlant(params = {}) {
    // TODO: implementar
    return new SolarPlant('');
  }

  /**
   * Registra um sistema de bateria.
   * @param {Object} params
   * @returns {Promise<BatterySystem>}
   *
   * TODO: Criar BatterySystem e persistir
   */
  async registerBatterySystem(params = {}) {
    // TODO: implementar
    return new BatterySystem('');
  }

  /**
   * Registra uma estação de recarga.
   * @param {Object} params
   * @returns {Promise<EVCharger>}
   *
   * TODO: Criar EVCharger e persistir
   */
  async registerEVCharger(params = {}) {
    // TODO: implementar
    return new EVCharger('');
  }

  /**
   * Adiciona um proprietário a um ativo.
   * @param {string} assetId
   * @param {Object} ownerParams
   * @returns {Promise<AssetOwner>}
   *
   * TODO: Validar que soma de ownershipPercentage não ultrapassa 100%
   * TODO: Criar AssetOwner e persistir
   */
  async addOwner(assetId, ownerParams = {}) {
    // TODO: implementar
    return new AssetOwner(assetId);
  }

  /**
   * Remove um proprietário de um ativo.
   * @param {string} assetId
   * @param {string} ownerId
   * @returns {Promise<void>}
   *
   * TODO: Chamar AssetOwner.exit() e persistir
   */
  async removeOwner(assetId, ownerId) {
    // TODO: implementar
  }

  /**
   * Adiciona um documento a um ativo.
   * @param {string} assetId
   * @param {Object} documentParams
   * @returns {Promise<AssetDocument>}
   *
   * TODO: Criar AssetDocument e persistir
   * TODO: NÃO realizar upload — url deve ser fornecida após upload externo
   */
  async addDocument(assetId, documentParams = {}) {
    // TODO: implementar
    return new AssetDocument(assetId);
  }

  /**
   * Registra uma métrica de desempenho de ativo.
   * @param {string} assetId
   * @param {Object} metricParams
   * @returns {Promise<AssetMetric>}
   *
   * TODO: Criar AssetMetric e persistir
   */
  async recordMetric(assetId, metricParams = {}) {
    // TODO: implementar
    return new AssetMetric(assetId);
  }

  /**
   * Retorna um ativo pelo ID.
   * @param {string} organizationId
   * @param {string} assetId
   * @returns {Promise<Asset|null>}
   */
  async getAsset(organizationId, assetId) {
    // TODO: Delegar para _repository.getAsset()
    return null;
  }

  /**
   * Retorna ativos com filtros.
   * @param {string} organizationId
   * @param {Object} [filters]
   * @param {number} [limit=50]
   * @returns {Promise<Asset[]>}
   */
  async getAssets(organizationId, filters = {}, limit = 50) {
    // TODO: Delegar para _repository.getAssets()
    return [];
  }

  /**
   * Retorna ativos de um proprietário específico.
   * @param {string} organizationId
   * @param {string} ownerId
   * @returns {Promise<Asset[]>}
   */
  async getAssetsByOwner(organizationId, ownerId) {
    // TODO: Delegar para _repository.getAssetsByOwner()
    return [];
  }

  /**
   * Retorna ativos de um cliente específico.
   * @param {string} organizationId
   * @param {string} customerId
   * @returns {Promise<Asset[]>}
   */
  async getAssetsByCustomer(organizationId, customerId) {
    // TODO: Delegar para _repository.getAssetsByCustomer()
    return [];
  }

  /**
   * Retorna apenas ativos em status operacional.
   * @param {string} organizationId
   * @returns {Promise<Asset[]>}
   *
   * TODO: Filtrar por ACTIVE_STATUSES
   */
  async getOperationalAssets(organizationId) {
    // TODO: implementar
    return [];
  }

  /**
   * Retorna resumo de saúde de um ativo.
   * @param {string} organizationId
   * @param {string} assetId
   * @returns {Promise<Object>}
   *
   * TODO: Retornar { status, lastMetrics, openWorkOrders, documentsExpired }
   * TODO: openWorkOrders depende de integração com Operations Domain (futuro)
   */
  async getAssetHealth(organizationId, assetId) {
    // TODO: implementar
    return {};
  }
}
