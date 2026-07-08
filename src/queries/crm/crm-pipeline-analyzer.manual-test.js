/**
 * ESA OS — Queries / CRM
 * Suite de testes de integração — CRMPipelineAnalyzer
 * 24 cenários obrigatórios
 *
 * Execução: node src/queries/crm/crm-pipeline-analyzer.manual-test.js
 *
 * Valida aging, classificação por faixas, boundaries, timestamps inválidos,
 * próxima ação, valueAtRisk, criticalValue, filtros, referenceDate determinístico,
 * CRMQueryResult via CRMQueryService e listas gerenciais.
 *
 * Usa mock de readModel (objeto com getDeals()) para controle total de timestamps.
 * Não usa Jest. ES Modules nativos.
 */

import { CRMPipelineAnalyzer, AGING_THRESHOLDS } from './crm-pipeline-analyzer.js';
import { CRMQueryService }                        from './crm-query-service.js';
import { CRMQueryResult }                         from './crm-query-result.js';
import { CRMReadModel }                           from '../../read-models/crm/crm-read-model.js';
import { CRMMetrics }                             from '../../read-models/crm/crm-metrics.js';

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
  console.log(`\n[${n}/24] ${title}`);
}

// ── Constantes de tempo ───────────────────────────────────────────────────────

const DAY_MS   = 86_400_000;
const REF_DATE = 1_000_000_000_000; // Timestamp fixo para testes determinísticos

// Fabrica mock de readModel com controle total de deals
function mockRM(deals) {
  return {
    getDeals: (filters = {}) => {
      let items = deals.slice();
      if (filters.funil)      items = items.filter((d) => d.funil === filters.funil);
      if (filters.responsavel) items = items.filter((d) => d.responsavel === filters.responsavel);
      if (filters.status)      items = items.filter((d) => d.status === filters.status);
      return items;
    },
  };
}

const OPT = { referenceDate: REF_DATE };

// ── 1. AGING_THRESHOLDS exportado e centralizado ──────────────────────────────

section(1, 'AGING_THRESHOLDS exportado — fresh=7, attention=14, risk=30');

assert(AGING_THRESHOLDS.fresh     === 7,  '1.1 AGING_THRESHOLDS.fresh = 7');
assert(AGING_THRESHOLDS.attention === 14, '1.2 AGING_THRESHOLDS.attention = 14');
assert(AGING_THRESHOLDS.risk      === 30, '1.3 AGING_THRESHOLDS.risk = 30');

// ── 2. Deal fresh (3 dias) ────────────────────────────────────────────────────

section(2, 'deal com 3 dias → classificado como "fresh"');

const analyzer = new CRMPipelineAnalyzer(mockRM([{
  id: 'd1', funil: 'venda_ufv', status: 'Em andamento',
  valor: 100000, responsavel: 'Lucas',
  updatedAt: REF_DATE - 3 * DAY_MS, createdAt: REF_DATE - 10 * DAY_MS,
}]));
const h2 = analyzer.getPipelineHealth({}, OPT);

assert(h2.freshDeals     === 1, '2.1 freshDeals = 1');
assert(h2.attentionDeals === 0, '2.2 attentionDeals = 0');
assert(h2.riskDeals      === 0, '2.3 riskDeals = 0');
assert(h2.criticalDeals  === 0, '2.4 criticalDeals = 0');

// ── 3. Deal attention (10 dias) ───────────────────────────────────────────────

section(3, 'deal com 10 dias → classificado como "attention"');

const h3 = new CRMPipelineAnalyzer(mockRM([{
  id: 'd2', valor: 50000, updatedAt: REF_DATE - 10 * DAY_MS, createdAt: 0,
}])).getPipelineHealth({}, OPT);

assert(h3.freshDeals     === 0, '3.1 freshDeals = 0');
assert(h3.attentionDeals === 1, '3.2 attentionDeals = 1');
assert(h3.riskDeals      === 0, '3.3 riskDeals = 0');
assert(h3.criticalDeals  === 0, '3.4 criticalDeals = 0');

