/**
 * ESA OS — Queries / CRM
 * Suite de testes manuais — CRMQueryService + CRMQueryResult
 * 16 cenários obrigatórios
 *
 * Execução: node src/queries/crm/crm-query-service.manual-test.js
 *
 * Valida:
 * - CRMQueryResult estrutura, generatedAt e toJSON()
 * - Todas as queries: getDeal, searchDeals, getPipeline, getStatusSummary,
 *   getMetrics, getForecast, getExecutiveSummary
 * - Propagação de filtros para Read Model e Metrics
 * - Validação de dependências com erros claros
 * - Singleton crmQueryService com singletons reais
 *
 * Usa classes reais. Sem mocks. Sem Jest. ES Modules nativos.
 */

import { CRMQueryService, CRMQueryResult, crmQueryService } from './index.js';
import { CRMReadModel, CRMMetrics, crmReadModel }           from '../../read-models/crm/index.js';

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
  console.log(`\n[${n}/16] ${title}`);
}

// ── Dados de teste ────────────────────────────────────────────────────────────

const TEST_DEALS = {
  'deal-1': {
    funil: 'venda_ufv', etapa: 'Proposta', status: 'Em andamento',
    valor: 100000, responsavel: 'Lucas', createdAt: 1000001, updatedAt: 1000002,
  },
  'deal-2': {
    funil: 'venda_ufv', etapa: 'Negociação', status: 'Vendido',
    valor: 200000, responsavel: 'Lucas', createdAt: 1000003, updatedAt: 1000004,
  },
  'deal-3': {
    funil: 'assinatura_energia', etapa: 'Qualificação', status: 'Perdido',
    valor: 50000, kwh: 30000, responsavel: 'Outro', createdAt: 1000005, updatedAt: 1000006,
  },
  'deal-4': {
    funil: 'venda_ufv', etapa: 'Proposta', status: 'Pausado',
    valor: 40000, responsavel: 'Lucas', createdAt: 1000007, updatedAt: 1000008,
  },
};

// ── Setup compartilhado para cenários 3-12 ────────────────────────────────────

const rm      = new CRMReadModel();
const metrics = new CRMMetrics(rm);
const svc     = new CRMQueryService(rm, metrics);
rm.hydrate(TEST_DEALS);

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 1 — CRMQueryResult
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. CRMQueryResult cria generatedAt ────────────────────────────────────────

section(1, 'CRMQueryResult cria generatedAt com Date.now()');

const before1 = Date.now();
const result1 = new CRMQueryResult({ id: 'x' }, { query: 'test.1' });
const after1  = Date.now();

assert(typeof result1.generatedAt === 'number',    '1.1 generatedAt é número');
assert(result1.generatedAt >= before1,             '1.2 generatedAt >= timestamp antes da criação');
assert(result1.generatedAt <= after1,              '1.3 generatedAt <= timestamp depois da criação');
assert(result1.data.id === 'x',                    '1.4 data preservado no constructor');
assert(result1.metadata.query === 'test.1',        '1.5 metadata preservado no constructor');

// ── 2. CRMQueryResult.toJSON retorna estrutura padrão ─────────────────────────

section(2, 'CRMQueryResult.toJSON() retorna estrutura padrão com clones');

// Object data
const dataObj2 = { funil: 'venda_ufv', valor: 50000 };
const meta2    = { query: 'crm.test', extra: 'info' };
const result2  = new CRMQueryResult(dataObj2, meta2);
const json2    = result2.toJSON();

assert('data'        in json2, '2.1 json.data presente');
assert('metadata'    in json2, '2.2 json.metadata presente');
assert('generatedAt' in json2, '2.3 json.generatedAt presente');
assert(json2.data !== dataObj2,           '2.4 data é clone — não a referência original');
assert(json2.data.funil === 'venda_ufv',  '2.5 data.funil preservado');
assert(json2.metadata !== meta2,          '2.6 metadata é clone');
assert(json2.metadata.query === 'crm.test', '2.7 metadata.query preservado');
assert(json2.generatedAt === result2.generatedAt, '2.8 generatedAt consistente');

// Array data
const dataArr2  = [{ id: 'a' }, { id: 'b' }];
const resultArr = new CRMQueryResult(dataArr2, {});
const jsonArr   = resultArr.toJSON();
assert(Array.isArray(jsonArr.data),       '2.9 array data retorna array');
assert(jsonArr.data !== dataArr2,         '2.10 array é clone (novo array)');
assert(jsonArr.data.length === 2,         '2.11 comprimento do array preservado');

