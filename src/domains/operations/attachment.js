/**
 * ESA OS — Operations Domain
 * OperationsAttachment
 *
 * Representa um arquivo anexado a uma WorkOrder em campo.
 *
 * Responsabilidades:
 * - Modelar todos os tipos de arquivo de campo (foto, vídeo, laudo, etc.)
 * - Registrar metadata de captura (localização, timestamp, técnico)
 * - Preparar estrutura para upload futuro em Firebase Storage ou S3
 * - Não armazenar binários — apenas referência ao arquivo externo
 *
 * Tipos cobertos:
 * - Foto de campo (antes, durante, depois)
 * - Vídeo de instalação
 * - Laudo técnico (PDF)
 * - Projeto elétrico (DWG, PDF)
 * - Diagrama unifiliar
 * - Nota técnica
 * - Documento do cliente
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não acessa Firebase Storage nesta versão.
 */

/**
 * Tipos de anexo suportados.
 */
export const ATTACHMENT_TYPE = {
  PHOTO:          'PHOTO',          // Foto de campo
  VIDEO:          'VIDEO',          // Vídeo de campo
  DOCUMENT:       'DOCUMENT',       // Documento genérico (PDF, DOC)
  TECHNICAL_REPORT: 'TECHNICAL_REPORT', // Laudo técnico
  PROJECT:        'PROJECT',        // Projeto elétrico/fotovoltaico
  DIAGRAM:        'DIAGRAM',        // Diagrama unifiliar ou de blocos
  TECHNICAL_NOTE: 'TECHNICAL_NOTE', // Nota técnica interna
  OTHER:          'OTHER',
};

/**
 * Arquivo anexado a uma WorkOrder em campo.
 */
export class OperationsAttachment {
  /**
   * @param {string} workOrderId  - ID da WorkOrder
   * @param {string} type         - ATTACHMENT_TYPE.*
   * @param {string} name         - Nome do arquivo
   * @param {string} url          - URL do arquivo armazenado
   * @param {string} mimeType     - MIME type (ex: 'image/jpeg', 'application/pdf')
   * @param {number} sizeBytes    - Tamanho em bytes
   * @param {string} uploadedBy   - UID do técnico que enviou
   * @param {number} capturedAt   - Timestamp de captura (ms) — pode diferir do upload
   * @param {number} latitude     - Latitude de captura (null se não disponível)
   * @param {number} longitude    - Longitude de captura (null se não disponível)
   * @param {Object} metadata     - Dados extras (description, step, exifData)
   */
  constructor(
    workOrderId,
    type        = ATTACHMENT_TYPE.PHOTO,
    name        = '',
    url         = '',
    mimeType    = '',
    sizeBytes   = 0,
    uploadedBy  = '',
    capturedAt  = null,
    latitude    = null,
    longitude   = null,
    metadata    = {}
  ) {
    /** @type {string} */
    this.id = OperationsAttachment._generateId();

    this.workOrderId = workOrderId;
    this.type        = type;
    this.name        = name;

    /**
     * @type {string} URL de acesso ao arquivo.
     * TODO: Integrar com Firebase Storage para gerar URL assinada
     */
    this.url = url;

    this.mimeType   = mimeType;
    this.sizeBytes  = sizeBytes;
    this.uploadedBy = uploadedBy;
    this.capturedAt = capturedAt ?? Date.now();
    this.latitude   = latitude;
    this.longitude  = longitude;
    this.metadata   = metadata;

    /** @type {number} Timestamp de registro do anexo */
    this.createdAt = Date.now();
  }

  /**
   * Verifica se o anexo é uma imagem.
   * @returns {boolean}
   *
   * TODO: Verificar mimeType.startsWith('image/')
   */
  isImage() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se o anexo possui geolocalização.
   * @returns {boolean}
   *
   * TODO: Retornar latitude !== null && longitude !== null
   */
  hasLocation() {
    // TODO: implementar
    return false;
  }

  /**
   * Retorna tamanho formatado para exibição.
   * @returns {string} - Ex: '2.4 MB'
   *
   * TODO: Implementar conversão KB/MB/GB
   */
  getFormattedSize() {
    // TODO: implementar
    return '';
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
   * @returns {OperationsAttachment}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new OperationsAttachment('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
