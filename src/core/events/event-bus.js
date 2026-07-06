/**
 * ESA OS — Core / Events
 * EventBus
 *
 * Barramento de eventos da plataforma ESA OS.
 * Implementa o padrão Publish/Subscribe para comunicação desacoplada
 * entre Core, Domains e Services.
 *
 * Responsabilidades:
 * - Registrar Subscribers por tipo de evento
 * - Rotear CoreEvents publicados para os Subscribers correspondentes
 * - Remover Subscribers quando não forem mais necessários
 * - Manter histórico em memória dos eventos publicados (ring buffer)
 * - Prover diagnóstico de subscribers ativos e histórico de eventos
 *
 * Modelo de comunicação:
 *   Publisher  →  EventBus.publish(event)  →  [Subscriber A, Subscriber B, ...]
 *
 * Garantias:
 *   - Entrega best-effort (sem retry automático nesta fase)
 *   - Ordem de entrega: FIFO por tipo de evento
 *   - Isolamento: erro em um Subscriber não afeta os demais
 *   - Deduplicação: um Subscriber nunca é chamado duas vezes pelo mesmo evento
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * O EventBus opera exclusivamente em memória — sem persistência.
 * Não integrado com Logger nem Audit nesta fase.
 */

import { CoreEvent } from './event.js';
import { Subscriber } from './subscriber.js';

/**
 * Capacidade máxima do histórico em memória.
 * Ao atingir o limite, os eventos mais antigos são descartados (ring buffer).
 *
 * TODO: Tornar configurável via ESA_CORE_CONFIG
 */
const DEFAULT_HISTORY_LIMIT = 500;

/**
 * Barramento central de eventos da plataforma ESA OS.
 */
export class EventBus {
  /**
   * @param {number} historyLimit - Máximo de eventos mantidos em memória
   */
  constructor(historyLimit = DEFAULT_HISTORY_LIMIT) {
    /**
     * @type {Map<string, Set<Subscriber>>}
     * Mapa de eventType (incluindo wildcards) → conjunto de Subscribers.
     */
    this._subscribers = new Map();

    /**
     * @type {CoreEvent[]}
     * Histórico em memória dos eventos publicados (ring buffer).
     */
    this._history = [];

    /** @type {number} */
    this._historyLimit = historyLimit;

    /** @type {number} Total de eventos publicados desde a inicialização */
    this._publishedCount = 0;

    /** @type {boolean} Se true, loga eventos no console (modo debug) */
    this._debug = false;
  }

  /**
   * Registra um Subscriber para um ou mais tipos de evento.
   *
   * @param {string|string[]} eventTypes - Tipo(s) de evento a escutar (suporta wildcards)
   * @param {Function}        handler    - Callback (event: CoreEvent) => void | Promise<void>
   * @param {Object}          options
   * @param {string}          options.owner - Módulo dono da inscrição
   * @param {boolean}         options.once  - Remove após primeiro disparo
   * @returns {string} subscriberId
   */
  subscribe(eventTypes, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('[EventBus] handler must be a function');
    }
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const id = CoreEvent._generateId();
    const sub = new Subscriber(id, types, handler, options.owner || '', options.once || false);

    for (const type of types) {
      if (!this._subscribers.has(type)) this._subscribers.set(type, new Set());
      this._subscribers.get(type).add(sub);
    }

    if (this._debug) console.debug(`[EventBus] subscribe ${id} -> [${types.join(', ')}]`);

