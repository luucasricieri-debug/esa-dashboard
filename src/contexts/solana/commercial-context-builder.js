/**
 * ESA OS — Contexts / Solana
 * SolanaCommercialContextBuilder
 *
 * Produz o contrato de contexto comercial para consumo por agentes Solana IA,
 * automações gerenciais e geração de relatórios assistidos.
 *
 * Fonte única: CRMManagementBrief via queryProvider.getManagementBrief()
 * Política:    READ-ONLY, whitelist-first, data minimization aplicada.
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa CRMReadModel diretamente.
 * Não chama Anthropic. Não executa ações comerciais. Não move deals.
 * Não cria follow-up. Não acessa analyzers diretamente.
 * Usa dependency injection — recebe queryProvider no constructor.
 */

/** Versão do contrato de contexto (incrementar em quebras de compatibilidade). */
export const CONTEXT_VERSION = '1.0';

/** Tipo de contexto — identifica a natureza do contrato para o consumidor. */
export const CONTEXT_TYPE = 'commercial-management';

/** Domínio de negócio coberto por este contexto. */
export const CONTEXT_DOMAIN = 'crm';

/** Identificador estável do tenant ESA (primeiro tenant da plataforma). */
export const ORGANIZATION_ID = 'esa';

/** O que um consumidor PODE fazer com os dados deste contexto. */
export const CAPABILITIES = Object.freeze([
  'summarize',
  'explain-risk',
  'compare-priorities',
  'identify-attention-points',
]);

/** O que um consumidor NÃO PODE fazer com os dados deste contexto. */
export const RESTRICTIONS = Object.freeze([
  'read-only',
  'no-deal-mutation',
  'no-followup-creation',
  'no-stage-move',
  'no-user-management',
  'no-file-access',
  'no-secret-access',
]);

/**
 * Builder do contexto comercial para agentes Solana.
 * Não recalcula análises — delega a queryProvider.getManagementBrief().
 */
export class SolanaCommercialContextBuilder {
  /** @param {Object} queryProvider - Deve expor getManagementBrief(filters, options) */
  constructor(queryProvider) {
    this._qp = queryProvider;
  }

  /**
   * Gera o contexto comercial para agentes.
   *
   * @param {Object} [filters={}]
   * @param {Object} [options={}]
   * @param {number} [options.referenceDate] - Timestamp ms (determinismo em testes)
   * @returns {SolanaCommercialContext}
   */
  generateContext(filters = {}, options = {}) {
    if (!this._qp || typeof this._qp.getManagementBrief !== 'function') {
      throw new TypeError(
        '[SolanaCommercialContextBuilder] queryProvider must expose getManagementBrief()',
      );
    }

    const result = this._qp.getManagementBrief(filters, options);
    const brief  = result && typeof result.toJSON === 'function'
      ? result.toJSON().data
      : (result && result.data !== undefined ? result.data : result);

    if (!brief || typeof brief !== 'object') {
      throw new Error(
        '[SolanaCommercialContextBuilder] getManagementBrief retornou resultado inválido',
      );
    }

    const highlights     = this._buildHighlights(brief.highlights);
    const riskSnapshot   = this._buildRiskSnapshot(brief.risk);
    const actionSnapshot = this._buildActionSnapshot(brief.actionPriority);
    const entities       = this._buildEntities(brief.risk, brief.actionPriority, highlights);

    return _sanitize({
      contextVersion:    CONTEXT_VERSION,
      contextType:       CONTEXT_TYPE,
      generatedAt:       _safeNum(brief.generatedAt),
      referenceDate:     _safeNum(brief.referenceDate),
      scope:             this._buildScope(brief.filters, filters),
      executiveSnapshot: this._buildExecutiveSnapshot(brief.executive),
      pipelineSnapshot:  this._buildPipelineSnapshot(brief.pipelineHealth),
      riskSnapshot,
      actionSnapshot,
      highlights,
      narrative:         typeof brief.managementNarrative === 'string'
        ? brief.managementNarrative
        : null,
      entities,
      capabilities:  CAPABILITIES.slice(),
      restrictions:  RESTRICTIONS.slice(),
      metadata:      this._buildMetadata(
        brief.metadata || {},
        entities,
        highlights,
        riskSnapshot,
        actionSnapshot,
      ),
    });
  }

