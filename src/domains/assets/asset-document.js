/**
 * ESA OS — Assets Domain
 * AssetDocument
 *
 * Representa um documento vinculado a um ativo energético.
 *
 * IMPORTANTE: NÃO usa Firebase Storage. NÃO conectado ao Dashboard legado.
 */

export const ASSET_DOCUMENT_TYPE = {
  PROJECT:           'PROJECT',           // Projeto elétrico / fotovoltaico
  DATASHEET:         'DATASHEET',         // Datasheet do equipamento
  INVOICE:           'INVOICE',           // Nota fiscal de aquisição
  CONTRACT:          'CONTRACT',          // Contrato relacionado ao ativo
  HOMOLOGATION:      'HOMOLOGATION',      // Documentação de homologação
  LICENSE:           'LICENSE',           // Licença ou alvará
  WARRANTY:          'WARRANTY',          // Termo de garantia
  MANUAL:            'MANUAL',            // Manual técnico
  INSPECTION_REPORT: 'INSPECTION_REPORT', // Laudo de inspeção
  TECHNICAL_REPORT:  'TECHNICAL_REPORT',  // Relatório técnico
  OTHER:             'OTHER',
};

export class AssetDocument {
  /**
   * @param {string} assetId     - ID do ativo
   * @param {string} type        - ASSET_DOCUMENT_TYPE.*
   * @param {string} name        - Nome do arquivo
   * @param {string} url         - URL de acesso (armazenado externamente)
   * @param {string} uploadedBy  - UID da Person que enviou
   * @param {number} version     - Versão do documento
   * @param {number} issuedAt    - Timestamp de emissão do documento (ms)
   * @param {number} expiresAt   - Timestamp de validade (null se não vence)
   * @param {Object} metadata    - Dados extras (mimeType, sizeBytes, description)
   */
  constructor(
    assetId    = '',
    type       = ASSET_DOCUMENT_TYPE.OTHER,
    name       = '',
    url        = '',
    uploadedBy = '',
    version    = 1,
    issuedAt   = null,
    expiresAt  = null,
    metadata   = {}
  ) {
    this.id         = AssetDocument._generateId();
    this.assetId    = assetId;
    this.type       = type;
    this.name       = name;
    this.url        = url;
    this.uploadedBy = uploadedBy;
    this.version    = version;
    this.issuedAt   = issuedAt;
    this.expiresAt  = expiresAt;
    this.metadata   = metadata;
    this.createdAt  = Date.now();
  }

  /**
   * @param {number} [atTime]
   * @returns {boolean}
   * TODO: Retornar expiresAt !== null && atTime > expiresAt
   */
  isExpired(atTime = Date.now()) {
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
