/**
 * ESA OS — Assets Domain
 * AssetLocation
 *
 * Modela a localização física de um ativo energético.
 *
 * IMPORTANTE: NÃO acessa GPS. NÃO conectado ao Dashboard legado.
 * Coordenadas são recebidas como parâmetros — coletadas externamente.
 */

export class AssetLocation {
  /**
   * @param {string} assetId         - ID do ativo
   * @param {string} address         - Logradouro e número
   * @param {string} city            - Município
   * @param {string} state           - Estado (UF)
   * @param {string} postalCode      - CEP
   * @param {string} country         - País (padrão: 'BR')
   * @param {number} latitude        - Latitude decimal
   * @param {number} longitude       - Longitude decimal
   * @param {string} distributorArea - Área de concessão da distribuidora
   * @param {string} timezone        - Fuso horário (ex: 'America/Sao_Paulo')
   * @param {Object} metadata        - Dados extras (zone, region, notes)
   */
  constructor(
    assetId         = '',
    address         = '',
    city            = '',
    state           = '',
    postalCode      = '',
    country         = 'BR',
    latitude        = null,
    longitude       = null,
    distributorArea = '',
    timezone        = 'America/Sao_Paulo',
    metadata        = {}
  ) {
    this.assetId         = assetId;
    this.address         = address;
    this.city            = city;
    this.state           = state;
    this.postalCode      = postalCode;
    this.country         = country;
    this.latitude        = latitude;
    this.longitude       = longitude;
    this.distributorArea = distributorArea;
    this.timezone        = timezone;
    this.metadata        = metadata;
  }

  /**
   * @returns {boolean}
   * TODO: Retornar latitude !== null && longitude !== null
   */
  hasCoordinates() {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {string} - Ex: 'Curitiba, PR'
   * TODO: implementar
   */
  getShortLabel() {
    // TODO: implementar
    return '';
  }

  /** @returns {Object} */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {AssetLocation}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new AssetLocation();
  }
}