// ── 4. Deal risk (20 dias) ────────────────────────────────────────────────────

section(4, 'deal com 20 dias → classificado como "risk"; valor entra em valueAtRisk');

const h4 = new CRMPipelineAnalyzer(mockRM([{
  id: 'd3', valor: 75000, updatedAt: REF_DATE - 20 * DAY_MS, createdAt: 0,
}])).getPipelineHealth({}, OPT);

assert(h4.riskDeals   === 1,     '4.1 riskDeals = 1');
assert(h4.valueAtRisk === 75000, '4.2 valueAtRisk = 75000');
assert(h4.criticalValue === 0,   '4.3 criticalValue = 0 (risk não é critical)');

// ── 5. Deal critical (35 dias) ────────────────────────────────────────────────

section(5, 'deal com 35 dias → "critical"; valor entra em valueAtRisk e criticalValue');

const h5 = new CRMPipelineAnalyzer(mockRM([{
  id: 'd4', valor: 200000, updatedAt: REF_DATE - 35 * DAY_MS, createdAt: 0,
}])).getPipelineHealth({}, OPT);

assert(h5.criticalDeals  === 1,      '5.1 criticalDeals = 1');
assert(h5.valueAtRisk    === 200000, '5.2 valueAtRisk = 200000');
assert(h5.criticalValue  === 200000, '5.3 criticalValue = 200000');

// ── 6. Boundary: exatamente 7 dias → fresh ───────────────────────────────────

section(6, 'boundary: exatamente 7 dias → "fresh"');

const d6 = { id: 'b6', valor: 0, updatedAt: REF_DATE - 7 * DAY_MS, createdAt: 0 };
const a6 = new CRMPipelineAnalyzer(mockRM([d6]));
assert(a6._classifyAging(7) === 'fresh', '6.1 _classifyAging(7) = "fresh"');
const h6 = a6.getPipelineHealth({}, OPT);
assert(h6.freshDeals === 1, '6.2 deal de exatamente 7 dias → fresh');

// ── 7. Boundary: exatamente 8 dias → attention ───────────────────────────────

section(7, 'boundary: exatamente 8 dias → "attention"');

const a7 = new CRMPipelineAnalyzer(mockRM([{ id: 'b7', valor: 0, updatedAt: REF_DATE - 8 * DAY_MS, createdAt: 0 }]));
assert(a7._classifyAging(8) === 'attention', '7.1 _classifyAging(8) = "attention"');
const h7 = a7.getPipelineHealth({}, OPT);
assert(h7.attentionDeals === 1, '7.2 deal de exatamente 8 dias → attention');

// ── 8. Boundary: exatamente 14 dias → attention ──────────────────────────────

section(8, 'boundary: exatamente 14 dias → "attention"');

const a8 = new CRMPipelineAnalyzer(mockRM([{ id: 'b8', valor: 0, updatedAt: REF_DATE - 14 * DAY_MS, createdAt: 0 }]));
assert(a8._classifyAging(14) === 'attention', '8.1 _classifyAging(14) = "attention"');
assert(a8.getPipelineHealth({}, OPT).attentionDeals === 1, '8.2 deal de 14 dias → attention');

// ── 9. Boundary: exatamente 15 dias → risk ───────────────────────────────────

section(9, 'boundary: exatamente 15 dias → "risk"');

const a9 = new CRMPipelineAnalyzer(mockRM([{ id: 'b9', valor: 0, updatedAt: REF_DATE - 15 * DAY_MS, createdAt: 0 }]));
assert(a9._classifyAging(15) === 'risk', '9.1 _classifyAging(15) = "risk"');
assert(a9.getPipelineHealth({}, OPT).riskDeals === 1, '9.2 deal de 15 dias → risk');

// ── 10. Boundary: exatamente 30 dias → risk ──────────────────────────────────

