/**
 * ESA OS — Core / Audit
 * Audit (Facade)
 *
 * Fachada principal do módulo de auditoria da plataforma ESA OS.
 * É o único ponto de entrada para registrar e consultar a trilha de auditoria.
 *
 * Responsabilidades:
 * - Receber chamadas de auditoria de qualquer módulo do ESA OS
 * - Criar AuditEntry a partir de AuditContext + dados da operação
 * - Armazenar entradas em memória (persistência via Firebase será implementada futuramente)
 * - Prover consultas filtradas por person, resource e action
 * - NÃO integrar com Logger ou Event Bus neste momento
 *
 * Padrão: Facade
 * Consumo: import { audit } from 'src/core/audit/index.js'
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não persiste dados. Não integra com Logger ou Event Bus.
 * Não altere nenhum arquivo existente.
 */

import { AuditEntry }   from './audit-entry.js';
import { AuditContext } from './audit-context.js';
import { AUDIT_ACTION } from './audit-action.js';

/**
 * Limite máximo de entradas mantidas em memória.
 *
 * TODO: Mover para src/core/config.js quando integrado
 */
const DEFAULT_HISTORY_LIMIT = 5000;

/**
 * Facade de auditoria do ESA OS.
 * Instanciada como singleton no index.js.
 */
export class Audit {
  constructor() {
    /** @type {AuditEntry[]} Trilha de auditoria em memória */
    this._entries = [];

    /** @type {number} Limite de entradas em memória (ring buffer) */
    this._historyLimit = DEFAULT_HISTORY_LIMIT;
  }

  // ── Escrita ───────────────────────────────────────────────────────────────

  /**
   * Registra uma ação auditada e adiciona ao histórico em memória.
   * Método principal — todos os módulos chamam este método.
   *
   * context.sessionId, ip, userAgent e correlationId são mesclados no metadata
   * automaticamente. Os metadata recebidos pelo chamador prevalecem em duplicatas.
   *
   * @param {AuditContext} context    - Contexto da operação (quem, quando, de onde)
   * @param {string}       action     - Ação realizada: AUDIT_ACTION.*
   * @param {string}       resource   - Tipo do recurso afetado (ex: 'deal')
   * @param {string}       resourceId - ID do recurso afetado
   * @param {Object|null}  before     - Estado do recurso antes da ação
   * @param {Object|null}  after      - Estado do recurso após a ação
   * @param {Object}       metadata   - Dados extras (prevalecem sobre context em duplicatas)
   * @returns {AuditEntry}
   */
  record(context, action, resource, resourceId, before = null, after = null, metadata = {}) {
    this._validate(context, action, resource, resourceId);

    const mergedMeta = {
      sessionId:     context.sessionId,
      ip:            context.ip,
      userAgent:     context.userAgent,
      correlationId: context.correlationId,
      ...metadata,
    };

    const entry = new AuditEntry(
      action,
      resource,
      resourceId,
      context.organizationId,
      context.personId,
      context.source,
      before,
      after,
      mergedMeta,
    );

    this._entries.push(entry);
    if (this._entries.length > this._historyLimit) this._entries.shift();

    return entry;
  }

  /**
   * Cria uma AuditEntry sem adicioná-la à trilha.
   * Útil para construir a entrada antes de confirmar a operação.
   * Aplica as mesmas validações de record().
   *
   * @param {AuditContext} context
   * @param {string}       action
   * @param {string}       resource
   * @param {string}       resourceId
   * @param {Object|null}  before
   * @param {Object|null}  after
   * @returns {AuditEntry}
   */
  createEntry(context, action, resource, resourceId, before = null, after = null) {
    this._validate(context, action, resource, resourceId);

    const mergedMeta = {
      sessionId:     context.sessionId,
      ip:            context.ip,
      userAgent:     context.userAgent,
      correlationId: context.correlationId,
    };

    return new AuditEntry(
      action,
      resource,
      resourceId,
      context.organizationId,
      context.personId,
      context.source,
      before,
      after,
      mergedMeta,
    );
  }

  // ── Consulta ──────────────────────────────────────────────────────────────