// Null data
const resultNull = new CRMQueryResult(null, { query: 'null-test' });
assert(resultNull.toJSON().data === null, '2.12 null data preservado em toJSON');

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 2 — Queries de Read Model
// ═════════════════════════════════════════════════════════════════════════════

// ── 3. getDeal retorna CRMQueryResult ─────────────────────────────────────────

section(3, 'getDeal() retorna CRMQueryResult com deal correto');

const r3 = svc.getDeal('deal-1');
assert(r3 instanceof CRMQueryResult,            '3.1 retorna instância de CRMQueryResult');
assert(r3.data !== null,                        '3.2 data não nulo para deal existente');
assert(r3.data.funil === 'venda_ufv',           '3.3 funil correto');
assert(r3.data.valor === 100000,                '3.4 valor correto');
assert(r3.metadata.query === 'crm.getDeal',     '3.5 metadata.query correto');
assert(r3.metadata.dealId === 'deal-1',         '3.6 metadata.dealId correto');

const r3null = svc.getDeal('nao-existe');
assert(r3null instanceof CRMQueryResult,        '3.7 retorna CRMQueryResult mesmo para deal inexistente');
assert(r3null.data === null,                    '3.8 data = null para deal inexistente');

// ── 4. searchDeals retorna Deals filtrados ────────────────────────────────────

section(4, 'searchDeals() retorna array de Deals com filtros aplicados');

const r4all = svc.searchDeals();
assert(r4all instanceof CRMQueryResult,         '4.1 retorna CRMQueryResult');
assert(Array.isArray(r4all.data),               '4.2 data é array');
assert(r4all.data.length === 4,                 '4.3 sem filtro retorna todos os 4 deals');

const r4ufv = svc.searchDeals({ funil: 'venda_ufv' });
assert(r4ufv.data.length === 3,                 '4.4 filtro por funil retorna 3 deals (venda_ufv)');
assert(r4ufv.data.every((d) => d.funil === 'venda_ufv'), '4.5 todos os deals filtrados são venda_ufv');

const r4vendido = svc.searchDeals({ status: 'Vendido' });
assert(r4vendido.data.length === 1,             '4.6 filtro por status Vendido retorna 1 deal');
assert(r4vendido.data[0].id === 'deal-2',       '4.7 deal Vendido é deal-2');

// ── 5. searchDeals metadata.count correto ─────────────────────────────────────

section(5, 'searchDeals() metadata.count reflete o número de deals retornados');

const r5 = svc.searchDeals({ responsavel: 'Lucas' });
assert(r5.metadata.count === r5.data.length,    '5.1 metadata.count === data.length');
assert(r5.metadata.count === 3,                 '5.2 Lucas tem 3 deals');
assert(r5.metadata.query === 'crm.searchDeals', '5.3 metadata.query correto');
assert(r5.metadata.filters.responsavel === 'Lucas', '5.4 filtro preservado em metadata');

// ── 6. getPipeline retorna pipeline ───────────────────────────────────────────

section(6, 'getPipeline() retorna estrutura funil → etapa');

const r6 = svc.getPipeline();
assert(r6 instanceof CRMQueryResult,              '6.1 retorna CRMQueryResult');
assert(typeof r6.data === 'object',               '6.2 data é objeto');
assert('venda_ufv' in r6.data,                    '6.3 funil venda_ufv presente');
assert('assinatura_energia' in r6.data,           '6.4 funil assinatura_energia presente');
assert('Proposta' in r6.data.venda_ufv,           '6.5 etapa Proposta presente em venda_ufv');
assert(r6.data.venda_ufv.Proposta.count === 2,    '6.6 2 deals em venda_ufv/Proposta (deal-1 e deal-4)');
assert(r6.metadata.query === 'crm.getPipeline',   '6.7 metadata.query correto');

// ── 7. getStatusSummary retorna status ────────────────────────────────────────

section(7, 'getStatusSummary() retorna total e byStatus corretos');

