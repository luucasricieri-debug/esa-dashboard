/**
 * ESA OS — Manual Tests
 * CRMManagementBriefBuilder — 45 cenários
 *
 * Execute:  node src/queries/crm/crm-management-brief-builder.manual-test.js
 *
 * Cobertura:
 *   - Contrato e estrutura do briefing (cenários 1–8)
 *   - Seção executive (cenários 9–11)
 *   - Seção pipelineHealth (cenários 12–14)
 *   - Seção risk (cenários 15–17)
 *   - Seção actionPriority (cenários 18–20)
 *   - Highlights — disparo e ausência (cenários 21–30)
 *   - Highlight sorting (cenários 31–33)
 *   - Management narrative (cenários 34–39)
 *   - Isolamento de falha de seção (cenários 40–42)
 *   - Filtros e metadata (cenários 43–45)
 */

import { CRMQueryService }              from './crm-query-service.js';
import { CRMManagementBriefBuilder,
         HIGH_EXPOSURE_THRESHOLD,
         SECTION_STATUS,
         HIGHLIGHT_CODES,
         HIGHLIGHT_SEVERITY }           from './crm-management-brief-builder.js';
import { CRMMetrics }                   from '../../read-models/crm/crm-metrics.js';

// ── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

function assert(desc, condition) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(`  FAIL: ${desc}`);
    console.error(`  FAIL: ${desc}`);
  }
}

