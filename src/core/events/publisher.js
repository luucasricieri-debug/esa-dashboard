/**
 * ESA OS — Core / Events
 * Publisher
 *
 * Representa um produtor de eventos na plataforma ESA OS.
 * Cada Domain ou Service que precisar emitir eventos deve usar
 * uma instância de Publisher ao invés de acessar o EventBus diretamente.
 *
 * Responsabilidades:
 * - Encapsular a publicação de eventos no EventBus
 * - Identificar automaticamente o módulo de origem (source) em cada evento
 * - Prover métodos semânticos para publicação simples e em lote
 * - Isolar o produtor de eventos dos detalhes internos do EventBus
 *
 * Padrão de uso esperado:
 *   const publisher = new Publisher('CRMDomain', eventBus);
 *   await publisher.emit('crm:deal:won', { dealId: '123', value: 50000 });
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Não publica eventos reais. Não altera nenhum comportamento da aplicação.
 */

import { CoreEvent } from './event.js';

/**
 * Produtor de eventos para um módulo específico da plataforma.
 */
export class Publisher {
  /**
   * @param {string}   name      - Nome do módulo produtor (ex: 'CRMDomain', 'IdentityDomain')
   * @param {EventBus} eventBus  - Instância do EventBus onde os eventos serão publicados
   */
  constructor(name, eventBus) {
    /** @type {string} Identificador do módulo — preenchido automaticamente como source */
    this.name = name;

    /**
     * @type {EventBus | null} Referência ao EventBus.
     * Null até ser injetado via bindTo() — permite construção antes do bus estar disponível.
     */
    this.eventBus = eventBus || null;

    /** @type {number} Total de eventos publicados por esta instância */
    this.publishedCount = 0;
  }

  /**
   * Publica um evento no EventBus com source preenchido automaticamente.
   *
   * @param {string} type      - Tipo do evento (use EVENT_TYPES.*)
   * @param {Object} payload   - Dados do evento
   * @param {Object} metadata  - Metadados extras (correlationId, traceId, etc.)
   * @returns {Promise<CoreEvent>} - O evento criado e publicado
   */
  async emit(type, payload = {}, metadata = {}) {
    if (!this.eventBus) {
      throw new Error(`[Publisher:${this.name}] EventBus not bound. Call bindTo(eventBus) before emit().`);
    }
    const event = new CoreEvent(type, payload, this.name, metadata);
    await this.eventBus.publish(event);
    this.publishedCount++;
    return event;
  }

  /**
   * Publica múltiplos eventos em sequência.
   * Útil para casos onde uma ação de domínio gera mais de um evento.
   *
   * @param {Array<{ type: string, payload?: Object, metadata?: Object }>} events
   * @returns {Promise<CoreEvent[]>} - Eventos criados e publicados, em ordem
   */
  async emitMany(events = []) {
    const published = [];
    for (const { type, payload = {}, metadata = {} } of events) {
      published.push(await this.emit(type, payload, metadata));
    }
    return published;
  }

  /**
   * Vincula este Publisher a um EventBus.
   * Permite construção antecipada antes do bus estar disponível.
   *
   * @param {EventBus} eventBus
   */
  bindTo(eventBus) {
    if (!eventBus || typeof eventBus.publish !== 'function') {
      throw new TypeError('[Publisher] eventBus must expose a publish() method');
    }
    this.eventBus = eventBus;
  }

  /**
   * Verifica se este Publisher está vinculado a um EventBus.
   * @returns {boolean}
   */
  isBound() {
    return this.eventBus !== null;
  }

  /**
   * Retorna informações de diagnóstico deste Publisher.
   * @returns {{ name: string, bound: boolean, publishedCount: number }}
   */
  getInfo() {
    return {
      name: this.name,
      bound: this.isBound(),
      publishedCount: this.publishedCount,
    };
  }
}