const r7 = svc.getStatusSummary();
assert(r7 instanceof CRMQueryResult,              '7.1 retorna CRMQueryResult');
assert(r7.data.total === 4,                       '7.2 total = 4');
assert(r7.data.byStatus['Em andamento'] === 1,    '7.3 Em andamento = 1');
assert(r7.data.byStatus['Vendido']      === 1,    '7.4 Vendido = 1');
assert(r7.data.byStatus['Perdido']      === 1,    '7.5 Perdido = 1');
assert(r7.data.byStatus['Pausado']      === 1,    '7.6 Pausado = 1');
assert(r7.metadata.query === 'crm.getStatusSummary', '7.7 metadata.query correto');

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 3 — Queries de Métricas
// ═════════════════════════════════════════════════════════════════════════════

// ── 8. getMetrics retorna conversion/win/loss/paused ─────────────────────────

section(8, 'getMetrics() retorna todos os campos de conversão e taxas');

const r8 = svc.getMetrics();
assert(r8 instanceof CRMQueryResult,        '8.1 retorna CRMQueryResult');
assert('conversion' in r8.data,             '8.2 campo conversion presente');
assert('winRate'    in r8.data,             '8.3 campo winRate presente');
assert('lossRate'   in r8.data,             '8.4 campo lossRate presente');
assert('pausedRate' in r8.data,             '8.5 campo pausedRate presente');
assert(!('forecast' in r8.data),            '8.6 forecast NÃO está em getMetrics (é query separada)');

// conversion: 1 Vendido / 4 total = 25%
assert(r8.data.conversion.total     === 4,  '8.7 conversion.total = 4');
assert(r8.data.conversion.converted === 1,  '8.8 conversion.converted = 1');
assert(r8.data.conversion.rate      === 25, '8.9 conversion.rate = 25');

// winRate: decided=2 (Vendido+Perdido), won=1 → 50%
assert(r8.data.winRate.decided === 2,       '8.10 winRate.decided = 2');
assert(r8.data.winRate.won     === 1,       '8.11 winRate.won = 1');
assert(r8.data.winRate.rate    === 50,      '8.12 winRate.rate = 50');

// lossRate: decided=2, lost=1 → 50%
assert(r8.data.lossRate.decided === 2,      '8.13 lossRate.decided = 2');
assert(r8.data.lossRate.lost    === 1,      '8.14 lossRate.lost = 1');
assert(r8.data.lossRate.rate    === 50,     '8.15 lossRate.rate = 50');

// pausedRate: 1 Pausado / 4 total = 25%
assert(r8.data.pausedRate.total  === 4,     '8.16 pausedRate.total = 4');
assert(r8.data.pausedRate.paused === 1,     '8.17 pausedRate.paused = 1');
assert(r8.data.pausedRate.rate   === 25,    '8.18 pausedRate.rate = 25');

assert(r8.metadata.query === 'crm.getMetrics', '8.19 metadata.query correto');

// ── 9. getForecast retorna forecast ──────────────────────────────────────────

section(9, 'getForecast() retorna totalValue e weightedValue corretos');

const r9 = svc.getForecast();
assert(r9 instanceof CRMQueryResult,              '9.1 retorna CRMQueryResult');
assert('totalValue'    in r9.data,                '9.2 campo totalValue presente');
assert('weightedValue' in r9.data,                '9.3 campo weightedValue presente');
assert('dealCount'     in r9.data,                '9.4 campo dealCount presente');

// totalValue: 100000 + 200000 + 50000 + 40000 = 390000
assert(r9.data.totalValue    === 390000,          '9.5 totalValue = 390000');

// weightedValue: 100000×0.50 + 200000×1.00 + 50000×0.00 + 40000×0.20
//              = 50000 + 200000 + 0 + 8000 = 258000
assert(r9.data.weightedValue === 258000,          '9.6 weightedValue = 258000');
assert(r9.data.dealCount     === 4,               '9.7 dealCount = 4');
assert(r9.metadata.query === 'crm.getForecast',   '9.8 metadata.query correto');

// ── 10. getExecutiveSummary retorna todas as seções ───────────────────────────

section(10, 'getExecutiveSummary() retorna pipeline, status e todas as métricas');

