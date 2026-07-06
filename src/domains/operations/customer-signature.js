/**
 * ESA OS — Operations Domain
 * CustomerSignature
 *
 * Representa a assinatura do cliente ao final de um atendimento.
 *
 * Responsabilidades:
 * - Modelar a assinatura de conclusão de serviço
 * - Registrar dados de identificação do signatário
 * - Armazenar coordenadas de captura para validade legal
 * - Preparar estrutura para assinatura digital futura (LGPD/ICP-Brasil)
 *
 * IMPORTANTE:
 * Não implementa assinatura digital real nesta versão.
 * Não armazena CPF/CNPJ em texto claro — campo customerDocument é referência futura.
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 *
 * TODO: Avaliar conformidade com LGPD antes de armazenar customerDocument
 * TODO: Integrar com serviço de assinatura digital (ex: ClickSign, DocuSign)
 */

/**
 * Status da assinatura.
 */
export const SIGNATURE_STATUS = {
  PENDING:  'PENDING',   // Aguardando assinatura do cliente
  SIGNED:   'SIGNED',    // Cliente assinou
  REFUSED:  'REFUSED',   // Cliente recusou assinar
  BYPASSED: 'BYPASSED',  // Assinatura dispensada (ex: cliente ausente)
};

/**
 * Assinatura do cliente ao concluir um atendimento.
 */
export class CustomerSignature {
  /**
   * @param {string} workOrderId       - ID da WorkOrder concluída
   * @param {string} technicianId      - UID do técnico que capturou a assinatura
   * @param {string} customerName      - Nome do signatário
   * @param {string} customerDocument  - Referência ao documento (não armazenar CPF em texto)
   * @param {string} signatureData     - Dados da assinatura (base64 SVG ou referência a URL)
   * @param {string} status            - SIGNATURE_STATUS.*
   * @param {number} latitude          - Latitude de captura
   * @param {number} longitude         - Longitude de captura
   * @param {Object} metadata          - Dados extras (refusalReason, witnessName)
   */
  constructor(
    workOrderId,
    technicianId     = '',
    customerName     = '',
    customerDocument = '',
    signatureData    = '',
    status           = SIGNATURE_STATUS.PENDING,
    latitude         = null,
    longitude        = null,
    metadata         = {}
  ) {
    /** @type {string} */
    this.id = CustomerSignature._generateId();

    this.workOrderId       = workOrderId;
    this.technicianId      = technicianId;
    this.customerName      = customerName;

    /**
     * @type {string} Referência ao documento do cliente.
     * TODO: Substituir por referência anonimizada antes de persistir (LGPD)
     */
    this.customerDocument = customerDocument;

    /**
     * @type {string} Dados da assinatura.
     * TODO: Armazenar como URL de Storage em vez de base64 inline
     */
    this.signatureData = signatureData;

    this.status    = status;
    this.latitude  = latitude;
    this.longitude = longitude;
    this.metadata  = metadata;

    /** @type {number} Timestamp de captura da assinatura */
    this.signedAt  = null;

    /** @type {number} */
    this.createdAt = Date.now();
  }

  /**
   * Registra a assinatura do cliente.
   * @param {string} signatureData - Dados capturados na tela (SVG/base64)
   *
   * TODO: Validar que signatureData não está vazio
   * TODO: Setar status = SIGNED e signedAt = Date.now()
   */
  sign(signatureData) {
    // TODO: implementar
  }

  /**
   * Registra recusa do cliente em assinar.
   * @param {string} reason
   *
   * TODO: Setar status = REFUSED e armazenar reason em metadata.refusalReason
   */
  refuse(reason = '') {
    // TODO: implementar
  }

  /**
   * Marca a assinatura como dispensada (cliente ausente ou caso especial).
   * @param {string} reason
   *
   * TODO: Setar status = BYPASSED — exige justificativa obrigatória
   */
  bypass(reason = '') {
    // TODO: implementar
  }

  /**
   * Verifica se a assinatura está completa.
   * @returns {boolean}
   *
   * TODO: Retornar status === SIGNATURE_STATUS.SIGNED
   */
  isSigned() {
    // TODO: implementar
    return false;
  }

  /**
   * @returns {Object}
   */
  toJSON() {
    // TODO: implementar — nunca serializar signatureData completo em logs
    return {};
  }

  /**
   * @param {Object} data
   * @returns {CustomerSignature}
   */
  static fromJSON(data) {
    // TODO: implementar
    return new CustomerSignature('');
  }

  /** @private */
  static _generateId() {
    // TODO: crypto.randomUUID()
    return '';
  }
}
