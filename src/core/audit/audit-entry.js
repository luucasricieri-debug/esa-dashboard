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

/** Campos de controle que não entram no diff — mudam sem representar alteração de dados. */
const DIFF_IGNORED_FIELDS = new Set(['createdAt', 'updatedAt', 'timestamp']);

/** Conjunto de ações que classificam uma entrada como modificação de dados. */
const MODIFICATION_ACTIONS = new Set([
  AUDIT_ACTION.UPDATE,
  AUDIT_ACTION.MOVE,
  AUDIT_ACTION.APPROVE,
  AUDIT_ACTION.REJECT,
]);

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
   * Retorna true para UPDATE, MOVE, APPROVE e REJECT.
   * @returns {boolean}
   */
  isModification() {
    return MODIFICATION_ACTIONS.has(this.action);
  }

  /**
   * Verifica se esta entrada registrou uma remoção.
   * Retorna true somente para DELETE.
   * @returns {boolean}
   */
  isDeletion() {
    return this.action === AUDIT_ACTION.DELETE;
  }

  /**
   * Calcula o diff entre before e after.
   *
   * Compara a união das chaves de before e after usando Object.is().
   * Ignora campos de controle de tempo: createdAt, updatedAt, timestamp.
   * Suporta before null (tratado como {}) e after null (tratado como {}).
   * Não implementa deep diff — comparação apenas no nível raiz.
   * Não muta before ou after.
   *
   * @returns {Object} Mapa { [campo]: { from, to } } para cada campo alterado
   */
  getDiff() {
    const before = this.before || {};
    const after  = this.after  || {};
    const keys   = new Set([...Object.keys(before), ...Object.keys(after)]);
    const diff   = {};

    for (const key of keys) {
      if (DIFF_IGNORED_FIELDS.has(key)) continue;
      if (!Object.is(before[key], after[key])) {
        diff[key] = { from: before[key], to: after[key] };
      }
    }

    return diff;
  }

  /**
   * Serializa a entrada para persistência ou transporte.
   * @returns {Object}
   */
  toJSON() {
    return {
      id:             this.id,
      organizationId: this.organizationId,
      personId:       this.personId,
      action:         this.action,
      resource:       this.resource,
      resourceId:     this.resourceId,
      source:         this.source,
      timestamp:      this.timestamp,
      before:         this.before,
      after:          this.after,
      metadata:       this.metadata,
    };
  }

  /**
   * Reconstrói uma AuditEntry a partir de objeto serializado.
   * Preserva id e timestamp originais — não gera novos.
   * @param {Object} data
   * @returns {AuditEntry}
   */
  static fromJSON(data) {
    const entry = new AuditEntry(
      data.action         || AUDIT_ACTION.READ,
      data.resource       || '',
      data.resourceId     || '',
      data.organizationId || '',
      data.personId       || '',
      data.source         || '',
      data.before         ?? null,
      data.after          ?? null,
      data.metadata       || {},
    );
    if (data.id)        entry.id        = data.id;
    if (data.timestamp) entry.timestamp = data.timestamp;
    return entry;
  }

  /**
   * Gera um identificador único para a entrada.
   * Usa crypto.randomUUID() quando disponível; fallback para ambientes sem suporte.
   * Nunca retorna ID vazio.
   * @returns {string}
   * @private
   */
  static _generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}
