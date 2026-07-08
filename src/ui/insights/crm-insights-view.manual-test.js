/**
 * ESA OS — UI / Insights
 * Suite de testes de integração — CRMInsightsView
 * 28 cenários obrigatórios
 *
 * Execução: node src/ui/insights/crm-insights-view.manual-test.js
 *
 * Usa CRMReadModel, CRMMetrics e CRMQueryService reais (sem mocks).
 * Usa os mesmos 4 deals da suite do CRMQueryService.
 * Container fake: { innerHTML: '' }
 */

import { CRMReadModel }    from '../../read-models/crm/crm-read-model.js';
import { CRMMetrics }      from '../../read-models/crm/crm-metrics.js';
import { CRMQueryService } from '../../queries/crm/crm-query-service.js';
import { CRMInsightsView } from './crm-insights-view.js';

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
  console.log(`\n[${n}/28] ${title}`);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_DEALS = {
  'deal-1': { funil: 'venda_ufv', etapa: 'Proposta',     status: 'Em andamento', valor: 100000, responsavel: 'Lucas', createdAt: 1000001 },
  'deal-2': { funil: 'venda_ufv', etapa: 'Negociação',   status: 'Vendido',      valor: 200000, responsavel: 'Lucas', createdAt: 1000003 },
  'deal-3': { funil: 'assinatura_energia', etapa: 'Qualificação', status: 'Perdido', valor: 50000, kwh: 30000, responsavel: 'Outro', createdAt: 1000005 },
  'deal-4': { funil: 'venda_ufv', etapa: 'Proposta',     status: 'Pausado',      valor: 40000,  responsavel: 'Lucas', createdAt: 1000007 },
};

const rm      = new CRMReadModel();
const metrics = new CRMMetrics(rm);
const svc     = new CRMQueryService(rm, metrics);
rm.hydrate(TEST_DEALS);

// queryProvider espelha a interface window.ESA_OS exposta por ESAApplication
const queryProvider = {
  getCRMExecutiveSummary: (filters = {}) => svc.getExecutiveSummary(filters).toJSON(),
  searchCRMDeals:         (filters = {}) => svc.searchDeals(filters).toJSON(),
  queryCRMDeal:           (dealId)       => svc.getDeal(dealId).toJSON(),
};

const view      = new CRMInsightsView(queryProvider);
const container = { innerHTML: '' };

// ── 1. load() retorna ViewModel com shape correta ─────────────────────────────

section(1, 'load() retorna ViewModel com shape correta');

const vm1 = view.load();

assert(vm1 !== null && typeof vm1 === 'object', '1.1 load() retorna objeto');
assert(typeof vm1.generatedAt === 'number',     '1.2 generatedAt é number');
assert(typeof vm1.dealCount   === 'number',     '1.3 dealCount é number');
assert(Array.isArray(vm1.cards),                '1.4 cards é array');
assert(Array.isArray(vm1.pipeline),             '1.5 pipeline é array');
assert(Array.isArray(vm1.status),               '1.6 status é array');
assert(Array.isArray(vm1.forecast),             '1.7 forecast é array');

// ── 2. dealCount = 4 via metadata ─────────────────────────────────────────────

section(2, 'dealCount = 4 via metadata.dealCount');

const vm2 = view.load();

assert(vm2.dealCount === 4, '2.1 dealCount = 4');

// ── 3. cards.length = 6 ──────────────────────────────────────────────────────

section(3, 'cards possui 6 itens');

assert(vm1.cards.length === 6, '3.1 cards.length = 6');
assert(vm1.cards[0].id === 'deals',         '3.2 cards[0].id = deals');
assert(vm1.cards[1].id === 'conversion',    '3.3 cards[1].id = conversion');
assert(vm1.cards[2].id === 'winRate',       '3.4 cards[2].id = winRate');
assert(vm1.cards[3].id === 'lossRate',      '3.5 cards[3].id = lossRate');
assert(vm1.cards[4].id === 'pipelineValue', '3.6 cards[4].id = pipelineValue');
assert(vm1.cards[5].id === 'forecast',      '3.7 cards[5].id = forecast');