  /**
   * Retorna as entradas da trilha, com filtros opcionais.
   * Ordenadas por timestamp DESC (mais recentes primeiro).
   * Retorna cópia — não expõe o array interno.
   *
   * @param {Object} filters
   * @param {string} [filters.action]         - Filtrar por ação (AUDIT_ACTION.*)
   * @param {string} [filters.resource]       - Filtrar por tipo de recurso
   * @param {string} [filters.resourceId]     - Filtrar por ID do recurso
   * @param {string} [filters.personId]       - Filtrar por quem executou
   * @param {string} [filters.organizationId] - Filtrar por organização
   * @param {string} [filters.source]         - Filtrar por módulo de origem
   * @param {number} [filters.from]           - Timestamp mínimo inclusivo (ms)
   * @param {number} [filters.to]             - Timestamp máximo inclusivo (ms)
   * @param {number} [limit=100]              - Máximo de resultados (<=0 = sem limite)
   * @returns {AuditEntry[]}
   */
  getEntries(filters = {}, limit = 100) {
    let result = this._entries.slice().reverse();

    if (filters.action)         result = result.filter((e) => e.action         === filters.action);
    if (filters.resource)       result = result.filter((e) => e.resource       === filters.resource);
    if (filters.resourceId)     result = result.filter((e) => e.resourceId     === filters.resourceId);
    if (filters.personId)       result = result.filter((e) => e.personId       === filters.personId);
    if (filters.organizationId) result = result.filter((e) => e.organizationId === filters.organizationId);
    if (filters.source)         result = result.filter((e) => e.source         === filters.source);
    if (filters.from != null)   result = result.filter((e) => e.timestamp      >= filters.from);
    if (filters.to   != null)   result = result.filter((e) => e.timestamp      <= filters.to);

    if (limit > 0) result = result.slice(0, limit);
    return result;
  }

  /**
   * Retorna todas as entradas registradas por uma Person específica.
   * Ordenadas por timestamp DESC.
   *
   * @param {string} personId
   * @param {number} [limit=100]
   * @returns {AuditEntry[]}
   */
  findByPerson(personId, limit = 100) {
    return this.getEntries({ personId }, limit);
  }

  /**
   * Retorna todas as entradas relacionadas a um recurso específico.
   * Ordenadas cronologicamente ASC (histórico de evolução do recurso).
   *
   * @param {string} resource   - Tipo do recurso (ex: 'deal')
   * @param {string} resourceId - ID do recurso
   * @param {number} [limit=50]
   * @returns {AuditEntry[]}
   */
  findByResource(resource, resourceId, limit = 50) {
    let result = this._entries.filter(
      (e) => e.resource === resource && e.resourceId === resourceId,
    );
    if (limit > 0) result = result.slice(0, limit);
    return result;
  }

  /**
   * Retorna todas as entradas de um tipo de ação específico.
   * Ordenadas por timestamp DESC.
   *
   * @param {string} action - AUDIT_ACTION.*
   * @param {number} [limit=100]
   * @returns {AuditEntry[]}
   */
  findByAction(action, limit = 100) {
    return this.getEntries({ action }, limit);
  }

  // ── Manutenção ────────────────────────────────────────────────────────────

  /**
   * Limpa todas as entradas em memória.
   * Não registra nova AuditEntry.
   * NÃO remove entradas persistidas no Firebase.
   *
   * TODO: Proteger com verificação de permissão (somente DIRETOR)
   */
  clear() {
    this._entries.length = 0;
  }

  /**
   * Retorna estatísticas da trilha em memória.
   * @returns {{ totalEntries, historyLimit, byAction, byResource, byOrganization }}
   */
  getStats() {
    const byAction       = {};
    const byResource     = {};
    const byOrganization = {};

    for (const entry of this._entries) {
      byAction[entry.action]               = (byAction[entry.action]               || 0) + 1;
      byResource[entry.resource]           = (byResource[entry.resource]           || 0) + 1;
      byOrganization[entry.organizationId] = (byOrganization[entry.organizationId] || 0) + 1;
    }

    return {
      totalEntries:  this._entries.length,
      historyLimit:  this._historyLimit,
      byAction,
      byResource,
      byOrganization,
    };
  }

  // ── Privado ───────────────────────────────────────────────────────────────

  /**
   * Valida os parâmetros obrigatórios de record() e createEntry().
   * @private
   */
  _validate(context, action, resource, resourceId) {
    if (!(context instanceof AuditContext)) {
      throw new TypeError('[Audit] context must be an AuditContext instance');
    }
    if (!context.isValid()) {
      throw new Error('[Audit] context.isValid() is false — organizationId and personId are required');
    }
    if (AUDIT_ACTION[action] === undefined) {
      throw new Error(`[Audit] Unknown action: "${action}"`);
    }
    if (typeof resource !== 'string' || !resource.trim()) {
      throw new Error('[Audit] resource must be a non-empty string');
    }
    if (typeof resourceId !== 'string' || !resourceId.trim()) {
      throw new Error('[Audit] resourceId must be a non-empty string');
    }
  }
}
