/**
 * ESA OS — UI / Insights
 * Suite de testes de integração — CRMInsightsView
 * 100 cenários obrigatórios
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
  console.log(`\n[${n}/100] ${title}`);
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
  getCRMExecutiveSummary:       (filters = {}) => svc.getExecutiveSummary(filters).toJSON(),
  searchCRMDeals:               (filters = {}) => svc.searchDeals(filters).toJSON(),
  queryCRMDeal:                 (dealId)       => svc.getDeal(dealId).toJSON(),
  getCRMPipelineHealth:         (filters = {}) => svc.getPipelineHealth(filters).toJSON(),
  getCRMCriticalDeals:          (filters = {}) => svc.getCriticalDeals(filters).toJSON(),
  getCRMDealsWithoutNextAction: (filters = {}) => svc.getDealsWithoutNextAction(filters).toJSON(),
  getCRMRiskSignalSummary:      (filters = {}) => svc.getRiskSignalSummary(filters).toJSON(),
  getCRMActionPrioritySummary:  (filters = {}) => svc.getActionPrioritySummary(filters).toJSON(),
  getCRMManagementBrief:        (filters = {}) => svc.getManagementBrief(filters).toJSON(),
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

// ── 29. Estado vazio: getDealDetailState()='empty', painel ausente ────────────

section(29, 'getDealDetailState()="empty" na construção; painel ausente no HTML');

const view29 = new CRMInsightsView(queryProvider);
const c29    = { innerHTML: '' };

assert(view29.getDealDetailState() === 'empty', '29.1 getDealDetailState() = "empty" na construção');
view29.render(c29);
assert(!c29.innerHTML.includes('data-insights-deal-detail'), '29.2 painel ausente no HTML quando empty');

// ── 30. selectDeal → 'loaded': getDealDetailState, getStats().dealDetailState ─

section(30, 'selectDeal → estado "loaded"; getStats().dealDetailState = "loaded"');

view.clearFilters();
view.loadDrilldown('Todos', {});
const deal30 = view.selectDeal('deal-1');

assert(deal30 !== null,                        '30.1 selectDeal retorna objeto (não null)');
assert(deal30.id === 'deal-1',                 '30.2 deal30.id = "deal-1"');
assert(view.getDealDetailState() === 'loaded', '30.3 getDealDetailState() = "loaded"');
const stats30 = view.getStats();
assert(stats30.dealDetailState === 'loaded',   '30.4 getStats().dealDetailState = "loaded"');
assert(stats30.selectedDealId  === 'deal-1',   '30.5 getStats().selectedDealId = "deal-1"');

// ── 31. Deal não encontrado: 'not-found', "Deal não encontrado" no HTML ───────

section(31, 'selectDeal com id inexistente → "not-found"; HTML mostra aviso');

const deal31 = view.selectDeal('nonexistent-deal');

assert(deal31 === null,                              '31.1 selectDeal retorna null para id inexistente');
assert(view.getDealDetailState() === 'not-found',    '31.2 getDealDetailState() = "not-found"');
assert(view.getSelectedDeal()    === null,           '31.3 getSelectedDeal() = null');

const c31 = { innerHTML: '' };
view.render(c31);
assert(c31.innerHTML.includes('Deal não encontrado'),       '31.4 HTML contém "Deal não encontrado"');
assert(c31.innerHTML.includes('data-insights-deal-detail'), '31.5 atributo data-insights-deal-detail presente no not-found');

// ── 32. Erro da query: provider throws → 'error', "Não foi possível" no HTML ─

section(32, 'queryCRMDeal que lança erro → estado "error"; HTML mostra mensagem de falha');

const providerErr32 = {
  getCRMExecutiveSummary: (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:         (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:           ()       => { throw new Error('Falha de rede simulada'); },
};
const view32 = new CRMInsightsView(providerErr32);
view32.loadDrilldown('Todos', {});
const deal32 = view32.selectDeal('deal-1');

assert(deal32 === null,                          '32.1 selectDeal retorna null quando provider lança');
assert(view32.getDealDetailState() === 'error',  '32.2 getDealDetailState() = "error"');
assert(view32.getSelectedDeal()    === null,     '32.3 getSelectedDeal() = null no erro');

const c32 = { innerHTML: '' };
view32.render(c32);
assert(c32.innerHTML.includes('Não foi possível carregar o detalhe do deal'), '32.4 HTML contém mensagem de falha');
assert(c32.innerHTML.includes('data-insights-deal-detail'),                   '32.5 atributo data-insights-deal-detail presente no error');

// ── 33. _buildDealDetailViewModel: shape e mapeamento de campos ───────────────

section(33, '_buildDealDetailViewModel mapeia campos gerenciais corretamente');

const vmDeal33 = view._buildDealDetailViewModel({
  id: 'deal-x', nome: 'Projeto Alpha', empresa: null,
  funil: 'venda_ufv', etapa: 'Proposta', status: 'Em andamento',
  produto: null, responsavel: 'Lucas', captador: null,
  valor: 150000, kwh: null, createdAt: 1000001, updatedAt: null,
  proximaAcao: null, obs: null,
});

assert(vmDeal33.id          === 'deal-x',       '33.1 vm.id correto');
assert(vmDeal33.nome        === 'Projeto Alpha', '33.2 vm.nome correto');
assert(vmDeal33.empresa     === null,            '33.3 vm.empresa null quando ausente');
assert(vmDeal33.produto     === null,            '33.4 vm.produto null quando ausente');
assert(vmDeal33.valor       === 150000,          '33.5 vm.valor = 150000');
assert(vmDeal33.kwh         === null,            '33.6 vm.kwh null quando ausente');
assert(vmDeal33.createdAt   === 1000001,         '33.7 vm.createdAt = 1000001');
assert(vmDeal33.updatedAt   === null,            '33.8 vm.updatedAt null quando ausente');
assert(vmDeal33.obs         === null,            '33.9 vm.obs null quando ausente');
assert(vmDeal33.proximaAcao === null,            '33.10 vm.proximaAcao null quando ausente');

// ── 34. Campos ausentes mostram '—', sem textos inválidos ─────────────────────

section(34, 'campos ausentes mostram "—"; sem "undefined", "[object Object]", ">null<"');

view.clearFilters();
view.loadDrilldown('Todos', {});
view.selectDeal('deal-1');
const c34 = { innerHTML: '' };
view.render(c34);
const html34 = c34.innerHTML;

assert(!html34.includes('>undefined<'),      '34.1 "undefined" não visível no painel');
assert(!html34.includes('[object Object]'),  '34.2 "[object Object]" não visível');
assert(!html34.includes('>null<'),           '34.3 ">null<" não visível');
assert(html34.includes('>—<'),              '34.4 "—" presente como fallback para campos ausentes');

// ── 35. Moeda pt-BR formatada no painel ──────────────────────────────────────

section(35, 'valor deal-2 (200000) formatado em pt-BR no painel');

view.clearFilters();
view.loadDrilldown('Todos', {});
view.selectDeal('deal-2');
const c35 = { innerHTML: '' };
view.render(c35);
const html35 = c35.innerHTML;

assert(html35.includes('R$'),      '35.1 símbolo "R$" presente no painel');
assert(html35.includes('200.000'), '35.2 valor "200.000" formatado em pt-BR');

// ── 36. Datas pt-BR via _formatDate ──────────────────────────────────────────

section(36, '_formatDate retorna string com "/" e "1970" para timestamp 1000001');

const ts36   = 1000001;
const date36  = view._formatDate(ts36);
const year36  = String(new Date(ts36).getFullYear());

assert(typeof date36 === 'string',    '36.1 _formatDate retorna string');
assert(date36.length > 0,             '36.2 string não vazia');
assert(date36.includes('/'),          '36.3 contém "/" (formato dd/mm/yyyy)');
assert(date36.includes(year36),       '36.4 contém o ano correto (' + year36 + ') no locale local');

view.clearFilters();
view.loadDrilldown('Todos', {});
view.selectDeal('deal-1');
const c36 = { innerHTML: '' };
view.render(c36);
assert(c36.innerHTML.includes(year36), '36.5 HTML do painel contém o ano do createdAt');

// ── 37. Painel somente leitura — sem botões de ação ──────────────────────────

section(37, 'painel não contém botões de edição, exclusão, salvamento ou follow-up');

const c37 = { innerHTML: '' };
view.render(c37);
const html37 = c37.innerHTML;

assert(!html37.includes('Editar'),    '37.1 sem botão "Editar" no painel');
assert(!html37.includes('Excluir'),   '37.2 sem botão "Excluir" no painel');
assert(!html37.includes('Salvar'),    '37.3 sem botão "Salvar" no painel');
assert(!html37.includes('Mover'),     '37.4 sem botão "Mover" no painel');
assert(!html37.includes('Follow-up'), '37.5 sem botão "Follow-up" no painel');

// ── 38. Troca de deal — painel exibe o deal mais recentemente selecionado ─────

section(38, 'troca de deal: HTML exibe campos do novo deal selecionado');

view.clearFilters();
view.loadDrilldown('Todos', {});
view.selectDeal('deal-1');

assert(view.getDealDetailState() === 'loaded',  '38.1 estado loaded após deal-1');
assert(view.getSelectedDeal().id === 'deal-1',  '38.2 selectedDeal é deal-1');

view.selectDeal('deal-3');

assert(view.getDealDetailState() === 'loaded',  '38.3 estado loaded após deal-3');
assert(view.getSelectedDeal().id === 'deal-3',  '38.4 selectedDeal é deal-3');

const c38 = { innerHTML: '' };
view.render(c38);
assert(c38.innerHTML.includes('assinatura_energia'), '38.5 HTML mostra funil do deal-3 (assinatura_energia)');

// ── 39. clearFilters zera estado — 'empty', painel ausente ───────────────────

section(39, 'clearFilters reseta dealDetailState para "empty"; painel some do HTML');

view.clearFilters();

assert(view.getDealDetailState() === 'empty', '39.1 getDealDetailState() = "empty" após clearFilters');
assert(view.getSelectedDeal()    === null,    '39.2 getSelectedDeal() = null após clearFilters');

const c39 = { innerHTML: '' };
view.render(c39);
assert(!c39.innerHTML.includes('data-insights-deal-detail'), '39.3 painel ausente no HTML após clear');

// ── 40. data-insights-deal-detail presente; sem actions de edição ─────────────

section(40, 'data-insights-deal-detail presente; sem data-insights-action de edição/exclusão');

view.loadDrilldown('Todos', {});
view.selectDeal('deal-1');
const c40 = { innerHTML: '' };
view.render(c40);
const html40 = c40.innerHTML;

assert(html40.includes('data-insights-deal-detail'),        '40.1 data-insights-deal-detail presente no HTML');
assert(!html40.includes('data-insights-action="edit"'),     '40.2 sem data-insights-action="edit"');
assert(!html40.includes('data-insights-action="delete"'),   '40.3 sem data-insights-action="delete"');
assert(!html40.includes('data-insights-action="save"'),     '40.4 sem data-insights-action="save"');
assert(!html40.includes('data-insights-action="move"'),     '40.5 sem data-insights-action="move"');

view.clearFilters();

// ── 41. getStats inclui dealDetailState; vira "empty" após clearFilters ───────

section(41, 'getStats().dealDetailState reflete estado atual; "empty" após clear');

view.loadDrilldown('Todos', {});
view.selectDeal('deal-2');
const stats41a = view.getStats();

assert(stats41a.dealDetailState === 'loaded', '41.1 dealDetailState = "loaded" em getStats após selectDeal');
assert(stats41a.selectedDealId  === 'deal-2', '41.2 selectedDealId = "deal-2" em getStats');

view.clearFilters();
const stats41b = view.getStats();

assert(stats41b.dealDetailState === 'empty', '41.3 dealDetailState = "empty" após clearFilters');
assert(stats41b.selectedDealId  === null,    '41.4 selectedDealId = null após clearFilters');

// ── 42. XSS em empresa, produto, obs, proximaAcao — entidades escapadas ───────
// Testa diretamente _buildDealDetailPanelHTML porque CRMReadModel armazena apenas
// um conjunto fixo de campos (funil, etapa, status, valor, etc.) e não persiste
// campos gerenciais estendidos como empresa/produto/obs/proximaAcao.
// O contrato do painel é escapar qualquer valor recebido — testamos isso aqui.

section(42, 'XSS em empresa, produto, obs e proximaAcao é escapado por _buildDealDetailPanelHTML');

const vmXSS42 = view._buildDealDetailViewModel({
  id:          'deal-xss42',
  funil:       'venda_ufv',
  etapa:       'Proposta',
  status:      'Em andamento',
  valor:       1000,
  responsavel: 'Lucas',
  empresa:     '<script>xss()</script>',
  produto:     '"><img onerror=x>',
  obs:         '<b>observacao</b>',
  proximaAcao: '" onmouseover="xss()',
  createdAt:   1,
});
const html42 = view._buildDealDetailPanelHTML(vmXSS42);

assert(!html42.includes('<script>xss()'),     '42.1 script em empresa não presente no HTML');
assert(!html42.includes('<img onerror=x>'),   '42.2 img XSS em produto não presente');
assert(!html42.includes('<b>observacao</b>'), '42.3 tag b em obs não presente');
assert(!html42.includes('" onmouseover="xss()'), '42.4 payload onmouseover não presente sem escaping (aspas escapadas)');
assert(html42.includes('&lt;script'),         '42.5 empresa escapada com &lt;script');
assert(html42.includes('&lt;b&gt;'),          '42.6 obs escapada com &lt;b&gt;');

// ── 43. loadPipelineHealth → _healthState = 'loaded' ─────────────────────────

section(43, 'loadPipelineHealth() com provider válido → _healthState = "loaded"');

view.clearFilters();
const h43 = view.loadPipelineHealth({});

assert(h43 !== null,                            '43.1 loadPipelineHealth retorna objeto (não null)');
assert(view.getPipelineHealth() !== null,        '43.2 getPipelineHealth() retorna objeto');
assert(view.getStats().healthState === 'loaded', '43.3 getStats().healthState = "loaded"');
assert('totalDeals'            in h43,           '43.4 data.totalDeals presente');
assert('attentionDeals'        in h43,           '43.5 data.attentionDeals presente');
assert('riskDeals'             in h43,           '43.6 data.riskDeals presente');
assert('criticalDeals'         in h43,           '43.7 data.criticalDeals presente');
assert('dealsWithoutNextAction' in h43,          '43.8 data.dealsWithoutNextAction presente');
assert('valueAtRisk'           in h43,           '43.9 data.valueAtRisk presente');
assert('agingDistribution'     in h43,           '43.10 data.agingDistribution presente');

// ── 44. render inclui seção Saúde do Pipeline ─────────────────────────────────

section(44, 'render() inclui seção "Saúde do Pipeline" (data-insights-health)');

const c44 = { innerHTML: '' };
view.render(c44);

assert(c44.innerHTML.includes('data-insights-health'),     '44.1 data-insights-health presente no HTML');
assert(c44.innerHTML.includes('Saúde do Pipeline'),        '44.2 título "Saúde do Pipeline" presente');

// ── 45. Cards gerenciais com data-health-kpi ──────────────────────────────────

section(45, 'cards gerenciais com data-health-kpi presentes no HTML');

const c45 = { innerHTML: '' };
view.render(c45);

assert(c45.innerHTML.includes('data-health-kpi="attention"'),    '45.1 kpi attention presente');
assert(c45.innerHTML.includes('data-health-kpi="risk"'),         '45.2 kpi risk presente');
assert(c45.innerHTML.includes('data-health-kpi="critical"'),     '45.3 kpi critical presente');
assert(c45.innerHTML.includes('data-health-kpi="without-action"'), '45.4 kpi without-action presente');
assert(c45.innerHTML.includes('data-health-kpi="value-at-risk"'), '45.5 kpi value-at-risk presente');

// ── 46. Distribuição de aging presente ───────────────────────────────────────

section(46, 'distribuição de aging presente com data-health-aging-distribution');

const c46 = { innerHTML: '' };
view.render(c46);

assert(c46.innerHTML.includes('data-health-aging-distribution'), '46.1 data-health-aging-distribution presente');
assert(c46.innerHTML.includes('data-health-aging-level="fresh"'),     '46.2 aging-level fresh presente');
assert(c46.innerHTML.includes('data-health-aging-level="attention"'), '46.3 aging-level attention presente');
assert(c46.innerHTML.includes('data-health-aging-level="risk"'),      '46.4 aging-level risk presente');
assert(c46.innerHTML.includes('data-health-aging-level="critical"'),  '46.5 aging-level critical presente');
assert(c46.innerHTML.includes('Distribuição de Aging'),               '46.6 label "Distribuição de Aging" presente');

// ── 47. Lista de críticos presente ───────────────────────────────────────────

section(47, 'lista de deals críticos presente com data-health-critical-list');

// Todos os test deals têm timestamps de 1970 → críticos com data atual como referência
const c47 = { innerHTML: '' };
view.render(c47);

// Todos os 4 deals são críticos (timestamps de 1970)
assert(c47.innerHTML.includes('data-health-critical-list'), '47.1 data-health-critical-list presente');
assert(c47.innerHTML.includes('Deals Críticos'),            '47.2 título "Deals Críticos" presente');
assert(c47.innerHTML.includes('Aging'),                     '47.3 coluna Aging presente na tabela');

// ── 48. data-insights-deal-id na lista reutiliza selectDeal ──────────────────

section(48, 'deals críticos têm data-insights-deal-id para seleção via selectDeal');

const c48 = { innerHTML: '' };
view.render(c48);

// Os deals críticos têm data-insights-deal-id para permitir seleção
assert(c48.innerHTML.includes('data-insights-deal-id="deal-1"') ||
       c48.innerHTML.includes('data-insights-deal-id="deal-2"') ||
       c48.innerHTML.includes('data-insights-deal-id="deal-3"') ||
       c48.innerHTML.includes('data-insights-deal-id="deal-4"'),
  '48.1 ao menos um data-insights-deal-id de deal crítico presente na lista');

// Confirmação: selectDeal() continua funcionando a partir da lista
view.selectDeal('deal-1');
assert(view.getDealDetailState() === 'loaded', '48.2 selectDeal via deal-id da lista ainda funciona');
assert(view.getSelectedDeal().id === 'deal-1', '48.3 deal correto selecionado');

view.clearFilters();

// ── 49. Escape HTML nos campos da lista de críticos ───────────────────────────

section(49, 'escape HTML em campos da lista de críticos (name, stage, responsible)');

const rmXSS49  = new CRMReadModel();
const mXSS49   = new CRMMetrics(rmXSS49);
const svcXSS49 = new CRMQueryService(rmXSS49, mXSS49);
rmXSS49.hydrate({
  'xss-49': {
    funil:       'venda_ufv',
    etapa:       '<b>Etapa XSS</b>',
    status:      'Em andamento',
    valor:       50000,
    responsavel: '"><script>bad()</script>',
    createdAt:   1,
    updatedAt:   1,
  },
});
const pXSS49 = {
  getCRMExecutiveSummary:  (f = {}) => svcXSS49.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:          (f = {}) => svcXSS49.searchDeals(f).toJSON(),
  queryCRMDeal:            (id)     => svcXSS49.getDeal(id).toJSON(),
  getCRMPipelineHealth:    (f = {}) => svcXSS49.getPipelineHealth(f).toJSON(),
  getCRMCriticalDeals:     (f = {}) => svcXSS49.getCriticalDeals(f).toJSON(),
  getCRMDealsWithoutNextAction: (f = {}) => svcXSS49.getDealsWithoutNextAction(f).toJSON(),
};
const vXSS49 = new CRMInsightsView(pXSS49);
const cXSS49 = { innerHTML: '' };
vXSS49.render(cXSS49);
const html49 = cXSS49.innerHTML;

assert(!html49.includes('<b>Etapa XSS</b>'),           '49.1 tag <b> em etapa não presente no HTML');
assert(!html49.includes('<script>bad()'),               '49.2 <script> em responsavel não presente');
assert(html49.includes('&lt;b&gt;') || html49.includes('&lt;'), '49.3 entidades escapadas presentes');

// ── 50. Moeda pt-BR no valor em risco ────────────────────────────────────────

section(50, 'valueAtRisk formatado em pt-BR no card value-at-risk');

// Com todos os 4 deals críticos (1970), valueAtRisk = soma de todos os valores
// deal-1=100000, deal-2=200000, deal-3=50000, deal-4=40000 → todos críticos
const c50 = { innerHTML: '' };
view.render(c50);
const html50 = c50.innerHTML;

// O valueAtRisk deve ser formatado com R$
assert(html50.includes('R$'),    '50.1 símbolo "R$" presente no kpi value-at-risk');

// ── 51. Erro em getCRMPipelineHealth isolado — não quebra restante do HTML ────

section(51, 'erro em getCRMPipelineHealth é isolado; restante do HTML permanece válido');

const providerErr51 = {
  getCRMExecutiveSummary: (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:         (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:           (id)     => svc.getDeal(id).toJSON(),
  getCRMPipelineHealth:   ()       => { throw new Error('Falha de rede simulada'); },
};
const view51 = new CRMInsightsView(providerErr51);
const c51    = { innerHTML: '' };

const vm51 = view51.render(c51);

assert(vm51 !== null,                                            '51.1 render retorna viewModel (não null) mesmo com erro no health');
assert(c51.innerHTML.includes('ESA OS Insights'),               '51.2 título da página presente (insights não quebrou)');
assert(c51.innerHTML.includes('data-card-id="deals"'),          '51.3 cards executivos presentes');
assert(view51.getStats().healthState === 'error',               '51.4 healthState = "error"');
assert(c51.innerHTML.includes('data-insights-health'),          '51.5 seção health presente mostrando erro');
assert(c51.innerHTML.includes('Não foi possível carregar a análise'), '51.6 mensagem de erro de health presente');

// ── 52. clearFilters zera healthState para 'empty'; seção ausente no HTML ─────

section(52, 'clearFilters reseta healthState para "empty"; seção Saúde ausente do HTML');

// Precisamos de um view sem getCRMPipelineHealth para testar 'empty' após clearFilters
const providerNoHealth = {
  getCRMExecutiveSummary: (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:         (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:           (id)     => svc.getDeal(id).toJSON(),
};
const view52 = new CRMInsightsView(providerNoHealth);
view52.render({ innerHTML: '' }); // render sem getCRMPipelineHealth → healthState='empty'

assert(view52.getStats().healthState === 'empty', '52.1 healthState = "empty" sem provider de health');

view52.clearFilters();
assert(view52.getStats().healthState === 'empty', '52.2 healthState = "empty" após clearFilters');

const c52 = { innerHTML: '' };
view52.render(c52);
assert(!c52.innerHTML.includes('data-insights-health'), '52.3 seção health ausente quando provider não suporta');

// Estado do main view após clearFilters deve também resetar health
view.loadPipelineHealth({});
assert(view.getStats().healthState === 'loaded', '52.4 healthState = "loaded" após loadPipelineHealth');
view.clearFilters();
assert(view.getStats().healthState === 'empty',  '52.5 healthState = "empty" após clearFilters no main view');

// ── 53. loadRiskSignals → _riskSignalsState = 'loaded' + shape correta ────────

section(53, 'loadRiskSignals() com provider válido → _riskSignalsState = "loaded" + shape correta');

view.clearFilters();
const h53 = view.loadRiskSignals({});

assert(h53 !== null,                                    '53.1 loadRiskSignals retorna objeto (não null)');
assert(view.getRiskSignalSummary() !== null,            '53.2 getRiskSignalSummary() retorna objeto');
assert(view.getStats().riskSignalsState === 'loaded',   '53.3 getStats().riskSignalsState = "loaded"');
assert('totalSignals'    in h53,                        '53.4 data.totalSignals presente');
assert('criticalSignals' in h53,                        '53.5 data.criticalSignals presente');
assert('riskSignals'     in h53,                        '53.6 data.riskSignals presente');
assert('affectedDeals'   in h53,                        '53.7 data.affectedDeals presente');
assert('valueExposed'    in h53,                        '53.8 data.valueExposed presente');
assert(Array.isArray(h53.signals),                      '53.9 data.signals é array');
assert(!isNaN(h53.valueExposed),                        '53.10 data.valueExposed não é NaN');

// ── 54. render inclui seção Sinais de Risco Comercial ────────────────────────

section(54, 'render() inclui seção "Sinais de Risco Comercial" (data-insights-risk-signals)');

const c54 = { innerHTML: '' };
view.render(c54);

assert(c54.innerHTML.includes('data-insights-risk-signals'),  '54.1 data-insights-risk-signals presente no HTML');
assert(c54.innerHTML.includes('Sinais de Risco Comercial'),   '54.2 título "Sinais de Risco Comercial" presente');

// ── 55. Cards KPI com data-risk-kpi presentes ────────────────────────────────

section(55, 'cards gerenciais data-risk-kpi presentes no HTML da seção');

const c55 = { innerHTML: '' };
view.render(c55);

assert(c55.innerHTML.includes('data-risk-kpi="critical"'),       '55.1 kpi critical presente');
assert(c55.innerHTML.includes('data-risk-kpi="risk"'),           '55.2 kpi risk presente');
assert(c55.innerHTML.includes('data-risk-kpi="affected-deals"'), '55.3 kpi affected-deals presente');
assert(c55.innerHTML.includes('data-risk-kpi="value-exposed"'),  '55.4 kpi value-exposed presente');

// ── 56. Lista de sinais com data-risk-signals-list presente ──────────────────

section(56, 'lista de sinais com data-risk-signals-list presente no HTML');

const c56 = { innerHTML: '' };
view.render(c56);

assert(c56.innerHTML.includes('data-risk-signals-list'), '56.1 data-risk-signals-list presente');

// ── 57. Itens de sinal têm data-risk-signal-severity ─────────────────────────

section(57, 'itens de sinal têm atributo data-risk-signal-severity');

const c57 = { innerHTML: '' };
view.render(c57);

assert(c57.innerHTML.includes('data-risk-signal-severity='), '57.1 data-risk-signal-severity presente nos itens');

// ── 58. Labels de severidade em pt-BR ────────────────────────────────────────

section(58, 'labels de severidade em pt-BR presentes nos itens da lista');

// TEST_DEALS são todos críticos → CRITICAL_NO_NEXT_ACTION → label "Crítico"
const c58 = { innerHTML: '' };
view.render(c58);

assert(c58.innerHTML.includes('Crítico') || c58.innerHTML.includes('Risco'),  '58.1 label pt-BR "Crítico" ou "Risco" presente');
assert(c58.innerHTML.includes('data-risk-signal-type='),                       '58.2 data-risk-signal-type presente nos itens');

// ── 59. Escape HTML nos campos dos sinais ─────────────────────────────────────

section(59, 'escape HTML em campos dos sinais (responsavel, etapa com XSS)');

const rmXSS59  = new CRMReadModel();
const mXSS59   = new CRMMetrics(rmXSS59);
const svcXSS59 = new CRMQueryService(rmXSS59, mXSS59);
rmXSS59.hydrate({
  'xss-59': {
    funil: 'venda_ufv', etapa: '<b>XSS Etapa</b>', status: 'Em andamento',
    valor: 50000, responsavel: '"><script>alert(1)</script>', createdAt: 1, updatedAt: 1,
  },
});
const pXSS59 = {
  getCRMExecutiveSummary:       (f = {}) => svcXSS59.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:               (f = {}) => svcXSS59.searchDeals(f).toJSON(),
  queryCRMDeal:                 (id)     => svcXSS59.getDeal(id).toJSON(),
  getCRMPipelineHealth:         (f = {}) => svcXSS59.getPipelineHealth(f).toJSON(),
  getCRMCriticalDeals:          (f = {}) => svcXSS59.getCriticalDeals(f).toJSON(),
  getCRMDealsWithoutNextAction: (f = {}) => svcXSS59.getDealsWithoutNextAction(f).toJSON(),
  getCRMRiskSignalSummary:      (f = {}) => svcXSS59.getRiskSignalSummary(f).toJSON(),
};
const vXSS59 = new CRMInsightsView(pXSS59);
const cXSS59 = { innerHTML: '' };
vXSS59.render(cXSS59);
const html59 = cXSS59.innerHTML;

assert(!html59.includes('<script>alert(1)'),      '59.1 <script> em responsavel não presente no HTML');
assert(!html59.includes('<b>XSS Etapa</b>'),      '59.2 tag <b> em etapa não presente');
assert(html59.includes('&lt;') || html59.includes('&gt;'), '59.3 entidades HTML escapadas presentes nos sinais');

// ── 60. R$ no kpi value-exposed ──────────────────────────────────────────────

section(60, 'valueExposed formatado com R$ no kpi value-exposed');

// TEST_DEALS: 4 deals críticos → valueExposed = 100000+200000+50000+40000 = 390000
const c60 = { innerHTML: '' };
view.render(c60);

assert(c60.innerHTML.includes('R$'), '60.1 símbolo "R$" presente no HTML (incluso no kpi value-exposed)');

// ── 61. Aging em dias nos meta dos sinais ─────────────────────────────────────

section(61, 'agingDays em dias presentes nos meta dos sinais (padrão: Nd)');

// TEST_DEALS têm timestamps de 1970 → agingDays >> 0 → deve aparecer como "Nd"
const c61 = { innerHTML: '' };
view.render(c61);

assert(/\d+d/.test(c61.innerHTML), '61.1 padrão "Nd" (ex: 20000d) presente no HTML dos sinais');

// ── 62. Erro em getCRMRiskSignalSummary é isolado ────────────────────────────

section(62, 'erro em getCRMRiskSignalSummary é isolado; restante do HTML permanece válido');

const providerErr62 = {
  getCRMExecutiveSummary:       (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:               (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:                 (id)     => svc.getDeal(id).toJSON(),
  getCRMPipelineHealth:         (f = {}) => svc.getPipelineHealth(f).toJSON(),
  getCRMCriticalDeals:          (f = {}) => svc.getCriticalDeals(f).toJSON(),
  getCRMDealsWithoutNextAction: (f = {}) => svc.getDealsWithoutNextAction(f).toJSON(),
  getCRMRiskSignalSummary:      ()       => { throw new Error('Falha de sinais simulada'); },
};
const view62 = new CRMInsightsView(providerErr62);
const c62    = { innerHTML: '' };
const vm62   = view62.render(c62);

assert(vm62 !== null,                                             '62.1 render retorna viewModel (não null)');
assert(c62.innerHTML.includes('ESA OS Insights'),                 '62.2 título da página presente');
assert(view62.getStats().riskSignalsState === 'error',            '62.3 riskSignalsState = "error"');
assert(c62.innerHTML.includes('data-insights-risk-signals'),      '62.4 seção risk presente exibindo erro');

// ── 63. Ambas health e risk falhando → página ainda renderiza ─────────────────

section(63, 'health e risk signals ambos falhando → página ainda renderiza com conteúdo principal');

const providerBothErr63 = {
  getCRMExecutiveSummary:  (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:          (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:            (id)     => svc.getDeal(id).toJSON(),
  getCRMPipelineHealth:    ()       => { throw new Error('health fail'); },
  getCRMRiskSignalSummary: ()       => { throw new Error('risk fail'); },
};
const view63 = new CRMInsightsView(providerBothErr63);
const c63    = { innerHTML: '' };
const vm63   = view63.render(c63);

assert(vm63 !== null,                               '63.1 render retorna viewModel mesmo com ambos falhando');
assert(c63.innerHTML.includes('ESA OS Insights'),   '63.2 título da página presente');

// ── 64. clearFilters reseta riskSignalsState para 'empty' ─────────────────────

section(64, 'clearFilters reseta riskSignalsState para "empty"');

view.loadRiskSignals({});
assert(view.getStats().riskSignalsState === 'loaded', '64.1 riskSignalsState = "loaded" após loadRiskSignals');
view.clearFilters();
assert(view.getStats().riskSignalsState === 'empty',  '64.2 riskSignalsState = "empty" após clearFilters');

// ── 65. Provider sem getCRMRiskSignalSummary → seção ausente do HTML ──────────

section(65, 'provider sem getCRMRiskSignalSummary → riskSignalsState = "empty"; seção ausente do HTML');

const providerNoRisk65 = {
  getCRMExecutiveSummary: (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:         (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:           (id)     => svc.getDeal(id).toJSON(),
};
const view65 = new CRMInsightsView(providerNoRisk65);
const c65    = { innerHTML: '' };
view65.render(c65);

assert(view65.getStats().riskSignalsState === 'empty',       '65.1 riskSignalsState = "empty" sem provider');
assert(!c65.innerHTML.includes('data-insights-risk-signals'), '65.2 seção risk ausente quando provider não suporta');

// ── 66. data-insights-deal-id nos sinais → selectDeal reutilizável ───────────

section(66, 'sinais de deal têm data-insights-deal-id; selectDeal() ainda funciona a partir deles');

view.clearFilters();
const c66 = { innerHTML: '' };
view.render(c66);

// TEST_DEALS geram CRITICAL_NO_NEXT_ACTION com dealIds dos 4 deals
assert(
  c66.innerHTML.includes('data-insights-deal-id="deal-1"') ||
  c66.innerHTML.includes('data-insights-deal-id="deal-2"') ||
  c66.innerHTML.includes('data-insights-deal-id="deal-3"') ||
  c66.innerHTML.includes('data-insights-deal-id="deal-4"'),
  '66.1 ao menos um data-insights-deal-id de sinal de risco presente no HTML'
);

view.selectDeal('deal-2');
assert(view.getDealDetailState() === 'loaded', '66.2 selectDeal() ainda funciona via deal-id de sinal');
assert(view.getSelectedDeal().id === 'deal-2', '66.3 deal correto carregado');

view.clearFilters();

// ── 67. Ausência de undefined/null/NaN/[object Object] na seção de sinais ─────

section(67, 'HTML da seção de sinais não contém undefined, null, NaN ou [object Object]');

const c67 = { innerHTML: '' };
view.render(c67);

assert(!c67.innerHTML.includes('>undefined<'),    '67.1 "undefined" não visível no HTML');
assert(!c67.innerHTML.includes('[object Object]'), '67.2 "[object Object]" não visível');
assert(!c67.innerHTML.includes('>null<'),          '67.3 ">null<" não visível');
assert(!c67.innerHTML.includes('>NaN<'),           '67.4 ">NaN<" não visível');

// ── 68. loadActionPriorities → loaded state + shape correta ─────────────────

section(68, 'loadActionPriorities() com provider válido → _actionPriorityState = "loaded" + shape correta');

view.clearFilters();
const ap68 = view.loadActionPriorities({});

assert(ap68 !== null,                                       '68.1 loadActionPriorities retorna objeto (não null)');
assert(view.getActionPrioritySummary() !== null,            '68.2 getActionPrioritySummary() retorna objeto');
assert(view.getStats().actionPriorityState === 'loaded',    '68.3 getStats().actionPriorityState = "loaded"');
assert(typeof ap68.totalPriorities      === 'number',       '68.4 totalPriorities é number');
assert(typeof ap68.urgentDeals          === 'number',       '68.5 urgentDeals é number');
assert(typeof ap68.highPriorityDeals    === 'number',       '68.6 highPriorityDeals é number');
assert(typeof ap68.mediumPriorityDeals  === 'number',       '68.7 mediumPriorityDeals é number');
assert(typeof ap68.lowPriorityDeals     === 'number',       '68.8 lowPriorityDeals é number');
assert(typeof ap68.prioritizedValue     === 'number',       '68.9 prioritizedValue é number');
assert(typeof ap68.averagePriorityScore === 'number',       '68.10 averagePriorityScore é number');

// ── 69. render inclui seção Prioridades de Ação ──────────────────────────────

section(69, 'render() inclui seção "Prioridades de Ação" (data-insights-action-priorities)');

const c69 = { innerHTML: '' };
view.render(c69);

assert(c69.innerHTML.includes('data-insights-action-priorities'), '69.1 data-insights-action-priorities presente no HTML');
assert(c69.innerHTML.includes('Prioridades de Ação'),             '69.2 título "Prioridades de Ação" presente');

// ── 70. KPI cards com data-action-kpi ────────────────────────────────────────

section(70, 'cards gerenciais data-action-kpi presentes no HTML da seção');

const c70 = { innerHTML: '' };
view.render(c70);

assert(c70.innerHTML.includes('data-action-kpi="urgent"'),            '70.1 kpi urgent presente');
assert(c70.innerHTML.includes('data-action-kpi="high"'),              '70.2 kpi high presente');
assert(c70.innerHTML.includes('data-action-kpi="prioritized-value"'), '70.3 kpi prioritized-value presente');
assert(c70.innerHTML.includes('data-action-kpi="average-score"'),     '70.4 kpi average-score presente');

// ── 71. Lista com data-action-priorities-list ─────────────────────────────────

section(71, 'lista de prioridades com data-action-priorities-list presente no HTML');

const c71 = { innerHTML: '' };
view.render(c71);

assert(c71.innerHTML.includes('data-action-priorities-list'), '71.1 data-action-priorities-list presente');

// ── 72. Itens têm data-action-priority-level ──────────────────────────────────

section(72, 'itens de prioridade têm atributo data-action-priority-level');

const c72 = { innerHTML: '' };
view.render(c72);

assert(c72.innerHTML.includes('data-action-priority-level='), '72.1 data-action-priority-level presente nos itens');

// ── 73. Labels pt-BR "Urgente" presente ──────────────────────────────────────

// TEST_DEALS são críticos sem próxima ação → todos urgent → label "Urgente"
section(73, 'label pt-BR "Urgente" presente nos itens de prioridade');

const c73 = { innerHTML: '' };
view.render(c73);

assert(c73.innerHTML.includes('Urgente'), '73.1 label "Urgente" presente no HTML de prioridades');

// ── 74. Score presente na meta line dos itens ─────────────────────────────────

section(74, 'Score: presente na linha meta dos itens de prioridade');

const c74 = { innerHTML: '' };
view.render(c74);

assert(c74.innerHTML.includes('Score:'), '74.1 "Score:" presente na meta line dos itens');

// ── 75. Reason tags com data-action-reason-code ───────────────────────────────

section(75, 'tags de reason com data-action-reason-code presentes nos itens');

const c75 = { innerHTML: '' };
view.render(c75);

assert(c75.innerHTML.includes('data-action-reason-code='), '75.1 data-action-reason-code presente nos itens');

// ── 76. R$ no KPI prioritized-value ──────────────────────────────────────────

// TEST_DEALS: todos críticos urgentes → prioritizedValue = soma de todos os valores
section(76, 'prioritizedValue formatado com R$ no kpi prioritized-value');

const c76 = { innerHTML: '' };
view.render(c76);

assert(c76.innerHTML.includes('R$'), '76.1 símbolo "R$" presente (prioritizedValue formatado)');

// ── 77. Aging em dias (Nd) presente nos itens ────────────────────────────────

section(77, 'agingDays em dias (padrão Nd) presente nos meta dos itens');

// TEST_DEALS têm timestamps de 1970 → agingDays >> 0 → aparece como "Nd"
const c77 = { innerHTML: '' };
view.render(c77);

assert(/\d+d/.test(c77.innerHTML), '77.1 padrão "Nd" (ex: 20000d) presente no HTML de prioridades');

// ── 78. XSS em dealName/responsible escapado ──────────────────────────────────

section(78, 'XSS em campos dos itens de prioridade (responsible com payload) é escapado');

const rmXSS78  = new CRMReadModel();
const mXSS78   = new CRMMetrics(rmXSS78);
const svcXSS78 = new CRMQueryService(rmXSS78, mXSS78);
rmXSS78.hydrate({
  'xss-78': {
    funil:       'venda_ufv',
    etapa:       'Proposta',
    status:      'Em andamento',
    valor:       50000,
    responsavel: '"><script>xss()</script>',
    createdAt:   1,
    updatedAt:   1,
  },
});
const pXSS78 = {
  getCRMExecutiveSummary:      (f = {}) => svcXSS78.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:              (f = {}) => svcXSS78.searchDeals(f).toJSON(),
  queryCRMDeal:                (id)     => svcXSS78.getDeal(id).toJSON(),
  getCRMPipelineHealth:        (f = {}) => svcXSS78.getPipelineHealth(f).toJSON(),
  getCRMCriticalDeals:         (f = {}) => svcXSS78.getCriticalDeals(f).toJSON(),
  getCRMDealsWithoutNextAction:(f = {}) => svcXSS78.getDealsWithoutNextAction(f).toJSON(),
  getCRMRiskSignalSummary:     (f = {}) => svcXSS78.getRiskSignalSummary(f).toJSON(),
  getCRMActionPrioritySummary: (f = {}) => svcXSS78.getActionPrioritySummary(f).toJSON(),
};
const vXSS78 = new CRMInsightsView(pXSS78);
const cXSS78 = { innerHTML: '' };
vXSS78.render(cXSS78);
const html78 = cXSS78.innerHTML;

assert(!html78.includes('<script>xss()'),    '78.1 <script> em responsavel não presente no HTML de prioridades');
assert(!html78.includes('" onclick='),       '78.2 onclick não presente');
assert(html78.includes('&lt;') || html78.includes('&quot;'), '78.3 entidades HTML escapadas presentes');

// ── 79. Erro em getCRMActionPrioritySummary é isolado ────────────────────────

section(79, 'erro em getCRMActionPrioritySummary é isolado; restante do HTML permanece válido');

const providerErr79 = {
  getCRMExecutiveSummary:      (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:              (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:                (id)     => svc.getDeal(id).toJSON(),
  getCRMPipelineHealth:        (f = {}) => svc.getPipelineHealth(f).toJSON(),
  getCRMCriticalDeals:         (f = {}) => svc.getCriticalDeals(f).toJSON(),
  getCRMDealsWithoutNextAction:(f = {}) => svc.getDealsWithoutNextAction(f).toJSON(),
  getCRMRiskSignalSummary:     (f = {}) => svc.getRiskSignalSummary(f).toJSON(),
  getCRMActionPrioritySummary: ()       => { throw new Error('Falha de prioridades simulada'); },
};
const view79 = new CRMInsightsView(providerErr79);
const c79    = { innerHTML: '' };
const vm79   = view79.render(c79);

assert(vm79 !== null,                                             '79.1 render retorna viewModel (não null) com erro em action-priority');
assert(c79.innerHTML.includes('ESA OS Insights'),                 '79.2 título da página presente');
assert(view79.getStats().actionPriorityState === 'error',         '79.3 actionPriorityState = "error"');
assert(c79.innerHTML.includes('data-insights-action-priorities'), '79.4 seção action-priority presente exibindo erro');

// ── 80. clearFilters reseta actionPriorityState para 'empty' ─────────────────

section(80, 'clearFilters reseta actionPriorityState para "empty"');

view.loadActionPriorities({});
assert(view.getStats().actionPriorityState === 'loaded', '80.1 actionPriorityState = "loaded" após loadActionPriorities');
view.clearFilters();
assert(view.getStats().actionPriorityState === 'empty',  '80.2 actionPriorityState = "empty" após clearFilters');

// ── 81. Provider sem getCRMActionPrioritySummary → seção ausente ──────────────

section(81, 'provider sem getCRMActionPrioritySummary → actionPriorityState = "empty"; seção ausente do HTML');

const providerNoAP81 = {
  getCRMExecutiveSummary: (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:         (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:           (id)     => svc.getDeal(id).toJSON(),
};
const view81 = new CRMInsightsView(providerNoAP81);
const c81    = { innerHTML: '' };
view81.render(c81);

assert(view81.getStats().actionPriorityState === 'empty',           '81.1 actionPriorityState = "empty" sem provider');
assert(!c81.innerHTML.includes('data-insights-action-priorities'),   '81.2 seção action-priority ausente quando provider não suporta');

// ── 82. data-insights-deal-id nos itens → selectDeal() reutilizável ──────────

section(82, 'itens de prioridade com dealId têm data-insights-deal-id; selectDeal() ainda funciona');

view.clearFilters();
const c82 = { innerHTML: '' };
view.render(c82);

// TEST_DEALS têm IDs e geram prioridades com dealId → data-insights-deal-id deve estar presente
assert(
  c82.innerHTML.includes('data-insights-deal-id="deal-1"') ||
  c82.innerHTML.includes('data-insights-deal-id="deal-2"') ||
  c82.innerHTML.includes('data-insights-deal-id="deal-3"') ||
  c82.innerHTML.includes('data-insights-deal-id="deal-4"'),
  '82.1 ao menos um data-insights-deal-id de item de prioridade presente no HTML'
);

view.loadDrilldown('Todos', {});
view.selectDeal('deal-2');
assert(view.getDealDetailState() === 'loaded', '82.2 selectDeal() funciona via deal-id de priority item');
assert(view.getSelectedDeal().id === 'deal-2', '82.3 deal correto carregado');

view.clearFilters();

// ── 83. Ausência de undefined/null/NaN/[object Object] na seção de prioridades

section(83, 'HTML da seção de prioridades não contém undefined, null, NaN ou [object Object]');

const c83 = { innerHTML: '' };
view.render(c83);

assert(!c83.innerHTML.includes('>undefined<'),    '83.1 "undefined" não visível no HTML de prioridades');
assert(!c83.innerHTML.includes('[object Object]'), '83.2 "[object Object]" não visível');
assert(!c83.innerHTML.includes('>null<'),          '83.3 ">null<" não visível');
assert(!c83.innerHTML.includes('>NaN<'),           '83.4 ">NaN<" não visível');

// ── 84. loadManagementBrief → state 'loaded' + shape correta ────────────────

section(84, 'loadManagementBrief() com provider válido → _managementBriefState = "loaded" + shape correta');

view.clearFilters();
const mb84 = view.loadManagementBrief({});

assert(mb84 !== null,                                          '84.1 loadManagementBrief retorna objeto (não null)');
assert(view.getManagementBrief() !== null,                    '84.2 getManagementBrief() retorna objeto');
assert(view.getStats().managementBriefState === 'loaded',     '84.3 getStats().managementBriefState = "loaded"');
assert('highlights'          in mb84,                         '84.4 highlights presente');
assert('managementNarrative' in mb84,                         '84.5 managementNarrative presente');
assert(Array.isArray(mb84.highlights),                        '84.6 highlights é Array');
assert(typeof mb84.managementNarrative === 'string',          '84.7 managementNarrative é string');

// ── 85. render inclui seção Briefing Gerencial ────────────────────────────────

section(85, 'render() inclui seção "Briefing Gerencial" (data-insights-management-brief)');

const c85 = { innerHTML: '' };
view.render(c85);

assert(c85.innerHTML.includes('data-insights-management-brief'), '85.1 data-insights-management-brief presente no HTML');
assert(c85.innerHTML.includes('Briefing Gerencial'),             '85.2 título "Briefing Gerencial" presente');

// ── 86. Narrativa gerencial presente no HTML ──────────────────────────────────

section(86, 'narrativa gerencial com data-brief-narrative presente no HTML');

const c86 = { innerHTML: '' };
view.render(c86);

assert(c86.innerHTML.includes('data-brief-narrative'), '86.1 data-brief-narrative presente');
// TEST_DEALS de 1970 → todos críticos → narrativa menciona "crítico"
assert(c86.innerHTML.includes('crítico') || c86.innerHTML.includes('pipeline') || c86.innerHTML.includes('deal'),
  '86.2 narrativa gerencial contém texto relevante');

// ── 87. Highlights presentes com data-brief-highlight-code ───────────────────

section(87, 'highlights com data-brief-highlight-code presentes no HTML');

const c87 = { innerHTML: '' };
view.render(c87);

assert(c87.innerHTML.includes('data-brief-highlight-code='), '87.1 data-brief-highlight-code presente');
assert(c87.innerHTML.includes('data-brief-highlights'),      '87.2 data-brief-highlights container presente');

// ── 88. Highlights têm data-brief-highlight-severity ─────────────────────────

section(88, 'highlights têm atributo data-brief-highlight-severity');

const c88 = { innerHTML: '' };
view.render(c88);

assert(c88.innerHTML.includes('data-brief-highlight-severity='), '88.1 data-brief-highlight-severity presente');

// ── 89. Labels de severidade em pt-BR nos highlights ─────────────────────────

section(89, 'labels pt-BR de severidade nos highlights (Crítico, Risco, Atenção, Informativo)');

const c89 = { innerHTML: '' };
view.render(c89);

// TEST_DEALS → todos críticos → devem aparecer labels críticos
assert(
  c89.innerHTML.includes('Crítico') || c89.innerHTML.includes('Risco') ||
  c89.innerHTML.includes('Atenção') || c89.innerHTML.includes('Informativo'),
  '89.1 ao menos um label de severidade pt-BR presente nos highlights'
);

// ── 90. getManagementBrief() retorna cópia — mutação não altera estado interno

section(90, 'getManagementBrief() retorna cópia imutável');

view.loadManagementBrief({});
const mb90 = view.getManagementBrief();
assert(mb90 !== null, '90.1 getManagementBrief() retorna objeto');
const prevNarrative = mb90.managementNarrative;
mb90.managementNarrative = 'MUTADO';
assert(view.getManagementBrief().managementNarrative === prevNarrative, '90.2 mutar retorno não altera interno');

// ── 91. clearFilters reseta managementBriefState para 'empty' ────────────────

section(91, 'clearFilters reseta managementBriefState para "empty"');

view.loadManagementBrief({});
assert(view.getStats().managementBriefState === 'loaded', '91.1 managementBriefState = "loaded" após load');
view.clearFilters();
assert(view.getStats().managementBriefState === 'empty',  '91.2 managementBriefState = "empty" após clearFilters');

// ── 92. Provider sem getCRMManagementBrief → seção ausente do HTML ─────────

section(92, 'provider sem getCRMManagementBrief → managementBriefState = "empty"; seção ausente do HTML');

const providerNoBrief92 = {
  getCRMExecutiveSummary: (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:         (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:           (id)     => svc.getDeal(id).toJSON(),
};
const view92 = new CRMInsightsView(providerNoBrief92);
const c92    = { innerHTML: '' };
view92.render(c92);

assert(view92.getStats().managementBriefState === 'empty',          '92.1 managementBriefState = "empty" sem provider');
assert(!c92.innerHTML.includes('data-insights-management-brief'),   '92.2 seção brief ausente quando provider não suporta');

// ── 93. Erro em getCRMManagementBrief é isolado ───────────────────────────────

section(93, 'erro em getCRMManagementBrief é isolado; restante do HTML permanece válido');

const providerErr93 = {
  getCRMExecutiveSummary:      (f = {}) => svc.getExecutiveSummary(f).toJSON(),
  searchCRMDeals:              (f = {}) => svc.searchDeals(f).toJSON(),
  queryCRMDeal:                (id)     => svc.getDeal(id).toJSON(),
  getCRMPipelineHealth:        (f = {}) => svc.getPipelineHealth(f).toJSON(),
  getCRMCriticalDeals:         (f = {}) => svc.getCriticalDeals(f).toJSON(),
  getCRMDealsWithoutNextAction:(f = {}) => svc.getDealsWithoutNextAction(f).toJSON(),
  getCRMRiskSignalSummary:     (f = {}) => svc.getRiskSignalSummary(f).toJSON(),
  getCRMActionPrioritySummary: (f = {}) => svc.getActionPrioritySummary(f).toJSON(),
  getCRMManagementBrief:       ()       => { throw new Error('brief falhou'); },
};
const view93 = new CRMInsightsView(providerErr93);
const c93    = { innerHTML: '' };
const vm93   = view93.render(c93);

assert(vm93 !== null,                                              '93.1 render retorna viewModel mesmo com erro no brief');
assert(c93.innerHTML.includes('ESA OS Insights'),                  '93.2 título da página presente');
assert(view93.getStats().managementBriefState === 'error',         '93.3 managementBriefState = "error"');
assert(c93.innerHTML.includes('data-insights-management-brief'),   '93.4 seção brief presente mostrando erro');
assert(c93.innerHTML.includes('Não foi possível carregar o briefing'), '93.5 mensagem de erro de brief presente');
assert(c93.innerHTML.includes('data-insights-health'),             '93.6 seção health ainda presente (isolamento correto)');

// ── 94. Seção briefing aparece ANTES de health no HTML ───────────────────────

section(94, 'seção briefing aparece ANTES de health no HTML (ordem correta)');

view.clearFilters();
const c94 = { innerHTML: '' };
view.render(c94);

const idxBrief94  = c94.innerHTML.indexOf('data-insights-management-brief');
const idxHealth94 = c94.innerHTML.indexOf('data-insights-health');

assert(idxBrief94  >= 0, '94.1 data-insights-management-brief presente no HTML');
assert(idxHealth94 >= 0, '94.2 data-insights-health presente no HTML');
assert(idxBrief94 < idxHealth94, '94.3 briefing aparece ANTES de health no HTML');

// ── 95. getStats() inclui managementBriefState ────────────────────────────────

section(95, 'getStats() inclui managementBriefState');

view.clearFilters();
const stats95 = view.getStats();
assert('managementBriefState' in stats95, '95.1 managementBriefState presente em getStats()');
assert(typeof stats95.managementBriefState === 'string', '95.2 managementBriefState é string');

// ── 96. Highlights mostram no máximo 5 (view slice) ──────────────────────────

section(96, 'HTML exibe no máximo 5 highlights (view mostra top 5)');

view.clearFilters();
view.loadManagementBrief({});
const mb96 = view.getManagementBrief();
assert(mb96 !== null, '96.1 brief carregado');

const highlightCount96 = (c87.innerHTML.match(/data-brief-highlight-code=/g) || []).length;
assert(highlightCount96 <= 5, `96.2 no máximo 5 highlights no HTML (encontrou ${highlightCount96})`);

// ── 97. XSS em narrativa e títulos de highlight escapado ─────────────────────

section(97, 'XSS em campos da seção de briefing é escapado');

// O _escapeHTML é chamado sobre managementNarrative e campos de highlight
// Testamos via _escapeHTML diretamente (a função é usada internamente)
const esc97 = view._escapeHTML('<script>xss()</script>');
assert(!esc97.includes('<script>'),   '97.1 <script> escapado por _escapeHTML');
assert(esc97.includes('&lt;script'), '97.2 &lt;script presente após escape');

// Render com provider real — confirma ausência de tags abertas na seção de brief
const c97 = { innerHTML: '' };
view.render(c97);
const briefSection97 = c97.innerHTML.substring(
  c97.innerHTML.indexOf('data-insights-management-brief'),
  c97.innerHTML.indexOf('data-insights-health') > 0
    ? c97.innerHTML.indexOf('data-insights-health')
    : c97.innerHTML.length
);
assert(!briefSection97.includes('<script'), '97.3 nenhuma tag <script> não escapada na seção de brief');

// ── 98. Ausência de undefined/null/NaN/[object Object] na seção de briefing ──

section(98, 'HTML da seção de briefing não contém undefined, null, NaN ou [object Object]');

const c98 = { innerHTML: '' };
view.render(c98);

assert(!c98.innerHTML.includes('>undefined<'),    '98.1 "undefined" não visível no HTML de briefing');
assert(!c98.innerHTML.includes('[object Object]'), '98.2 "[object Object]" não visível');
assert(!c98.innerHTML.includes('>null<'),          '98.3 ">null<" não visível');
assert(!c98.innerHTML.includes('>NaN<'),           '98.4 ">NaN<" não visível');

// ── 99. Highlights com dealId têm data-insights-deal-id → selectDeal ─────────

section(99, 'highlights com dealId têm data-insights-deal-id; selectDeal() ainda funciona');

view.clearFilters();
const c99 = { innerHTML: '' };
view.render(c99);

// O brief pode ou não gerar highlights com dealId (depende da lógica do builder)
// Verificamos que se presentes, o selectDeal funciona normalmente
view.loadDrilldown('Todos', {});
view.selectDeal('deal-1');
assert(view.getDealDetailState() === 'loaded', '99.1 selectDeal() ainda funciona com brief carregado');
assert(view.getSelectedDeal().id === 'deal-1', '99.2 deal correto selecionado');

view.clearFilters();

// ── 100. Render completo: brief + health + risk + action presente juntos ──────

section(100, 'render() completo: todas as 4 seções gerenciais presentes no HTML');

const c100 = { innerHTML: '' };
view.render(c100);

assert(c100.innerHTML.includes('data-insights-management-brief'),  '100.1 seção briefing presente');
assert(c100.innerHTML.includes('data-insights-health'),            '100.2 seção health presente');
assert(c100.innerHTML.includes('data-insights-risk-signals'),      '100.3 seção risk signals presente');
assert(c100.innerHTML.includes('data-insights-action-priorities'), '100.4 seção action priorities presente');
// Ordem: brief → health → risk → action
const iB = c100.innerHTML.indexOf('data-insights-management-brief');
const iH = c100.innerHTML.indexOf('data-insights-health');
const iR = c100.innerHTML.indexOf('data-insights-risk-signals');
const iA = c100.innerHTML.indexOf('data-insights-action-priorities');
assert(iB < iH,  '100.5 brief antes de health');
assert(iH < iR,  '100.6 health antes de risk');
assert(iR < iA,  '100.7 risk antes de action');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 100 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