// ── 4. card deals: value = 4, format = number ────────────────────────────────

section(4, 'card[0] deals: value = 4, format = number');

const cardDeals = vm1.cards[0];

assert(cardDeals.value  === 4,        '4.1 value = 4');
assert(cardDeals.format === 'number', '4.2 format = number');
assert(cardDeals.label  === 'Total de Deals', '4.3 label correto');

// ── 5. cards de taxa: conversion=25, winRate=50, lossRate=50 ─────────────────

section(5, 'cards de taxa: conversion=25, winRate=50, lossRate=50');

assert(vm1.cards[1].value  === 25,       '5.1 conversion.value = 25');
assert(vm1.cards[1].format === 'percent','5.2 conversion.format = percent');
assert(vm1.cards[2].value  === 50,       '5.3 winRate.value = 50');
assert(vm1.cards[2].format === 'percent','5.4 winRate.format = percent');
assert(vm1.cards[3].value  === 50,       '5.5 lossRate.value = 50');
assert(vm1.cards[3].format === 'percent','5.6 lossRate.format = percent');

// ── 6. cards financeiros: pipelineValue=390000, forecast=258000 ──────────────

section(6, 'cards financeiros: pipelineValue=390000, forecast=258000');

assert(vm1.cards[4].value  === 390000,   '6.1 pipelineValue.value = 390000');
assert(vm1.cards[4].format === 'currency','6.2 pipelineValue.format = currency');
assert(vm1.cards[5].value  === 258000,   '6.3 forecast.value = 258000');
assert(vm1.cards[5].format === 'currency','6.4 forecast.format = currency');

// ── 7. pipeline.length = 2 ───────────────────────────────────────────────────

section(7, 'pipeline é array com 2 funis');

assert(vm1.pipeline.length === 2, '7.1 pipeline.length = 2');
assert(typeof vm1.pipeline[0].funil === 'string',   '7.2 pipeline[0].funil é string');
assert(Array.isArray(vm1.pipeline[0].stages),       '7.3 pipeline[0].stages é array');
assert(typeof vm1.pipeline[0].count      === 'number', '7.4 pipeline[0].count é number');
assert(typeof vm1.pipeline[0].totalValue === 'number', '7.5 pipeline[0].totalValue é number');

// ── 8. pipeline[0] = assinatura_energia (ordenação alfab.) ───────────────────

section(8, 'pipeline ordenado alfabeticamente por funil');

assert(vm1.pipeline[0].funil === 'assinatura_energia', '8.1 pipeline[0].funil = assinatura_energia');
assert(vm1.pipeline[1].funil === 'venda_ufv',          '8.2 pipeline[1].funil = venda_ufv');
assert(vm1.pipeline[0].count      === 1,               '8.3 assinatura_energia.count = 1');
assert(vm1.pipeline[0].totalValue === 50000,           '8.4 assinatura_energia.totalValue = 50000');
assert(vm1.pipeline[1].count      === 3,               '8.5 venda_ufv.count = 3');
assert(vm1.pipeline[1].totalValue === 340000,          '8.6 venda_ufv.totalValue = 340000');

// ── 9. stages de venda_ufv ordenados alfabeticamente ─────────────────────────

section(9, 'stages de venda_ufv ordenados alfabeticamente');

const ufvStages = vm1.pipeline[1].stages;

assert(ufvStages.length           === 2,           '9.1 venda_ufv.stages.length = 2');
assert(ufvStages[0].etapa         === 'Negociação', '9.2 stages[0].etapa = Negociação');
assert(ufvStages[0].count         === 1,           '9.3 Negociação.count = 1');
assert(ufvStages[0].totalValue    === 200000,      '9.4 Negociação.totalValue = 200000');
assert(ufvStages[1].etapa         === 'Proposta',  '9.5 stages[1].etapa = Proposta');
assert(ufvStages[1].count         === 2,           '9.6 Proposta.count = 2');
assert(ufvStages[1].totalValue    === 140000,      '9.7 Proposta.totalValue = 140000');

