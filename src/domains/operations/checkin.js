/**
 * ESA OS — Operations Domain
 * FieldCheckIn
 *
 * Registra o check-in e check-out de um técnico em uma WorkOrder.
 *
 * Responsabilidades:
 * - Modelar a entrada e saída de campo de um técnico
 * - Armazenar geolocalização no momento do registro
 * - Opcionalmente vincular foto de confirmação
 * - Preparar cálculo automático de tempo em campo
 *
 * IMPORTANTE:
 * NÃO acessa GPS real.
 * NÃO usa navigator.geolocation.
 * As coordenadas são recebidas como parâmetros — coletadas pela camada de UI.
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 */

/**
 * Tipo do registro de campo.
 */
export const CHECKIN_TYPE = {
  CHECK_IN:  'CHECK_IN',  // Chegada ao local de atendimento
  CHECK_OUT: 'CHECK_OUT', // Saída do local após atendimento
};

/**
 * Registro de check-in ou check-out de campo.
 */
export class FieldCheckIn {
  /**
   * @param {string} workOrderId - ID da WorkOrder
   * @param {string} technicianId - ID do Technician
   * @param {string} type        - CHECKIN_TYPE.*
   * @param {number} latitude    - Latitude capturada pelo dispositivo
   * @param {number} longitude   - Longitude capturada pelo dispositivo
   * @param {number} accuracy    - Precisão em metros (reportada pelo GPS do dispositivo)
   * @param {string} photoUrl    - URL da foto de confirmação (opcional)
   * @param {Object} metadata    - Dados extras (deviceId, appVersion, network)
   */
  constructor(
    workOrderId,
    technicianId = '',
    type         = CHECKIN_TYPE.CHECK_IN,
    latitude     = null,
    longitude    = null,
    accuracy     = null,
    photoUrl     = null,
    metadata     = {}
  ) {
    /** @type {string} */
    this.id = FieldCheckIn._generateId();

    this.workOrderId  = workOrderId;
    this.technicianId = technicianId;
    this.type         = type;

    /**
     * Coordenadas fornecidas pelo cliente (dispositivo do técnico).
     * NÃO coletadas por este arquivo.
     * TODO: Validar que coordenadas estão dentro de intervalo razoável
     */
    this.latitude  = latitude;
    this.longitude = longitude;
    this.accuracy  = accuracy;

    /** @type {string|null} URL da foto capturada no momento do check-in */
    this.photoUrl = photoUrl;

    this.metadata = metadata;

    /** @type {number} Timestamp registrado no servidor no momento do registro */
    this.timestamp = Date.now();
  }

  /**
   * Verifica se este registro é um check-in.
   * @returns {boolean}
   *
   * TODO: Retornar type === CHECKIN_TYPE.CHECK_IN
   */
  isCheckIn() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se este registro é um check-out.
   * @returns {boolean}
   *
   * TODO: Retornar type === CHECKIN_TYPE.CHECK_OUT
   */
  isCheckOut() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se o registro possui localização.
   * @returns {boolean}
   *
   * TODO: Retornar latitude !== null && longitude !== null
   */
  hasLocation() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se a precisão GPS é aceitável para validade do check-in.
   * @param {number} [maxAccuracyMeters] - Padrão: 100 metros
   * @returns {boolean}
   *
   * TODO: Retornar accuracy !== null && accuracy <= maxAccuracyMeters
   */
  hasAcceptableAccuracy(maxAccuracyMeters = 100) {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * @param {Object} data
   * @returns {FieldCheckIn}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new FieldCheckIn('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
