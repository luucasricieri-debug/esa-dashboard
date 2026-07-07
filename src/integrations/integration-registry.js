/**
 * ESA OS — Integrations
 * IntegrationRegistry
 *
 * Registro central das integrações ativas da plataforma ESA OS.
 * Controla o ciclo de vida de cada integração de forma uniforme.
 *
 * Responsabilidades:
 * - Manter um catálogo nomeado de integrações registradas
 * - Controlar start/stop individual ou em massa
 * - Prover listagem e estatísticas de diagnóstico
 * - Garantir que nomes duplicados não sejam registrados
 * - Parar automaticamente integrações ativas ao removê-las
 *
 * Interface mínima esperada de uma integração:
 *   start()
 *   stop()
 *   isStarted() → boolean
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não integra com Logger. Não integra com Firebase.
 */

/**
 * Registro de integrações da plataforma ESA OS.
 */
export class IntegrationRegistry {
  constructor() {
    /** @type {Map<string, Object>} */
    this._integrations = new Map();
  }

  // ── Registro ──────────────────────────────────────────────────────────────

  /**
   * Registra uma integração com nome único.
   * @param {string} name        - Identificador único (ex: 'crmAudit')
   * @param {Object} integration - Objeto que expõe start(), stop(), isStarted()
   * @returns {Object} A integração registrada
   * @throws {Error}     Se o nome já estiver em uso
   * @throws {TypeError} Se o nome for inválido ou a integração não expuser a interface mínima
   */
  register(name, integration) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('[IntegrationRegistry] name must be a non-empty string');
    }
    if (
      !integration ||
      typeof integration.start     !== 'function' ||
      typeof integration.stop      !== 'function' ||
      typeof integration.isStarted !== 'function'
    ) {
      throw new TypeError(
        '[IntegrationRegistry] integration must expose start(), stop(), isStarted()',
      );
    }
    if (this._integrations.has(name)) {
      throw new Error(`[IntegrationRegistry] Integration "${name}" is already registered`);
    }

    this._integrations.set(name, integration);
    return integration;
  }

  /**
   * Remove uma integração pelo nome.
   * Se estiver iniciada, chama stop() antes de remover.
   * @param {string} name
   * @returns {boolean} true se existia e foi removida, false se não existia
   */
  unregister(name) {
    const integration = this._integrations.get(name);
    if (!integration) return false;

    if (integration.isStarted()) integration.stop();
    this._integrations.delete(name);
    return true;
  }

  /**
   * Retorna a integração pelo nome, ou null se não existir.
   * @param {string} name
   * @returns {Object|null}
   */
  get(name) {
    return this._integrations.get(name) || null;
  }

  // ── Ciclo de vida individual ──────────────────────────────────────────────

  /**
   * Inicia uma integração pelo nome.
   * @param {string} name
   * @throws {Error} Se o nome não estiver registrado
   */
  start(name) {
    const integration = this._integrations.get(name);
    if (!integration) throw new Error(`[IntegrationRegistry] Unknown integration: "${name}"`);
    return integration.start();
  }

  /**
   * Para uma integração pelo nome.
   * @param {string} name
   * @throws {Error} Se o nome não estiver registrado
   */
  stop(name) {
    const integration = this._integrations.get(name);
    if (!integration) throw new Error(`[IntegrationRegistry] Unknown integration: "${name}"`);
    return integration.stop();
  }

  // ── Ciclo de vida em massa ────────────────────────────────────────────────

  /**
   * Inicia todas as integrações registradas, sequencialmente.
   * Registra falhas sem interromper o restante.
   * @returns {{ started: string[], failed: Array<{ name, error }> }}
   */
  startAll() {
    const started = [];
    const failed  = [];

    for (const [name, integration] of this._integrations) {
      try {
        integration.start();
        started.push(name);
      } catch (err) {
        failed.push({ name, error: err.message || String(err) });
      }
    }

    return { started, failed };
  }

  /**
   * Para todas as integrações registradas, sequencialmente.
   * Registra falhas sem interromper o restante.
   * @returns {{ stopped: string[], failed: Array<{ name, error }> }}
   */
  stopAll() {
    const stopped = [];
    const failed  = [];

    for (const [name, integration] of this._integrations) {
      try {
        integration.stop();
        stopped.push(name);
      } catch (err) {
        failed.push({ name, error: err.message || String(err) });
      }
    }

    return { stopped, failed };
  }

  // ── Diagnóstico ───────────────────────────────────────────────────────────

  /**
   * Lista as integrações registradas com seus estados.
   * Retorna cópia — não expõe o Map interno.
   * @returns {Array<{ name: string, started: boolean }>}
   */
  list() {
    return Array.from(this._integrations.entries()).map(([name, integration]) => ({
      name,
      started: integration.isStarted(),
    }));
  }

  /**
   * Retorna estatísticas de todas as integrações registradas.
   * Usa integration.getStats() quando disponível.
   * @returns {Object}
   */
  getStats() {
    const stats = {};

    for (const [name, integration] of this._integrations) {
      stats[name] = typeof integration.getStats === 'function'
        ? integration.getStats()
        : { started: integration.isStarted() };
    }

    return stats;
  }
}