// ── 10. totalKwh e totais por funil ──────────────────────────────────────────

section(10, 'totalKwh e totais por funil corretos');

const aStagePipeline = vm1.pipeline[0];

assert(aStagePipeline.totalKwh              === 30000, '10.1 assinatura_energia.totalKwh = 30000');
assert(aStagePipeline.stages[0].totalKwh    === 30000, '10.2 Qualificação.totalKwh = 30000');
assert(vm1.pipeline[1].totalKwh             === 0,     '10.3 venda_ufv.totalKwh = 0');

// ── 11. status ordenado count DESC, depois alfabeticamente ───────────────────

section(11, 'status ordenado count DESC, depois alfab. (todos count=1 → alfab.)');

assert(vm1.status.length === 4, '11.1 status.length = 4');

const statusLabels = vm1.status.map((s) => s.status);
assert(statusLabels[0] === 'Em andamento', '11.2 status[0] = Em andamento');
assert(statusLabels[1] === 'Pausado',      '11.3 status[1] = Pausado');
assert(statusLabels[2] === 'Perdido',      '11.4 status[2] = Perdido');
assert(statusLabels[3] === 'Vendido',      '11.5 status[3] = Vendido');
assert(vm1.status.every((s) => s.count === 1), '11.6 todos count = 1');

// ── 12. status percent = count/total * 100 ───────────────────────────────────

section(12, 'status.percent = count/total * 100');

vm1.status.forEach((s) => {
  assert(s.percent === 25, `12.x ${s.status}.percent = 25`);
});
assert(vm1.status[0].percent === 25, '12.1 Em andamento.percent = 25');

// ── 13. forecast ordenado weightedValue DESC ─────────────────────────────────

section(13, 'forecast ordenado por weightedValue DESC');

assert(vm1.forecast.length                    === 4,        '13.1 forecast.length = 4');
assert(vm1.forecast[0].status                 === 'Vendido','13.2 forecast[0].status = Vendido');
assert(vm1.forecast[0].weightedValue          === 200000,   '13.3 forecast[0].weightedValue = 200000');
assert(vm1.forecast[1].status                 === 'Em andamento', '13.4 forecast[1].status = Em andamento');
assert(vm1.forecast[1].weightedValue          === 50000,    '13.5 forecast[1].weightedValue = 50000');
assert(vm1.forecast[2].status                 === 'Pausado','13.6 forecast[2].status = Pausado');
assert(vm1.forecast[2].weightedValue          === 8000,     '13.7 forecast[2].weightedValue = 8000');
assert(vm1.forecast[3].status                 === 'Perdido','13.8 forecast[3].status = Perdido');
assert(vm1.forecast[3].weightedValue          === 0,        '13.9 forecast[3].weightedValue = 0');

// ── 14. render() escreve innerHTML, retorna viewModel, getStats atualizado ────

section(14, 'render() escreve HTML, retorna viewModel e atualiza getStats');

const resultRender = view.render(container);

assert(resultRender !== null,                              '14.1 render() retorna viewModel (não null)');
assert(typeof resultRender === 'object',                   '14.2 retorno é objeto');
assert(resultRender.dealCount === 4,                       '14.3 retorno.dealCount = 4');
assert(container.innerHTML.length > 100,                   '14.4 container.innerHTML preenchido');
assert(container.innerHTML.includes('ESA OS Insights'),    '14.5 HTML contém título');
assert(container.innerHTML.includes('data-card-id="deals"'), '14.6 HTML contém card deals');

