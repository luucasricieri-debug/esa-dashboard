/**
 * ESA OS — Energy Domain
 * GenerationUnit
 *
 * Representa uma unidade geradora registrada na distribuidora.
 * Vincula um Asset (SolarPlant) à ANEEL/distribuidora para fins regulatórios.
 *
 * IMPORTANTE: NÃO conectado ao Dashboard legado.
 */

export const GENERATION_TYPE = {
  SOLAR_PHOTOVOLTAIC: 'SOLAR_PHOTOVOLTAIC', // Fotovoltaico
  WIND:               'WIND',               // Eólico
  HYDRO:              'HYDRO',              // Hidrelétrico
  BIOMASS:            'BIOMASS',            // Biomassa
  OTHER:              'OTHER',
};

export class GenerationUnit {
  /**
   * @param {string}  distributor        - Distribuidora (ex: 'Copel')
   * @param {string}  unitNumber         - Número da unidade geradora
   * @param {string}  installationNumber - Número de instalação
   * @param {string}  holderName         - Nome do titular
   * @param {string}  organizationId     - ID da organização gestora
   * @param {string}  assetId            - ID do Asset (SolarPlant) vinculado
   * @param {string}  generationType     - GENERATION_TYPE.*
   * @param {number}  installedPowerKw   - Potência instalada (kW)
   * @param {number}  connectionDate     - Timestamp de conexão com a rede (ms)
   * @param {boolean} active             - Unidade ativa
   * @param {Object}  metadata           - Dados extras (aneel ref, notes)
   */
  constructor(
    distributor        = '',
    unitNumber         = '',
    installationNumber = '',
    holderName         = '',
    organizationId     = '',
    assetId            = '',
    generationType     = GENERATION_TYPE.SOLAR_PHOTOVOLTAIC,
    installedPowerKw   = 0,
    connectionDate     = null,
    active             = true,
    metadata           = {}
  ) {
    this.id                 = GenerationUnit._generateId();
    this.distributor        = distributor;
    this.unitNumber         = unitNumber;
    this.installationNumber = installationNumber;
    this.holderName         = holderName;
    this.organizationId     = organizationId;

    /**
     * @type {string} Vínculo com SolarPlant no Assets Domain.
     * TODO: Sincronizar dados quando SolarPlant for atualizada
     */
    this.assetId         = assetId;
    this.generationType  = generationType;
    this.installedPowerKw = installedPowerKw;
    this.connectionDate  = connectionDate;
    this.active          = active;
    this.metadata        = metadata;
    this.createdAt       = Date.now();
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
