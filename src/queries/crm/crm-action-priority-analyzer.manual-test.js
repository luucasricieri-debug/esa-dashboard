/**
 * ESA OS — Queries / CRM
 * Suite de testes — CRMActionPriorityAnalyzer
 * 41 cenários
 *
 * Execução: node src/queries/crm/crm-action-priority-analyzer.manual-test.js
 *
 * Valida: constantes, scoring, níveis, thresholds, dupla contribuição, bônus de valor,
 * signalTypes (sem sinais agregados), reasons, ordenação determinística, resumo,
 * getUrgentActionPriorities, filtros, referenceDate, resultado vazio, ausência de NaN,
 * integração CRMQueryService e delegações ESAApplication.
 *
 * Usa mock de readModel (objeto com getDeals()) para controle total de dados.
 * Não usa Jest. ES Modules nativos.
 */

import {
  CRMActionPriorityAnalyzer,
  PRIORITY_LEVELS,
  SCORE_WEIGHTS,
  VALUE_THRESHOLDS,
  PRIORITY_SCORE_THRESHOLDS,
} from './crm-action-priority-analyzer.js';
import { CRMQueryService }  from './crm-query-service.js';
import { CRMReadModel }     from '../../read-models/crm/crm-read-model.js';
import { CRMMetrics }       from '../../read-models/crm/crm-metrics.js';
import { ESA }              from '../../core/app.js';

// ── Runner ────────────────────────────────────────────────────────────────────

let total  = 0;
let failed = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function section(n, title) {
  console.log(`\n[${n}/41] ${title}`);
}

// ── Constantes de tempo ───────────────────────────────────────────────────────

const DAY_MS   = 86_400_000;
const REF_DATE = 1_000_000_000_000;
const OPT      = { referenceDate: REF_DATE };

function mockRM(deals) {
  return {
    getDeals: (filters = {}) => {
      let items = deals.slice();
      if (filters.funil)       items = items.filter((d) => d.funil       === filters.funil);
      if (filters.responsavel) items = items.filter((d) => d.responsavel === filters.responsavel);
      if (filters.status)      items = items.filter((d) => d.status      === filters.status);
      return items;
    },
  };
}

// ── Deals auxiliares ──────────────────────────────────────────────────────────

// fresh (5d): score=0, level=low
const D_FRESH = { id: 'fresh-1', updatedAt: REF_DATE - 5 * DAY_MS, valor: 10000, responsavel: 'Ana', funil: 'test' };

// attention (12d): score=15, level=low (15 < 25)
const D_ATTN = { id: 'attn-1', updatedAt: REF_DATE - 12 * DAY_MS, valor: 10000, responsavel: 'Ana', funil: 'test' };

// risk + action + low value: STALE_DEAL(+15), no NO_NEXT_ACTION → score=50, high
const D_RISK_ACT = { id: 'risk-act', updatedAt: REF_DATE - 20 * DAY_MS, valor: 10000, proximaAcao: 'Call', responsavel: 'Ana', funil: 'test' };

// risk + no action + low value: STALE_DEAL(+15) + NO_NEXT_ACTION(+20) → score=70, high
const D_RISK_NOACT = { id: 'risk-noact', updatedAt: REF_DATE - 20 * DAY_MS, valor: 10000, responsavel: 'Ana', funil: 'test' };

// critical + no action + low value: CRITICAL_NO_NEXT_ACTION(+35) + NO_NEXT_ACTION(+20) → 115→100, urgent
const D_CRIT_NOACT = { id: 'crit-noact', updatedAt: REF_DATE - 40 * DAY_MS, valor: 10000, responsavel: 'Ana', funil: 'test' };

// critical + action + low value: STALE_DEAL(+15), no NO_NEXT_ACTION → score=75, urgent
const D_CRIT_ACT = { id: 'crit-act', updatedAt: REF_DATE - 40 * DAY_MS, valor: 10000, proximaAcao: 'Call', responsavel: 'Ana', funil: 'test' };

// risk + action + valor=500k: HIGH_VALUE_STALE(+25) + value.high(+15) → score=75, urgent
const D_RISK_500K = { id: 'risk-500k', updatedAt: REF_DATE - 20 * DAY_MS, valor: 500000, proximaAcao: 'Call', responsavel: 'Ana', funil: 'test' };

// risk + action + valor=999999: still high tier(+15) → score=75, urgent
const D_RISK_999K = { id: 'risk-999k', updatedAt: REF_DATE - 20 * DAY_MS, valor: 999999, proximaAcao: 'Call', responsavel: 'Ana', funil: 'test' };

// risk + action + valor=1M: veryHigh tier(+25) → score=85, urgent
const D_RISK_1M = { id: 'risk-1m', updatedAt: REF_DATE - 20 * DAY_MS, valor: 1_000_000, proximaAcao: 'Call', responsavel: 'Ana', funil: 'test' };

