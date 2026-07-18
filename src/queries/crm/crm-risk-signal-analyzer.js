/**
 * ESA OS — Queries / CRM
 * CRMRiskSignalAnalyzer
 *
 * Análise de sinais de risco comercial do pipeline CRM.
 * Produz sinais gerenciais explícitos, priorizados e deduplicados a partir dos deals.
 *
 * Reutiliza AGING_THRESHOLDS de CRMPipelineAnalyzer — não duplica lógica de classificação.
 * Usa dependency injection — não importa singletons diretamente.
 *
 * IMPORTANTE:
 * Não acessa Firebase. Não acessa Audit. Não acessa Event Bus.
 * Usa apenas CRMReadModel.getDeals() como fonte.
 *
 * Política de deduplicação (por deal, por ordem de especificidade):
 *   CRITICAL_NO_NEXT_ACTION: emitido se critical + sem próxima ação.
 *   HIGH_VALUE_STALE:        emitido se valor >= HIGH_VALUE_THRESHOLD + aging risk/critical.
 *                            Pode coexistir com CRITICAL_NO_NEXT_ACTION (dimensões distintas:
 *                            valor exposto vs ausência de ação). Coexistência intencional.
 *   STALE_DEAL:              emitido se risk/critical E nenhum sinal específico já emitido.
 *                            Suprimido quando CRITICAL_NO_NEXT_ACTION ou HIGH_VALUE_STALE
 *                            já cobrem o mesmo deal com maior especificidade.
 *   RESPONSIBLE_RISK_CONCENTRATION: sinal agregado por responsável. Sem deduplicação com
 *                            sinais de deal (dimensão diferente: concentração de portfólio).
 *   PIPELINE_RISK_CONCENTRATION:    sinal agregado por funil. Sem deduplicação com sinais
 *                            de deal (dimensão diferente: saúde do funil).
 */

import { AGING_THRESHOLDS } from './crm-pipeline-analyzer.js';

/** Tipos de sinal de risco (centralizados — sem strings mágicas espalhadas). */
export const SIGNAL_TYPES = {
  CRITICAL_NO_NEXT_ACTION:        'CRITICAL_NO_NEXT_ACTION',
  HIGH_VALUE_STALE:               'HIGH_VALUE_STALE',
  STALE_DEAL:                     'STALE_DEAL',
  RESPONSIBLE_RISK_CONCENTRATION: 'RESPONSIBLE_RISK_CONCENTRATION',
  PIPELINE_RISK_CONCENTRATION:    'PIPELINE_RISK_CONCENTRATION',
};

/** Níveis de severidade (centralizados). */
export const SEVERITY_LEVELS = {
  info:      'info',
  attention: 'attention',
  risk:      'risk',
  critical:  'critical',
};

/**
 * Threshold de alto valor para HIGH_VALUE_STALE (R$ 500.000).
 * Deals com valor >= HIGH_VALUE_THRESHOLD em faixa risk/critical geram este sinal.
 */
export const HIGH_VALUE_THRESHOLD = 500_000;

/**
 * Thresholds de concentração de risco (centralizados — sem números mágicos espalhados).
 *
 * responsibleMinDeals:   mínimo de deals risk/critical por responsável para disparar sinal
 * responsibleMinPercent: percentual mínimo de deals risk/critical na carteira do responsável
 * pipelineMinDeals:      mínimo de deals elegíveis no funil
 * pipelineMinPercent:    percentual mínimo de deals risk/critical no funil
 */
export const RISK_THRESHOLDS = {
  responsibleMinDeals:   3,
  responsibleMinPercent: 0.50,
  pipelineMinDeals:      5,
  pipelineMinPercent:    0.40,
};

/** Ordem de priorização de severidade (menor índice = maior prioridade). */
const SEVERITY_ORDER = {
  [SEVERITY_LEVELS.critical]:  0,
  [SEVERITY_LEVELS.risk]:      1,
  [SEVERITY_LEVELS.attention]: 2,
  [SEVERITY_LEVELS.info]:      3,
};

const MS_PER_DAY = 86_400_000;