section(10, 'boundary: exatamente 30 dias → "risk"');

const a10 = new CRMPipelineAnalyzer(mockRM([{ id: 'b10', valor: 0, updatedAt: REF_DATE - 30 * DAY_MS, createdAt: 0 }]));
assert(a10._classifyAging(30) === 'risk', '10.1 _classifyAging(30) = "risk"');
assert(a10.getPipelineHealth({}, OPT).riskDeals === 1, '10.2 deal de 30 dias → risk');

// ── 11. Boundary: exatamente 31 dias → critical ──────────────────────────────

section(11, 'boundary: exatamente 31 dias → "critical"');

const a11 = new CRMPipelineAnalyzer(mockRM([{ id: 'b11', valor: 0, updatedAt: REF_DATE - 31 * DAY_MS, createdAt: 0 }]));
assert(a11._classifyAging(31) === 'critical', '11.1 _classifyAging(31) = "critical"');
assert(a11.getPipelineHealth({}, OPT).criticalDeals === 1, '11.2 deal de 31 dias → critical');

// ── 12. Timestamp ausente (updatedAt=0, createdAt=0) ─────────────────────────

section(12, 'timestamp ausente → agingDays=null; "unknown"; não entra em faixas normais');

const aNull = new CRMPipelineAnalyzer(mockRM([{ id: 'bn', valor: 50000, updatedAt: 0, createdAt: 0 }]));
const dNull = { id: 'bn', valor: 50000, updatedAt: 0, createdAt: 0 };
assert(aNull._agingDays(dNull, REF_DATE) === null, '12.1 _agingDays = null quando ambos timestamps = 0');
assert(aNull._classifyAging(null) === 'unknown',   '12.2 _classifyAging(null) = "unknown"');
const hNull = aNull.getPipelineHealth({}, OPT);
assert(hNull.freshDeals + hNull.attentionDeals + hNull.riskDeals + hNull.criticalDeals === 0,
  '12.3 deal sem timestamp não entra em nenhuma faixa de aging');

// ── 13. Timestamp inválido (string, NaN) ─────────────────────────────────────

section(13, 'timestamp inválido (string, NaN) → agingDays=null; tratado como ausente');

const dBad = { id: 'bad', updatedAt: 'not-a-date', createdAt: NaN };
const aBad = new CRMPipelineAnalyzer(mockRM([dBad]));
assert(aBad._agingDays(dBad, REF_DATE) === null,  '13.1 updatedAt string → agingDays = null');
assert(aBad._classifyAging(null) === 'unknown',    '13.2 classified as unknown');
assert(aBad.getPipelineHealth({}, OPT).totalDeals === 1, '13.3 deal ainda contabilizado em totalDeals');

// ── 14. Fallback para createdAt quando updatedAt=0 ───────────────────────────

section(14, 'fallback createdAt: updatedAt=0 → usa createdAt para calcular aging');

const dFb = { id: 'fb', valor: 0, updatedAt: 0, createdAt: REF_DATE - 20 * DAY_MS };
const aFb = new CRMPipelineAnalyzer(mockRM([dFb]));
assert(aFb._lastRelevantAt(dFb) === REF_DATE - 20 * DAY_MS, '14.1 _lastRelevantAt usa createdAt quando updatedAt=0');
assert(aFb._agingDays(dFb, REF_DATE) === 20, '14.2 agingDays = 20 via createdAt');
assert(aFb.getPipelineHealth({}, OPT).riskDeals === 1, '14.3 classificado como risk via createdAt');

// ── 15. Valor inválido ou ausente → 0; sem NaN ───────────────────────────────

section(15, 'valor inválido ou ausente → value=0 no DealItem; sem NaN no valueAtRisk');

