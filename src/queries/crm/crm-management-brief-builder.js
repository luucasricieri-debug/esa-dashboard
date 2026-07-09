/**
 * ESA OS — Queries / CRM
 * CRMManagementBriefBuilder
 *
 * Orquestra os resultados do CRMQueryService em um briefing gerencial consolidado.
 * NÃO recalcula análises — consolida contratos existentes via dependency injection.
 *
 * Seções consolidadas:
 *   executive      → getExecutiveSummary()
 *   pipelineHealth → getPipelineHealth()
 *   risk           → getRiskSignalSummary()
 *   actionPriority → getActionPrioritySummary()
 *
 * Gera highlights gerenciais determinísticos e narrativa em pt-BR.
 * Cada seção é isolada: falha de uma seção não impede as demais.
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa Event Bus. Não usa IA.
 * Não duplica CRMPipelineAnalyzer, CRMRiskSignalAnalyzer, CRMActionPriorityAnalyzer.
 * Usa dependency injection — recebe CRMQueryService no constructor.
 */

/** Threshold de exposição financeira elevada para highlight HIGH_EXPOSURE (R$ 1.000.000). */
export const HIGH_EXPOSURE_THRESHOLD = 1_000_000;

/** Status de seção no briefing (centralizados). */
export const SECTION_STATUS = {
  available:   'available',
  unavailable: 'unavailable',
};

/** Códigos de highlight (centralizados — sem strings mágicas). */
export const HIGHLIGHT_CODES = {
  CRITICAL_PIPELINE: 'CRITICAL_PIPELINE',
  VALUE_AT_RISK:     'VALUE_AT_RISK',
  NO_NEXT_ACTION:    'NO_NEXT_ACTION',
  CRITICAL_SIGNALS:  'CRITICAL_SIGNALS',
  URGENT_ACTIONS:    'URGENT_ACTIONS',
  HIGH_EXPOSURE:     'HIGH_EXPOSURE',
};

/** Severidade dos highlights (alinhada com SEVERITY_LEVELS do CRMRiskSignalAnalyzer). */
export const HIGHLIGHT_SEVERITY = {
  critical:  'critical',
  risk:      'risk',
  attention: 'attention',
  info:      'info',
};

const SEVERITY_ORDER     = { critical: 0, risk: 1, attention: 2, info: 3 };
const TOP_SIGNALS_LIMIT    = 10;
const TOP_PRIORITIES_LIMIT = 10;

/**
 * Builder do briefing gerencial comercial da ESA OS.
 * Não recalcula análises — orquestra CRMQueryService.
 */
export class CRMManagementBriefBuilder {
  /** @param {CRMQueryService} queryService */
  constructor(queryService) {
    this._qs = queryService;
  }

