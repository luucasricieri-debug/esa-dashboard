/**
 * ESA OS — Assets Domain
 * AssetRepository
 *
 * Contrato de persistência do Assets Domain.
 *
 * Firebase RTDB paths previstos (NÃO implementar agora):
 *   assets/registry/{orgId}/{assetId}
 *   assets/owners/{assetId}/{ownerId}
 *   assets/documents/{assetId}/{docId}
 *   assets/metrics/{assetId}/{metricId}
 *   assets/locations/{assetId}
 *
 * IMPORTANTE: NÃO usa Firebase. NÃO importa FirebaseService.
 * NÃO conectado ao Dashboard legado.
 */

export class AssetRepository {

  // ─── Assets ────────────────────────────────────────────────────────────────

  /**
   * @param {string} organizationId
   * @param {string} assetId
   * @returns {Promise<Asset|null>}
   * TODO: Firebase: get assets/registry/{organizationId}/{assetId}
   */
  async getAsset(organizationId, assetId) {
    // TODO: implementar
    return null;
  }

  /**
   * @param {string} organizationId
   * @param {Object} [filters] - { type, status, customerId }
   * @returns {Promise<Asset[]>}
   * TODO: Firebase: query assets/registry/{organizationId}
   */
  async getAssets(organizationId, filters = {}) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {string} type - ASSET_TYPE.*
   * @returns {Promise<Asset[]>}
   * TODO: Delegar para getAssets({ type })
   */
  async getAssetsByType(organizationId, type) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {string} ownerId
   * @returns {Promise<Asset[]>}
   * TODO: Buscar AssetOwners por personId e retornar seus Assets
   */
  async getAssetsByOwner(organizationId, ownerId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {string} customerId
   * @returns {Promise<Asset[]>}
   * TODO: Delegar para getAssets({ customerId })
   */
  async getAssetsByCustomer(organizationId, customerId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string} organizationId
   * @param {Asset}  asset
   * @returns {Promise<void>}
   */
  async saveAsset(organizationId, asset) {
    // TODO: implementar
  }

  /**
   * @param {string} organizationId
   * @param {string} assetId
   * @returns {Promise<void>}
   * TODO: Soft delete — setar status = DECOMMISSIONED
   */
  async deleteAsset(organizationId, assetId) {
    // TODO: implementar
  }

  // ─── Owners ────────────────────────────────────────────────────────────────

  /**
   * @param {string} assetId
   * @returns {Promise<AssetOwner[]>}
   * TODO: Firebase: get assets/owners/{assetId}
   */
  async getOwners(assetId) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}     assetId
   * @param {AssetOwner} owner
   * @returns {Promise<void>}
   */
  async saveOwner(assetId, owner) {
    // TODO: implementar
  }

  // ─── Documents ─────────────────────────────────────────────────────────────

  /**
   * @param {string} assetId
   * @param {string} [type] - ASSET_DOCUMENT_TYPE.*
   * @returns {Promise<AssetDocument[]>}
   */
  async getDocuments(assetId, type = null) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}        assetId
   * @param {AssetDocument} document
   * @returns {Promise<void>}
   */
  async saveDocument(assetId, document) {
    // TODO: implementar
  }

  // ─── Metrics ───────────────────────────────────────────────────────────────

  /**
   * @param {string} assetId
   * @param {Object} [filters] - { metric, from, to, limit }
   * @returns {Promise<AssetMetric[]>}
   * TODO: Firebase: query assets/metrics/{assetId}
   */
  async getMetrics(assetId, filters = {}) {
    // TODO: implementar
    return [];
  }

  /**
   * @param {string}      assetId
   * @param {AssetMetric} metric
   * @returns {Promise<void>}
   */
  async saveMetric(assetId, metric) {
    // TODO: implementar
  }
}