// ── Helpers de aging (importam AGING_THRESHOLDS — sem duplicar lógica de classificação) ──

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
 * Analisador de sinais de risco comercial do pipeline CRM.
 */
export class CRMRiskSignalAnalyzer {
  /**
   * @param {CRMReadModel} readModel - Instância do Read Model CRM (injetada)
   */
  constructor(readModel) {
    this._readModel = readModel;
  }

  // ── API pública ───────────────────────────────────────────────────────────

  /**
   * Retorna lista priorizada de sinais de risco comercial.
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @param {number} [options.referenceDate] - Timestamp de referência em ms (testes determinísticos)
   * @returns {RiskSignal[]}
   */
  getRiskSignals(filters = {}, options = {}) {
    this._requireReadModel();
    const refMs  = this._referenceMs(options);
    const deals  = this._readModel.getDeals(filters);
    const signals = this._generateSignals(deals, refMs);
    this._sortSignals(signals);
    return signals;
  }

  /**
   * Retorna apenas sinais com severity === 'critical'.
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {RiskSignal[]}
   */
  getCriticalRiskSignals(filters = {}, options = {}) {
    return this.getRiskSignals(filters, options)
      .filter((s) => s.severity === SEVERITY_LEVELS.critical);
  }

  /**
   * Retorna resumo gerencial com contagens, valor exposto e lista priorizada de sinais.
   *
   * @param {Object} filters
   * @param {Object} [options={}]
   * @returns {RiskSignalSummary}
   */
  getRiskSignalSummary(filters = {}, options = {}) {
    this._requireReadModel();
    const refMs   = this._referenceMs(options);
    const deals   = this._readModel.getDeals(filters);
    const signals = this._generateSignals(deals, refMs);
    this._sortSignals(signals);
    return this._buildSummary(signals, deals);
  }

  // ── Geração de sinais ─────────────────────────────────────────────────────

  _generateSignals(deals, refMs) {
    const signals = [];
    this._generateDealSignals(deals, refMs, signals);
    this._generateResponsibleSignals(deals, refMs, signals);
    this._generatePipelineSignals(deals, refMs, signals);
    return signals;
  }

  _generateDealSignals(deals, refMs, signals) {
    for (const deal of deals) {
      const days  = _agingDays(deal, refMs);
      const level = _classifyAging(days);
      const valor = Number(deal.valor) || 0;
      if (level !== 'risk' && level !== 'critical') continue;

      const emitted = new Set();

      if (level === 'critical' && !_hasNextAction(deal)) {
        signals.push(this._signalCriticalNoNextAction(deal, days, valor));
        emitted.add(SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION);
      }
      if (valor >= HIGH_VALUE_THRESHOLD) {
        signals.push(this._signalHighValueStale(deal, days, level, valor));
        emitted.add(SIGNAL_TYPES.HIGH_VALUE_STALE);
      }
      if (emitted.size === 0) {
        signals.push(this._signalStaleDeal(deal, days, level, valor));
      }
    }
  }

  _generateResponsibleSignals(deals, refMs, signals) {
    const map = this._buildResponsibleMap(deals, refMs);
    for (const [responsible, { eligible, atRisk }] of map) {
      if (atRisk.length < RISK_THRESHOLDS.responsibleMinDeals) continue;
      const percent = atRisk.length / eligible.length;
      if (percent < RISK_THRESHOLDS.responsibleMinPercent) continue;
      const totalVal = atRisk.reduce((s, d) => s + (Number(d.valor) || 0), 0);
      signals.push(this._signalResponsibleConcentration(responsible, atRisk, eligible, percent, totalVal));
    }
  }

  _generatePipelineSignals(deals, refMs, signals) {
    const map = this._buildPipelineMap(deals, refMs);
    for (const [pipeline, { eligible, atRisk }] of map) {
      if (eligible.length < RISK_THRESHOLDS.pipelineMinDeals) continue;
      const percent = atRisk.length / eligible.length;
      if (percent < RISK_THRESHOLDS.pipelineMinPercent) continue;
      signals.push(this._signalPipelineConcentration(pipeline, atRisk, eligible, percent));
    }
  }