  // ── Section builders ──────────────────────────────────────────────────────

  _buildScope(briefFilters, callFilters) {
    return {
      organization:   ORGANIZATION_ID,
      domain:         CONTEXT_DOMAIN,
      filtersApplied: Object.assign({}, briefFilters || {}, callFilters || {}),
    };
  }

  _buildExecutiveSnapshot(ex) {
    if (!ex || typeof ex !== 'object') return null;
    return {
      totalDeals:       _safeNum(ex.totalDeals),
      conversionRate:   _safeNum(ex.conversionRate),
      winRate:          _safeNum(ex.winRate),
      lossRate:         _safeNum(ex.lossRate),
      pausedRate:       _safeNum(ex.pausedRate),
      pipelineValue:    _safeNum(ex.pipelineValue),
      weightedForecast: _safeNum(ex.weightedForecast),
    };
  }

  _buildPipelineSnapshot(ph) {
    if (!ph || typeof ph !== 'object') return null;
    return {
      totalDeals:             _safeNum(ph.totalDeals),
      freshDeals:             _safeNum(ph.freshDeals),
      attentionDeals:         _safeNum(ph.attentionDeals),
      riskDeals:              _safeNum(ph.riskDeals),
      criticalDeals:          _safeNum(ph.criticalDeals),
      dealsWithoutNextAction: _safeNum(ph.dealsWithoutNextAction),
      valueAtRisk:            _safeNum(ph.valueAtRisk),
      criticalValue:          _safeNum(ph.criticalValue),
      agingDistribution:      _safePlainObject(ph.agingDistribution),
    };
  }

  _buildRiskSnapshot(risk) {
    if (!risk || typeof risk !== 'object') return null;
    const top = Array.isArray(risk.topSignals) ? risk.topSignals : [];
    return {
      totalSignals:    _safeNum(risk.totalSignals),
      criticalSignals: _safeNum(risk.criticalSignals),
      riskSignals:     _safeNum(risk.riskSignals),
      affectedDeals:   _safeNum(risk.affectedDeals),
      valueExposed:    _safeNum(risk.valueExposed),
      byType:          _safePlainObject(risk.byType),
      bySeverity:      _safePlainObject(risk.bySeverity),
      topSignals:      top.map(_normalizeSignal),
    };
  }

  _buildActionSnapshot(ap) {
    if (!ap || typeof ap !== 'object') return null;
    const top = Array.isArray(ap.topPriorities) ? ap.topPriorities : [];
    return {
      totalPriorities:      _safeNum(ap.totalPriorities),
      urgentDeals:          _safeNum(ap.urgentDeals),
      highPriorityDeals:    _safeNum(ap.highPriorityDeals),
      mediumPriorityDeals:  _safeNum(ap.mediumPriorityDeals),
      lowPriorityDeals:     _safeNum(ap.lowPriorityDeals),
      prioritizedValue:     _safeNum(ap.prioritizedValue),
      urgentValue:          _safeNum(ap.urgentValue),
      averagePriorityScore: _safeNum(ap.averagePriorityScore),
      byPriorityLevel:      _safePlainObject(ap.byPriorityLevel),
      topPriorities:        top.map(_normalizePriority),
    };
  }

  _buildHighlights(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(h => ({
      code:        _safeStr(h.code),
      severity:    _safeStr(h.severity),
      title:       _safeStr(h.title),
      description: _safeStr(h.description),
      value:       _safeNum(h.value),
      count:       _safeNum(h.count),
      dealId:      h.dealId != null ? _safeStr(h.dealId) : null,
    }));
  }

