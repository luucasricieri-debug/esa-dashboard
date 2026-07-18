/**
 * ESA OS — Queries / CRM
 * Suite de testes — CRMRiskSignalAnalyzer
 * 33 cenários
 *
 * Execução: node src/queries/crm/crm-risk-signal-analyzer.manual-test.js
 *
 * Valida: constantes, tipos de sinal, deduplicação, coexistência intencional,
 * thresholds, priorização, valueExposed sem dupla contagem, filtros,
 * referenceDate, ausência de NaN, resultado vazio, integração CRMQueryService
 * e delegações ESAApplication.
 *
 * Usa mock de readModel (objeto com getDeals()) para controle total de dados.
 * Não usa Jest. ES Modules nativos.
 */

import {
  CRMRiskSignalAnalyzer,
  SIGNAL_TYPES,
  SEVERITY_LEVELS,
  HIGH_VALUE_THRESHOLD,
  RISK_THRESHOLDS,
} from './crm-risk-signal-analyzer.js';
import { CRMQueryService }                        from './crm-query-service.js';
import { CRMQueryResult }                         from './crm-query-result.js';
import { CRMReadModel }                           from '../../read-models/crm/crm-read-model.js';
import { CRMMetrics }                             from '../../read-models/crm/crm-metrics.js';
import { ESA }                                    from '../../core/app.js';

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
  console.log(`\n[${n}/33] ${title}`);
}

// ── Constantes de tempo ───────────────────────────────────────────────────────

const DAY_MS   = 86_400_000;
const REF_DATE = 1_000_000_000_000;
const OPT      = { referenceDate: REF_DATE };

function mockRM(deals) {
  return {
    getDeals: (filters = {}) => {
      let items = deals.slice();
      if (filters.funil)       items = items.filter((d) => d.funil === filters.funil);
      if (filters.responsavel) items = items.filter((d) => d.responsavel === filters.responsavel);
      if (filters.status)      items = items.filter((d) => d.status === filters.status);
      return items;
    },
  };
}

// ── 1. SIGNAL_TYPES exportado e centralizado ──────────────────────────────────

section(1, 'SIGNAL_TYPES exportado com todos os 5 tipos');

assert(SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION        === 'CRITICAL_NO_NEXT_ACTION',        '1.1 CRITICAL_NO_NEXT_ACTION');
assert(SIGNAL_TYPES.HIGH_VALUE_STALE               === 'HIGH_VALUE_STALE',               '1.2 HIGH_VALUE_STALE');
assert(SIGNAL_TYPES.STALE_DEAL                     === 'STALE_DEAL',                     '1.3 STALE_DEAL');
assert(SIGNAL_TYPES.RESPONSIBLE_RISK_CONCENTRATION === 'RESPONSIBLE_RISK_CONCENTRATION', '1.4 RESPONSIBLE_RISK_CONCENTRATION');
assert(SIGNAL_TYPES.PIPELINE_RISK_CONCENTRATION    === 'PIPELINE_RISK_CONCENTRATION',    '1.5 PIPELINE_RISK_CONCENTRATION');

// ── 2. SEVERITY_LEVELS exportado e centralizado ───────────────────────────────

section(2, 'SEVERITY_LEVELS exportado com todos os 4 níveis');

assert(SEVERITY_LEVELS.info      === 'info',      '2.1 SEVERITY_LEVELS.info');
assert(SEVERITY_LEVELS.attention === 'attention', '2.2 SEVERITY_LEVELS.attention');
assert(SEVERITY_LEVELS.risk      === 'risk',      '2.3 SEVERITY_LEVELS.risk');
assert(SEVERITY_LEVELS.critical  === 'critical',  '2.4 SEVERITY_LEVELS.critical');

// ── 3. HIGH_VALUE_THRESHOLD exportado = 500000 ───────────────────────────────

section(3, 'HIGH_VALUE_THRESHOLD exportado = 500000');

assert(HIGH_VALUE_THRESHOLD === 500_000, '3.1 HIGH_VALUE_THRESHOLD = 500000');