// risk + action + valor=5M: still veryHigh(+25) — no accumulation → score=85, urgent
const D_RISK_5M = { id: 'risk-5m', updatedAt: REF_DATE - 20 * DAY_MS, valor: 5_000_000, proximaAcao: 'Call', responsavel: 'Ana', funil: 'test' };

// attention + no action: no NO_NEXT_ACTION (not risk/critical) → score=15, low
const D_ATTN_NOACT = { id: 'attn-noact', updatedAt: REF_DATE - 12 * DAY_MS, valor: 10000, responsavel: 'Ana', funil: 'test' };

// summary deals
const D_SUM_URGENT = { id: 'sum-urgent', updatedAt: REF_DATE - 40 * DAY_MS, valor: 50000, responsavel: 'X', funil: 'test2' };
const D_SUM_HIGH   = { id: 'sum-high',   updatedAt: REF_DATE - 20 * DAY_MS, valor: 10000, responsavel: 'X', funil: 'test2' };
const D_SUM_MED    = { id: 'sum-med',    updatedAt: REF_DATE - 12 * DAY_MS, valor: 500000, responsavel: 'X', funil: 'test2' };
const D_SUM_LOW    = { id: 'sum-low',    updatedAt: REF_DATE -  5 * DAY_MS, valor: 30000, responsavel: 'X', funil: 'test2' };

// sorting: attention(12d) deals — score=15 each, different values/aging/id
const D_SORT_HV = { id: 'sort-hv', updatedAt: REF_DATE - 12 * DAY_MS, valor: 200000, responsavel: 'Ana', funil: 'test' };
const D_SORT_LV = { id: 'sort-lv', updatedAt: REF_DATE - 12 * DAY_MS, valor: 100000, responsavel: 'Ana', funil: 'test' };
const D_SORT_8D = { id: 'sort-8d', updatedAt: REF_DATE -  8 * DAY_MS, valor: 50000,  responsavel: 'Ana', funil: 'test' };
const D_SORT_12D = { id: 'sort-12d', updatedAt: REF_DATE - 12 * DAY_MS, valor: 50000, responsavel: 'Ana', funil: 'test' };
const D_SORT_Z  = { id: 'z-deal',   updatedAt: REF_DATE -  5 * DAY_MS, valor: 20000, responsavel: 'Ana', funil: 'test' };
const D_SORT_A  = { id: 'a-deal',   updatedAt: REF_DATE -  5 * DAY_MS, valor: 20000, responsavel: 'Ana', funil: 'test' };

// aggregate signal trigger: 3+ deals same responsible risk/critical → RESPONSIBLE_RISK_CONCENTRATION
const D_AGGR1 = { id: 'aggr-1', updatedAt: REF_DATE - 40 * DAY_MS, valor: 10000, responsavel: 'Jose', funil: 'F1' };
const D_AGGR2 = { id: 'aggr-2', updatedAt: REF_DATE - 40 * DAY_MS, valor: 10000, responsavel: 'Jose', funil: 'F1' };
const D_AGGR3 = { id: 'aggr-3', updatedAt: REF_DATE - 40 * DAY_MS, valor: 10000, responsavel: 'Jose', funil: 'F1' };

// ── 1. PRIORITY_LEVELS exportado com todos os 4 níveis ───────────────────────

section(1, 'PRIORITY_LEVELS exportado com todos os 4 níveis');

assert(PRIORITY_LEVELS.low    === 'low',    '1.1 PRIORITY_LEVELS.low');
assert(PRIORITY_LEVELS.medium === 'medium', '1.2 PRIORITY_LEVELS.medium');
assert(PRIORITY_LEVELS.high   === 'high',   '1.3 PRIORITY_LEVELS.high');
assert(PRIORITY_LEVELS.urgent === 'urgent', '1.4 PRIORITY_LEVELS.urgent');

// ── 2. SCORE_WEIGHTS exportado com todos os pesos ────────────────────────────

section(2, 'SCORE_WEIGHTS exportado com pesos de aging, signal, value e noNextAction');

assert(SCORE_WEIGHTS.aging.fresh      === 0,  '2.1 aging.fresh = 0');
assert(SCORE_WEIGHTS.aging.attention  === 15, '2.2 aging.attention = 15');
assert(SCORE_WEIGHTS.aging.risk       === 35, '2.3 aging.risk = 35');
assert(SCORE_WEIGHTS.aging.critical   === 60, '2.4 aging.critical = 60');
assert(SCORE_WEIGHTS.signal.CRITICAL_NO_NEXT_ACTION === 35, '2.5 signal.CRITICAL_NO_NEXT_ACTION = 35');
assert(SCORE_WEIGHTS.signal.HIGH_VALUE_STALE        === 25, '2.6 signal.HIGH_VALUE_STALE = 25');
assert(SCORE_WEIGHTS.signal.STALE_DEAL              === 15, '2.7 signal.STALE_DEAL = 15');
assert(SCORE_WEIGHTS.value.high     === 15, '2.8 value.high = 15');
assert(SCORE_WEIGHTS.value.veryHigh === 25, '2.9 value.veryHigh = 25');
assert(SCORE_WEIGHTS.noNextAction   === 20, '2.10 noNextAction = 20');