  _buildEntities(risk, ap, highlights) {
    const map = new Map();

    if (risk && Array.isArray(risk.topSignals)) {
      for (const s of risk.topSignals) {
        const did = s && _safeStr(s.dealId);
        if (!did) continue;
        _mergeEntity(map, did, _safeStr(s.dealName) || did, 'risk', _safeStr(s.type));
      }
    }

    if (ap && Array.isArray(ap.topPriorities)) {
      for (const p of ap.topPriorities) {
        const did = p && _safeStr(p.dealId);
        if (!did) continue;
        _mergeEntity(map, did, _safeStr(p.dealName) || did, 'priority', _safeStr(p.priorityLevel));
      }
    }

    for (const h of highlights) {
      if (!h.dealId) continue;
      _mergeEntity(map, h.dealId, h.dealId, 'highlight', _safeStr(h.code));
    }

    return Array.from(map.entries())
      .map(([id, { name, roles, references }]) => ({
        entityType:  'deal',
        id,
        name,
        role:       Array.from(roles).sort(),
        references: Array.from(references).filter(Boolean).sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  _buildMetadata(briefMeta, entities, highlights, riskSnapshot, actionSnapshot) {
    return {
      source:              'crm-management-brief',
      sourceVersion:       '1.0',
      sectionsAvailable:   Array.isArray(briefMeta.availableSections)
        ? briefMeta.availableSections.slice()
        : [],
      sectionsUnavailable: Array.isArray(briefMeta.unavailableSections)
        ? briefMeta.unavailableSections.slice()
        : [],
      entityCount:         entities.length,
      highlightCount:      highlights.length,
      riskSignalCount:     riskSnapshot && Array.isArray(riskSnapshot.topSignals)
        ? riskSnapshot.topSignals.length
        : 0,
      priorityCount:       actionSnapshot && Array.isArray(actionSnapshot.topPriorities)
        ? actionSnapshot.topPriorities.length
        : 0,
      minimized:           true,
      readOnly:            true,
    };
  }
}

// ── Entity accumulator ────────────────────────────────────────────────────

function _mergeEntity(map, id, name, role, ref) {
  if (!map.has(id)) {
    map.set(id, { name: name || id, roles: new Set(), references: new Set() });
  }
  const e = map.get(id);
  if (name && !e.name) e.name = name;
  e.roles.add(role);
  if (ref) e.references.add(ref);
}

// ── Normalizadores whitelist-first ────────────────────────────────────────

function _normalizeSignal(s) {
  return {
    type:        _safeStr(s.type),
    severity:    _safeStr(s.severity),
    title:       _safeStr(s.title),
    dealId:      s.dealId != null ? _safeStr(s.dealId) : null,
    dealName:    s.dealName != null ? _safeStr(s.dealName) : null,
    responsible: s.responsible != null ? _safeStr(s.responsible) : null,
    pipeline:    s.pipeline != null ? _safeStr(s.pipeline) : null,
    value:       _safeNum(s.value),
    agingDays:   _safeNum(s.agingDays),
  };
}

function _normalizePriority(p) {
  const days = p.agingDays != null ? Number(p.agingDays) : null;
  return {
    dealId:        _safeStr(p.dealId),
    dealName:      _safeStr(p.dealName),
    responsible:   _safeStr(p.responsible),
    pipeline:      _safeStr(p.pipeline),
    priorityLevel: _safeStr(p.priorityLevel),
    priorityScore: _safeNum(p.priorityScore),
    value:         _safeNum(p.value),
    agingDays:     days !== null && !isNaN(days) && days >= 0 ? days : null,
  };
}

// ── Sanitização defensiva (whitelist-first + backstop final) ──────────────

function _safeStr(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return null;
  return String(v);
}

function _safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function _safePlainObject(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'number') {
      out[k] = isNaN(val) ? null : val;
    } else if (val === null || val === undefined) {
      out[k] = null;
    } else if (typeof val === 'string' || typeof val === 'boolean') {
      out[k] = val;
    } else {
      out[k] = null;
    }
  }
  return out;
}

function _sanitize(v) {
  if (v === undefined) return null;
  if (v === null)      return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (Array.isArray(v)) return v.map(_sanitize);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = _sanitize(val);
    return out;
  }
  return v;
}