const stats14 = view.getStats();
assert(stats14.renderCount     === 1,                      '14.7 renderCount = 1');
assert(typeof stats14.lastGeneratedAt === 'number',        '14.8 lastGeneratedAt é number');
assert(stats14.lastDealCount   === 4,                      '14.9 lastDealCount = 4');
assert(stats14.lastError       === null,                   '14.10 lastError = null');

// ── 15. render() com 0 deals → empty state ───────────────────────────────────

section(15, 'render() com 0 deals → empty state');

const rmEmpty        = new CRMReadModel();
const metricsEmpty   = new CRMMetrics(rmEmpty);
const svcEmpty       = new CRMQueryService(rmEmpty, metricsEmpty);
const providerEmpty  = {
  getCRMExecutiveSummary: (filters = {}) => svcEmpty.getExecutiveSummary(filters).toJSON(),
  searchCRMDeals:         (filters = {}) => svcEmpty.searchDeals(filters).toJSON(),
  queryCRMDeal:           (dealId)       => svcEmpty.getDeal(dealId).toJSON(),
};
const viewEmpty      = new CRMInsightsView(providerEmpty);
const containerEmpty = { innerHTML: '' };

const resultEmpty = viewEmpty.render(containerEmpty);

assert(resultEmpty !== null,                                          '15.1 render retorna viewModel mesmo com 0 deals');
assert(resultEmpty.dealCount === 0,                                   '15.2 viewModel.dealCount = 0');
assert(containerEmpty.innerHTML.includes('Nenhum Deal disponível'),   '15.3 HTML contém mensagem empty state');
assert(!containerEmpty.innerHTML.includes('data-card-id'),            '15.4 HTML não contém cards no empty state');

// ── 16. render() com queryProvider inválido → error state, lastError registrado

section(16, 'render() com queryProvider inválido → error state, lastError set');

const badProvider = { getCRMExecutiveSummary: () => null };
const viewErr     = new CRMInsightsView(badProvider);
const containerErr = { innerHTML: '' };

const resultErr = viewErr.render(containerErr);

assert(resultErr === null,                                            '16.1 render() retorna null no erro');
assert(containerErr.innerHTML.includes('Não foi possível carregar'), '16.2 HTML contém mensagem de erro');

const statsErr = viewErr.getStats();
assert(statsErr.renderCount === 0,                                    '16.3 renderCount não incrementado no erro');
assert(statsErr.lastError !== null,                                   '16.4 lastError não é null');
assert(typeof statsErr.lastError.name    === 'string',                '16.5 lastError.name é string');
assert(typeof statsErr.lastError.message === 'string',                '16.6 lastError.message é string');
assert(statsErr.lastDealCount === null,                               '16.7 lastDealCount continua null após erro');

// ── 17. normalizeFilters remove vazios e converte from/to ─────────────────────

section(17, 'normalizeFilters remove vazios, trim strings e converte from/to para number');

const n17 = view._normalizeFilters({
  funil:      '  venda_ufv  ',
  status:     '',
  responsavel: null,
  from:       '1000001',
  to:         NaN,
});

assert(n17.funil === 'venda_ufv',      '17.1 funil trimado');
assert(!('status' in n17),             '17.2 status vazio removido');
assert(!('responsavel' in n17),        '17.3 responsavel null removido');
assert(n17.from === 1000001,           '17.4 from convertido para number');
assert(!('to' in n17),                 '17.5 to NaN removido');

const n17b = view._normalizeFilters({ funil: '   ', to: 0 });
assert(!('funil' in n17b), '17.6 funil somente espaços removido');
assert(n17b.to === 0,      '17.7 to=0 aceito (número válido — num() retorna 0, não null)');

const n17c = view._normalizeFilters({ from: 9999999, etapa: 'Proposta' });
assert(n17c.from === 9999999,  '17.8 from positivo aceito');
assert(!('etapa' in n17c),     '17.9 campo etapa não suportado ignorado');

// ── 18. setFilters e getActiveFilters usam snapshots ─────────────────────────

section(18, 'setFilters normaliza e armazena; getActiveFilters retorna cópia');