  // ── Construtores de sinal ─────────────────────────────────────────────────

  _signalCriticalNoNextAction(deal, agingDays, valor) {
    return this._toSignal(SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION, SEVERITY_LEVELS.critical, {
      title:       'Deal crítico sem próxima ação',
      description: `Deal parado há ${agingDays} dias sem próxima ação registrada.`,
      dealId:      deal.id          || null,
      dealName:    deal.nome        || deal.cliente || deal.id || null,
      responsible: deal.responsavel || null,
      pipeline:    deal.funil       || null,
      stage:       deal.etapa       || null,
      value:       valor > 0 ? valor : null,
      agingDays,
      metadata:    { agingLevel: 'critical' },
    });
  }

  _signalHighValueStale(deal, agingDays, agingLevel, valor) {
    const sev = agingLevel === 'critical' ? SEVERITY_LEVELS.critical : SEVERITY_LEVELS.risk;
    return this._toSignal(SIGNAL_TYPES.HIGH_VALUE_STALE, sev, {
      title:       'Deal de alto valor parado',
      description: `Deal com valor superior a R$ 500 mil parado há ${agingDays} dias.`,
      dealId:      deal.id          || null,
      dealName:    deal.nome        || deal.cliente || deal.id || null,
      responsible: deal.responsavel || null,
      pipeline:    deal.funil       || null,
      stage:       deal.etapa       || null,
      value:       valor,
      agingDays,
      metadata:    { agingLevel, threshold: HIGH_VALUE_THRESHOLD },
    });
  }

  _signalStaleDeal(deal, agingDays, agingLevel, valor) {
    const sev = agingLevel === 'critical' ? SEVERITY_LEVELS.critical : SEVERITY_LEVELS.risk;
    return this._toSignal(SIGNAL_TYPES.STALE_DEAL, sev, {
      title:       `Deal ${agingLevel === 'critical' ? 'crítico' : 'em risco'} parado`,
      description: `Deal parado há ${agingDays} dias.`,
      dealId:      deal.id          || null,
      dealName:    deal.nome        || deal.cliente || deal.id || null,
      responsible: deal.responsavel || null,
      pipeline:    deal.funil       || null,
      stage:       deal.etapa       || null,
      value:       valor > 0 ? valor : null,
      agingDays,
      metadata:    { agingLevel },
    });
  }

  _signalResponsibleConcentration(responsible, atRisk, eligible, percent, totalVal) {
    const pct = Math.round(percent * 100);
    return this._toSignal(SIGNAL_TYPES.RESPONSIBLE_RISK_CONCENTRATION, SEVERITY_LEVELS.risk, {
      title:       `Concentração de risco: ${responsible}`,
      description: `${responsible} possui ${atRisk.length} deals em risco/crítico (${pct}% da carteira).`,
      dealId:      null,
      dealName:    null,
      responsible,
      pipeline:    null,
      stage:       null,
      value:       totalVal > 0 ? totalVal : null,
      agingDays:   null,
      metadata: {
        atRiskCount:   atRisk.length,
        eligibleCount: eligible.length,
        percent:       Math.round(percent * 100) / 100,
      },
    });
  }

  _signalPipelineConcentration(pipeline, atRisk, eligible, percent) {
    const pct = Math.round(percent * 100);
    return this._toSignal(SIGNAL_TYPES.PIPELINE_RISK_CONCENTRATION, SEVERITY_LEVELS.risk, {
      title:       `Concentração de risco no funil: ${pipeline}`,
      description: `Funil ${pipeline}: ${atRisk.length}/${eligible.length} deals em risco/crítico (${pct}%).`,
      dealId:      null,
      dealName:    null,
      responsible: null,
      pipeline,
      stage:       null,
      value:       null,
      agingDays:   null,
      metadata: {
        atRiskCount:   atRisk.length,
        eligibleCount: eligible.length,
        percent:       Math.round(percent * 100) / 100,
      },
    });
  }