  /**
   * Constrói o briefing gerencial consolidado.
   *
   * @param {Object} [filters={}]
   * @param {Object} [options={}]
   * @param {number} [options.referenceDate] - Timestamp ms (testes determinísticos)
   * @returns {ManagementBrief}
   */
  buildBrief(filters = {}, options = {}) {
    const refDate   = this._refDate(options);
    const sections  = {};
    const available = [];
    const unavail   = [];

    let executive      = null;
    let pipelineHealth = null;
    let risk           = null;
    let actionPriority = null;

    try {
      executive = this._normalizeExecutive(this._qs.getExecutiveSummary(filters).toJSON());
      sections.executive = SECTION_STATUS.available;
      available.push('executive');
    } catch (_) {
      sections.executive = SECTION_STATUS.unavailable;
      unavail.push('executive');
    }

    try {
      pipelineHealth = this._normalizePipelineHealth(this._qs.getPipelineHealth(filters, options).toJSON());
      sections.pipelineHealth = SECTION_STATUS.available;
      available.push('pipelineHealth');
    } catch (_) {
      sections.pipelineHealth = SECTION_STATUS.unavailable;
      unavail.push('pipelineHealth');
    }

    try {
      risk = this._normalizeRisk(this._qs.getRiskSignalSummary(filters, options).toJSON());
      sections.risk = SECTION_STATUS.available;
      available.push('risk');
    } catch (_) {
      sections.risk = SECTION_STATUS.unavailable;
      unavail.push('risk');
    }

    try {
      actionPriority = this._normalizeActionPriority(this._qs.getActionPrioritySummary(filters, options).toJSON());
      sections.actionPriority = SECTION_STATUS.available;
      available.push('actionPriority');
    } catch (_) {
      sections.actionPriority = SECTION_STATUS.unavailable;
      unavail.push('actionPriority');
    }

    const highlights = this._buildHighlights(pipelineHealth, risk, actionPriority);
    this._sortHighlights(highlights);
    const managementNarrative = this._buildNarrative(pipelineHealth, risk, actionPriority, executive);

    return {
      generatedAt:         Date.now(),
      referenceDate:       refDate,
      filters:             Object.assign({}, filters),
      executive,
      pipelineHealth,
      risk,
      actionPriority,
      highlights,
      managementNarrative,
      metadata: {
        filtersApplied:      Object.keys(filters).length > 0,
        referenceDate:       refDate,
        sections,
        availableSections:   available.slice(),
        unavailableSections: unavail.slice(),
        highlightCount:      highlights.length,
        topRiskSignalCount:  risk           ? risk.topSignals.length              : 0,
        topPriorityCount:    actionPriority ? actionPriority.topPriorities.length : 0,
      },
    };
  }

  // ── Normalizadores de seção ───────────────────────────────────────────────

  _normalizeExecutive(json) {
    const d    = json.data     || {};
    const meta = json.metadata || {};
    const totalDeals = (meta.dealCount !== undefined && meta.dealCount !== null)
      ? meta.dealCount
      : ((d.status && d.status.total) || 0);
    return {
      totalDeals,
      conversionRate:   Number((d.conversion && d.conversion.rate)            || 0),
      winRate:          Number((d.winRate     && d.winRate.rate)              || 0),
      lossRate:         Number((d.lossRate    && d.lossRate.rate)             || 0),
      pausedRate:       Number((d.pausedRate  && d.pausedRate.rate)           || 0),
      pipelineValue:    Number((d.forecast    && d.forecast.totalValue)       || 0),
      weightedForecast: Number((d.forecast    && d.forecast.weightedValue)    || 0),
    };
  }

  _normalizePipelineHealth(json) {
    const d = json.data || {};
    return {
      totalDeals:             Number(d.totalDeals)             || 0,
      freshDeals:             Number(d.freshDeals)             || 0,
      attentionDeals:         Number(d.attentionDeals)         || 0,
      riskDeals:              Number(d.riskDeals)              || 0,
      criticalDeals:          Number(d.criticalDeals)          || 0,
      dealsWithoutNextAction: Number(d.dealsWithoutNextAction) || 0,
      valueAtRisk:            Number(d.valueAtRisk)            || 0,
      criticalValue:          Number(d.criticalValue)          || 0,
      agingDistribution:      Object.assign({}, d.agingDistribution || {}),
    };
  }

  _normalizeRisk(json) {
    const d       = json.data || {};
    const signals = Array.isArray(d.signals) ? d.signals : [];
    return {
      totalSignals:    Number(d.totalSignals)    || 0,
      criticalSignals: Number(d.criticalSignals) || 0,
      riskSignals:     Number(d.riskSignals)     || 0,
      affectedDeals:   Number(d.affectedDeals)   || 0,
      valueExposed:    Number(d.valueExposed)    || 0,
      byType:          Object.assign({}, d.byType     || {}),
      bySeverity:      Object.assign({}, d.bySeverity || {}),
      topSignals:      signals.slice(0, TOP_SIGNALS_LIMIT),
    };
  }