    return id;
  }

  /**
   * Registra um Subscriber que se remove automaticamente após o primeiro disparo.
   * @param {string|string[]} eventTypes
   * @param {Function}        handler
   * @param {Object}          options
   * @returns {string} subscriberId
   */
  subscribeOnce(eventTypes, handler, options = {}) {
    return this.subscribe(eventTypes, handler, { ...options, once: true });
  }

  /**
   * Remove uma inscrição pelo subscriberId retornado em subscribe().
   * @param {string} subscriberId
   * @returns {boolean} - true se a inscrição foi encontrada e removida
   */
  unsubscribe(subscriberId) {
    let found = false;
    for (const [key, set] of this._subscribers) {
      const toRemove = [];
      for (const sub of set) {
        if (sub.id === subscriberId) toRemove.push(sub);
      }
      for (const sub of toRemove) {
        set.delete(sub);
        found = true;
      }
      if (set.size === 0) this._subscribers.delete(key);
    }
    return found;
  }

  /**
   * Remove todas as inscrições de um módulo (owner) de uma vez.
   * @param {string} owner - Identificador do módulo (ex: 'CRMDomain')
   * @returns {number} - Quantidade de Subscribers únicos removidos
   */
  unsubscribeAll(owner) {
    const removed = new Set();
    for (const [key, set] of this._subscribers) {
      const toRemove = [];
      for (const sub of set) {
        if (sub.owner === owner) toRemove.push(sub);
      }
      for (const sub of toRemove) {
        set.delete(sub);
        removed.add(sub.id);
      }
      if (set.size === 0) this._subscribers.delete(key);
    }
    return removed.size;
  }

  /**
   * Publica um CoreEvent, entregando-o a todos os Subscribers correspondentes.
   * Rota para matches exatos e wildcards (* / domain:* / domain:entity:*).
   * Erros em Subscribers individuais são isolados — não interrompem os demais.
   *
   * @param {CoreEvent} event
   * @returns {Promise<number>} - Quantidade de Subscribers notificados com sucesso
   */
  async publish(event) {
    if (!(event instanceof CoreEvent)) {
      throw new TypeError('[EventBus] publish() requires a CoreEvent instance');
    }

    this._history.push(event);
    if (this._history.length > this._historyLimit) this._history.shift();
    this._publishedCount++;

    if (this._debug) console.debug(`[EventBus] publish ${event.type} (id: ${event.id})`);

    const subscribers = this._resolveSubscribers(event.type);
    let successCount = 0;

    for (const sub of subscribers) {
      if (!sub.active) continue;
      try {
        await sub.dispatch(event);
        successCount++;
      } catch (err) {
        if (this._debug) console.error(`[EventBus] Error in subscriber "${sub.id}" (owner: "${sub.owner}"):`, err);
      }
      if (!sub.active) this.unsubscribe(sub.id);
    }

    return successCount;
  }

  /**
   * Retorna o histórico de eventos publicados em memória.
   * @param {string} [eventType] - Filtro opcional por tipo de evento
   * @returns {CoreEvent[]}
   */
  getHistory(eventType = '') {
    if (eventType) return this._history.filter((e) => e.type === eventType).slice();
    return this._history.slice();
  }

  /**
   * Retorna os Subscribers ativos, opcionalmente filtrados por tipo de evento.
   * Deduplicado — um Subscriber registrado em múltiplos tipos aparece uma única vez.
   * @param {string} [eventType]
   * @returns {Subscriber[]}
   */
  listSubscribers(eventType = '') {
    const seen = new Set();
    const result = [];

    const collectActive = (set) => {
      if (!set) return;
      for (const sub of set) {
        if (sub.active && !seen.has(sub.id)) {
          seen.add(sub.id);
          result.push(sub);
        }
      }
    };

    if (eventType) {
      collectActive(this._subscribers.get(eventType));
    } else {
      for (const set of this._subscribers.values()) collectActive(set);
    }

    return result;
  }

  /**
   * Limpa o histórico de eventos em memória.
   * Não remove Subscribers registrados.
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Remove todos os Subscribers e limpa o histórico.
   * Útil para reinicialização controlada (testes, hot-reload).
   */
  reset() {
    this._subscribers = new Map();
    this._history = [];
    this._publishedCount = 0;
  }

  /**
   * Ativa ou desativa o modo debug (log de eventos no console).
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this._debug = Boolean(enabled);
  }

  /**
   * Retorna um snapshot de diagnóstico do estado atual do EventBus.
   * @returns {{ subscriberCount: number, publishedCount: number, historyLength: number, debug: boolean }}
   */
  getStats() {
    const seen = new Set();
    for (const set of this._subscribers.values()) {
      for (const sub of set) seen.add(sub.id);
    }
    return {
      subscriberCount: seen.size,
      publishedCount: this._publishedCount,
      historyLength: this._history.length,
      debug: this._debug,
    };
  }

  /**
   * Coleta Subscribers de uma chave do Map, deduplicando por id.
   * @param {string}        key
   * @param {Set<string>}   seen
   * @param {Subscriber[]}  result
   * @private
   */
  _collectSubscribers(key, seen, result) {
    const set = this._subscribers.get(key);
    if (!set) return;
    for (const sub of set) {
      if (!seen.has(sub.id)) {
        seen.add(sub.id);
        result.push(sub);
      }
    }
  }

  /**
   * Resolve todos os Subscribers que devem receber um evento do tipo dado,
   * incluindo wildcards (* / domain:* / domain:entity:*).
   * @param {string} eventType
   * @returns {Subscriber[]}
   * @private
   */
  _resolveSubscribers(eventType) {
    const seen = new Set();
    const result = [];
    const parts = eventType.split(':');

    this._collectSubscribers(eventType, seen, result);
    this._collectSubscribers('*', seen, result);
    if (parts.length >= 1) this._collectSubscribers(`${parts[0]}:*`, seen, result);
    if (parts.length >= 2) this._collectSubscribers(`${parts[0]}:${parts[1]}:*`, seen, result);

    return result;
  }
}
