/**
 * ESA OS — Integrations
 * CRMAuditIntegration
 *
 * Escuta eventos do domínio CRM no Event Bus e gera AuditEntries
 * correspondentes no módulo de Audit.
 *
 * Responsabilidades:
 * - Assinar o wildcard 'crm:*' no Event Bus após start()
 * - Usar CRMEventMapper para converter cada evento em um comando de auditoria
 * - Construir AuditContext a partir dos metadados do evento
 * - Chamar audit.record() quando o contexto for válido
 * - Manter contadores de diagnóstico para observabilidade
 * - Isolar erros internamente — nunca relançar para o Event Bus
 *
 * Padrão: Integration / Adapter
 * Instanciação: via dependency injection (não importa singletons)
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não integra com Logger. Não integra com Firebase.
 */

import { AuditContext }   from '../core/audit/audit-context.js';
import { CRMEventMapper } from './crm-event-mapper.js';

/** Owner registrado no Subscriber do Event Bus para diagnóstico. */
const SUBSCRIBER_OWNER = 'CRMAuditIntegration';

/**
 * Integração CRM → Audit via Event Bus.
 */
export class CRMAuditIntegration {
  /**
   * @param {EventBus} eventBus - Instância do EventBus da ESA OS (injetada)
   * @param {Audit}    audit    - Instância do Audit da ESA OS (injetada)
   */
  constructor(eventBus, audit) {
    this._eventBus = eventBus;
    this._audit    = audit;
    this._mapper   = new CRMEventMapper();

    this._started      = false;
    this._subscriberId = null;

    // ── Contadores de diagnóstico ──────────────────────────────────────────
    this._receivedCount         = 0;
    this._auditedCount          = 0;
    this._skippedUnmapped       = 0;
    this._skippedInvalidContext = 0;
    this._errorCount            = 0;
    this._lastError             = null;
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  /**
   * Inicia a integração assinando 'crm:*' no Event Bus.
   * Idempotente — chamadas adicionais quando já iniciado não têm efeito.
   * @throws {TypeError} Se eventBus ou audit não expuserem os métodos necessários
   */
  start() {
    if (this._started) return;

    if (!this._eventBus || typeof this._eventBus.subscribe !== 'function') {
      throw new TypeError('[CRMAuditIntegration] eventBus must expose subscribe()');
    }
    if (!this._audit || typeof this._audit.record !== 'function') {
      throw new TypeError('[CRMAuditIntegration] audit must expose record()');
    }

    this._subscriberId = this._eventBus.subscribe(
      'crm:*',
      async (event) => this._handleEvent(event),
      { owner: SUBSCRIBER_OWNER },
    );

    this._started = true;
  }

  /**
   * Para a integração removendo a assinatura do Event Bus.
   * @returns {boolean} false se já estava parado; resultado de unsubscribe() caso contrário
   */
  stop() {
    if (!this._started) return false;

    const result       = this._eventBus.unsubscribe(this._subscriberId);
    this._subscriberId = null;
    this._started      = false;
    return result;
  }

  /**
   * Indica se a integração está ativa.
   * @returns {boolean}
   */
  isStarted() {
    return this._started;
  }

  /**
   * Retorna snapshot de diagnóstico desta integração.
   * @returns {Object}
   */
  getStats() {
    return {
      started:              this._started,
      subscriberId:         this._subscriberId,
      receivedCount:        this._receivedCount,
      auditedCount:         this._auditedCount,
      skippedUnmapped:      this._skippedUnmapped,
      skippedInvalidContext: this._skippedInvalidContext,
      errorCount:           this._errorCount,
      lastError:            this._lastError,
    };
  }

  // ── Privado ───────────────────────────────────────────────────────────────

  /**
   * Handler async invocado pelo Event Bus para cada evento 'crm:*'.
   * Nunca relança erros — isola falhas internas.
   * @private
   */
  async _handleEvent(event) {
    this._receivedCount++;

    try {
      const mapped = this._mapper.map(event);

      if (mapped === null) {
        this._skippedUnmapped++;
        return;
      }

      const context = this._buildContext(event);

      if (!context.isValid()) {
        this._skippedInvalidContext++;
        return;
      }

      this._audit.record(
        context,
        mapped.action,
        mapped.resource,
        mapped.resourceId,
        mapped.before,
        mapped.after,
        mapped.metadata,
      );

      this._auditedCount++;
    } catch (err) {
      this._errorCount++;
      this._lastError = { name: err.name || 'Error', message: err.message || String(err) };
    }
  }

  /**
   * Constrói um AuditContext a partir dos metadados e payload do evento.
   * Não acessa browser, navigator ou IP real.
   * @private
   */
  _buildContext(event) {
    const meta    = event.metadata || {};
    const payload = event.payload  || {};

    return new AuditContext(
      meta.organizationId  || payload.organizationId  || '',
      meta.personId        || meta.userId             || payload.personId || payload.userId || '',
      meta.sessionId       || '',
      event.source         || 'CRM',
      '',
      '',
      meta.correlationId   || '',
    );
  }
}