  _normalizeActionPriority(json) {
    const d          = json.data || {};
    const priorities = Array.isArray(d.priorities) ? d.priorities : [];
    return {
      totalPriorities:     Number(d.totalPriorities)      || 0,
      urgentDeals:         Number(d.urgentDeals)          || 0,
      highPriorityDeals:   Number(d.highPriorityDeals)    || 0,
      mediumPriorityDeals: Number(d.mediumPriorityDeals)  || 0,
      lowPriorityDeals:    Number(d.lowPriorityDeals)     || 0,
      prioritizedValue:    Number(d.prioritizedValue)     || 0,
      urgentValue:         Number(d.urgentValue)          || 0,
      averagePriorityScore:Number(d.averagePriorityScore) || 0,
      byPriorityLevel:     Object.assign({}, d.byPriorityLevel || {}),
      topPriorities:       priorities.slice(0, TOP_PRIORITIES_LIMIT),
    };
  }

  // ── Highlights ────────────────────────────────────────────────────────────

  _buildHighlights(ph, risk, ap) {
    const h = [];

    if (ph) {
      if (ph.criticalDeals > 0) {
        const n = ph.criticalDeals;
        h.push(this._mkHighlight(
          HIGHLIGHT_CODES.CRITICAL_PIPELINE, HIGHLIGHT_SEVERITY.critical,
          'Deals críticos no pipeline',
          `${n} deal${n !== 1 ? 's' : ''} com aging superior a 30 dias exige${n === 1 ? '' : 'm'} ação imediata.`,
          ph.criticalValue > 0 ? ph.criticalValue : null,
          n,
          null,
          { criticalDeals: n, criticalValue: ph.criticalValue },
        ));
      }
      if (ph.valueAtRisk > 0) {
        const n = ph.riskDeals + ph.criticalDeals;
        h.push(this._mkHighlight(
          HIGHLIGHT_CODES.VALUE_AT_RISK, HIGHLIGHT_SEVERITY.risk,
          'Valor em risco no pipeline',
          `${_fmtCurrency(ph.valueAtRisk)} em valor concentra-se em deals com aging elevado.`,
          ph.valueAtRisk,
          n > 0 ? n : null,
          null,
          { valueAtRisk: ph.valueAtRisk },
        ));
      }
      if (ph.dealsWithoutNextAction > 0) {
        const n = ph.dealsWithoutNextAction;
        h.push(this._mkHighlight(
          HIGHLIGHT_CODES.NO_NEXT_ACTION, HIGHLIGHT_SEVERITY.attention,
          'Deals sem próxima ação',
          `${n} deal${n !== 1 ? 's' : ''} não possui${n === 1 ? '' : 'em'} próxima ação registrada.`,
          null,
          n,
          null,
          { dealsWithoutNextAction: n },
        ));
      }
    }

    if (risk) {
      if (risk.criticalSignals > 0) {
        const n = risk.criticalSignals;
        h.push(this._mkHighlight(
          HIGHLIGHT_CODES.CRITICAL_SIGNALS, HIGHLIGHT_SEVERITY.critical,
          'Sinais críticos de risco',
          `${n} sinal${n !== 1 ? 'ais' : ''} de risco em nível crítico ${n === 1 ? 'foi' : 'foram'} identificado${n !== 1 ? 's' : ''}.`,
          risk.valueExposed > 0 ? risk.valueExposed : null,
          n,
          null,
          { criticalSignals: n, valueExposed: risk.valueExposed },
        ));
      }
      if (risk.valueExposed >= HIGH_EXPOSURE_THRESHOLD) {
        h.push(this._mkHighlight(
          HIGHLIGHT_CODES.HIGH_EXPOSURE, HIGHLIGHT_SEVERITY.risk,
          'Alta exposição financeira a risco',
          `${_fmtCurrency(risk.valueExposed)} em valor está exposto a sinais de risco comercial.`,
          risk.valueExposed,
          risk.affectedDeals > 0 ? risk.affectedDeals : null,
          null,
          { valueExposed: risk.valueExposed, threshold: HIGH_EXPOSURE_THRESHOLD },
        ));
      }
    }

    if (ap && ap.urgentDeals > 0) {
      const n = ap.urgentDeals;
      h.push(this._mkHighlight(
        HIGHLIGHT_CODES.URGENT_ACTIONS, HIGHLIGHT_SEVERITY.critical,
        'Ações urgentes pendentes',
        `${n} deal${n !== 1 ? 's' : ''} com prioridade urgente exige${n === 1 ? '' : 'm'} ação imediata.`,
        ap.urgentValue > 0 ? ap.urgentValue : null,
        n,
        null,
        { urgentDeals: n, urgentValue: ap.urgentValue },
      ));
    }

    return h;
  }

