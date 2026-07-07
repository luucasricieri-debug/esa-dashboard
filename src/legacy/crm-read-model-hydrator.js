/**
 * ESA OS — Legacy
 * CRMLegacyReadModelHydrator
 *
 * Adapter entre o snapshot legado (crmDeals) e o CRMReadModel da ESA OS.
 * Responsável exclusivamente por delegar a hidratação inicial ao Read Model,
 * com logging observacional e isolamento de erros.
 *
 * IMPORTANTE:
 * Não importa EventBus. Não importa Audit. Não publica CoreEvents.
 * Não gera AuditEntries. Não simula crm:deal:created.
 * A hidratação é uma sincronização direta snapshot → readModel.
 */

const CHILD_SOURCE = 'CRMLegacyReadModelHydrator';

/**
 * Adapter para hidratação inicial do CRMReadModel a partir do snapshot legado.
 */
export class CRMLegacyReadModelHydrator {
  /**
   * @param {CRMReadModel} readModel - Read Model alvo (injetado)
   * @param {Logger|null}  [logger=null] - Logger opcional (injetado)
   */
  constructor(readModel, logger = null) {
    this._readModel = readModel;
    this._logger = logger !== null && typeof logger.child === 'function'
      ? logger.child(CHILD_SOURCE)
      : logger;
  }

  /**
   * Hidrata o CRMReadModel com o snapshot legado de deals.
   * Em caso de erro: loga (se logger disponível) e relança — nunca engole.
   *
   * @param {Object|Map} deals   - Snapshot legado (crmDeals do index.html)
   * @param {Object}     options - Opções passadas diretamente ao readModel.hydrate()
   * @returns {Promise<{ received: number, hydrated: number, skipped: number, replaced: boolean }>}
   */
  async hydrate(deals, options = {}) {
    try {
      const result = this._readModel.hydrate(deals, options);

      if (this._logger) {
        this._logger.info('CRM read model hydrated', {
          received: result.received,
          hydrated: result.hydrated,
          skipped:  result.skipped,
          replaced: result.replaced,
        });
      }

      return result;
    } catch (err) {
      if (this._logger) {
        this._logger.error('CRM read model hydration failed', err, {});
      }
      throw err;
    }
  }

  /**
   * Snapshot de diagnóstico do hydrator.
   * @returns {{ loggerEnabled: boolean, readModel: Object }}
   */
  getStats() {
    return {
      loggerEnabled: this._logger !== null,
      readModel:     this._readModel.getStats(),
    };
  }
}