// ── 4. RISK_THRESHOLDS exportado com todos os campos ────────────────────────

section(4, 'RISK_THRESHOLDS exportado com responsibleMinDeals=3, responsibleMinPercent=0.50, pipelineMinDeals=5, pipelineMinPercent=0.40');

assert(RISK_THRESHOLDS.responsibleMinDeals   === 3,    '4.1 responsibleMinDeals = 3');
assert(RISK_THRESHOLDS.responsibleMinPercent === 0.50, '4.2 responsibleMinPercent = 0.50');
assert(RISK_THRESHOLDS.pipelineMinDeals      === 5,    '4.3 pipelineMinDeals = 5');
assert(RISK_THRESHOLDS.pipelineMinPercent    === 0.40, '4.4 pipelineMinPercent = 0.40');

// ── 5. CRITICAL_NO_NEXT_ACTION emitido: deal critical sem próxima ação ────────

section(5, 'CRITICAL_NO_NEXT_ACTION: deal crítico sem próxima ação → sinal emitido com severity critical');

const d5 = { id: 'deal-crit', funil: 'venda', etapa: 'Proposta', responsavel: 'Ana',
              valor: 50000, updatedAt: REF_DATE - 40 * DAY_MS };
const a5 = new CRMRiskSignalAnalyzer(mockRM([d5]));
const s5 = a5.getRiskSignals({}, OPT);

assert(s5.length >= 1,                                            '5.1 ao menos 1 sinal emitido');
const crit5 = s5.find((s) => s.type === SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION);
assert(crit5 !== undefined,                                       '5.2 CRITICAL_NO_NEXT_ACTION presente');
assert(crit5.severity === SEVERITY_LEVELS.critical,               '5.3 severity = critical');
assert(crit5.agingDays === 40,                                    '5.4 agingDays = 40');
assert(crit5.dealId === 'deal-crit',                              '5.5 dealId correto');

// ── 6. CRITICAL_NO_NEXT_ACTION não emitido: deal critical COM próxima ação ───

section(6, 'CRITICAL_NO_NEXT_ACTION: deal crítico COM próxima ação → NÃO emitido');

const d6 = { id: 'deal-pa', funil: 'venda', valor: 50000,
              updatedAt: REF_DATE - 40 * DAY_MS, proximaAcao: 'Ligar na sexta' };
const s6 = new CRMRiskSignalAnalyzer(mockRM([d6])).getRiskSignals({}, OPT);
const crit6 = s6.find((s) => s.type === SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION);

assert(crit6 === undefined,       '6.1 CRITICAL_NO_NEXT_ACTION ausente (deal tem próxima ação)');
assert(s6.length >= 1,            '6.2 outro sinal emitido (STALE_DEAL) no lugar');

// ── 7. HIGH_VALUE_STALE: deal risk com valor >= 500000 → severity risk ────────

section(7, 'HIGH_VALUE_STALE: deal risk (20d) com valor >= 500000 → severity risk');

const d7 = { id: 'hv-risk', funil: 'venda', valor: 600000,
              updatedAt: REF_DATE - 20 * DAY_MS };
const s7 = new CRMRiskSignalAnalyzer(mockRM([d7])).getRiskSignals({}, OPT);
const hv7 = s7.find((s) => s.type === SIGNAL_TYPES.HIGH_VALUE_STALE);

assert(hv7 !== undefined,                           '7.1 HIGH_VALUE_STALE emitido');
assert(hv7.severity === SEVERITY_LEVELS.risk,       '7.2 severity = risk (deal está em faixa risk)');
assert(hv7.value    === 600000,                     '7.3 value = 600000');

// ── 8. HIGH_VALUE_STALE: deal critical com valor >= 500000 → severity critical

section(8, 'HIGH_VALUE_STALE: deal critical (40d) com valor >= 500000 → severity critical');

const d8 = { id: 'hv-crit', funil: 'venda', valor: 750000,
              updatedAt: REF_DATE - 40 * DAY_MS, proximaAcao: 'Reunião marcada' };
