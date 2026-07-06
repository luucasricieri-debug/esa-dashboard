/**
 * ESA OS — Assets Domain
 * AssetOwner
 *
 * Representa o vínculo de propriedade entre uma Person/Organização e um Asset.
 *
 * Responsabilidades:
 * - Modelar quotas e tipos de propriedade
 * - Preparar gestão de múltiplos proprietários (co-investimento)
 * - Registrar entrada e saída de propriedade
 *
 * IMPORTANTE: Sem lógica financeira. NÃO conectado ao Dashboard legado.
 */

export const OWNERSHIP_TYPE = {
  DIRECT:                'DIRECT',               // Proprietário direto do ativo
  INVESTMENT_QUOTA:      'INVESTMENT_QUOTA',      // Quota de fundo de investimento
  CO_INVESTMENT:         'CO_INVESTMENT',         // Co-investimento entre partes
  FOUNDER_PARTICIPATION: 'FOUNDER_PARTICIPATION', // Participação de fundador
  OTHER:                 'OTHER',
};

export class AssetOwner {
  /**
   * @param {string}  assetId             - ID do Asset
   * @param {string}  personId            - UID da Person proprietária
   * @param {string}  organizationId      - ID da organização
   * @param {number}  ownershipPercentage - Percentual de propriedade (0-100)
   * @param {string}  ownershipType       - OWNERSHIP_TYPE.*
   * @param {number}  acquiredAt          - Timestamp de aquisição (ms)
   * @param {number}  exitedAt            - Timestamp de saída (ms, null se ainda ativo)
   * @param {boolean} active              - Propriedade ativa
   * @param {Object}  metadata            - Dados extras (investmentAmount, notes)
   */
  constructor(
    assetId             = '',
    personId            = '',
    organizationId      = '',
    ownershipPercentage = 0,
    ownershipType       = OWNERSHIP_TYPE.DIRECT,
    acquiredAt          = null,
    exitedAt            = null,
    active              = true,
    metadata            = {}
  ) {
    this.id                  = AssetOwner._generateId();
    this.assetId             = assetId;
    this.personId            = personId;
    this.organizationId      = organizationId;
    this.ownershipPercentage = ownershipPercentage;
    this.ownershipType       = ownershipType;
    this.acquiredAt          = acquiredAt ?? Date.now();
    this.exitedAt            = exitedAt;
    this.active              = active;
    this.metadata            = metadata;
  }

  /**
   * Registra saída da propriedade.
   * @param {number} [exitedAt]
   * TODO: Setar exitedAt e active = false
   */
  exit(exitedAt = Date.now()) {
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