const returned18 = view.setFilters({ funil: '  venda_ufv  ', status: '' });

assert(returned18.funil === 'venda_ufv',   '18.1 setFilters retorna filtros normalizados');
assert(!('status' in returned18),          '18.2 status vazio não incluso no retorno');

const active18 = view.getActiveFilters();
assert(active18.funil === 'venda_ufv',     '18.3 getActiveFilters reflete filtro ativo');

active18.funil = 'MUTADO';
assert(view.getActiveFilters().funil === 'venda_ufv', '18.4 mutar retorno não altera estado interno');

// ── 19. clearFilters limpa filtros, drilldown e selectedDeal ─────────────────

section(19, 'clearFilters zera activeFilters, drilldown e selectedDeal');

// estado de entrada: activeFilters = { funil: 'venda_ufv' } (de 18)
const cleared19 = view.clearFilters();

assert(typeof cleared19 === 'object',                  '19.1 clearFilters retorna objeto');
assert(Object.keys(cleared19).length === 0,            '19.2 retorno é objeto vazio');
assert(Object.keys(view.getActiveFilters()).length === 0, '19.3 activeFilters esvaziado');
assert(view.getDrilldown().active === false,           '19.4 drilldown.active = false após clear');
assert(view.getSelectedDeal() === null,                '19.5 selectedDeal = null após clear');

// ── 20. View Model expõe activeFilters e filterOptions ───────────────────────

section(20, 'buildViewModel inclui activeFilters, filterOptions, drilldown e selectedDeal');

view.setFilters({ funil: 'venda_ufv' });
const vm20 = view.load(view.getActiveFilters());

assert('activeFilters' in vm20,                        '20.1 vm tem activeFilters');
assert('filterOptions' in vm20,                        '20.2 vm tem filterOptions');
assert('drilldown'     in vm20,                        '20.3 vm tem drilldown');
assert('selectedDeal'  in vm20,                        '20.4 vm tem selectedDeal');
assert(vm20.activeFilters.funil === 'venda_ufv',       '20.5 activeFilters.funil = venda_ufv');
assert(Array.isArray(vm20.filterOptions.funis),        '20.6 filterOptions.funis é array');
assert(Array.isArray(vm20.filterOptions.statuses),     '20.7 filterOptions.statuses é array');
assert(vm20.filterOptions.funis.includes('venda_ufv'), '20.8 funis inclui venda_ufv');
assert(vm20.dealCount === 3,                           '20.9 dealCount=3 com filtro funil=venda_ufv');
assert(vm20.selectedDeal === null,                     '20.10 selectedDeal null antes de selectDeal');

view.clearFilters();

// ── 21. render gera controles de filtro com data attributes ──────────────────

section(21, 'render gera seção de filtros com todos os data attributes obrigatórios');

const c21 = { innerHTML: '' };
view.render(c21);

assert(c21.innerHTML.includes('data-insights-filters'),          '21.1 contêiner de filtros presente');
assert(c21.innerHTML.includes('data-insights-filter="funil"'),   '21.2 select funil presente');
assert(c21.innerHTML.includes('data-insights-filter="status"'),  '21.3 select status presente');
assert(c21.innerHTML.includes('data-insights-filter="responsavel"'), '21.4 input responsavel presente');
assert(c21.innerHTML.includes('data-insights-filter="from"'),    '21.5 input data inicial presente');
assert(c21.innerHTML.includes('data-insights-filter="to"'),      '21.6 input data final presente');
assert(c21.innerHTML.includes('data-insights-action="apply-filters"'), '21.7 botão aplicar presente');
assert(c21.innerHTML.includes('data-insights-action="clear-filters"'), '21.8 botão limpar presente');

// ── 22. cards possuem data-insights-drilldown ─────────────────────────────────

section(22, 'cards possuem data-insights-drilldown corretos');

const c22 = { innerHTML: '' };
view.render(c22);