// ── 3. VALUE_THRESHOLDS exportado ────────────────────────────────────────────

section(3, 'VALUE_THRESHOLDS exportado com limiares corretos');

assert(VALUE_THRESHOLDS.high     === 500_000,   '3.1 high = 500000');
assert(VALUE_THRESHOLDS.veryHigh === 1_000_000, '3.2 veryHigh = 1000000');

// ── 4. PRIORITY_SCORE_THRESHOLDS exportado ───────────────────────────────────

section(4, 'PRIORITY_SCORE_THRESHOLDS exportado com limiares de nível');

assert(PRIORITY_SCORE_THRESHOLDS.medium === 25, '4.1 medium = 25');
assert(PRIORITY_SCORE_THRESHOLDS.high   === 50, '4.2 high = 50');
assert(PRIORITY_SCORE_THRESHOLDS.urgent === 75, '4.3 urgent = 75');

// ── 5. constructor e _requireReadModel ───────────────────────────────────────

section(5, 'constructor aceita readModel; getActionPriorities lança sem readModel válido');

let threw5 = false;
try { new CRMActionPriorityAnalyzer(null).getActionPriorities(); } catch (e) { threw5 = true; }
assert(threw5, '5.1 lança TypeError sem readModel');

let threw5b = false;
try { new CRMActionPriorityAnalyzer({}).getActionPriorities(); } catch (e) { threw5b = true; }
assert(threw5b, '5.2 lança TypeError com readModel sem getDeals()');

const a5 = new CRMActionPriorityAnalyzer(mockRM([D_FRESH]));
assert(Array.isArray(a5.getActionPriorities({}, OPT)), '5.3 retorna array com readModel válido');

// ── 6. Fresh deal → score=0, priorityLevel=low ───────────────────────────────

section(6, 'fresh deal (5d): score=0, agingLevel=fresh, priorityLevel=low');

const a6 = new CRMActionPriorityAnalyzer(mockRM([D_FRESH]));
const [p6] = a6.getActionPriorities({}, OPT);

assert(p6.agingLevel   === 'fresh', '6.1 agingLevel = fresh');
assert(p6.priorityScore === 0,      '6.2 priorityScore = 0');
assert(p6.priorityLevel === 'low',  '6.3 priorityLevel = low');

// ── 7. Attention deal → score=15, priorityLevel=low ──────────────────────────

section(7, 'attention deal (12d): score=15, agingLevel=attention, priorityLevel=low');

const a7 = new CRMActionPriorityAnalyzer(mockRM([D_ATTN]));
const [p7] = a7.getActionPriorities({}, OPT);

assert(p7.agingLevel    === 'attention', '7.1 agingLevel = attention');
assert(p7.priorityScore === 15,          '7.2 priorityScore = 15 (base aging)');
assert(p7.priorityLevel === 'low',       '7.3 priorityLevel = low (15 < 25)');

// ── 8. Risk + action + low value → STALE_DEAL, score=50, high ────────────────

section(8, 'risk (20d) + action + valor<500k → STALE_DEAL, score=50, priorityLevel=high');

const a8 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_ACT]));
const [p8] = a8.getActionPriorities({}, OPT);

assert(p8.agingLevel    === 'risk', '8.1 agingLevel = risk');
assert(p8.priorityScore === 50,     '8.2 score = 35(risk) + 15(STALE_DEAL)');
assert(p8.priorityLevel === 'high', '8.3 priorityLevel = high');
assert(p8.signalTypes.includes('STALE_DEAL'), '8.4 signalTypes inclui STALE_DEAL');

// ── 9. Risk + no action + low value → STALE_DEAL + NO_NEXT_ACTION, score=70 ─

section(9, 'risk (20d) + sem ação + valor<500k → score=70 (STALE_DEAL + NO_NEXT_ACTION), high');

const a9 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_NOACT]));
const [p9] = a9.getActionPriorities({}, OPT);

assert(p9.priorityScore === 70,     '9.1 score = 35 + 15(STALE_DEAL) + 20(NO_NEXT_ACTION)');
assert(p9.priorityLevel === 'high', '9.2 priorityLevel = high (70 < 75)');
assert(p9.metadata.hasNextAction === false, '9.3 metadata.hasNextAction = false');

// ── 10. Critical + no action + low value → cap 100, urgent ──────────────────

section(10, 'critical (40d) + sem ação + valor<500k → score cap 100, urgent');

