/**
 * ESA OS — Queries / CRM
 * CRMActionPriorityAnalyzer
 *
 * Priorização gerencial de ações comerciais.
 * Combina aging (via AGING_THRESHOLDS de CRMPipelineAnalyzer) e sinais de risco
 * (via CRMRiskSignalAnalyzer) em uma fila priorizada de deals que merecem atenção.
 *
 * Política de dupla contribuição (intencional, documentada e testada):
 *   CRITICAL_NO_NEXT_ACTION (+35) e NO_NEXT_ACTION (+20) podem coexistir no mesmo deal.
 *   Razão: o sinal representa gravidade específica (ausência de ação num deal crítico);
 *   o bônus genérico representa ausência objetiva de próxima ação em qualquer deal
 *   risk/critical. Dimensões distintas — acumulação intencional.
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa Audit. Não acessa Event Bus.
 * Usa apenas CRMReadModel.getDeals() como fonte (diretamente e via CRMRiskSignalAnalyzer).
 * Usa dependency injection — não importa singletons diretamente.
 */

import { AGING_THRESHOLDS }    from './crm-pipeline-analyzer.js';
import { CRMRiskSignalAnalyzer,
         SIGNAL_TYPES }        from './crm-risk-signal-analyzer.js';

/** Níveis de prioridade gerencial (centralizados — sem strings mágicas espalhadas). */
export const PRIORITY_LEVELS = {
  low:    'low',
  medium: 'medium',
  high:   'high',
  urgent: 'urgent',
};

/**
 * Pesos de pontuação (centralizados — sem números mágicos espalhados).
 *
 * aging:        base score por nível de aging (fresh=0, attention=15, risk=35, critical=60)
 * signal:       bônus por tipo de sinal de deal (deal-level signals only)
 * value:        bônus por faixa de valor — usar o MAIOR bracket aplicável, sem acumulação
 * noNextAction: bônus adicional para deals risk/critical sem próxima ação registrada
 *               (pode coexistir com CRITICAL_NO_NEXT_ACTION — ver política de dupla contribuição)
 */
export const SCORE_WEIGHTS = {
  aging: { fresh: 0, attention: 15, risk: 35, critical: 60 },
  signal: {
    [SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION]: 35,
    [SIGNAL_TYPES.HIGH_VALUE_STALE]:        25,
    [SIGNAL_TYPES.STALE_DEAL]:              15,
  },
  value:        { high: 15, veryHigh: 25 },
  noNextAction: 20,
};

/**
 * Thresholds de valor para bônus de pontuação.
 * high:     R$ 500.000 — alinha com HIGH_VALUE_THRESHOLD do CRMRiskSignalAnalyzer
 * veryHigh: R$ 1.000.000 — bracket de criticidade adicional
 */
export const VALUE_THRESHOLDS = {
  high:     500_000,
  veryHigh: 1_000_000,
};

/**
 * Thresholds de score para determinação do nível de prioridade (centralizados).
 * low:    0–24  | medium: 25–49 | high: 50–74 | urgent: 75–100
 */
export const PRIORITY_SCORE_THRESHOLDS = {
  medium: 25,
  high:   50,
  urgent: 75,
};

const MS_PER_DAY = 86_400_000;

const AGING_REASON_LABELS = {
  attention: 'Aging em atenção (8–14 dias)',
  risk:      'Deal em risco por aging (15–30 dias)',
  critical:  'Deal crítico por aging (31+ dias)',
};

const SIGNAL_REASON_LABELS = {
  [SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION]: 'Deal crítico sem próxima ação',
  [SIGNAL_TYPES.HIGH_VALUE_STALE]:        'Deal de alto valor parado',
  [SIGNAL_TYPES.STALE_DEAL]:              'Deal parado (risco ou crítico)',
};

// ── Helpers de aging (mesma lógica de crm-risk-signal-analyzer.js — AGING_THRESHOLDS compartilhado) ──

function _lastRelevantAt(deal) {
  const u = Number(deal.updatedAt);
  if (u > 0) return u;
  const c = Number(deal.createdAt);
  return c > 0 ? c : 0;
}

function _agingDays(deal, referenceMs) {
  const t = _lastRelevantAt(deal);
  if (t <= 0) return null;
  const ms = referenceMs - t;
  return ms >= 0 ? Math.floor(ms / MS_PER_DAY) : 0;
}