assert(c22.innerHTML.includes('data-insights-drilldown="all"'),  '22.1 cards com drilldown=all presentes');
assert(c22.innerHTML.includes('data-insights-drilldown="won"'),  '22.2 card conversion/winRate têm drilldown=won');
assert(c22.innerHTML.includes('data-insights-drilldown="lost"'), '22.3 card lossRate tem drilldown=lost');
// verificar cards individuais
assert(c22.innerHTML.includes('data-card-id="deals" data-insights-drilldown="all"'),       '22.4 deals → all');
assert(c22.innerHTML.includes('data-card-id="conversion" data-insights-drilldown="won"'),  '22.5 conversion → won');
assert(c22.innerHTML.includes('data-card-id="lossRate" data-insights-drilldown="lost"'),   '22.6 lossRate → lost');
assert(c22.innerHTML.includes('data-card-id="pipelineValue" data-insights-drilldown="all"'), '22.7 pipelineValue → all');
assert(c22.innerHTML.includes('data-card-id="forecast" data-insights-drilldown="all"'),    '22.8 forecast → all');

// ── 23. pipeline e status possuem data attributes de drill-down ───────────────

section(23, 'pipeline e status possuem data-insights-funil, etapa e status');

const c23 = { innerHTML: '' };
view.render(c23);

assert(c23.innerHTML.includes('data-insights-funil="venda_ufv"'),              '23.1 data-insights-funil=venda_ufv');
assert(c23.innerHTML.includes('data-insights-funil="assinatura_energia"'),     '23.2 data-insights-funil=assinatura_energia');
assert(c23.innerHTML.includes('data-insights-etapa="Proposta"'),               '23.3 data-insights-etapa=Proposta');
assert(c23.innerHTML.includes('data-insights-etapa="Negociação"'),             '23.4 data-insights-etapa=Negociação');
assert(c23.innerHTML.includes('data-insights-etapa-funil="venda_ufv"'),        '23.5 data-insights-etapa-funil=venda_ufv');
assert(c23.innerHTML.includes('data-insights-status="Em andamento"'),          '23.6 data-insights-status=Em andamento');
assert(c23.innerHTML.includes('data-insights-status="Vendido"'),               '23.7 data-insights-status=Vendido');
assert(c23.innerHTML.includes('data-insights-status="Perdido"'),               '23.8 data-insights-status=Perdido');

// ── 24. loadDrilldown mescla activeFilters com filtros específicos ────────────

section(24, 'loadDrilldown mescla activeFilters + filtros específicos, prioridade no específico');

view.setFilters({ responsavel: 'Lucas' });
const dd24 = view.loadDrilldown('Deals Vendidos', { status: 'Vendido' });

assert(dd24.active === true,               '24.1 drilldown.active = true');
assert(dd24.title  === 'Deals Vendidos',   '24.2 título correto');
assert(dd24.filters.responsavel === 'Lucas', '24.3 filtro base responsavel mantido');
assert(dd24.filters.status === 'Vendido',  '24.4 filtro específico status aplicado');
assert(dd24.deals.length === 1,            '24.5 apenas 1 deal (deal-2: Lucas + Vendido)');
assert(dd24.deals[0].id === 'deal-2',      '24.6 deal retornado é deal-2');

const stats24 = view.getStats();
assert(stats24.drilldownDealCount === 1,   '24.7 getStats().drilldownDealCount = 1');

view.clearFilters();

// ── 25. getDrilldown retorna snapshot sem expor referências internas ──────────

section(25, 'getDrilldown retorna snapshot imutável');

view.loadDrilldown('Pipeline venda_ufv', { funil: 'venda_ufv' });
const dd25 = view.getDrilldown();

assert(dd25.active === true,               '25.1 drilldown.active = true');
assert(dd25.deals.length === 3,            '25.2 3 deals em venda_ufv');
assert(dd25.filters.funil === 'venda_ufv', '25.3 filters.funil = venda_ufv');