const a10 = new CRMActionPriorityAnalyzer(mockRM([D_CRIT_NOACT]));
const [p10] = a10.getActionPriorities({}, OPT);

assert(p10.agingLevel    === 'critical', '10.1 agingLevel = critical');
assert(p10.priorityScore === 100,        '10.2 score capped at 100 (60+35+20=115)');
assert(p10.priorityLevel === 'urgent',   '10.3 priorityLevel = urgent');
assert(p10.signalTypes.includes('CRITICAL_NO_NEXT_ACTION'), '10.4 signalTypes inclui CRITICAL_NO_NEXT_ACTION');

// ── 11. Critical + action + low value → STALE_DEAL, score=75, urgent ─────────

section(11, 'critical (40d) + com ação + valor<500k → STALE_DEAL, score=75, urgent');

const a11 = new CRMActionPriorityAnalyzer(mockRM([D_CRIT_ACT]));
const [p11] = a11.getActionPriorities({}, OPT);

assert(p11.priorityScore === 75,      '11.1 score = 60(critical) + 15(STALE_DEAL)');
assert(p11.priorityLevel === 'urgent','11.2 priorityLevel = urgent (75 = limiar)');
assert(p11.signalTypes.includes('STALE_DEAL'), '11.3 STALE_DEAL em signalTypes');

// ── 12. HIGH_VALUE_STALE: risk + action + valor=500k → score=75, urgent ──────

section(12, 'risk (20d) + action + valor=500k → HIGH_VALUE_STALE(+25) + value.high(+15) = 75, urgent');

const a12 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_500K]));
const [p12] = a12.getActionPriorities({}, OPT);

assert(p12.priorityScore === 75,      '12.1 score = 35+25+15 = 75');
assert(p12.priorityLevel === 'urgent','12.2 priorityLevel = urgent');
assert(p12.signalTypes.includes('HIGH_VALUE_STALE'), '12.3 signalTypes inclui HIGH_VALUE_STALE');

// ── 13. Valor 999999 → tier high (+15), não veryHigh ─────────────────────────

section(13, 'valor=999999 → bônus tier high(+15), não veryHigh(+25)');

const a13 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_999K]));
const [p13] = a13.getActionPriorities({}, OPT);

assert(p13.priorityScore === 75, '13.1 score = 35+25(HIGH_VALUE_STALE)+15(high tier) = 75');
const reasons13 = p13.reasons.map((r) => r.code);
assert(reasons13.includes('HIGH_VALUE'), '13.2 reason HIGH_VALUE presente (não VERY_HIGH_VALUE)');

// ── 14. Valor=1M → tier veryHigh (+25) ───────────────────────────────────────

section(14, 'valor=1.000.000 → bônus tier veryHigh(+25)');

const a14 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_1M]));
const [p14] = a14.getActionPriorities({}, OPT);

assert(p14.priorityScore === 85, '14.1 score = 35+25(HIGH_VALUE_STALE)+25(veryHigh) = 85');
const reasons14 = p14.reasons.map((r) => r.code);
assert(reasons14.includes('VERY_HIGH_VALUE'), '14.2 reason VERY_HIGH_VALUE presente');

// ── 15. Valor=5M → mesmo bônus que 1M, sem acumulação ────────────────────────

section(15, 'valor=5M usa mesmo bônus veryHigh(+25) que 1M — sem acumulação');

const a15 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_5M]));
const [p15] = a15.getActionPriorities({}, OPT);

assert(p15.priorityScore === 85, '15.1 score = 35+25(HIGH_VALUE_STALE)+25(veryHigh) = 85 (não 95)');

// ── 16. Valor < 500k → sem bônus de valor ────────────────────────────────────

section(16, 'valor < 500k → sem bônus de valor no score');

const a16 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_ACT]));
const [p16] = a16.getActionPriorities({}, OPT);

const reasonCodes16 = p16.reasons.map((r) => r.code);
assert(!reasonCodes16.includes('HIGH_VALUE'),      '16.1 sem reason HIGH_VALUE para valor < 500k');
assert(!reasonCodes16.includes('VERY_HIGH_VALUE'), '16.2 sem reason VERY_HIGH_VALUE para valor < 500k');

// ── 17. Attention + sem ação → sem bônus NO_NEXT_ACTION ──────────────────────

section(17, 'attention deal sem ação → sem bônus NO_NEXT_ACTION (só risk/critical qualificam)');

const a17 = new CRMActionPriorityAnalyzer(mockRM([D_ATTN_NOACT]));
const [p17] = a17.getActionPriorities({}, OPT);

assert(p17.priorityScore === 15, '17.1 score = 15 (só base aging, sem NO_NEXT_ACTION)');
const reasonCodes17 = p17.reasons.map((r) => r.code);
assert(!reasonCodes17.includes('NO_NEXT_ACTION'), '17.2 sem reason NO_NEXT_ACTION para attention');

