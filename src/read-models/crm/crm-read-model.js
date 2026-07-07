/**
 * ESA OS — Read Models / CRM
 * CRMReadModel
 *
 * Mantém uma visão derivada em memória do estado dos Deals CRM,
 * reconstruída a partir de CoreEvents do Event Bus.
 *
 * Padrão: Read Model / Projection (CQRS)
 * Estado interno: Map<dealId, deal>
 * Fonte de verdade: CoreEvents publicados no Event Bus
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa Audit. Não acessa index.html.
 * Não publica eventos. Apenas consome e projeta.
 */

/**
 * Eventos CRM suportados por este Read Model.
 */
const SUPPORTED = new Set([
  'crm:deal:created',
  'crm:deal:updated',
  'crm:deal:stage-changed',
  'crm:deal:won',
  'crm:deal:lost',
  'crm:deal:paused',
]);

/**
 * Projeção em memória dos Deals CRM derivada de eventos.
 */
export class CRMReadModel {

  constructor() {
    /** @type {Map<string, Object>} dealId → snapshot derivado */
    this._deals = new Map();

    this._hydrationCount = 0;
    this._lastHydration  = null;
  }

  // ── Projeção ──────────────────────────────────────────────────────────────

  /**
   * Aplica um CoreEvent ao estado interno do Read Model.
   * Eventos não suportados retornam false sem lançar erro.
   *
   * @param {CoreEvent} event
   * @returns {boolean} true se o evento foi aplicado; false se ignorado
   */
  apply(event) {
    const { type, payload = {}, createdAt, id } = event;

    switch (type) {
      case 'crm:deal:created':       return this._applyCreated(payload, createdAt, id, type);
      case 'crm:deal:updated':       return this._applyUpdated(payload, createdAt, id, type);
      case 'crm:deal:stage-changed': return this._applyStageChanged(payload, createdAt, id, type);
      case 'crm:deal:won':           return this._applyStatus(payload, createdAt, id, type, 'Vendido');
      case 'crm:deal:lost':          return this._applyStatus(payload, createdAt, id, type, 'Perdido');
      case 'crm:deal:paused':        return this._applyStatus(payload, createdAt, id, type, 'Pausado');
      default:                       return false;
    }
  }

  // ── Leitura ───────────────────────────────────────────────────────────────

  /**
   * Retorna cópia rasa de um Deal pelo ID.
   * @param {string} dealId
   * @returns {Object|null}
   */
  getDeal(dealId) {
    const deal = this._deals.get(dealId);
    return deal ? Object.assign({}, deal) : null;
  }

  /**
   * Retorna array de cópias dos Deals, com filtros opcionais e ordenação por updatedAt DESC.
   *
   * @param {Object} filters
   * @param {string} [filters.funil]
   * @param {string} [filters.etapa]
   * @param {string} [filters.status]
   * @param {string} [filters.responsavel]
   * @param {string} [filters.responsavelUid]
   * @param {string} [filters.captador]
   * @param {string} [filters.captadorUid]
   * @param {number} [filters.from]  - timestamp inclusivo (updatedAt >=)
   * @param {number} [filters.to]    - timestamp inclusivo (updatedAt <=)
   * @returns {Object[]}
   */
  getDeals(filters = {}) {
    let deals = Array.from(this._deals.values()).map((d) => Object.assign({}, d));

    if (filters.funil          != null) deals = deals.filter((d) => d.funil          === filters.funil);
    if (filters.etapa          != null) deals = deals.filter((d) => d.etapa          === filters.etapa);
    if (filters.status         != null) deals = deals.filter((d) => d.status         === filters.status);
    if (filters.responsavel    != null) deals = deals.filter((d) => d.responsavel    === filters.responsavel);
    if (filters.responsavelUid != null) deals = deals.filter((d) => d.responsavelUid === filters.responsavelUid);
    if (filters.captador       != null) deals = deals.filter((d) => d.captador       === filters.captador);
    if (filters.captadorUid    != null) deals = deals.filter((d) => d.captadorUid    === filters.captadorUid);
    if (filters.from           != null) deals = deals.filter((d) => d.updatedAt      >= filters.from);
    if (filters.to             != null) deals = deals.filter((d) => d.updatedAt      <= filters.to);

    deals.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return deals;
  }

  /**
   * Agrupa Deals por funil → etapa com contagens e totais.
   *
   * @param {Object} filters - Mesmos filtros de getDeals()
   * @returns {Object} { funil: { etapa: { count, totalValue, totalKwh } } }
   */
  getPipeline(filters = {}) {
    const deals    = this.getDeals(filters).filter((d) => d.funil);
    const pipeline = {};

    for (const deal of deals) {
      const funil = deal.funil;
      const etapa = deal.etapa || 'Sem etapa';

      if (!pipeline[funil])        pipeline[funil]        = {};
      if (!pipeline[funil][etapa]) pipeline[funil][etapa] = { count: 0, totalValue: 0, totalKwh: 0 };

      pipeline[funil][etapa].count++;
      pipeline[funil][etapa].totalValue += Number(deal.valor) || 0;
      pipeline[funil][etapa].totalKwh   += Number(deal.kwh)   || 0;
    }

    return pipeline;
  }

  /**
   * Retorna contagem de Deals por status.
   *
   * @param {Object} filters
   * @returns {{ total: number, byStatus: Object }}
   */
  getStatusSummary(filters = {}) {
    const deals    = this.getDeals(filters);
    const byStatus = {};

    for (const deal of deals) {
      const s = deal.status || 'Sem status';
      byStatus[s] = (byStatus[s] || 0) + 1;
    }

    return { total: deals.length, byStatus };
  }