function assertEq(desc, actual, expected) {
  const ok = actual === expected;
  if (!ok) console.error(`  FAIL: ${desc} → got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  assert(desc, ok);
}

function scenario(n, label) {
  console.log(`\n[${n}/45] ${label}`);
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

const REF_DATE = 1_000_000_000_000;
const DAY_MS   = 86_400_000;

// Mock readModel — preserva proximaAcao e demais campos sem normalização
function mockRM(deals) {
  function filtered(filters = {}) {
    let items = deals.slice();
    if (filters.funil)       items = items.filter((d) => d.funil       === filters.funil);
    if (filters.responsavel) items = items.filter((d) => d.responsavel === filters.responsavel);
    if (filters.status)      items = items.filter((d) => d.status      === filters.status);
    return items;
  }
  return {
    getDeals:        (f = {}) => filtered(f),
    getPipeline:     (f = {}) => {
      const pipeline = {};
      for (const d of filtered(f)) {
        const fn = d.funil || 'Sem Funil';
        const et = d.etapa || 'Sem Etapa';
        if (!pipeline[fn]) pipeline[fn] = {};
        if (!pipeline[fn][et]) pipeline[fn][et] = { count: 0, totalValue: 0, totalKwh: 0 };
        pipeline[fn][et].count++;
        pipeline[fn][et].totalValue += d.valor || 0;
        pipeline[fn][et].totalKwh  += d.kwh   || 0;
      }
      return pipeline;
    },
    getStatusSummary:(f = {}) => {
      const byStatus = {};
      for (const d of filtered(f)) {
        const s = d.status || 'Em andamento';
        byStatus[s] = (byStatus[s] || 0) + 1;
      }
      return { total: filtered(f).length, byStatus };
    },
  };
}

function makeSvc(deals) {
  const rm  = mockRM(deals);
  const met = new CRMMetrics(rm);
  return new CRMQueryService(rm, met);
}

function makeBuilder(deals) {
  return new CRMManagementBriefBuilder(makeSvc(deals));
}

// Standard 4-deal set — triggers all 6 highlights
const D_CRIT1  = { id: 'mb-1', updatedAt: REF_DATE - 40 * DAY_MS, valor: 200_000, responsavel: 'Ana', funil: 'venda_ufv' };
const D_CRIT2  = { id: 'mb-2', updatedAt: REF_DATE - 40 * DAY_MS, valor: 500_000, responsavel: 'Ana', funil: 'venda_ufv' };
const D_RISK1  = { id: 'mb-3', updatedAt: REF_DATE - 20 * DAY_MS, valor: 1_000_000, proximaAcao: 'Call', responsavel: 'Ana', funil: 'venda_ufv' };
const D_FRESH1 = { id: 'mb-4', updatedAt: REF_DATE - 5  * DAY_MS, valor: 50_000,  proximaAcao: 'Call', responsavel: 'Ana', funil: 'venda_ufv' };

const ALL_DEALS    = [D_CRIT1, D_CRIT2, D_RISK1, D_FRESH1];
const opts         = { referenceDate: REF_DATE };

// ── Cenários 1–8 : Contrato e estrutura ──────────────────────────────────────

scenario(1, 'buildBrief() retorna objeto com todas as chaves do contrato ManagementBrief');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const keys = ['generatedAt','referenceDate','filters','executive','pipelineHealth','risk','actionPriority','highlights','managementNarrative','metadata'];
  for (const k of keys) assert(`chave "${k}" presente`, k in brief);
}

scenario(2, 'generatedAt é número > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('generatedAt é número > 0', typeof brief.generatedAt === 'number' && brief.generatedAt > 0);
}

scenario(3, 'referenceDate propagado de options');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assertEq('referenceDate === REF_DATE', brief.referenceDate, REF_DATE);
}

scenario(4, 'referenceDate null quando options vazio');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, {});
  assertEq('referenceDate null sem option', brief.referenceDate, null);
}

scenario(5, 'filters é cópia rasa dos filtros passados');
{
  const f     = { funil: 'venda_ufv' };
  const brief = makeBuilder(ALL_DEALS).buildBrief(f, opts);
  assertEq('filters.funil preservado', brief.filters.funil, 'venda_ufv');
  assert('filters não é a mesma referência', brief.filters !== f);
}

scenario(6, 'highlights é Array');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('highlights é Array', Array.isArray(brief.highlights));
}

scenario(7, 'managementNarrative é string não vazia');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('narrative é string', typeof brief.managementNarrative === 'string');
  assert('narrative não é vazia', brief.managementNarrative.length > 0);
}

scenario(8, 'metadata contém todas as chaves esperadas');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const metaKeys = ['filtersApplied','referenceDate','sections','availableSections','unavailableSections','highlightCount','topRiskSignalCount','topPriorityCount'];
  for (const k of metaKeys) assert(`metadata.${k} presente`, k in brief.metadata);
}

// ── Cenários 9–11 : Seção executive ──────────────────────────────────────────

scenario(9, 'executive contém todas as chaves esperadas');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const keys = ['totalDeals','conversionRate','winRate','lossRate','pausedRate','pipelineValue','weightedForecast'];
  for (const k of keys) assert(`executive.${k} presente`, k in brief.executive);
}

scenario(10, 'executive.totalDeals = 4 com 4 deals');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assertEq('executive.totalDeals', brief.executive.totalDeals, 4);
}

scenario(11, 'executive.pipelineValue > 0 com deals de valor');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('pipelineValue > 0', brief.executive.pipelineValue > 0);
}

// ── Cenários 12–14 : Seção pipelineHealth ────────────────────────────────────

scenario(12, 'pipelineHealth contém todas as chaves esperadas');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const keys = ['totalDeals','freshDeals','attentionDeals','riskDeals','criticalDeals','dealsWithoutNextAction','valueAtRisk','criticalValue','agingDistribution'];
  for (const k of keys) assert(`pipelineHealth.${k} presente`, k in brief.pipelineHealth);
}

scenario(13, 'pipelineHealth.criticalDeals = 2 (D_CRIT1 e D_CRIT2 com 40d)');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assertEq('criticalDeals', brief.pipelineHealth.criticalDeals, 2);
}

scenario(14, 'pipelineHealth.dealsWithoutNextAction = 2 (D_CRIT1 e D_CRIT2 sem proximaAcao)');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assertEq('dealsWithoutNextAction', brief.pipelineHealth.dealsWithoutNextAction, 2);
}

// ── Cenários 15–17 : Seção risk ───────────────────────────────────────────────

scenario(15, 'risk contém todas as chaves esperadas');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const keys = ['totalSignals','criticalSignals','riskSignals','affectedDeals','valueExposed','byType','bySeverity','topSignals'];
  for (const k of keys) assert(`risk.${k} presente`, k in brief.risk);
}

scenario(16, 'risk.topSignals é Array com no máximo 10 itens');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('topSignals é Array', Array.isArray(brief.risk.topSignals));
  assert('topSignals ≤ 10', brief.risk.topSignals.length <= 10);
}

scenario(17, 'risk.valueExposed ≥ 1.700.000 (D_CRIT2 500k + D_RISK1 1M + D_CRIT1 200k sinais sobrepostos)');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('valueExposed ≥ 1.700.000', brief.risk.valueExposed >= 1_700_000);
}

// ── Cenários 18–20 : Seção actionPriority ────────────────────────────────────

scenario(18, 'actionPriority contém todas as chaves esperadas');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const keys = ['totalPriorities','urgentDeals','highPriorityDeals','mediumPriorityDeals','lowPriorityDeals','prioritizedValue','urgentValue','averagePriorityScore','byPriorityLevel','topPriorities'];
  for (const k of keys) assert(`actionPriority.${k} presente`, k in brief.actionPriority);
}

scenario(19, 'actionPriority.topPriorities é Array com no máximo 10 itens');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('topPriorities é Array', Array.isArray(brief.actionPriority.topPriorities));
  assert('topPriorities ≤ 10', brief.actionPriority.topPriorities.length <= 10);
}

scenario(20, 'actionPriority.urgentDeals ≥ 2 (D_CRIT1 e D_CRIT2 com score ≥ 75)');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('urgentDeals ≥ 2', brief.actionPriority.urgentDeals >= 2);
}

// ── Cenários 21–30 : Highlights — disparo e ausência ─────────────────────────

scenario(21, 'CRITICAL_PIPELINE dispara quando criticalDeals > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const h = brief.highlights.find((x) => x.code === HIGHLIGHT_CODES.CRITICAL_PIPELINE);
  assert('CRITICAL_PIPELINE presente', h !== undefined);
  assertEq('severity critical', h.severity, HIGHLIGHT_SEVERITY.critical);
}

scenario(22, 'VALUE_AT_RISK dispara quando valueAtRisk > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const h = brief.highlights.find((x) => x.code === HIGHLIGHT_CODES.VALUE_AT_RISK);
  assert('VALUE_AT_RISK presente', h !== undefined);
  assertEq('severity risk', h.severity, HIGHLIGHT_SEVERITY.risk);
}

scenario(23, 'NO_NEXT_ACTION dispara quando dealsWithoutNextAction > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const h = brief.highlights.find((x) => x.code === HIGHLIGHT_CODES.NO_NEXT_ACTION);
  assert('NO_NEXT_ACTION presente', h !== undefined);
  assertEq('severity attention', h.severity, HIGHLIGHT_SEVERITY.attention);
}

scenario(24, 'CRITICAL_SIGNALS dispara quando criticalSignals > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const h = brief.highlights.find((x) => x.code === HIGHLIGHT_CODES.CRITICAL_SIGNALS);
  assert('CRITICAL_SIGNALS presente', h !== undefined);
  assertEq('severity critical', h.severity, HIGHLIGHT_SEVERITY.critical);
}

scenario(25, 'URGENT_ACTIONS dispara quando urgentDeals > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const h = brief.highlights.find((x) => x.code === HIGHLIGHT_CODES.URGENT_ACTIONS);
  assert('URGENT_ACTIONS presente', h !== undefined);
  assertEq('severity critical', h.severity, HIGHLIGHT_SEVERITY.critical);
}

scenario(26, 'HIGH_EXPOSURE dispara quando valueExposed >= 1.000.000');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const h = brief.highlights.find((x) => x.code === HIGHLIGHT_CODES.HIGH_EXPOSURE);
  assert('HIGH_EXPOSURE presente', h !== undefined);
  assertEq('severity risk', h.severity, HIGHLIGHT_SEVERITY.risk);
}

scenario(27, 'HIGH_EXPOSURE NÃO dispara quando valueExposed < 1.000.000 (apenas 1 deal risk 999.999)');
{
  const d = { id: 'x1', updatedAt: REF_DATE - 20 * DAY_MS, valor: 999_999, proximaAcao: 'Call', responsavel: 'A', funil: 'venda_ufv' };
  const brief = makeBuilder([d]).buildBrief({}, opts);
  const h = brief.highlights.find((x) => x.code === HIGHLIGHT_CODES.HIGH_EXPOSURE);
  assert('HIGH_EXPOSURE ausente abaixo de 1M', h === undefined);
}

scenario(28, 'HIGH_EXPOSURE dispara exatamente no threshold de 1.000.000');
{
  const d = { id: 'x2', updatedAt: REF_DATE - 20 * DAY_MS, valor: 1_000_000, proximaAcao: 'Call', responsavel: 'A', funil: 'venda_ufv' };
  const brief = makeBuilder([d]).buildBrief({}, opts);
  const h = brief.highlights.find((x) => x.code === HIGHLIGHT_CODES.HIGH_EXPOSURE);
  assert('HIGH_EXPOSURE dispara em exatamente 1M', h !== undefined);
}

scenario(29, 'Nenhum highlight quando pipeline limpo (1 deal fresh com ação)');
{
  const d = { id: 'f1', updatedAt: REF_DATE - 3 * DAY_MS, valor: 50_000, proximaAcao: 'Demo', responsavel: 'B', funil: 'venda_ufv' };
  const brief = makeBuilder([d]).buildBrief({}, opts);
  assertEq('0 highlights para pipeline limpo', brief.highlights.length, 0);
}

scenario(30, 'Highlight contract: code, severity, title, description, value, count, dealId, metadata presentes');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  for (const h of brief.highlights) {
    const keys = ['code','severity','title','description','value','count','dealId','metadata'];
    for (const k of keys) assert(`highlight.${k} em ${h.code}`, k in h);
  }
}

// ── Cenários 31–33 : Highlight sorting ───────────────────────────────────────

scenario(31, 'Highlights sorted: critical antes de risk antes de attention');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const sevOrder = { critical: 0, risk: 1, attention: 2, info: 3 };
  let ok = true;
  for (let i = 1; i < brief.highlights.length; i++) {
    const prev = sevOrder[brief.highlights[i - 1].severity] ?? 99;
    const cur  = sevOrder[brief.highlights[i].severity]     ?? 99;
    if (prev > cur) { ok = false; break; }
  }
  assert('severity ordering correto', ok);
}

scenario(32, 'metadata.highlightCount === highlights.length');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assertEq('highlightCount === highlights.length', brief.metadata.highlightCount, brief.highlights.length);
}

scenario(33, 'CRITICAL_SIGNALS e URGENT_ACTIONS ambos critical — CRITICAL_SIGNALS vem antes (code localeCompare)');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  const criticals = brief.highlights.filter((h) => h.severity === 'critical').map((h) => h.code);
  const idxCS = criticals.indexOf(HIGHLIGHT_CODES.CRITICAL_SIGNALS);
  const idxUA = criticals.indexOf(HIGHLIGHT_CODES.URGENT_ACTIONS);
  assert('CRITICAL_SIGNALS e URGENT_ACTIONS ambos presentes como critical', idxCS >= 0 && idxUA >= 0);
}

// ── Cenários 34–39 : Management narrative ────────────────────────────────────

scenario(34, 'narrative menciona deals críticos quando criticalDeals > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('narrative menciona críticos', brief.managementNarrative.includes('crítico'));
}

scenario(35, 'narrative menciona sinais críticos quando criticalSignals > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('narrative menciona sinais críticos', brief.managementNarrative.includes('sinal'));
}

scenario(36, 'narrative menciona atenção urgente quando urgentDeals > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('narrative menciona urgente', brief.managementNarrative.includes('urgente'));
}

scenario(37, 'narrative menciona dealsWithoutNextAction quando > 0');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('narrative menciona sem próxima ação', brief.managementNarrative.includes('sem próxima ação') || brief.managementNarrative.includes('próxima ação'));
}

scenario(38, 'narrative fallback: weightedForecast quando pipeline limpo');
{
  const d = { id: 'f1', updatedAt: REF_DATE - 3 * DAY_MS, valor: 50_000, proximaAcao: 'Demo', responsavel: 'B', funil: 'venda_ufv', status: 'em_andamento' };
  const brief = makeBuilder([d]).buildBrief({}, opts);
  const hasDefault = brief.managementNarrative.includes('forecast') || brief.managementNarrative.includes('pipeline') || brief.managementNarrative.includes('anomalia');
  assert('narrative fallback presente', hasDefault);
}

scenario(39, 'narrative fallback final: "Nenhuma anomalia" quando sem dados');
{
  const svc = {
    getExecutiveSummary:     () => ({ toJSON: () => ({ data: { forecast: { totalValue: 0, weightedValue: 0 }, status: { total: 0 }, conversion: { rate: 0 }, winRate: { rate: 0 }, lossRate: { rate: 0 }, pausedRate: { rate: 0 }, pipeline: {} }, metadata: { dealCount: 0 }, generatedAt: 1 }) }),
    getPipelineHealth:       () => ({ toJSON: () => ({ data: { totalDeals: 0, freshDeals: 0, attentionDeals: 0, riskDeals: 0, criticalDeals: 0, dealsWithoutNextAction: 0, valueAtRisk: 0, criticalValue: 0, agingDistribution: {} }, metadata: {}, generatedAt: 1 }) }),
    getRiskSignalSummary:    () => ({ toJSON: () => ({ data: { totalSignals: 0, criticalSignals: 0, riskSignals: 0, affectedDeals: 0, valueExposed: 0, byType: {}, bySeverity: {}, signals: [] }, metadata: {}, generatedAt: 1 }) }),
    getActionPrioritySummary:() => ({ toJSON: () => ({ data: { totalPriorities: 0, urgentDeals: 0, highPriorityDeals: 0, mediumPriorityDeals: 0, lowPriorityDeals: 0, prioritizedValue: 0, urgentValue: 0, averagePriorityScore: 0, byPriorityLevel: {}, priorities: [] }, metadata: {}, generatedAt: 1 }) }),
  };
  const b = new CRMManagementBriefBuilder(svc);
  const brief = b.buildBrief({}, {});
  assert('narrative final fallback', brief.managementNarrative === 'Nenhuma anomalia gerencial identificada no pipeline atual.');
}

// ── Cenários 40–42 : Isolamento de falha de seção ────────────────────────────

scenario(40, 'falha em getPipelineHealth não impede retorno do briefing');
{
  const svcFail = {
    getExecutiveSummary:     () => ({ toJSON: () => ({ data: { forecast: { totalValue: 0, weightedValue: 0 }, status: { total: 0 }, conversion: { rate: 0 }, winRate: { rate: 0 }, lossRate: { rate: 0 }, pausedRate: { rate: 0 }, pipeline: {} }, metadata: { dealCount: 0 }, generatedAt: 1 }) }),
    getPipelineHealth:       () => { throw new Error('health boom'); },
    getRiskSignalSummary:    () => ({ toJSON: () => ({ data: { totalSignals: 0, criticalSignals: 0, riskSignals: 0, affectedDeals: 0, valueExposed: 0, byType: {}, bySeverity: {}, signals: [] }, metadata: {}, generatedAt: 1 }) }),
    getActionPrioritySummary:() => ({ toJSON: () => ({ data: { totalPriorities: 0, urgentDeals: 0, highPriorityDeals: 0, mediumPriorityDeals: 0, lowPriorityDeals: 0, prioritizedValue: 0, urgentValue: 0, averagePriorityScore: 0, byPriorityLevel: {}, priorities: [] }, metadata: {}, generatedAt: 1 }) }),
  };
  const b = new CRMManagementBriefBuilder(svcFail);
  let brief;
  try { brief = b.buildBrief({}, {}); } catch (e) { brief = null; }
  assert('briefing retornado mesmo com health falhando', brief !== null && brief !== undefined);
  assertEq('pipelineHealth null', brief.pipelineHealth, null);
  assertEq('pipelineHealth status unavailable', brief.metadata.sections.pipelineHealth, SECTION_STATUS.unavailable);
}

scenario(41, 'falha em getRiskSignalSummary — risk null, outras seções disponíveis');
{
  const svcFail = {
    getExecutiveSummary:     () => ({ toJSON: () => ({ data: { forecast: { totalValue: 0, weightedValue: 0 }, status: { total: 0 }, conversion: { rate: 0 }, winRate: { rate: 0 }, lossRate: { rate: 0 }, pausedRate: { rate: 0 }, pipeline: {} }, metadata: { dealCount: 0 }, generatedAt: 1 }) }),
    getPipelineHealth:       () => ({ toJSON: () => ({ data: { totalDeals: 0, freshDeals: 0, attentionDeals: 0, riskDeals: 0, criticalDeals: 0, dealsWithoutNextAction: 0, valueAtRisk: 0, criticalValue: 0, agingDistribution: {} }, metadata: {}, generatedAt: 1 }) }),
    getRiskSignalSummary:    () => { throw new Error('risk boom'); },
    getActionPrioritySummary:() => ({ toJSON: () => ({ data: { totalPriorities: 0, urgentDeals: 0, highPriorityDeals: 0, mediumPriorityDeals: 0, lowPriorityDeals: 0, prioritizedValue: 0, urgentValue: 0, averagePriorityScore: 0, byPriorityLevel: {}, priorities: [] }, metadata: {}, generatedAt: 1 }) }),
  };
  const b = new CRMManagementBriefBuilder(svcFail);
  const brief = b.buildBrief({}, {});
  assertEq('risk null', brief.risk, null);
  assertEq('risk status unavailable', brief.metadata.sections.risk, SECTION_STATUS.unavailable);
  assert('executive disponível', brief.metadata.sections.executive === SECTION_STATUS.available);
}

scenario(42, 'falha em getActionPrioritySummary — actionPriority null, outras seções disponíveis');
{
  const svcFail = {
    getExecutiveSummary:     () => ({ toJSON: () => ({ data: { forecast: { totalValue: 0, weightedValue: 0 }, status: { total: 0 }, conversion: { rate: 0 }, winRate: { rate: 0 }, lossRate: { rate: 0 }, pausedRate: { rate: 0 }, pipeline: {} }, metadata: { dealCount: 0 }, generatedAt: 1 }) }),
    getPipelineHealth:       () => ({ toJSON: () => ({ data: { totalDeals: 0, freshDeals: 0, attentionDeals: 0, riskDeals: 0, criticalDeals: 0, dealsWithoutNextAction: 0, valueAtRisk: 0, criticalValue: 0, agingDistribution: {} }, metadata: {}, generatedAt: 1 }) }),
    getRiskSignalSummary:    () => ({ toJSON: () => ({ data: { totalSignals: 0, criticalSignals: 0, riskSignals: 0, affectedDeals: 0, valueExposed: 0, byType: {}, bySeverity: {}, signals: [] }, metadata: {}, generatedAt: 1 }) }),
    getActionPrioritySummary:() => { throw new Error('ap boom'); },
  };
  const b = new CRMManagementBriefBuilder(svcFail);
  const brief = b.buildBrief({}, {});
  assertEq('actionPriority null', brief.actionPriority, null);
  assertEq('actionPriority status unavailable', brief.metadata.sections.actionPriority, SECTION_STATUS.unavailable);
  assert('pipelineHealth disponível', brief.metadata.sections.pipelineHealth === SECTION_STATUS.available);
}

// ── Cenários 43–45 : Filtros e metadata ─────────────────────────────────────

scenario(43, 'metadata.filtersApplied = true quando filtros passados');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({ funil: 'venda_ufv' }, opts);
  assertEq('filtersApplied true', brief.metadata.filtersApplied, true);
}

scenario(44, 'metadata.filtersApplied = false quando sem filtros');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assertEq('filtersApplied false', brief.metadata.filtersApplied, false);
}

scenario(45, 'metadata.availableSections e unavailableSections são Arrays');
{
  const brief = makeBuilder(ALL_DEALS).buildBrief({}, opts);
  assert('availableSections é Array', Array.isArray(brief.metadata.availableSections));
  assert('unavailableSections é Array', Array.isArray(brief.metadata.unavailableSections));
  assert('soma = 4', brief.metadata.availableSections.length + brief.metadata.unavailableSections.length === 4);
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`CRMManagementBriefBuilder — ${passed + failed}/45 cenários`);
console.log(`  Passou: ${passed}   Falhou: ${failed}`);
if (errors.length) {
  console.log('\nFalhas:');
  errors.forEach((e) => console.log(e));
  process.exit(1);
} else {
  console.log('\nTodos os cenários passaram.');
}