const r10 = svc.getExecutiveSummary();
assert(r10 instanceof CRMQueryResult,     '10.1 retorna CRMQueryResult');
assert('pipeline'   in r10.data,          '10.2 campo pipeline presente');
assert('status'     in r10.data,          '10.3 campo status presente');
assert('conversion' in r10.data,          '10.4 campo conversion presente');
assert('winRate'    in r10.data,          '10.5 campo winRate presente');
assert('lossRate'   in r10.data,          '10.6 campo lossRate presente');
assert('pausedRate' in r10.data,          '10.7 campo pausedRate presente');
assert('forecast'   in r10.data,          '10.8 campo forecast presente');

// Confirmar valores do executive summary
assert(r10.data.status.total      === 4,  '10.9 status.total = 4');
assert(r10.data.conversion.rate   === 25, '10.10 conversion.rate = 25');
assert(r10.data.winRate.rate      === 50, '10.11 winRate.rate = 50');
assert(r10.data.lossRate.rate     === 50, '10.12 lossRate.rate = 50');
assert(r10.data.pausedRate.rate   === 25, '10.13 pausedRate.rate = 25');
assert(r10.data.forecast.totalValue    === 390000, '10.14 forecast.totalValue = 390000');
assert(r10.data.forecast.weightedValue === 258000, '10.15 forecast.weightedValue = 258000');

assert(r10.metadata.query === 'crm.getExecutiveSummary', '10.16 metadata.query correto');

// ── 11. getExecutiveSummary metadata.dealCount correto ────────────────────────

section(11, 'getExecutiveSummary() metadata.dealCount reflete deals no filtro');

const r11all = svc.getExecutiveSummary();
assert(r11all.metadata.dealCount === 4,    '11.1 sem filtro dealCount = 4');

const r11lucas = svc.getExecutiveSummary({ responsavel: 'Lucas' });
assert(r11lucas.metadata.dealCount === 3,  '11.2 filtro Lucas dealCount = 3');
assert(r11lucas.metadata.filters.responsavel === 'Lucas', '11.3 filtro preservado em metadata');

// ── 12. Filtros são propagados para Read Model e Metrics ──────────────────────

section(12, 'Filtros são propagados corretamente para Read Model e Metrics');

const f12 = { responsavel: 'Lucas' };

// searchDeals com filtro Lucas
const r12deals = svc.searchDeals(f12);
assert(r12deals.data.length === 3,               '12.1 searchDeals: Lucas tem 3 deals');
assert(r12deals.data.every((d) => d.responsavel === 'Lucas'), '12.2 todos os deals são de Lucas');

// getStatusSummary com filtro Lucas (deals 1=Em andamento, 2=Vendido, 4=Pausado)
const r12status = svc.getStatusSummary(f12);
assert(r12status.data.total === 3,               '12.3 status.total = 3 para Lucas');
assert(r12status.data.byStatus['Vendido'] === 1, '12.4 Vendido = 1 para Lucas');
assert(!('Perdido' in r12status.data.byStatus),  '12.5 Perdido ausente (deal-3 não é Lucas)');

// getMetrics com filtro Lucas
const r12metrics = svc.getMetrics(f12);
assert(r12metrics.data.conversion.total === 3,   '12.6 conversion.total = 3 para Lucas');
assert(r12metrics.data.conversion.converted === 1, '12.7 conversion.converted = 1 para Lucas');

// getForecast com filtro Lucas
const r12forecast = svc.getForecast(f12);
// totalValue Lucas: 100000 + 200000 + 40000 = 340000
assert(r12forecast.data.totalValue === 340000,   '12.8 forecast.totalValue = 340000 para Lucas');
// weightedValue Lucas: 50000 + 200000 + 8000 = 258000
assert(r12forecast.data.weightedValue === 258000, '12.9 forecast.weightedValue = 258000 para Lucas');

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 4 — Validação de dependências
// ═════════════════════════════════════════════════════════════════════════════

// ── 13. getDeal funciona sem metrics válido ────────────────────────────────────

section(13, 'getDeal() funciona sem metrics válido — não valida o que não usa');

const rm13  = new CRMReadModel();
const svc13 = new CRMQueryService(rm13, null);
rm13.hydrate({ 'deal-13': { funil: 'eletromobilidade', valor: 77000 } });

const r13 = svc13.getDeal('deal-13');
assert(r13 instanceof CRMQueryResult,           '13.1 getDeal retorna CRMQueryResult sem metrics');
assert(r13.data !== null,                       '13.2 data não nulo');
assert(r13.data.funil === 'eletromobilidade',   '13.3 funil correto');