function _classifyAging(days) {
  if (days === null)                      return 'unknown';
  if (days <= AGING_THRESHOLDS.fresh)     return 'fresh';
  if (days <= AGING_THRESHOLDS.attention) return 'attention';
  if (days <= AGING_THRESHOLDS.risk)      return 'risk';
  return 'critical';
}

function _hasNextAction(deal) {
  const pa = deal.proximaAcao;
  if (pa && String(pa).trim()) return true;
  const fu = deal.followUp;
  if (fu && String(fu).trim()) return true;
  return false;
}

/**
 * Analisador de prioridades de ação comercial.
 */
export class CRMActionPriorityAnalyzer {
  /**
   * @param {CRMReadModel} readModel - Instância do Read Model CRM (injetada)
   */
  constructor(readModel) {
    this._readModel    = readModel;
    this._riskAnalyzer = null;
  }

  // ── API pública ───────────────────────────────────────────────────────────

  /**
   * Retorna lista priorizada de ações comerciais por deal.
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @param {number} [options.referenceDate] - Timestamp ms (testes determinísticos)
   * @returns {ActionPriority[]}
   */
  getActionPriorities(filters = {}, options = {}) {
    this._requireReadModel();
    const refMs     = this._referenceMs(options);
    const deals     = this._readModel.getDeals(filters);
    const signals   = this._getRiskAnalyzer().getRiskSignals(filters, options);
    const signalMap = this._buildDealSignalMap(signals);
    const items     = deals.map((deal) => this._buildPriority(deal, refMs, signalMap));
    this._sortPriorities(items);
    return items;
  }

  /**
   * Retorna apenas prioridades com nível 'urgent'.
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {ActionPriority[]}
   */
  getUrgentActionPriorities(filters = {}, options = {}) {
    return this.getActionPriorities(filters, options)
      .filter((p) => p.priorityLevel === PRIORITY_LEVELS.urgent);
  }

  /**
   * Retorna resumo gerencial com contagens, valores e fila priorizada.
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {ActionPrioritySummary}
   */
  getActionPrioritySummary(filters = {}, options = {}) {
    const items = this.getActionPriorities(filters, options);
    return this._buildSummary(items);
  }

  // ── Construção de prioridade ──────────────────────────────────────────────

  _buildPriority(deal, refMs, signalMap) {
    const days      = _agingDays(deal, refMs);
    const level     = _classifyAging(days);
    const valor     = Number(deal.valor) || 0;
    const hasAction = _hasNextAction(deal);
    const signals   = signalMap.get(deal.id) || [];

    const { score, reasons, signalTypes } = this._computeScore(level, valor, signals, hasAction);

    return {
      id:             `priority::${deal.id || ''}`,
      dealId:         deal.id          || '',
      dealName:       deal.nome        || deal.cliente || deal.id || '',
      company:        deal.empresa     || '',
      responsible:    deal.responsavel || '',
      pipeline:       deal.funil       || '',
      stage:          deal.etapa       || '',
      status:         deal.status      || '',
      value:          valor,
      agingDays:      days !== null ? days : -1,
      agingLevel:     level,
      priorityScore:  score,
      priorityLevel:  this._scoreToPriorityLevel(score),
      reasons,
      signalTypes,
      nextActionAt:   deal.proximaAcao  || null,
      lastRelevantAt: _lastRelevantAt(deal),
      metadata:       { hasNextAction: hasAction },
    };
  }

  _computeScore(agingLevel, valor, signals, hasNextAction) {
    let score         = 0;
    const reasons     = [];
    const signalTypes = [];

    const agingBase = SCORE_WEIGHTS.aging[agingLevel] || 0;
    if (agingBase > 0) {
      score += agingBase;
      reasons.push(this._reasonForAging(agingLevel, agingBase));
    }

    for (const signal of signals) {
      const bonus = SCORE_WEIGHTS.signal[signal.type];
      if (bonus !== undefined) {
        score += bonus;
        reasons.push({ code: signal.type, label: SIGNAL_REASON_LABELS[signal.type] || signal.type, weight: bonus });
      }
      signalTypes.push(signal.type);
    }

    const { bonus: vBonus, reason: vReason } = this._computeValueBonus(valor);
    if (vBonus > 0) { score += vBonus; reasons.push(vReason); }

    const isAtRisk = agingLevel === 'risk' || agingLevel === 'critical';
    if (isAtRisk && !hasNextAction) {
      score += SCORE_WEIGHTS.noNextAction;
      reasons.push({ code: 'NO_NEXT_ACTION', label: 'Sem próxima ação registrada', weight: SCORE_WEIGHTS.noNextAction });
    }

    return { score: Math.min(100, Math.max(0, score)), reasons, signalTypes };
  }