const dBadVal = { id: 'bv', updatedAt: REF_DATE - 35 * DAY_MS, valor: 'não-numero' };
const dNoVal  = { id: 'nv', updatedAt: REF_DATE - 35 * DAY_MS };
const aBadVal = new CRMPipelineAnalyzer(mockRM([dBadVal, dNoVal]));
const hBadVal = aBadVal.getPipelineHealth({}, OPT);

assert(!isNaN(hBadVal.valueAtRisk),   '15.1 valueAtRisk não é NaN mesmo com valor inválido');
assert(!isNaN(hBadVal.criticalValue), '15.2 criticalValue não é NaN');
assert(hBadVal.valueAtRisk === 0,     '15.3 valueAtRisk = 0 quando valor ausente/inválido');
assert(hBadVal.criticalValue === 0,   '15.4 criticalValue = 0 quando valor ausente/inválido');

const item15 = aBadVal.getCriticalDeals({}, OPT)[0];
assert(item15 !== undefined,          '15.5 getCriticalDeals retorna item');
assert(item15.value === 0,            '15.6 item.value = 0 (não NaN)');
assert(!isNaN(item15.value),          '15.7 item.value não é NaN');

// ── 16. valueAtRisk = soma de risk + critical ─────────────────────────────────

section(16, 'valueAtRisk acumula deals risk E critical; criticalValue só critical');

const aVAR = new CRMPipelineAnalyzer(mockRM([
  { id: 'r1', valor: 50000,  updatedAt: REF_DATE - 20 * DAY_MS, createdAt: 0 }, // risk
  { id: 'r2', valor: 80000,  updatedAt: REF_DATE - 25 * DAY_MS, createdAt: 0 }, // risk
  { id: 'c1', valor: 100000, updatedAt: REF_DATE - 40 * DAY_MS, createdAt: 0 }, // critical
  { id: 'f1', valor: 200000, updatedAt: REF_DATE - 3 * DAY_MS,  createdAt: 0 }, // fresh
]));
const hVAR = aVAR.getPipelineHealth({}, OPT);

assert(hVAR.riskDeals     === 2,      '16.1 riskDeals = 2');
assert(hVAR.criticalDeals === 1,      '16.2 criticalDeals = 1');
assert(hVAR.valueAtRisk   === 230000, '16.3 valueAtRisk = 50000+80000+100000 = 230000');
assert(hVAR.criticalValue === 100000, '16.4 criticalValue = 100000 (só critical)');

// ── 17. agingDistribution contagens e totalValue ──────────────────────────────

section(17, 'agingDistribution contém count e totalValue por faixa');

const hDist = aVAR.getPipelineHealth({}, OPT);

assert(hDist.agingDistribution.fresh.count       === 1,      '17.1 fresh.count = 1');
assert(hDist.agingDistribution.fresh.totalValue  === 200000, '17.2 fresh.totalValue = 200000');
assert(hDist.agingDistribution.risk.count        === 2,      '17.3 risk.count = 2');
assert(hDist.agingDistribution.risk.totalValue   === 130000, '17.4 risk.totalValue = 130000');
assert(hDist.agingDistribution.critical.count    === 1,      '17.5 critical.count = 1');
assert(hDist.agingDistribution.critical.totalValue === 100000, '17.6 critical.totalValue = 100000');

// ── 18. Deal sem próxima ação ─────────────────────────────────────────────────

section(18, 'deal sem proximaAcao nem followUp → _hasNextAction = false');

const aNa = new CRMPipelineAnalyzer(mockRM([
  { id: 'na1', updatedAt: REF_DATE - 5 * DAY_MS },
  { id: 'na2', updatedAt: REF_DATE - 5 * DAY_MS, proximaAcao: '' },
  { id: 'na3', updatedAt: REF_DATE - 5 * DAY_MS, proximaAcao: '   ' },
]));