// mutar deals do snapshot não altera interno
const prevLen = dd25.deals.length;
dd25.deals.push({ id: 'fake' });
assert(view.getDrilldown().deals.length === prevLen, '25.4 mutar deals não altera interno');

// mutar filters do snapshot não altera interno
dd25.filters.funil = 'MUTADO';
assert(view.getDrilldown().filters.funil === 'venda_ufv', '25.5 mutar filters não altera interno');

view.clearFilters();

// ── 26. selectDeal consulta queryCRMDeal e preserva selectedDeal ──────────────

section(26, 'selectDeal consulta queryCRMDeal e getSelectedDeal retorna cópia');

view.loadDrilldown('Todos', {});
const deal26 = view.selectDeal('deal-2');

assert(deal26 !== null,                    '26.1 selectDeal retorna deal (não null)');
assert(deal26.id     === 'deal-2',         '26.2 deal.id = deal-2');
assert(deal26.status === 'Vendido',        '26.3 deal.status = Vendido');
assert(deal26.valor  === 200000,           '26.4 deal.valor = 200000');

// mutar retorno não altera getSelectedDeal()
deal26.status = 'MUTADO';
assert(view.getSelectedDeal().status === 'Vendido', '26.5 mutar retorno não altera interno');

const stats26 = view.getStats();
assert(stats26.selectedDealId === 'deal-2', '26.6 getStats().selectedDealId = deal-2');

// ── 27. render exibe tabela de Deals e detalhe do Deal ───────────────────────

section(27, 'render exibe seção de drilldown e detalhe do Deal quando ativos');

// Estado: drilldown ativo com 4 deals (de loadDrilldown em 26), selectedDeal = deal-2
const c27 = { innerHTML: '' };
view.render(c27);

assert(c27.innerHTML.includes('Deals analisados'),              '27.1 HTML contém "Deals analisados"');
assert(c27.innerHTML.includes('Detalhe do Deal'),               '27.2 HTML contém "Detalhe do Deal"');
assert(c27.innerHTML.includes('data-insights-deal-id="deal-2"'), '27.3 HTML contém data-insights-deal-id=deal-2');
assert(c27.innerHTML.includes('Vendido'),                       '27.4 HTML contém status Vendido');

view.clearFilters();

// ── 28. escapeHTML protege textos dinâmicos de XSS ───────────────────────────

section(28, 'escapeHTML impede XSS em funil, etapa, status, responsavel e nome');

const rmXSS     = new CRMReadModel();
const mXSS      = new CRMMetrics(rmXSS);
const sXSS      = new CRMQueryService(rmXSS, mXSS);
rmXSS.hydrate({
  'deal-xss': {
    funil:      '<script>bad()</script>',
    etapa:      '<b>Etapa</b>',
    status:     'Em andamento',
    valor:      1000,
    responsavel: '" onclick="bad()"',
    nome:       '<img src=x onerror=bad()>',
    createdAt:  1,
  },
});
const providerXSS = {
  getCRMExecutiveSummary: (f = {}) => sXSS.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:         (f = {}) => sXSS.searchDeals(f).toJSON(),
  queryCRMDeal:           (id)     => sXSS.getDeal(id).toJSON(),
};
const viewXSS      = new CRMInsightsView(providerXSS);
const containerXSS = { innerHTML: '' };

viewXSS.loadDrilldown('XSS Test', {});
viewXSS.selectDeal('deal-xss');
viewXSS.render(containerXSS);

const html28 = containerXSS.innerHTML;

assert(!html28.includes('<script>bad()'),          '28.1 script tag não presente no HTML');
assert(!html28.includes('<img src=x onerror=bad()>'), '28.2 img xss tag não presente');
assert(!html28.includes('onclick="bad()"'),        '28.3 onclick não presente');
assert(html28.includes('&lt;'),                    '28.4 entidades HTML escapadas presentes (&lt;)');
assert(html28.includes('&quot;'),                  '28.5 aspas escapadas (&quot;) presentes');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 28 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