  _computeValueBonus(valor) {
    if (valor >= VALUE_THRESHOLDS.veryHigh) {
      const w = SCORE_WEIGHTS.value.veryHigh;
      return { bonus: w, reason: { code: 'VERY_HIGH_VALUE', label: 'Valor muito alto (≥ R$ 1 milhão)', weight: w } };
    }
    if (valor >= VALUE_THRESHOLDS.high) {
      const w = SCORE_WEIGHTS.value.high;
      return { bonus: w, reason: { code: 'HIGH_VALUE', label: 'Valor alto (≥ R$ 500 mil)', weight: w } };
    }
    return { bonus: 0, reason: null };
  }

  _reasonForAging(level, base) {
    return { code: `${level.toUpperCase()}_AGING`, label: AGING_REASON_LABELS[level] || level, weight: base };
  }

  _scoreToPriorityLevel(score) {
    if (score >= PRIORITY_SCORE_THRESHOLDS.urgent) return PRIORITY_LEVELS.urgent;
    if (score >= PRIORITY_SCORE_THRESHOLDS.high)   return PRIORITY_LEVELS.high;
    if (score >= PRIORITY_SCORE_THRESHOLDS.medium) return PRIORITY_LEVELS.medium;
    return PRIORITY_LEVELS.low;
  }

  // ── Mapa de sinais por deal ───────────────────────────────────────────────

  _buildDealSignalMap(signals) {
    const map = new Map();
    for (const signal of signals) {
      if (signal.dealId == null) continue;
      if (!map.has(signal.dealId)) map.set(signal.dealId, []);
      map.get(signal.dealId).push(signal);
    }
    return map;
  }

  // ── Ordenação ─────────────────────────────────────────────────────────────

  _sortPriorities(items) {
    items.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      if (b.value         !== a.value)         return b.value         - a.value;
      const ad = a.agingDays >= 0 ? a.agingDays : -1;
      const bd = b.agingDays >= 0 ? b.agingDays : -1;
      if (bd !== ad) return bd - ad;
      return String(a.dealId).localeCompare(String(b.dealId));
    });
  }

  // ── Resumo gerencial ──────────────────────────────────────────────────────

  _buildSummary(items) {
    const byPriorityLevel = { urgent: 0, high: 0, medium: 0, low: 0 };
    let prioritizedValue  = 0;
    let urgentValue       = 0;
    let scoreSum          = 0;

    for (const p of items) {
      if (p.priorityLevel in byPriorityLevel) byPriorityLevel[p.priorityLevel]++;
      if (p.priorityLevel === PRIORITY_LEVELS.high || p.priorityLevel === PRIORITY_LEVELS.urgent) {
        prioritizedValue += p.value;
      }
      if (p.priorityLevel === PRIORITY_LEVELS.urgent) urgentValue += p.value;
      scoreSum += p.priorityScore;
    }

    const averagePriorityScore = items.length > 0
      ? Math.round(scoreSum / items.length)
      : 0;

    return {
      totalPriorities:     items.length,
      urgentDeals:         byPriorityLevel.urgent,
      highPriorityDeals:   byPriorityLevel.high,
      mediumPriorityDeals: byPriorityLevel.medium,
      lowPriorityDeals:    byPriorityLevel.low,
      prioritizedValue,
      urgentValue,
      averagePriorityScore,
      byPriorityLevel,
      priorities: items,
    };
  }

  // ── Instanciação lazy ─────────────────────────────────────────────────────

  _getRiskAnalyzer() {
    if (!this._riskAnalyzer) {
      this._riskAnalyzer = new CRMRiskSignalAnalyzer(this._readModel);
    }
    return this._riskAnalyzer;
  }

  _referenceMs(options) {
    const r = options && options.referenceDate;
    return typeof r === 'number' && r > 0 ? r : Date.now();
  }

  _requireReadModel() {
    if (!this._readModel || typeof this._readModel.getDeals !== 'function') {
      throw new TypeError('[CRMActionPriorityAnalyzer] readModel must expose getDeals()');
    }
  }
}