  // ── Mapas de agregação ────────────────────────────────────────────────────

  _buildResponsibleMap(deals, refMs) {
    const map = new Map();
    for (const deal of deals) {
      const r = deal.responsavel;
      if (!r || !String(r).trim()) continue;
      if (!map.has(r)) map.set(r, { eligible: [], atRisk: [] });
      const entry = map.get(r);
      entry.eligible.push(deal);
      const level = _classifyAging(_agingDays(deal, refMs));
      if (level === 'risk' || level === 'critical') entry.atRisk.push(deal);
    }
    return map;
  }

  _buildPipelineMap(deals, refMs) {
    const map = new Map();
    for (const deal of deals) {
      const p = deal.funil;
      if (!p || !String(p).trim()) continue;
      if (!map.has(p)) map.set(p, { eligible: [], atRisk: [] });
      const entry = map.get(p);
      entry.eligible.push(deal);
      const level = _classifyAging(_agingDays(deal, refMs));
      if (level === 'risk' || level === 'critical') entry.atRisk.push(deal);
    }
    return map;
  }

  // ── Ordenação ─────────────────────────────────────────────────────────────

  _sortSignals(signals) {
    signals.sort((a, b) => {
      const sv = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
      if (sv !== 0) return sv;
      const va = a.value    ?? -1;
      const vb = b.value    ?? -1;
      if (vb !== va) return vb - va;
      const aa = a.agingDays ?? -1;
      const ab = b.agingDays ?? -1;
      if (ab !== aa) return ab - aa;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  // ── Resumo gerencial ──────────────────────────────────────────────────────

  _buildSummary(signals, deals) {
    const dealValueMap = new Map();
    for (const deal of deals) {
      if (deal.id) dealValueMap.set(deal.id, Number(deal.valor) || 0);
    }

    const affectedDealIds = new Set();
    const byType     = {};
    const bySeverity = { critical: 0, risk: 0, attention: 0, info: 0 };

    for (const signal of signals) {
      if (signal.dealId) affectedDealIds.add(signal.dealId);
      byType[signal.type] = (byType[signal.type] || 0) + 1;
      if (signal.severity in bySeverity) bySeverity[signal.severity]++;
    }

    let valueExposed = 0;
    for (const dealId of affectedDealIds) {
      valueExposed += dealValueMap.get(dealId) || 0;
    }

    return {
      totalSignals:     signals.length,
      criticalSignals:  bySeverity.critical,
      riskSignals:      bySeverity.risk,
      attentionSignals: bySeverity.attention,
      infoSignals:      bySeverity.info,
      affectedDeals:    affectedDealIds.size,
      valueExposed,
      byType,
      bySeverity,
      signals,
    };
  }

  // ── Base e utilitários ────────────────────────────────────────────────────

  _toSignal(type, severity, { title, description, dealId, dealName, responsible, pipeline, stage, value, agingDays, metadata }) {
    const slugKey = dealId != null
      ? String(dealId)
      : String(responsible || pipeline || 'global').replace(/\W+/g, '_').slice(0, 40);
    return {
      id:          `${type}::${slugKey}`,
      type,
      severity,
      title:       title       || '',
      description: description || '',
      dealId:      dealId      != null ? dealId      : null,
      dealName:    dealName    != null ? dealName    : null,
      responsible: responsible != null ? responsible : null,
      pipeline:    pipeline    != null ? pipeline    : null,
      stage:       stage       != null ? stage       : null,
      value:       typeof value === 'number' && !isNaN(value) ? value : null,
      agingDays:   typeof agingDays === 'number' && !isNaN(agingDays) ? agingDays : null,
      createdAt:   Date.now(),
      metadata:    Object.assign({}, metadata),
    };
  }

  _referenceMs(options) {
    const r = options && options.referenceDate;
    return typeof r === 'number' && r > 0 ? r : Date.now();
  }

  _requireReadModel() {
    if (!this._readModel || typeof this._readModel.getDeals !== 'function') {
      throw new TypeError('[CRMRiskSignalAnalyzer] readModel must expose getDeals()');
    }
  }
}