// searchDeals, getPipeline e getStatusSummary também funcionam sem metrics
const r13s = svc13.searchDeals();
assert(r13s.data.length === 1,                  '13.4 searchDeals funciona sem metrics');

// ── 14. query de metrics falha com erro claro sem metrics válido ──────────────

section(14, 'getMetrics() falha com TypeError claro quando metrics não disponível');

const svc14 = new CRMQueryService(new CRMReadModel(), null);

let err14 = null;
try { svc14.getMetrics(); } catch (e) { err14 = e; }

assert(err14 instanceof TypeError,                        '14.1 lança TypeError');
assert(err14.message.includes('[CRMQueryService]'),       '14.2 mensagem contém [CRMQueryService]');
assert(err14.message.includes('metrics must expose'),     '14.3 mensagem menciona "metrics must expose"');

// getForecast também falha
let err14f = null;
try { svc14.getForecast(); } catch (e) { err14f = e; }
assert(err14f instanceof TypeError,                       '14.4 getForecast também lança TypeError');
assert(err14f.message.includes('metrics must expose'),    '14.5 mensagem menciona "metrics must expose"');

// getExecutiveSummary falha
let err14e = null;
try { svc14.getExecutiveSummary(); } catch (e) { err14e = e; }
assert(err14e instanceof TypeError,                       '14.6 getExecutiveSummary lança TypeError');

// ── 15. query de readModel falha com erro claro sem readModel válido ──────────

section(15, 'getDeal() falha com TypeError claro quando readModel não disponível');

const rm15  = new CRMReadModel();
const svc15 = new CRMQueryService(null, new CRMMetrics(rm15));

let err15 = null;
try { svc15.getDeal('any'); } catch (e) { err15 = e; }

assert(err15 instanceof TypeError,                       '15.1 getDeal lança TypeError');
assert(err15.message.includes('[CRMQueryService]'),      '15.2 mensagem contém [CRMQueryService]');
assert(err15.message.includes('readModel must expose'),  '15.3 mensagem menciona "readModel must expose"');

// searchDeals também falha
let err15s = null;
try { svc15.searchDeals(); } catch (e) { err15s = e; }
assert(err15s instanceof TypeError,                      '15.4 searchDeals lança TypeError');

// getPipeline também falha
let err15p = null;
try { svc15.getPipeline(); } catch (e) { err15p = e; }
assert(err15p instanceof TypeError,                      '15.5 getPipeline lança TypeError');

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 5 — Singleton
// ═════════════════════════════════════════════════════════════════════════════

// ── 16. crmQueryService singleton usa crmReadModel e crmMetrics reais ─────────

section(16, 'crmQueryService singleton consulta crmReadModel e crmMetrics reais');

crmReadModel.clear();
crmReadModel.hydrate({
  'singleton-deal': {
    funil: 'venda_ufv', etapa: 'Negociação', status: 'Vendido',
    valor: 999000, responsavel: 'Teste', createdAt: 1000001, updatedAt: 1000002,
  },
});

const r16deal = crmQueryService.getDeal('singleton-deal');
assert(r16deal instanceof CRMQueryResult,         '16.1 getDeal via singleton retorna CRMQueryResult');
assert(r16deal.data !== null,                     '16.2 deal encontrado via singleton');
assert(r16deal.data.funil === 'venda_ufv',        '16.3 funil correto via singleton');
assert(r16deal.data.valor === 999000,             '16.4 valor correto via singleton');

const r16exec = crmQueryService.getExecutiveSummary();
assert(r16exec instanceof CRMQueryResult,         '16.5 getExecutiveSummary via singleton retorna CRMQueryResult');
assert(r16exec.metadata.dealCount === 1,          '16.6 dealCount = 1 (apenas singleton-deal)');
assert(r16exec.data.conversion.converted === 1,   '16.7 1 deal Vendido no readModel singleton');
assert(r16exec.data.forecast.totalValue === 999000, '16.8 forecast.totalValue = 999000');

const r16json = r16deal.toJSON();
assert('data'        in r16json, '16.9 toJSON() retorna estrutura padrão via singleton');
assert('metadata'    in r16json, '16.10 toJSON() inclui metadata');
assert('generatedAt' in r16json, '16.11 toJSON() inclui generatedAt');

// ═════════════════════════════════════════════════════════════════════════════
// Resultado final
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 16 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