// ── 18. Dupla contribuição: CRITICAL_NO_NEXT_ACTION + NO_NEXT_ACTION ─────────

section(18, 'dupla contribuição: CRITICAL_NO_NEXT_ACTION(+35) e NO_NEXT_ACTION(+20) coexistem');

const a18 = new CRMActionPriorityAnalyzer(mockRM([D_CRIT_NOACT]));
const [p18] = a18.getActionPriorities({}, OPT);

const codes18 = p18.reasons.map((r) => r.code);
assert(codes18.includes('CRITICAL_AGING'),           '18.1 reason CRITICAL_AGING presente');
assert(codes18.includes('CRITICAL_NO_NEXT_ACTION'),  '18.2 reason CRITICAL_NO_NEXT_ACTION presente');
assert(codes18.includes('NO_NEXT_ACTION'),           '18.3 reason NO_NEXT_ACTION presente');
assert(p18.priorityScore === 100,                    '18.4 60+35+20=115 → cap 100 (ambos bônus acumulados)');

// ── 19. _scoreToPriorityLevel — fronteiras de cada nível ─────────────────────

section(19, '_scoreToPriorityLevel nos 7 pontos de fronteira');

const aRef = new CRMActionPriorityAnalyzer(mockRM([]));
assert(aRef._scoreToPriorityLevel(24)  === 'low',    '19.1 score=24  → low');
assert(aRef._scoreToPriorityLevel(25)  === 'medium', '19.2 score=25  → medium');
assert(aRef._scoreToPriorityLevel(49)  === 'medium', '19.3 score=49  → medium');
assert(aRef._scoreToPriorityLevel(50)  === 'high',   '19.4 score=50  → high');
assert(aRef._scoreToPriorityLevel(74)  === 'high',   '19.5 score=74  → high');
assert(aRef._scoreToPriorityLevel(75)  === 'urgent', '19.6 score=75  → urgent');
assert(aRef._scoreToPriorityLevel(100) === 'urgent', '19.7 score=100 → urgent');

// ── 20. Score nunca ultrapassa 100 ───────────────────────────────────────────

section(20, 'score máximo é 100 mesmo que soma bruta exceda 100');

const a20 = new CRMActionPriorityAnalyzer(mockRM([D_CRIT_NOACT]));
const [p20] = a20.getActionPriorities({}, OPT);
assert(p20.priorityScore <= 100, '20.1 priorityScore ≤ 100');

// ── 21. reasons: shape { code, label, weight } ───────────────────────────────

section(21, 'reasons tem shape { code, label, weight } em todos os itens');

const a21 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_ACT]));
const [p21] = a21.getActionPriorities({}, OPT);

assert(p21.reasons.length > 0, '21.1 reasons não vazio para deal com pontos');
const r21 = p21.reasons[0];
assert(typeof r21.code   === 'string', '21.2 reasons[0].code é string');
assert(typeof r21.label  === 'string', '21.3 reasons[0].label é string');
assert(typeof r21.weight === 'number', '21.4 reasons[0].weight é number');
assert(r21.label.length > 0,          '21.5 reasons[0].label não vazio');

// ── 22. signalTypes exclui sinais agregados ───────────────────────────────────

section(22, 'signalTypes exclui RESPONSIBLE_RISK_CONCENTRATION e PIPELINE_RISK_CONCENTRATION');

// 3 deals do mesmo responsável risk/critical → gera RESPONSIBLE_RISK_CONCENTRATION (agregado)
const a22 = new CRMActionPriorityAnalyzer(mockRM([D_AGGR1, D_AGGR2, D_AGGR3]));
const priorities22 = a22.getActionPriorities({}, OPT);

for (const p of priorities22) {
  assert(!p.signalTypes.includes('RESPONSIBLE_RISK_CONCENTRATION'),
    `22.1 deal ${p.dealId}: signalTypes não inclui RESPONSIBLE_RISK_CONCENTRATION`);
  assert(!p.signalTypes.includes('PIPELINE_RISK_CONCENTRATION'),
    `22.2 deal ${p.dealId}: signalTypes não inclui PIPELINE_RISK_CONCENTRATION`);
}

// ── 23. Ordenação: priorityScore DESC ────────────────────────────────────────

section(23, 'ordenação: priorityScore DESC');

const a23 = new CRMActionPriorityAnalyzer(mockRM([D_FRESH, D_CRIT_NOACT, D_ATTN]));
const sorted23 = a23.getActionPriorities({}, OPT);

assert(sorted23[0].priorityScore >= sorted23[1].priorityScore, '23.1 first.score ≥ second.score');
assert(sorted23[1].priorityScore >= sorted23[2].priorityScore, '23.2 second.score ≥ third.score');
assert(sorted23[0].dealId === 'crit-noact',                    '23.3 first é crit-noact (score=100)');