const s8 = new CRMRiskSignalAnalyzer(mockRM([d8])).getRiskSignals({}, OPT);
const hv8 = s8.find((s) => s.type === SIGNAL_TYPES.HIGH_VALUE_STALE);

assert(hv8 !== undefined,                           '8.1 HIGH_VALUE_STALE emitido');
assert(hv8.severity === SEVERITY_LEVELS.critical,   '8.2 severity = critical (deal está em faixa critical)');

// ── 9. HIGH_VALUE_STALE: threshold exato R$ 500.000 → emitido ────────────────

section(9, 'HIGH_VALUE_STALE: valor = exatamente R$ 500.000 → emitido (boundary inclusivo)');

const d9 = { id: 'hv-bound', valor: HIGH_VALUE_THRESHOLD, updatedAt: REF_DATE - 20 * DAY_MS };
const s9 = new CRMRiskSignalAnalyzer(mockRM([d9])).getRiskSignals({}, OPT);

assert(s9.some((s) => s.type === SIGNAL_TYPES.HIGH_VALUE_STALE), '9.1 HIGH_VALUE_STALE emitido para valor = 500000');

// ── 10. HIGH_VALUE_STALE: valor R$ 499.999 → NÃO emitido ───────────────────

section(10, 'HIGH_VALUE_STALE: valor = 499999 → NÃO emitido');

const d10 = { id: 'hv-below', valor: 499_999, updatedAt: REF_DATE - 20 * DAY_MS };
const s10 = new CRMRiskSignalAnalyzer(mockRM([d10])).getRiskSignals({}, OPT);

assert(!s10.some((s) => s.type === SIGNAL_TYPES.HIGH_VALUE_STALE), '10.1 HIGH_VALUE_STALE ausente para valor < 500000');

// ── 11. STALE_DEAL emitido: deal risk sem sinal mais específico ───────────────

section(11, 'STALE_DEAL: deal risk sem HIGH_VALUE_STALE ou CRITICAL_NO_NEXT_ACTION → STALE_DEAL emitido');

const d11 = { id: 'stale-risk', funil: 'venda', valor: 10000, updatedAt: REF_DATE - 20 * DAY_MS };
const s11 = new CRMRiskSignalAnalyzer(mockRM([d11])).getRiskSignals({}, OPT);
const stale11 = s11.find((s) => s.type === SIGNAL_TYPES.STALE_DEAL);

assert(stale11 !== undefined,                   '11.1 STALE_DEAL emitido');
assert(stale11.severity === SEVERITY_LEVELS.risk, '11.2 severity = risk');
assert(stale11.dealId   === 'stale-risk',         '11.3 dealId correto');

// ── 12. STALE_DEAL suprimido quando HIGH_VALUE_STALE cobre o mesmo deal ───────

section(12, 'deduplicação: STALE_DEAL suprimido quando HIGH_VALUE_STALE já cobre o deal');

const d12 = { id: 'hv-stale', valor: 600000, updatedAt: REF_DATE - 20 * DAY_MS };
const s12 = new CRMRiskSignalAnalyzer(mockRM([d12])).getRiskSignals({}, OPT);

assert(s12.some((s)  => s.type === SIGNAL_TYPES.HIGH_VALUE_STALE),  '12.1 HIGH_VALUE_STALE presente');
assert(!s12.some((s) => s.type === SIGNAL_TYPES.STALE_DEAL),        '12.2 STALE_DEAL ausente (suprimido)');

// ── 13. STALE_DEAL suprimido quando CRITICAL_NO_NEXT_ACTION cobre o deal ──────

section(13, 'deduplicação: STALE_DEAL suprimido quando CRITICAL_NO_NEXT_ACTION já cobre o deal');

const d13 = { id: 'crit-stale', valor: 10000, updatedAt: REF_DATE - 40 * DAY_MS };
const s13 = new CRMRiskSignalAnalyzer(mockRM([d13])).getRiskSignals({}, OPT);

assert(s13.some((s)  => s.type === SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION), '13.1 CRITICAL_NO_NEXT_ACTION presente');
assert(!s13.some((s) => s.type === SIGNAL_TYPES.STALE_DEAL),              '13.2 STALE_DEAL ausente (suprimido)');

