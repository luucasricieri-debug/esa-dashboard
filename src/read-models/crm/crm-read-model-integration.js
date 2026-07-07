/**
 * ESA OS — Read Models / CRM
 * CRMReadModelIntegration
 *
 * Conecta o Event Bus ao CRMReadModel.
 * Assina 'crm:deal:*' e aplica cada evento recebido ao Read Model.
 *
 * Responsabilidades:
 * - Assinar eventos de deal CRM no Event Bus após start()
 * - Encaminhar cada evento para CRMReadModel.apply()
 * - Registrar resultado (applied / skipped) via Logger opcional
 * - Manter contadores de diagnóstico
 * - Isolar erros internamente — nunca relançar para o Event Bus
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa Audit. Não modifica index.html.
 */

const SUBSCRIBER_OWNER = 'CRMReadModelIntegration';

/**
 * Integração Event Bus → CRMReadModel.
 */
export class CRMReadModelIntegration {
  /**
   * @param {EventBus}       eventBus          - EventBus da ESA OS (injetado)
   * @param {CRMReadModel}   readModel         - Read Model alvo (injetado)
   * @param {Logger|null}    [logger=null]      - Logger opcional (injetado)
   */
  constructor(eventBus, readModel, logger = null) {
    this._eventBus  = eventBus;
    this._readModel = readModel;

    this._logger = logger !== null && typeof logger.child === 'function'
      ? logger.child(SUBSCRIBER_OWNER)
      : logger;

    this._started       = false;
    this._subscriberId  = null;
    this._receivedCount = 0;
    this._appliedCount  = 0;
    this._skippedCount  = 0;
    this._errorCount    = 0;
    this._lastError     = null;
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  /**
   * Inicia a integração assinando 'crm:deal:*' no Event Bus.
   * Idempotente — chamadas adicionais quando já iniciado não têm efeito.
   * @throws {TypeError} Se eventBus ou readModel não expuserem os métodos necessários
   */
  start() {
    if (this._started) return;

    if (!this._eventBus || typeof this._eventBus.subscribe !== 'function') {
      throw new TypeError('[CRMReadModelIntegration] eventBus must expose subscribe()');
    }
    if (!this._readModel || typeof this._readModel.apply !== 'function') {
      throw new TypeError('[CRMReadModelIntegration] readModel must expose apply()');
    }

    this._subscriberId = this._eventBus.subscribe(
      'crm:deal:*',
      async (event) => this._handleEvent(event),
      { owner: SUBSCRIBER_OWNER },
    );

    this._started = true;
  }

  /**
   * Para a integração removendo a assinatura do Event Bus.
   * @returns {boolean}
   */
  stop() {
    if (!this._started) return false;
    const result       = this._eventBus.unsubscribe(this._subscriberId);
    this._subscriberId = null;
    this._started      = false;
    return result;
  }

  /**
   * @returns {boolean}
   */
  isStarted() {
    return this._started;
  }

  /**
   * Snapshot de diagnóstico.
   * @returns {Object}
   */
  getStats() {
    return {
      started:       this._started,
      subscriberId:  this._subscriberId,
      receivedCount: this._receivedCount,
      appliedCount:  this._appliedCount,
      skippedCount:  this._skippedCount,
      errorCount:    this._errorCount,
      lastError:     this._lastError,
      loggerEnabled: this._logger !== null,
    };
  }

  // ── Handler privado ───────────────────────────────────────────────────────

  async _handleEvent(event) {
    this._receivedCount++;

    try {
      const applied = this._readModel.apply(event);
      const dealId  = (event.payload && (event.payload.id || event.payload.dealId)) || '';

      if (applied) {
        this._appliedCount++;
        if (this._logger) {
          this._logger.info('CRM read model updated', {
            eventId:   event.id,
            eventType: event.type,
            dealId,
          });
        }
      } else {
        this._skippedCount++;
        if (this._logger) {
          this._logger.debug('CRM read model skipped event', {
            eventId:   event.id,
            eventType: event.type,
            dealId,
          });
        }
      }
    } catch (err) {
      this._errorCount++;
      this._lastError = { name: err.name || 'Error', message: err.message || String(err) };
      if (this._logger) {
        this._logger.error('CRM read model integration failed', err, {
          eventId:   event.id,
          eventType: event.type,
        });
      }
    }
  }
}