// ── 24. Tiebreak: value DESC ──────────────────────────────────────────────────

section(24, 'tiebreak value DESC quando scores iguais');

// D_SORT_HV e D_SORT_LV têm score=15 (attention); D_SORT_HV valor=200k > 100k
const a24 = new CRMActionPriorityAnalyzer(mockRM([D_SORT_LV, D_SORT_HV]));
const sorted24 = a24.getActionPriorities({}, OPT);

assert(sorted24[0].dealId === 'sort-hv', '24.1 sort-hv (200k) vem antes de sort-lv (100k)');
assert(sorted24[1].dealId === 'sort-lv', '24.2 sort-lv é segundo');
assert(sorted24[0].value > sorted24[1].value, '24.3 value do primeiro > segundo');

// ── 25. Tiebreak: agingDays DESC ─────────────────────────────────────────────

section(25, 'tiebreak agingDays DESC quando scores e values iguais');

// D_SORT_12D (12d) e D_SORT_8D (8d): mesmo score (15), mesmo valor (50k), aging diferente
const a25 = new CRMActionPriorityAnalyzer(mockRM([D_SORT_8D, D_SORT_12D]));
const sorted25 = a25.getActionPriorities({}, OPT);

assert(sorted25[0].dealId === 'sort-12d', '25.1 sort-12d (12d) vem antes de sort-8d (8d)');
assert(sorted25[0].agingDays > sorted25[1].agingDays, '25.2 primeiro tem mais aging');

// ── 26. Tiebreak: dealId ASC (estável) ───────────────────────────────────────

section(26, 'tiebreak dealId localeCompare (estável) quando score, value e aging iguais');

// D_SORT_Z (id='z-deal') e D_SORT_A (id='a-deal'): mesmos score(0), value(20k), aging(5d)
const a26 = new CRMActionPriorityAnalyzer(mockRM([D_SORT_Z, D_SORT_A]));
const sorted26 = a26.getActionPriorities({}, OPT);

assert(sorted26[0].dealId === 'a-deal', '26.1 a-deal vem antes de z-deal (localeCompare)');
assert(sorted26[1].dealId === 'z-deal', '26.2 z-deal é segundo');

// ── 27. getActionPrioritySummary — shape completa ────────────────────────────

section(27, 'getActionPrioritySummary retorna objeto com todos os campos do contrato');

const a27 = new CRMActionPriorityAnalyzer(mockRM([D_SUM_URGENT, D_SUM_HIGH, D_SUM_MED, D_SUM_LOW]));
const s27 = a27.getActionPrioritySummary({}, OPT);

assert(typeof s27.totalPriorities     === 'number', '27.1 totalPriorities é number');
assert(typeof s27.urgentDeals         === 'number', '27.2 urgentDeals é number');
assert(typeof s27.highPriorityDeals   === 'number', '27.3 highPriorityDeals é number');
assert(typeof s27.mediumPriorityDeals === 'number', '27.4 mediumPriorityDeals é number');
assert(typeof s27.lowPriorityDeals    === 'number', '27.5 lowPriorityDeals é number');
assert(typeof s27.prioritizedValue    === 'number', '27.6 prioritizedValue é number');
assert(typeof s27.urgentValue         === 'number', '27.7 urgentValue é number');
assert(typeof s27.averagePriorityScore === 'number','27.8 averagePriorityScore é number');
assert(typeof s27.byPriorityLevel     === 'object', '27.9 byPriorityLevel é object');
assert(Array.isArray(s27.priorities),               '27.10 priorities é array');

// ── 28. Contagens do resumo ───────────────────────────────────────────────────

// D_SUM_URGENT → score=100, urgent
// D_SUM_HIGH   → score=70, high
// D_SUM_MED    → score=30, medium (attention + valor=500k: 15+15=30)
// D_SUM_LOW    → score=0, low

section(28, 'contagens do resumo: urgent=1, high=1, medium=1, low=1');

const s28 = new CRMActionPriorityAnalyzer(mockRM([D_SUM_URGENT, D_SUM_HIGH, D_SUM_MED, D_SUM_LOW]))
  .getActionPrioritySummary({}, OPT);

assert(s28.totalPriorities     === 4, '28.1 totalPriorities = 4');
assert(s28.urgentDeals         === 1, '28.2 urgentDeals = 1');
assert(s28.highPriorityDeals   === 1, '28.3 highPriorityDeals = 1');
assert(s28.mediumPriorityDeals === 1, '28.4 mediumPriorityDeals = 1');
assert(s28.lowPriorityDeals    === 1, '28.5 lowPriorityDeals = 1');

// ── 29. prioritizedValue e urgentValue ───────────────────────────────────────

section(29, 'prioritizedValue = sum(high+urgent); urgentValue = sum(urgent)');

