/**
 * ESA OS — Core / Audit
 * AuditContext
 *
 * Mantém o contexto de execução de uma operação auditada.
 * É propagado junto com AuditEntry para enriquecer a trilha de auditoria
 * com dados do ambiente em que a ação ocorreu.
 *
 * Responsabilidades:
 * - Capturar quem executou a ação (personId, organizationId)
 * - Capturar de onde a ação foi executada (ip, userAgent, sessionId)
 * - Prover correlationId para rastreamento entre múltiplos sistemas
 * - Ser construído uma vez por operação e reutilizado em todas as entradas dela
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não coleta dados reais de rede ou browser.
 */

/**
 * Contexto de execução de uma operação auditada.
 */
export class AuditContext {
  /**
   * @param {string} organizationId - ID da organização onde a ação ocorreu
   * @param {string} personId       - UID da Person que executou a ação
   * @param {string} sessionId      - ID da sessão ativa no momento da ação
   * @param {string} source         - Módulo de origem (ex: 'CRMDomain', 'IdentityDomain')
   * @param {string} ip             - Endereço IP do cliente (coletado pelo servidor)
   * @param {string} userAgent      - User-Agent do browser/cliente
   * @param {string} correlationId  - ID de correlação para rastrear operações relacionadas
   */
  constructor(
    organizationId = '',
    personId       = '',
    sessionId      = '',
    source         = '',
    ip             = '',
    userAgent      = '',
    correlationId  = ''
  ) {
    this.organizationId = organizationId;
    this.personId       = personId;
    this.sessionId      = sessionId;
    this.source         = source;
    this.ip             = ip;
    this.userAgent      = userAgent;
    this.correlationId  = correlationId;

    /** @type {number} Timestamp de criação do contexto */
    this.createdAt = Date.now();
  }

  /**
   * Verifica se o contexto possui os campos mínimos obrigatórios.
   * @returns {boolean}
   *
   * TODO: Exigir pelo menos organizationId e personId como obrigatórios
   */
  isValid() {
    // TODO: implementar
    return false;
  }

  /**
   * Cria um AuditContext a partir de uma Session ativa.
   * @param {Session} session - Instância de Session do Identity Domain
   * @returns {AuditContext}
   *
   * TODO: Extrair personId e sessionId da Session
   * TODO: Extrair organizationId da Organization associada à Session
   */
  static fromSession(session) {
    // TODO: implementar
    return new AuditContext();
  }

  /**
   * Serializa o contexto para inclusão em AuditEntry.
   * @returns {Object}
   *
   * TODO: Omitir campos vazios para reduzir tamanho do registro
   */
  toJSON() {
    // TODO: implementar
    return {};
  }
}