assert(!aNa._hasNextAction({ id: 'na1' }),                 '18.1 sem proximaAcao → false');
assert(!aNa._hasNextAction({ id: 'na2', proximaAcao: '' }),'18.2 proximaAcao vazia → false');
assert(!aNa._hasNextAction({ id: 'na3', proximaAcao: '   ' }), '18.3 proximaAcao só espaços → false');
const hNa = aNa.getPipelineHealth({}, OPT);
assert(hNa.dealsWithoutNextAction === 3, '18.4 dealsWithoutNextAction = 3');

// ── 19. Deal com proximaAcao → _hasNextAction = true ─────────────────────────

section(19, 'deal com proximaAcao preenchida → _hasNextAction = true');

const aWa = new CRMPipelineAnalyzer(mockRM([
  { id: 'wa1', updatedAt: REF_DATE - 5 * DAY_MS, proximaAcao: 'Ligar na segunda' },
  { id: 'wa2', updatedAt: REF_DATE - 5 * DAY_MS },
]));
assert(aWa._hasNextAction({ proximaAcao: 'Ligar na segunda' }), '19.1 proximaAcao preenchida → true');
const hWa = aWa.getPipelineHealth({}, OPT);
assert(hWa.dealsWithoutNextAction === 1, '19.2 apenas deal sem proximaAcao contabilizado');

// ── 20. Deal com followUp → _hasNextAction = true ────────────────────────────

section(20, 'deal com followUp preenchido → _hasNextAction = true');

const aFu = new CRMPipelineAnalyzer(mockRM([]));
assert(aFu._hasNextAction({ followUp: 'Call agendada' }),  '20.1 followUp preenchido → true');
assert(!aFu._hasNextAction({ followUp: '' }),              '20.2 followUp vazio → false');
assert(!aFu._hasNextAction({ followUp: '   ' }),           '20.3 followUp só espaços → false');

// ── 21. Filtros respeitados ───────────────────────────────────────────────────

section(21, 'filtros são propagados para getDeals() e respeitados na análise');

const aFilter = new CRMPipelineAnalyzer(mockRM([
  { id: 'f1', funil: 'venda_ufv',          valor: 100000, updatedAt: REF_DATE - 40 * DAY_MS },
  { id: 'f2', funil: 'assinatura_energia', valor: 50000,  updatedAt: REF_DATE - 40 * DAY_MS },
]));
const hFiltered = aFilter.getPipelineHealth({ funil: 'venda_ufv' }, OPT);
assert(hFiltered.totalDeals    === 1,      '21.1 apenas 1 deal com funil=venda_ufv');
assert(hFiltered.criticalDeals === 1,      '21.2 criticalDeals = 1');
assert(hFiltered.criticalValue === 100000, '21.3 criticalValue = 100000 (apenas venda_ufv)');

const cFiltered = aFilter.getCriticalDeals({ funil: 'venda_ufv' }, OPT);
assert(cFiltered.length === 1,             '21.4 getCriticalDeals com filtro retorna 1 item');
assert(cFiltered[0].id  === 'f1',          '21.5 item correto (f1)');

// ── 22. referenceDate determinística ─────────────────────────────────────────

section(22, 'options.referenceDate injeta referência temporal — aging determinístico');

const baseMs = 1_700_000_000_000;
const aRef   = new CRMPipelineAnalyzer(mockRM([
  { id: 'r1', valor: 0, updatedAt: baseMs - 5 * DAY_MS,  createdAt: 0 },  // fresh
  { id: 'r2', valor: 0, updatedAt: baseMs - 40 * DAY_MS, createdAt: 0 },  // critical
]));

const hRef = aRef.getPipelineHealth({}, { referenceDate: baseMs });
assert(hRef.referenceDate  === baseMs, '22.1 referenceDate preservado no resultado');
assert(hRef.freshDeals     === 1,     '22.2 fresh = 1 com referenceDate injetado');
assert(hRef.criticalDeals  === 1,     '22.3 critical = 1 com referenceDate injetado');

// ── 23. CRMQueryResult via CRMQueryService ────────────────────────────────────