// D_SUM_URGENT valor=50k (urgent), D_SUM_HIGH valor=10k (high)
assert(s28.prioritizedValue === 60000, '29.1 prioritizedValue = 50000(urgent) + 10000(high)');
assert(s28.urgentValue      === 50000, '29.2 urgentValue = 50000 (apenas urgent)');

// ── 30. averagePriorityScore ──────────────────────────────────────────────────

section(30, 'averagePriorityScore = media dos scores (arredondado)');

// scores: 100 (urgent) + 70 (high) + 30 (medium) + 0 (low) = 200 / 4 = 50
assert(s28.averagePriorityScore === 50, '30.1 averagePriorityScore = 50');

// ── 31. byPriorityLevel reflete contagens ────────────────────────────────────

section(31, 'byPriorityLevel reflete as contagens por nível');

assert(s28.byPriorityLevel.urgent === 1, '31.1 byPriorityLevel.urgent = 1');
assert(s28.byPriorityLevel.high   === 1, '31.2 byPriorityLevel.high = 1');
assert(s28.byPriorityLevel.medium === 1, '31.3 byPriorityLevel.medium = 1');
assert(s28.byPriorityLevel.low    === 1, '31.4 byPriorityLevel.low = 1');

// ── 32. priorities no resumo estão ordenadas ─────────────────────────────────

section(32, 'priorities no resumo estão ordenadas por score DESC');

assert(s28.priorities[0].priorityScore >= s28.priorities[1].priorityScore, '32.1 primeiro ≥ segundo');
assert(s28.priorities[1].priorityScore >= s28.priorities[2].priorityScore, '32.2 segundo ≥ terceiro');

// ── 33. getUrgentActionPriorities filtra somente urgent ──────────────────────

section(33, 'getUrgentActionPriorities retorna apenas deals com priorityLevel=urgent');

const a33 = new CRMActionPriorityAnalyzer(mockRM([D_SUM_URGENT, D_SUM_HIGH, D_SUM_MED, D_SUM_LOW]));
const urgent33 = a33.getUrgentActionPriorities({}, OPT);

assert(urgent33.length === 1, '33.1 apenas 1 urgent entre os 4 deals');
assert(urgent33[0].priorityLevel === 'urgent', '33.2 item retornado é urgent');
assert(urgent33[0].dealId === 'sum-urgent', '33.3 deal correto retornado');

// ── 34. Contrato completo do ActionPriority ───────────────────────────────────

section(34, 'ActionPriority possui todos os campos do contrato');

const a34 = new CRMActionPriorityAnalyzer(mockRM([D_RISK_ACT]));
const [p34] = a34.getActionPriorities({}, OPT);

assert(typeof p34.id            === 'string',  '34.1 id é string');
assert(typeof p34.dealId        === 'string',  '34.2 dealId é string');
assert(typeof p34.dealName      === 'string',  '34.3 dealName é string');
assert(typeof p34.company       === 'string',  '34.4 company é string');
assert(typeof p34.responsible   === 'string',  '34.5 responsible é string');
assert(typeof p34.pipeline      === 'string',  '34.6 pipeline é string');
assert(typeof p34.stage         === 'string',  '34.7 stage é string');
assert(typeof p34.status        === 'string',  '34.8 status é string');
assert(typeof p34.value         === 'number',  '34.9 value é number');
assert(typeof p34.agingDays     === 'number',  '34.10 agingDays é number');
assert(typeof p34.agingLevel    === 'string',  '34.11 agingLevel é string');
assert(typeof p34.priorityScore === 'number',  '34.12 priorityScore é number');
assert(typeof p34.priorityLevel === 'string',  '34.13 priorityLevel é string');
assert(Array.isArray(p34.reasons),             '34.14 reasons é array');
assert(Array.isArray(p34.signalTypes),         '34.15 signalTypes é array');
assert(p34.id.startsWith('priority::'),        '34.16 id tem prefixo priority::');

// ── 35. Filtros respeitados ───────────────────────────────────────────────────

section(35, 'filtro funil é respeitado; apenas deals do funil retornam');

const D_F1 = { id: 'f1', updatedAt: REF_DATE - 40 * DAY_MS, valor: 10000, funil: 'funil-A', responsavel: 'Z' };
const D_F2 = { id: 'f2', updatedAt: REF_DATE - 40 * DAY_MS, valor: 20000, funil: 'funil-B', responsavel: 'Z' };
const a35 = new CRMActionPriorityAnalyzer(mockRM([D_F1, D_F2]));
const res35 = a35.getActionPriorities({ funil: 'funil-A' }, OPT);

assert(res35.length === 1,            '35.1 apenas 1 deal no funil-A');
assert(res35[0].dealId === 'f1',      '35.2 deal retornado é f1');

// ── 36. referenceDate injection ──────────────────────────────────────────────

section(36, 'referenceDate altera aging: deal recente fica fresh com REF_DATE, crítico com Date.now()');