// ── 14. Coexistência intencional: CRITICAL_NO_NEXT_ACTION + HIGH_VALUE_STALE ─

section(14, 'coexistência intencional: deal critical + sem ação + alto valor → AMBOS emitidos; sem STALE_DEAL');

const d14 = { id: 'coex', valor: 800000, updatedAt: REF_DATE - 40 * DAY_MS };
const s14 = new CRMRiskSignalAnalyzer(mockRM([d14])).getRiskSignals({}, OPT);

assert(s14.some((s) => s.type === SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION),  '14.1 CRITICAL_NO_NEXT_ACTION presente');
assert(s14.some((s) => s.type === SIGNAL_TYPES.HIGH_VALUE_STALE),         '14.2 HIGH_VALUE_STALE presente (coexiste)');
assert(!s14.some((s) => s.type === SIGNAL_TYPES.STALE_DEAL),              '14.3 STALE_DEAL ausente');

// ── 15. RESPONSIBLE_RISK_CONCENTRATION: exatamente 3 de 6 deals (50%) ────────

section(15, 'RESPONSIBLE_RISK_CONCENTRATION: exatamente 3 atRisk de 6 total (50%) → sinal emitido');

const d15 = [
  { id: 'r1', responsavel: 'Maria', valor: 50000, funil: 'v', updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 'r2', responsavel: 'Maria', valor: 50000, funil: 'v', updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 'r3', responsavel: 'Maria', valor: 50000, funil: 'v', updatedAt: REF_DATE - 40 * DAY_MS, proximaAcao: 'ok' }, // critical com ação
  { id: 'r4', responsavel: 'Maria', valor: 50000, funil: 'v', updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 'r5', responsavel: 'Maria', valor: 50000, funil: 'v', updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 'r6', responsavel: 'Maria', valor: 50000, funil: 'v', updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
];
const s15 = new CRMRiskSignalAnalyzer(mockRM(d15)).getRiskSignals({}, OPT);
const rConc15 = s15.find((s) => s.type === SIGNAL_TYPES.RESPONSIBLE_RISK_CONCENTRATION);

assert(rConc15 !== undefined,              '15.1 RESPONSIBLE_RISK_CONCENTRATION emitido (3/6 = 50%)');
assert(rConc15.responsible === 'Maria',    '15.2 responsible = Maria');
assert(rConc15.metadata.atRiskCount === 3, '15.3 atRiskCount = 3');

// ── 16. RESPONSIBLE: 3 atRisk de 7 total (~43%) → NÃO emitido ────────────────

section(16, 'RESPONSIBLE_RISK_CONCENTRATION: 3 atRisk de 7 total (43%) → NÃO emitido (abaixo de 50%)');

const d16 = [
  ...d15,
  { id: 'r7', responsavel: 'Maria', valor: 50000, funil: 'v', updatedAt: REF_DATE - 3 * DAY_MS }, // fresh
];
const s16 = new CRMRiskSignalAnalyzer(mockRM(d16)).getRiskSignals({}, OPT);
const rConc16 = s16.find((s) => s.type === SIGNAL_TYPES.RESPONSIBLE_RISK_CONCENTRATION);

assert(rConc16 === undefined, '16.1 RESPONSIBLE_RISK_CONCENTRATION ausente (3/7 ~43% < 50%)');

// ── 17. RESPONSIBLE: menos de 3 deals → NÃO emitido ─────────────────────────

section(17, 'RESPONSIBLE_RISK_CONCENTRATION: 2 deals atRisk de 4 total (50%) → NÃO emitido (< min 3)');

const d17 = [
  { id: 'x1', responsavel: 'João', valor: 50000, funil: 'v', updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 'x2', responsavel: 'João', valor: 50000, funil: 'v', updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 'x3', responsavel: 'João', valor: 50000, funil: 'v', updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 'x4', responsavel: 'João', valor: 50000, funil: 'v', updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
];
const s17 = new CRMRiskSignalAnalyzer(mockRM(d17)).getRiskSignals({}, OPT);

assert(!s17.some((s) => s.type === SIGNAL_TYPES.RESPONSIBLE_RISK_CONCENTRATION),
  '17.1 RESPONSIBLE_RISK_CONCENTRATION ausente (2 atRisk < min 3)');

// ── 18. RESPONSIBLE: exatamente 50% no boundary → emitido ───────────────────

section(18, 'RESPONSIBLE_RISK_CONCENTRATION: percentual exatamente 50% (boundary inclusivo) → emitido');

assert(rConc15 !== undefined, '18.1 confirmação: 3/6 = 50% exato emite sinal (cenário 15 cobriu este boundary)');

// ── 19. PIPELINE_RISK_CONCENTRATION: 5 elegíveis e exatamente 40% atRisk ─────

section(19, 'PIPELINE_RISK_CONCENTRATION: 5 elegíveis e 40% atRisk (2/5) → sinal emitido');

const d19 = [
  { id: 'p1', funil: 'eletro', valor: 50000, updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 'p2', funil: 'eletro', valor: 50000, updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 'p3', funil: 'eletro', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 'p4', funil: 'eletro', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 'p5', funil: 'eletro', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
];
const s19 = new CRMRiskSignalAnalyzer(mockRM(d19)).getRiskSignals({}, OPT);
const pConc19 = s19.find((s) => s.type === SIGNAL_TYPES.PIPELINE_RISK_CONCENTRATION);

assert(pConc19 !== undefined,                 '19.1 PIPELINE_RISK_CONCENTRATION emitido (2/5 = 40%)');
assert(pConc19.pipeline === 'eletro',         '19.2 pipeline = eletro');
assert(pConc19.metadata.eligibleCount === 5,  '19.3 eligibleCount = 5');
assert(pConc19.metadata.atRiskCount   === 2,  '19.4 atRiskCount = 2');

// ── 20. PIPELINE: 5 elegíveis e 20% atRisk (1/5) → NÃO emitido ──────────────

section(20, 'PIPELINE_RISK_CONCENTRATION: 5 elegíveis e 20% atRisk (1/5) → NÃO emitido (abaixo de 40%)');

const d20 = [
  { id: 'q1', funil: 'eletro2', valor: 50000, updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 'q2', funil: 'eletro2', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 'q3', funil: 'eletro2', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 'q4', funil: 'eletro2', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 'q5', funil: 'eletro2', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
];
const s20 = new CRMRiskSignalAnalyzer(mockRM(d20)).getRiskSignals({}, OPT);

assert(!s20.some((s) => s.type === SIGNAL_TYPES.PIPELINE_RISK_CONCENTRATION),
  '20.1 PIPELINE_RISK_CONCENTRATION ausente (1/5 = 20% < 40%)');

// ── 21. PIPELINE: menos de 5 deals elegíveis → NÃO emitido ──────────────────

section(21, 'PIPELINE_RISK_CONCENTRATION: 4 deals elegíveis (< min 5) → NÃO emitido');

const d21 = [
  { id: 't1', funil: 'eletro3', valor: 50000, updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 't2', funil: 'eletro3', valor: 50000, updatedAt: REF_DATE - 20 * DAY_MS }, // risk
  { id: 't3', funil: 'eletro3', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
  { id: 't4', funil: 'eletro3', valor: 50000, updatedAt: REF_DATE - 3  * DAY_MS }, // fresh
];
const s21 = new CRMRiskSignalAnalyzer(mockRM(d21)).getRiskSignals({}, OPT);

assert(!s21.some((s) => s.type === SIGNAL_TYPES.PIPELINE_RISK_CONCENTRATION),
  '21.1 PIPELINE_RISK_CONCENTRATION ausente (4 elegíveis < min 5)');

// ── 22. Ordenação por severity: critical antes de risk ───────────────────────

section(22, 'ordenação: sinais critical aparecem antes de sinais risk');

const d22 = [
  { id: 'ord-risk', funil: 'v', valor: 10000, updatedAt: REF_DATE - 20 * DAY_MS }, // risk → STALE_DEAL risk
  { id: 'ord-crit', funil: 'v', valor: 10000, updatedAt: REF_DATE - 40 * DAY_MS }, // critical → CRITICAL_NO_NEXT_ACTION
];
const s22 = new CRMRiskSignalAnalyzer(mockRM(d22)).getRiskSignals({}, OPT);
const idx22crit = s22.findIndex((s) => s.severity === SEVERITY_LEVELS.critical);
const idx22risk = s22.findIndex((s) => s.severity === SEVERITY_LEVELS.risk);

assert(idx22crit !== -1 && idx22risk !== -1, '22.1 ambas as severidades presentes');
assert(idx22crit < idx22risk,                '22.2 critical antes de risk na lista');

// ── 23. Ordenação por value dentro da mesma severity ─────────────────────────

section(23, 'ordenação: maior value primeiro dentro da mesma severity');

const d23 = [
  { id: 'sv-low',  funil: 'v', valor: 100000, updatedAt: REF_DATE - 20 * DAY_MS }, // risk, low value
  { id: 'sv-high', funil: 'v', valor: 900000, updatedAt: REF_DATE - 20 * DAY_MS }, // risk, high value → HIGH_VALUE_STALE
];
const s23 = new CRMRiskSignalAnalyzer(mockRM(d23)).getRiskSignals({}, OPT);
const riskSignals23 = s23.filter((s) => s.severity === SEVERITY_LEVELS.risk);

assert(riskSignals23.length >= 2,                        '23.1 ao menos 2 sinais risk');
assert((riskSignals23[0].value ?? -1) >= (riskSignals23[1].value ?? -1), '23.2 maior valor primeiro');

// ── 24. Ordenação por agingDays dentro da mesma severity e value ──────────────

section(24, 'ordenação: maior agingDays primeiro quando severity e value idênticos');

const sameVal = 10000;
const d24 = [
  { id: 'ag-20', funil: 'v', valor: sameVal, updatedAt: REF_DATE - 20 * DAY_MS }, // 20d
  { id: 'ag-25', funil: 'v', valor: sameVal, updatedAt: REF_DATE - 25 * DAY_MS }, // 25d
];
const s24 = new CRMRiskSignalAnalyzer(mockRM(d24)).getRiskSignals({}, OPT);
const staleDeal24 = s24.filter((s) => s.type === SIGNAL_TYPES.STALE_DEAL);

assert(staleDeal24.length === 2,            '24.1 2 sinais STALE_DEAL');
assert(staleDeal24[0].agingDays === 25,     '24.2 maior aging primeiro (25d)');
assert(staleDeal24[1].agingDays === 20,     '24.3 menor aging depois (20d)');

// ── 25. Desempate estável por id ─────────────────────────────────────────────

section(25, 'desempate estável: ids comparados lexicograficamente quando severity/value/aging idênticos');

const refMs25 = REF_DATE;
const d25 = [
  { id: 'zzz-deal', valor: sameVal, updatedAt: REF_DATE - 20 * DAY_MS },
  { id: 'aaa-deal', valor: sameVal, updatedAt: REF_DATE - 20 * DAY_MS },
];
const s25 = new CRMRiskSignalAnalyzer(mockRM(d25)).getRiskSignals({}, OPT);

assert(s25.length >= 2, '25.1 ambos sinais presentes');
const ids25 = s25.filter((s) => s.type === SIGNAL_TYPES.STALE_DEAL).map((s) => s.id);
assert(ids25.length === 2,                        '25.2 2 STALE_DEAL presentes');
assert(ids25[0].localeCompare(ids25[1]) <= 0,     '25.3 ordenação lexicográfica estável por id');

// ── 26. valueExposed: sem dupla contagem do mesmo deal ───────────────────────

section(26, 'valueExposed: deal com CRITICAL_NO_NEXT_ACTION + HIGH_VALUE_STALE conta valor apenas uma vez');

const d26 = [
  { id: 'double', valor: 800000, updatedAt: REF_DATE - 40 * DAY_MS }, // critical + alto valor → 2 sinais
  { id: 'other',  valor: 100000, updatedAt: REF_DATE - 40 * DAY_MS }, // critical → 1 sinal
];
const sum26 = new CRMRiskSignalAnalyzer(mockRM(d26)).getRiskSignalSummary({}, OPT);

assert(sum26.valueExposed === 900000, '26.1 valueExposed = 800000 + 100000 = 900000 (sem dupla contagem)');
assert(sum26.affectedDeals === 2,     '26.2 affectedDeals = 2 (não dobrou)');

// ── 27. Valor inválido ou ausente → sem NaN; signal.value = null ─────────────

section(27, 'valor inválido (string) ou ausente → signal.value = null; sem NaN no summary');

const d27a = { id: 'bad-val', valor: 'nao-numero', updatedAt: REF_DATE - 40 * DAY_MS };
const d27b = { id: 'no-val',                       updatedAt: REF_DATE - 40 * DAY_MS };
const sum27 = new CRMRiskSignalAnalyzer(mockRM([d27a, d27b])).getRiskSignalSummary({}, OPT);

assert(!isNaN(sum27.valueExposed),   '27.1 valueExposed não é NaN');
assert(!isNaN(sum27.totalSignals),   '27.2 totalSignals não é NaN');
assert(!isNaN(sum27.affectedDeals),  '27.3 affectedDeals não é NaN');
assert(sum27.valueExposed === 0,     '27.4 valueExposed = 0 quando valores inválidos');

// ── 28. Timestamp ausente → sem sinais de aging para o deal ──────────────────

section(28, 'timestamp ausente (updatedAt=0, createdAt=0) → nenhum sinal de aging emitido para o deal');

const d28 = { id: 'no-ts', valor: 999999, updatedAt: 0, createdAt: 0 };
const s28 = new CRMRiskSignalAnalyzer(mockRM([d28])).getRiskSignals({}, OPT);
const dealSignals28 = s28.filter((s) => s.dealId === 'no-ts');

assert(dealSignals28.length === 0, '28.1 nenhum sinal de deal emitido para deal sem timestamp');

// ── 29. Filtros são propagados e respeitados ──────────────────────────────────

section(29, 'filtros respeitados: getRiskSignals com funil=A não processa deals de funil=B');

const d29 = [
  { id: 'f-a', funil: 'funilA', valor: 50000, updatedAt: REF_DATE - 40 * DAY_MS },
  { id: 'f-b', funil: 'funilB', valor: 50000, updatedAt: REF_DATE - 40 * DAY_MS },
];
const s29 = new CRMRiskSignalAnalyzer(mockRM(d29)).getRiskSignals({ funil: 'funilA' }, OPT);
const ids29 = s29.map((s) => s.dealId).filter(Boolean);

assert(ids29.every((id) => id === 'f-a'), '29.1 apenas deal de funilA nos sinais');
assert(!ids29.includes('f-b'),            '29.2 deal de funilB ausente');

// ── 30. referenceDate determinístico ─────────────────────────────────────────

section(30, 'options.referenceDate injeta referência temporal — aging determinístico');

const baseMs = 1_700_000_000_000;
const d30fresh = { id: 'ref-fresh', valor: 10000, updatedAt: baseMs - 3 * DAY_MS };
const d30crit  = { id: 'ref-crit',  valor: 10000, updatedAt: baseMs - 40 * DAY_MS };
const a30 = new CRMRiskSignalAnalyzer(mockRM([d30fresh, d30crit]));

const s30 = a30.getRiskSignals({}, { referenceDate: baseMs });
assert(!s30.some((s) => s.dealId === 'ref-fresh'), '30.1 deal fresco não gera sinal com referenceDate correto');
assert(s30.some((s)  => s.dealId === 'ref-crit'),  '30.2 deal crítico gera sinal com referenceDate correto');

// ── 31. Resultado vazio: sem deals → summary com zeros; sem NaN ───────────────

section(31, 'resultado vazio: sem deals → summary com todos os campos zerados; sem NaN');

const sum31 = new CRMRiskSignalAnalyzer(mockRM([])).getRiskSignalSummary({}, OPT);

assert(sum31.totalSignals     === 0,  '31.1 totalSignals = 0');
assert(sum31.criticalSignals  === 0,  '31.2 criticalSignals = 0');
assert(sum31.riskSignals      === 0,  '31.3 riskSignals = 0');
assert(sum31.affectedDeals    === 0,  '31.4 affectedDeals = 0');
assert(sum31.valueExposed     === 0,  '31.5 valueExposed = 0');
assert(!isNaN(sum31.valueExposed),    '31.6 valueExposed não é NaN');
assert(Array.isArray(sum31.signals),  '31.7 signals é array');
assert(sum31.signals.length   === 0,  '31.8 signals vazio');

// ── 32. Integração CRMQueryService: queries retornam CRMQueryResult correto ───

section(32, 'CRMQueryService.getRiskSignals / getCriticalRiskSignals / getRiskSignalSummary');

const rm32 = new CRMReadModel();
const m32  = new CRMMetrics(rm32);
const svc32 = new CRMQueryService(rm32, m32);
rm32.hydrate({
  'qs-crit':  { funil: 'venda_ufv', valor: 50000, responsavel: 'Carla', createdAt: 1000, updatedAt: 1001 },
  'qs-fresh': { funil: 'venda_ufv', valor: 50000, responsavel: 'Carla', createdAt: Date.now() - DAY_MS, updatedAt: Date.now() },
});

const r32all  = svc32.getRiskSignals({}, {});
const r32crit = svc32.getCriticalRiskSignals({}, {});
const r32sum  = svc32.getRiskSignalSummary({}, {});

assert(r32all  instanceof CRMQueryResult,                      '32.1 getRiskSignals retorna CRMQueryResult');
assert(r32crit instanceof CRMQueryResult,                      '32.2 getCriticalRiskSignals retorna CRMQueryResult');
assert(r32sum  instanceof CRMQueryResult,                      '32.3 getRiskSignalSummary retorna CRMQueryResult');
assert(r32all.metadata.query  === 'crm.getRiskSignals',        '32.4 metadata.query getRiskSignals');
assert(r32crit.metadata.query === 'crm.getCriticalRiskSignals','32.5 metadata.query getCriticalRiskSignals');
assert(r32sum.metadata.query  === 'crm.getRiskSignalSummary',  '32.6 metadata.query getRiskSignalSummary');
assert(Array.isArray(r32all.data),                             '32.7 getRiskSignals data é array');
assert(Array.isArray(r32crit.data),                            '32.8 getCriticalRiskSignals data é array');
assert('totalSignals' in r32sum.data,                          '32.9 getRiskSignalSummary data.totalSignals presente');
assert('signals'      in r32sum.data,                          '32.10 getRiskSignalSummary data.signals presente');
assert(r32crit.data.every((s) => s.severity === 'critical'),   '32.11 getCriticalRiskSignals retorna apenas critical');

// ── 33. Delegações ESAApplication ────────────────────────────────────────────

section(33, 'ESAApplication.getCRMRiskSignals / getCRMCriticalRiskSignals / getCRMRiskSignalSummary existem e retornam shape correta');

assert(typeof ESA.getCRMRiskSignals         === 'function', '33.1 getCRMRiskSignals é função');
assert(typeof ESA.getCRMCriticalRiskSignals === 'function', '33.2 getCRMCriticalRiskSignals é função');
assert(typeof ESA.getCRMRiskSignalSummary   === 'function', '33.3 getCRMRiskSignalSummary é função');

const esa33sum = ESA.getCRMRiskSignalSummary();
assert(typeof esa33sum         === 'object',  '33.4 getCRMRiskSignalSummary retorna objeto');
assert('data'        in esa33sum,            '33.5 retorno tem campo data');
assert('metadata'    in esa33sum,            '33.6 retorno tem campo metadata');
assert('generatedAt' in esa33sum,            '33.7 retorno tem campo generatedAt');
assert('totalSignals' in esa33sum.data,      '33.8 data.totalSignals presente');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 33 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
