/**
 * ESA OS — Core / Audit
 * AuditEntry
 *
 * Representa um registro imutável na trilha de auditoria da plataforma ESA OS.
 * Cada operação relevante gera uma AuditEntry com snapshot do estado antes e depois.
 *
 * Responsabilidades:
 * - Armazenar o registro completo de uma ação auditada
 * - Capturar estado anterior (before) e posterior (after) do recurso
 * - Vincular a ação ao contexto (quem, quando, de onde)
 * - Ser imutável após criação — trilhas de auditoria não são editáveis
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não persiste dados. Apenas modela a estrutura do registro.
 */

import { AUDIT_ACTION } from './audit-action.js';

/**
 * Registro imutável de uma ação auditada.
 */
export class AuditEntry {
  /**
   * @param {string}      action         - Ação realizada: AUDIT_ACTION.*
   * @param {string}      resource       - Tipo do recurso afetado (ex: 'deal', 'user', 'session')
   * @param {string}      resourceId     - ID do recurso afetado
   * @param {string}      organizationId - ID da organização onde ocorreu
   * @param {string}      personId       - UID da Person que executou
   * @param {string}      source         - Módulo de origem (ex: 'CRMDomain')
   * @param {Object|null} before         - Snapshot do estado do recurso antes da ação
   * @param {Object|null} after          - Snapshot do estado do recurso após a ação
   * @param {Object}      metadata       - Dados extras (correlationId, sessionId, ip)
   */
  constructor(
    action,
    resource,
    resourceId,
    organizationId = '',
    personId       = '',
    source         = '',
    before         = null,
    after          = null,
    metadata       = {}
  ) {
    /** @type {string} Identificador único imutável desta entrada */
    this.id = AuditEntry._generateId();

    this.action         = action;
    this.resource       = resource;
    this.resourceId     = resourceId;
    this.organizationId = organizationId;
    this.personId       = personId;
    this.source         = source;

    /** @type {number} Timestamp de criação (ms desde epoch) — imutável */
    this.timestamp = Date.now();

    /**
     * @type {Object|null} Estado do recurso ANTES da operação.
     * null para ações CREATE e LOGIN (não havia estado anterior).
     *
     * TODO: Sanitizar campos sensíveis (passHash, tokens) antes de armazenar
     */
    this.before = before;

    /**
     * @type {Object|null} Estado do recurso APÓS a operação.
     * null para ações DELETE e LOGOUT (recurso não existe mais).
     *
     * TODO: Sanitizar campos sensíveis antes de armazenar
     */
    this.after = after;

    this.metadata = metadata;
  }

  /**
   * Verifica se esta entrada registrou uma modificação de dados.
   * @returns {boolean}
   *
   * TODO: Retornar true se action for UPDATE, MOVE, APPROVE ou REJECT
   */
  isModification() {
    // TODO: implementar
    return false;
  }

  /**
   * Verifica se esta entrada registrou uma remoção.
   * @returns {boolean}
   *
   * TODO: Retornar true se action for DELETE
   */
  isDeletion() {
    // TODO: implementar
    return false;
  }

  /**
   * Calcula o diff entre before e after.
   * @returns {Object} - Campos que foram alterados com valores {from, to}
   *
   * TODO: Implementar diff de objetos planos
   * TODO: Ignorar campos de timestamp em comparações de diff
   */
  getDiff() {
    // TODO: implementar
    return {};
  }

  /**
   * Serializa a entrada para persistência ou transporte.
   * @returns {Object}
   *
   * TODO: Converter timestamp para ISO 8601
   * TODO: Nunca omitir id, timestamp, action, resource, personId
   */
  toJSON() {
    // TODO: implementar
    return {};
  }

  /**
   * Reconstrói uma AuditEntry a partir de objeto serializado.
   * @param {Object} data
   * @returns {AuditEntry}
   *
   * TODO: Restaurar id e timestamp originais
   * TODO: Validar action contra AUDIT_ACTION
   */
  static fromJSON(data) {
    // TODO: implementar
    return new AuditEntry(AUDIT_ACTION.READ, '', '');
  }

  /**
   * @returns {string}
   * @private
   * TODO: Usar crypto.randomUUID() quando disponível
   */
  static _generateId() {
    // TODO: implementar
    return '';
  }
}