// Com REF_DATE, D_FRESH (5d antes) é fresh → score=0
const a36fresh = new CRMActionPriorityAnalyzer(mockRM([D_FRESH]));
const [p36f] = a36fresh.getActionPriorities({}, OPT);
assert(p36f.agingLevel === 'fresh', '36.1 fresh com referenceDate=REF_DATE');

// Sem referenceDate, D_FRESH (timestamp=REF_DATE-5d ≈ 2001) fica decades old → critical
const a36now = new CRMActionPriorityAnalyzer(mockRM([D_FRESH]));
const [p36n] = a36now.getActionPriorities({});
assert(p36n.agingLevel === 'critical', '36.2 critical sem referenceDate (data de 2001)');

// ── 37. Resultado vazio ───────────────────────────────────────────────────────

section(37, 'getActionPriorities([]) retorna array vazio; resumo com zeros');

const a37 = new CRMActionPriorityAnalyzer(mockRM([]));
const empty37 = a37.getActionPriorities({}, OPT);
const sum37   = a37.getActionPrioritySummary({}, OPT);

assert(empty37.length === 0,          '37.1 getActionPriorities retorna array vazio');
assert(sum37.totalPriorities === 0,   '37.2 totalPriorities = 0');
assert(sum37.urgentDeals     === 0,   '37.3 urgentDeals = 0');
assert(sum37.prioritizedValue === 0,  '37.4 prioritizedValue = 0');

// ── 38. Sem NaN em campos numéricos ──────────────────────────────────────────

section(38, 'ausência de NaN em campos numéricos do resumo e dos itens');

const a38 = new CRMActionPriorityAnalyzer(mockRM([D_FRESH, D_RISK_ACT, D_CRIT_NOACT]));
const s38  = a38.getActionPrioritySummary({}, OPT);

assert(!isNaN(s38.prioritizedValue),    '38.1 prioritizedValue não é NaN');
assert(!isNaN(s38.urgentValue),         '38.2 urgentValue não é NaN');
assert(!isNaN(s38.averagePriorityScore),'38.3 averagePriorityScore não é NaN');
for (const p of s38.priorities) {
  assert(!isNaN(p.priorityScore), `38.4 priorityScore de ${p.dealId} não é NaN`);
  assert(!isNaN(p.value),         `38.5 value de ${p.dealId} não é NaN`);
}

// ── 39. agingDays = -1 para deal sem timestamp ────────────────────────────────

section(39, 'deal sem updatedAt/createdAt: agingDays = -1, agingLevel = unknown');

const D_NOTIME = { id: 'nt', valor: 5000, responsavel: 'Z', funil: 'X' };
const a39 = new CRMActionPriorityAnalyzer(mockRM([D_NOTIME]));
const [p39] = a39.getActionPriorities({}, OPT);

assert(p39.agingDays  === -1,       '39.1 agingDays = -1');
assert(p39.agingLevel === 'unknown','39.2 agingLevel = unknown');

// ── 40. Integração CRMQueryService ───────────────────────────────────────────

section(40, 'integração CRMQueryService: getActionPrioritySummary retorna CRMQueryResult');

const rm40  = new CRMReadModel();
const met40 = new CRMMetrics(rm40);
const svc40 = new CRMQueryService(rm40, met40);
rm40.hydrate({
  'int-1': { funil: 'venda_ufv', etapa: 'Proposta', status: 'Em andamento', valor: 100000, responsavel: 'Lucas', createdAt: 1 },
  'int-2': { funil: 'venda_ufv', etapa: 'Negociação', status: 'Vendido', valor: 200000, responsavel: 'Lucas', createdAt: 3 },
});

const qr40 = svc40.getActionPrioritySummary();
assert(qr40 !== null,                        '40.1 getActionPrioritySummary retorna objeto');
assert(typeof qr40.data === 'object',        '40.2 data é object');
assert(typeof qr40.generatedAt === 'number', '40.3 generatedAt é number');
assert(typeof qr40.metadata === 'object',    '40.4 metadata é object');
assert(typeof qr40.data.totalPriorities === 'number', '40.5 data.totalPriorities é number');

// ── 41. Delegações ESAApplication ────────────────────────────────────────────

section(41, 'ESAApplication delega getCRMActionPriorities, getUrgentActionPriorities e getActionPrioritySummary');

assert(typeof ESA.getCRMActionPriorities         === 'function', '41.1 ESA.getCRMActionPriorities é function');
assert(typeof ESA.getCRMUrgentActionPriorities   === 'function', '41.2 ESA.getCRMUrgentActionPriorities é function');
assert(typeof ESA.getCRMActionPrioritySummary    === 'function', '41.3 ESA.getCRMActionPrioritySummary é function');

const ap41 = ESA.getCRMActionPrioritySummary();
assert(typeof ap41.data === 'object', '41.4 retorno tem .data de objeto');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 41 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