  _mkHighlight(code, severity, title, description, value, count, dealId, metadata) {
    return {
      code,
      severity,
      title:       String(title       || ''),
      description: String(description || ''),
      value:       (typeof value === 'number' && !isNaN(value)) ? value : null,
      count:       (typeof count === 'number' && !isNaN(count)) ? count : null,
      dealId:      dealId != null ? String(dealId) : null,
      metadata:    Object.assign({}, metadata || {}),
    };
  }

  _sortHighlights(items) {
    items.sort((a, b) => {
      const sd = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
      if (sd !== 0) return sd;
      const va = a.value ?? -1;
      const vb = b.value ?? -1;
      if (vb !== va) return vb - va;
      const ca = a.count ?? -1;
      const cb = b.count ?? -1;
      if (cb !== ca) return cb - ca;
      return String(a.code).localeCompare(String(b.code));
    });
  }

  // ── Management Narrative ──────────────────────────────────────────────────

  _buildNarrative(ph, risk, ap, executive) {
    const parts = [];

    if (ph && ph.criticalDeals > 0) {
      const n      = ph.criticalDeals;
      const suffix = ph.valueAtRisk > 0
        ? ` e ${_fmtCurrency(ph.valueAtRisk)} em valor sob risco`
        : '';
      parts.push(`O pipeline possui ${n} deal${n !== 1 ? 's' : ''} crítico${n !== 1 ? 's' : ''}${suffix}.`);
    }

    if (risk && risk.criticalSignals > 0) {
      const n = risk.criticalSignals;
      parts.push(`Foram identificados ${n} sinal${n !== 1 ? 'ais' : ''} crítico${n !== 1 ? 's' : ''} de risco comercial.`);
    }

    if (ap && ap.urgentDeals > 0) {
      const n = ap.urgentDeals;
      parts.push(`${n} deal${n !== 1 ? 's' : ''} exige${n === 1 ? '' : 'm'} atenção urgente.`);
    }

    if (ph && ph.dealsWithoutNextAction > 0) {
      const n = ph.dealsWithoutNextAction;
      parts.push(`A principal prioridade gerencial é reduzir o volume de oportunidades sem próxima ação (${n} deal${n !== 1 ? 's' : ''}).`);
    }

    if (parts.length === 0) {
      if (executive && executive.weightedForecast > 0) {
        parts.push(`O forecast ponderado do pipeline é de ${_fmtCurrency(executive.weightedForecast)}.`);
      } else if (executive && executive.pipelineValue > 0) {
        parts.push(`O pipeline acumula ${_fmtCurrency(executive.pipelineValue)} em valor total.`);
      } else {
        parts.push('Nenhuma anomalia gerencial identificada no pipeline atual.');
      }
    }

    return parts.join(' ');
  }

  _refDate(options) {
    const r = options && options.referenceDate;
    return typeof r === 'number' && r > 0 ? r : null;
  }
}

function _fmtCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', {
    style:                 'currency',
    currency:              'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