  /**
   * Hidrata o Read Model a partir de um snapshot legado (Object ou Map).
   * Não publica CoreEvents. Não gera AuditEntries. Não usa Date.now().
   *
   * @param {Object|Map} deals   - Mapa dealId → objeto deal
   * @param {Object}     options
   * @param {boolean}    [options.replace=true] - Se true, limpa o Map antes de hidratar
   * @returns {{ received: number, hydrated: number, skipped: number, replaced: boolean }}
   */
  hydrate(deals, options = {}) {
    if (deals === null || typeof deals !== 'object' || Array.isArray(deals)) {
      throw new TypeError(
        '[CRMReadModel] hydrate() expects an Object or Map — received: ' +
          (deals === null ? 'null' : Array.isArray(deals) ? 'Array' : typeof deals),
      );
    }

    const { replace = true } = options;

    if (replace) this._deals.clear();

    const entries = deals instanceof Map ? deals.entries() : Object.entries(deals);
    let received  = 0;
    let hydrated  = 0;
    let skipped   = 0;

    for (const [dealId, deal] of entries) {
      received++;

      if (
        typeof dealId !== 'string' ||
        !dealId.trim() ||
        !deal ||
        typeof deal !== 'object' ||
        Array.isArray(deal)
      ) {
        skipped++;
        continue;
      }

      const createdAt = Number(deal.createdAt || deal.ts) || 0;
      const updatedAt = Number(deal.updatedAt || deal.etapaTs || deal.ts || deal.createdAt) || 0;

      this._deals.set(dealId, this._normalizeDeal(dealId, deal, createdAt, updatedAt, '', 'crm:deal:hydrated'));
      hydrated++;
    }

    this._hydrationCount++;
    const result       = { received, hydrated, skipped, replaced: replace };
    this._lastHydration = result;

    return result;
  }

  /**
   * Snapshot de diagnóstico do Read Model.
   * @returns {{ dealCount: number, hydrationCount: number, lastHydration: Object|null }}
   */
  getStats() {
    return {
      dealCount:      this._deals.size,
      hydrationCount: this._hydrationCount,
      lastHydration:  this._lastHydration ? Object.assign({}, this._lastHydration) : null,
    };
  }

  /**
   * Limpa todo o estado derivado, incluindo histórico de hidratação.
   */
  clear() {
    this._deals.clear();
    this._hydrationCount = 0;
    this._lastHydration  = null;
  }

  // ── Handlers privados ─────────────────────────────────────────────────────

  _applyCreated(payload, createdAt, eventId, eventType) {
    const dealId = payload.id || payload.dealId;
    if (!dealId) return false;

    const snap = payload.deal || {};
    // snap tem prioridade sobre payload nos campos de dados
    const src  = { ...payload, ...snap };

    this._deals.set(dealId, this._normalizeDeal(
      dealId, src,
      snap.createdAt || createdAt,
      createdAt,
      eventId,
      eventType,
    ));

    return true;
  }

  _normalizeDeal(id, src, createdAt, updatedAt, lastEventId, lastEventType) {
    return {
      id,
      funil:          src.funil          || '',
      etapa:          src.etapa          || '',
      status:         src.status         || 'Em andamento',
      valor:          Number(src.valor)  || 0,
      kwh:            Number(src.kwh)    || 0,
      responsavel:    src.responsavel    || '',
      responsavelUid: src.responsavelUid || '',
      captador:       src.captador       || '',
      captadorUid:    src.captadorUid    || '',
      createdAt,
      updatedAt,
      lastEventId,
      lastEventType,
    };
  }

  _applyUpdated(payload, createdAt, eventId, eventType) {
    const dealId = payload.id || payload.dealId;
    if (!dealId) return false;

    const existing = this._deals.get(dealId) || this._emptyDeal(dealId, createdAt);
    const patch    = payload.after || payload.deal || {};

    this._deals.set(dealId, Object.assign({}, existing, patch, {
      id:            dealId,
      updatedAt:     createdAt,
      lastEventId:   eventId,
      lastEventType: eventType,
    }));

    return true;
  }

  _applyStageChanged(payload, createdAt, eventId, eventType) {
    const dealId = payload.id || payload.dealId;
    if (!dealId) return false;

    const existing = this._deals.get(dealId) || this._emptyDeal(dealId, createdAt);

    this._deals.set(dealId, Object.assign({}, existing, {
      id:            dealId,
      etapa:         payload.toStage !== undefined ? payload.toStage : existing.etapa,
      updatedAt:     createdAt,
      lastEventId:   eventId,
      lastEventType: eventType,
    }));

    return true;
  }

  _applyStatus(payload, createdAt, eventId, eventType, forcedStatus) {
    const dealId = payload.id || payload.dealId;
    if (!dealId) return false;

    const existing = this._deals.get(dealId) || this._emptyDeal(dealId, createdAt);
    const patch    = payload.after || payload.deal || {};

    this._deals.set(dealId, Object.assign({}, existing, patch, {
      id:            dealId,
      status:        forcedStatus,
      updatedAt:     createdAt,
      lastEventId:   eventId,
      lastEventType: eventType,
    }));

    return true;
  }

  _emptyDeal(id, createdAt) {
    return {
      id,
      funil:          '',
      etapa:          '',
      status:         'Em andamento',
      valor:          0,
      kwh:            0,
      responsavel:    '',
      responsavelUid: '',
      captador:       '',
      captadorUid:    '',
      createdAt,
      updatedAt:      createdAt,
      lastEventId:    '',
      lastEventType:  '',
    };
  }
}