section(23, 'CRMQueryService.getPipelineHealth() retorna CRMQueryResult com metadata');

const rm23  = new CRMReadModel();
const m23   = new CRMMetrics(rm23);
const svc23 = new CRMQueryService(rm23, m23);
rm23.hydrate({
  'deal-23a': { funil: 'venda_ufv', valor: 100000, responsavel: 'Lucas', createdAt: 1000, updatedAt: 1001 },
  'deal-23b': { funil: 'venda_ufv', valor: 200000, responsavel: 'Lucas', createdAt: 1002, updatedAt: 1003 },
});

const r23 = svc23.getPipelineHealth({}, OPT);
assert(r23 instanceof CRMQueryResult,                     '23.1 retorna instância de CRMQueryResult');
assert(typeof r23.generatedAt === 'number',               '23.2 generatedAt é number');
assert(r23.metadata.query === 'crm.getPipelineHealth',    '23.3 metadata.query correto');
assert('totalDeals' in r23.data,                          '23.4 data.totalDeals presente');
assert(r23.data.totalDeals === 2,                         '23.5 totalDeals = 2');

const r23w = svc23.getDealsWithoutNextAction({}, OPT);
assert(r23w instanceof CRMQueryResult,                    '23.6 getDealsWithoutNextAction retorna CRMQueryResult');
assert(r23w.metadata.query === 'crm.getDealsWithoutNextAction', '23.7 metadata.query correto');
assert(Array.isArray(r23w.data),                          '23.8 data é array');

// ── 24. getCriticalDeals e getDealsWithoutNextAction — listas gerenciais ──────

section(24, 'listas gerenciais: getCriticalDeals ordenado por agingDays DESC; getDealsWithoutNextAction');

const aList = new CRMPipelineAnalyzer(mockRM([
  { id: 'crit-50',  valor: 50000,  updatedAt: REF_DATE - 50 * DAY_MS, funil: 'venda_ufv', etapa: 'Proposta', status: 'Em andamento', responsavel: 'Lucas' },
  { id: 'crit-35',  valor: 35000,  updatedAt: REF_DATE - 35 * DAY_MS, funil: 'venda_ufv', etapa: 'Negociação', status: 'Em andamento', responsavel: 'Outro' },
  { id: 'fresh-3',  valor: 100000, updatedAt: REF_DATE - 3 * DAY_MS,  funil: 'venda_ufv', etapa: 'Proposta', status: 'Em andamento', responsavel: 'Lucas' },
  { id: 'with-pa',  valor: 60000,  updatedAt: REF_DATE - 40 * DAY_MS, funil: 'venda_ufv', proximaAcao: 'Follow-up agendado' },
]));

const critList = aList.getCriticalDeals({}, OPT);
assert(critList.length === 3,                     '24.1 3 deals críticos (50, 35, 40 dias)');
assert(critList[0].id === 'crit-50',              '24.2 primeiro = mais antigo (50 dias)');
assert(critList[0].agingDays === 50,              '24.3 agingDays = 50');
assert(critList[0].agingLevel === 'critical',     '24.4 agingLevel = "critical"');
assert(typeof critList[0].pipeline === 'string',  '24.5 pipeline é string');
assert(typeof critList[0].stage    === 'string',  '24.6 stage é string');
assert(typeof critList[0].responsible === 'string','24.7 responsible é string');
assert(typeof critList[0].value    === 'number',  '24.8 value é number');
assert(critList[1].id === 'with-pa',              '24.9 segundo = 40 dias (with-pa)');

const noActionList = aList.getDealsWithoutNextAction({}, OPT);
assert(Array.isArray(noActionList),               '24.10 getDealsWithoutNextAction retorna array');
assert(noActionList.every((d) => d.nextActionAt === null || !d.nextActionAt), '24.11 todos sem próxima ação');
assert(!noActionList.some((d) => d.id === 'with-pa'), '24.12 with-pa ausente (tem proximaAcao)');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 24 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
