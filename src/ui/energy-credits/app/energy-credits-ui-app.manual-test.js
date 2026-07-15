/**
 * ESA OS — Manual Test: Energy Credits UI App
 * node src/ui/energy-credits/app/energy-credits-ui-app.manual-test.js
 *
 * Testa: formatters, state, router, app constructor, components (HTML).
 * Não requer DOM — todos os testes rodam em Node.js nativo.
 */

import {
  formatCurrencyBRL, formatKwh, formatPercentage,
  formatReferenceMonth, formatDateBR, formatCoverageMonths,
  formatDocument, formatNumber, currentReferenceMonth,
} from './energy-credits-formatters.js';

import { createEnergyCreditsState }  from './energy-credits-state.js';
import { createEnergyCreditsRouter, EC_ROUTE_REGISTRY } from './energy-credits-router.js';
import { NAV_SECTIONS, ROUTE_LABELS, getRouteLabel, ICONS } from './energy-credits-navigation.js';

import { ecLoadingState }  from './components/ec-loading-state.js';
import { ecEmptyState }    from './components/ec-empty-state.js';
import { ecErrorState }    from './components/ec-error-state.js';
import { ecKpiCard, ecKpiGrid } from './components/ec-kpi-card.js';
import { ecTable, ecActionBtn } from './components/ec-table.js';
import { ecStepper }       from './components/ec-stepper.js';
import { ecPaymentBadge, ecImportStatusBadge, ecBadge, ecCoverageBadge } from './components/ec-status-badge.js';
import { ecMobileCardList }  from './components/ec-mobile-card-list.js';
import { ecShellHtml }       from './components/ec-shell.js';
import { ecModalHtml }       from './components/ec-modal.js';

import { EnergyCreditsApp, createEnergyCreditsApp } from './energy-credits-app.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

function group(name) { console.log(`\n${name}`); }

// ── 1. formatCurrencyBRL ─────────────────────────────────────────────────────

group('1. formatCurrencyBRL');
assert('1.1 formata valor positivo', formatCurrencyBRL(1234.56).includes('1.234'));
assert('1.2 formata zero', formatCurrencyBRL(0).includes('0'));
assert('1.3 retorna — para null', formatCurrencyBRL(null) === '—');
assert('1.4 retorna — para undefined', formatCurrencyBRL(undefined) === '—');
assert('1.5 retorna — para NaN', formatCurrencyBRL('abc') === '—');
assert('1.6 aceita string numérica', formatCurrencyBRL('500').includes('500'));

// ── 2. formatKwh ─────────────────────────────────────────────────────────────

group('2. formatKwh');
assert('2.1 formata com "kWh"', formatKwh(100).endsWith('kWh'));
assert('2.2 formata com 2 decimais por padrão', formatKwh(100).includes('100,00'));
assert('2.3 retorna — para null', formatKwh(null) === '—');
assert('2.4 decimals=0 sem decimais', !formatKwh(100, 0).includes(','));
assert('2.5 formata valor grande', formatKwh(1234567, 0).includes('1.234.567'));

// ── 3. formatPercentage ───────────────────────────────────────────────────────

group('3. formatPercentage');
assert('3.1 termina com %', formatPercentage(12.5).endsWith('%'));
assert('3.2 retorna — para null', formatPercentage(null) === '—');
assert('3.3 1 decimal padrão', formatPercentage(12.5) === '12,5%');
assert('3.4 0 decimal', formatPercentage(12.5, 0) === '13%' || formatPercentage(12.5, 0) === '12%');

// ── 4. formatReferenceMonth ───────────────────────────────────────────────────

group('4. formatReferenceMonth');
assert('4.1 formata "2025-06" -> contém Jun e 2025', formatReferenceMonth('2025-06').includes('Jun') && formatReferenceMonth('2025-06').includes('2025'));
assert('4.2 retorna — para falsy', formatReferenceMonth('') === '—');
assert('4.3 retorna — para null', formatReferenceMonth(null) === '—');
assert('4.4 formata "2024-12" com Dez', formatReferenceMonth('2024-12').includes('Dez'));
assert('4.5 formata "2024-01" com Jan', formatReferenceMonth('2024-01').includes('Jan'));

// ── 5. formatDateBR ───────────────────────────────────────────────────────────

group('5. formatDateBR');
assert('5.1 retorna — para falsy', formatDateBR('') === '—');
assert('5.2 retorna — para null', formatDateBR(null) === '—');
assert('5.3 formata string ISO com /', formatDateBR('2025-06-15').includes('/'));
assert('5.4 retorna string', typeof formatDateBR('2025-06-15') === 'string');

// ── 6. formatCoverageMonths ───────────────────────────────────────────────────

group('6. formatCoverageMonths');
assert('6.1 retorna objeto com text e level', typeof formatCoverageMonths(1).text === 'string');
assert('6.2 low para <= 0.25', formatCoverageMonths(0.25).level === 'low');
assert('6.3 adequate para 1.0', formatCoverageMonths(1.0).level === 'adequate');
assert('6.4 high para > 1.5', formatCoverageMonths(2.0).level === 'high');
assert('6.5 none para null', formatCoverageMonths(null).level === 'none');
assert('6.6 text contém "meses"', formatCoverageMonths(1.5).text.includes('meses'));

// ── 7. formatDocument ─────────────────────────────────────────────────────────

group('7. formatDocument');
assert('7.1 formata CPF com pontos', formatDocument('12345678901').includes('.'));
assert('7.2 formata CNPJ com / e -', formatDocument('12345678000195').includes('/'));
assert('7.3 retorna — para falsy', formatDocument('') === '—');
assert('7.4 retorna — para null', formatDocument(null) === '—');
assert('7.5 ignora caracteres não-numéricos na entrada', formatDocument('123.456.789-01').includes('.'));

// ── 8. formatNumber e currentReferenceMonth ───────────────────────────────────

group('8. formatNumber / currentReferenceMonth');
assert('8.1 formatNumber retorna string', typeof formatNumber(100) === 'string');
assert('8.2 formatNumber — para null', formatNumber(null) === '—');
assert('8.3 currentReferenceMonth é YYYY-MM', /^\d{4}-\d{2}$/.test(currentReferenceMonth()));

// ── 9. createEnergyCreditsState ───────────────────────────────────────────────

group('9. createEnergyCreditsState');
{
  const st = createEnergyCreditsState();
  assert('9.1 get() retorna objeto', typeof st.get() === 'object');
  assert('9.2 route padrão = dashboard', st.get().route === 'dashboard');
  assert('9.3 persistenceMode padrão = preview', st.get().persistenceMode === 'preview');

  st.set({ route: 'financial' });
  assert('9.4 set atualiza route', st.get().route === 'financial');

  let notified = false;
  const unsub = st.subscribe((s) => { notified = s.route === 'reports'; });
  st.set({ route: 'reports' });
  assert('9.5 subscribe é notificado', notified);
  unsub();
  notified = false;
  st.set({ route: 'dashboard' });
  assert('9.6 unsubscribe para notificações', !notified);

  const st2 = createEnergyCreditsState({ persistenceMode: 'persist' });
  assert('9.7 initial state customizado', st2.get().persistenceMode === 'persist');

  st.reset();
  assert('9.8 reset restaura padrão', st.get().route === 'dashboard');
}

// ── 10. NAV_SECTIONS / ROUTE_LABELS ──────────────────────────────────────────

group('10. NAV_SECTIONS / ROUTE_LABELS');
assert('10.1 NAV_SECTIONS é array', Array.isArray(NAV_SECTIONS));
assert('10.2 tem ao menos 3 seções', NAV_SECTIONS.length >= 3);
assert('10.3 cada seção tem items', NAV_SECTIONS.every((s) => Array.isArray(s.items)));
assert('10.4 dashboard na primeira seção', NAV_SECTIONS[0].items.some((i) => i.route === 'dashboard'));
assert('10.5 generating-units presente', NAV_SECTIONS.flatMap((s) => s.items).some((i) => i.route === 'generating-units'));
assert('10.6 ROUTE_LABELS é objeto', typeof ROUTE_LABELS === 'object');
assert('10.7 dashboard label definido', typeof ROUTE_LABELS['dashboard'] === 'string');
assert('10.8 getRouteLabel retorna string', typeof getRouteLabel('dashboard') === 'string');
assert('10.9 getRouteLabel fallback para rota desconhecida', getRouteLabel('xxx') === 'xxx');
assert('10.10 ICONS é objeto com entradas', typeof ICONS.dashboard === 'string');

// ── 11. createEnergyCreditsRouter ─────────────────────────────────────────────

group('11. createEnergyCreditsRouter');
{
  const router = createEnergyCreditsRouter();
  assert('11.1 resolve retorna classe para dashboard', typeof router.resolve('dashboard') === 'function');
  assert('11.2 resolve retorna null para rota inválida', router.resolve('inexistente') === null);
  assert('11.3 getRoutes retorna array', Array.isArray(router.getRoutes()));
  assert('11.4 dashboard em getRoutes', router.getRoutes().includes('dashboard'));
  assert('11.5 generating-units em getRoutes', router.getRoutes().includes('generating-units'));
  assert('11.6 beneficiary-units em getRoutes', router.getRoutes().includes('beneficiary-units'));
  assert('11.7 monthly-settlement em getRoutes', router.getRoutes().includes('monthly-settlement'));
  assert('11.8 csv-import em getRoutes', router.getRoutes().includes('csv-import'));
  assert('11.9 utility-bill-import em getRoutes', router.getRoutes().includes('utility-bill-import'));
  assert('11.10 reports em getRoutes', router.getRoutes().includes('reports'));
  assert('11.11 financial em getRoutes', router.getRoutes().includes('financial'));
  assert('11.12 alerts em getRoutes', router.getRoutes().includes('alerts'));
  assert('11.13 isValidRoute para rota válida', router.isValidRoute('dashboard'));
  assert('11.14 isValidRoute false para rota inválida', !router.isValidRoute('inexistente'));
  assert('11.15 EC_ROUTE_REGISTRY tem 9 rotas', Object.keys(EC_ROUTE_REGISTRY).length === 9);
}

// ── 12. Components — ecLoadingState ───────────────────────────────────────────

group('12. Components HTML — ecLoadingState');
{
  const html = ecLoadingState();
  assert('12.1 retorna string', typeof html === 'string');
  assert('12.2 contém ec-loading', html.includes('ec-loading'));
  assert('12.3 contém ec-spinner', html.includes('ec-spinner'));
  assert('12.4 texto padrão', html.includes('Carregando'));
  assert('12.5 texto customizado', ecLoadingState('Aguarde...').includes('Aguarde'));
}

// ── 13. ecEmptyState ──────────────────────────────────────────────────────────

group('13. ecEmptyState');
{
  const html = ecEmptyState();
  assert('13.1 retorna string', typeof html === 'string');
  assert('13.2 contém ec-empty', html.includes('ec-empty'));
  assert('13.3 título padrão', html.includes('Nenhum dado disponível'));
  const custom = ecEmptyState({ title: 'Vazio', text: 'Sem registros', action: '<button>Ok</button>' });
  assert('13.4 título customizado', custom.includes('Vazio'));
  assert('13.5 texto presente', custom.includes('Sem registros'));
  assert('13.6 action presente', custom.includes('<button>Ok</button>'));
}

// ── 14. ecErrorState ──────────────────────────────────────────────────────────

group('14. ecErrorState');
{
  assert('14.1 array de errors', ecErrorState([{ message: 'Falhou' }]).includes('Falhou'));
  assert('14.2 string de erro', ecErrorState('Erro X').includes('Erro X'));
  assert('14.3 contém ec-error-state', ecErrorState('err').includes('ec-error-state'));
  assert('14.4 sem botão retry por padrão', !ecErrorState('err').includes('data-action="retry"'));
}

// ── 15. ecKpiCard ─────────────────────────────────────────────────────────────

group('15. ecKpiCard');
{
  const card = ecKpiCard({ label: 'Total', value: '42' });
  assert('15.1 retorna string', typeof card === 'string');
  assert('15.2 contém ec-kpi-card', card.includes('ec-kpi-card'));
  assert('15.3 label presente', card.includes('Total'));
  assert('15.4 value presente', card.includes('42'));
  assert('15.5 clickable com route', ecKpiCard({ label: 'L', value: 'V', route: 'dashboard' }).includes('ec-kpi-clickable'));
  assert('15.6 meta presente', ecKpiCard({ label: 'L', value: 'V', meta: 'info' }).includes('info'));
  assert('15.7 ecKpiGrid retorna string', typeof ecKpiGrid([{ label: 'A', value: '1' }]) === 'string');
  assert('15.8 ecKpiGrid contém grid', ecKpiGrid([]).includes('ec-kpi-grid'));
}

// ── 16. ecTable ───────────────────────────────────────────────────────────────

group('16. ecTable');
{
  const t = ecTable(['Nome', 'Valor'], [['João', 'R$ 100'], ['Maria', 'R$ 200']]);
  assert('16.1 retorna string', typeof t === 'string');
  assert('16.2 contém ec-table', t.includes('ec-table'));
  assert('16.3 headers presentes', t.includes('<th>Nome</th>') && t.includes('<th>Valor</th>'));
  assert('16.4 dados presentes', t.includes('João') && t.includes('Maria'));
  assert('16.5 table vazia mostra msg', ecTable(['A'], []).includes('Nenhum registro'));
  assert('16.6 msg customizada', ecTable(['A'], [], 'Nada').includes('Nada'));
  assert('16.7 ecActionBtn retorna string', typeof ecActionBtn('Ver', 'view') === 'string');
  assert('16.8 ecActionBtn contém data-action', ecActionBtn('Ver', 'view').includes('data-action="view"'));
}

// ── 17. ecStepper ─────────────────────────────────────────────────────────────

group('17. ecStepper');
{
  const steps = [{ label: 'Tipo' }, { label: 'Upload' }, { label: 'Prévia' }];
  const html = ecStepper(steps, 1);
  assert('17.1 retorna string', typeof html === 'string');
  assert('17.2 contém ec-stepper', html.includes('ec-stepper'));
  assert('17.3 step ativo', html.includes('ec-step-active'));
  assert('17.4 step concluído', html.includes('ec-step-done'));
  assert('17.5 labels presentes', html.includes('Tipo') && html.includes('Upload'));
  assert('17.6 ✓ no step concluído', html.includes('✓'));
}

// ── 18. ecBadges ──────────────────────────────────────────────────────────────

group('18. ecBadges');
{
  assert('18.1 ecPaymentBadge paid', ecPaymentBadge('paid').includes('ec-badge-paid'));
  assert('18.2 ecPaymentBadge open', ecPaymentBadge('open').includes('ec-badge-open'));
  assert('18.3 ecPaymentBadge overdue', ecPaymentBadge('overdue').includes('ec-badge-overdue'));
  assert('18.4 ecPaymentBadge fallback', ecPaymentBadge('unknown').includes('ec-badge-gray'));
  assert('18.5 ecImportStatusBadge pending', ecImportStatusBadge('pending').includes('ec-badge-gold'));
  assert('18.6 ecImportStatusBadge confirmed', ecImportStatusBadge('confirmed').includes('ec-badge-green'));
  assert('18.7 ecBadge personalizado', ecBadge('Texto', 'ec-badge-blue').includes('Texto'));
  assert('18.8 ecCoverageBadge low', ecCoverageBadge('low', '0,20 meses').includes('ec-coverage-low'));
  assert('18.9 ecCoverageBadge adequate', ecCoverageBadge('adequate', '1,0 meses').includes('ec-coverage-adequate'));
  assert('18.10 ecCoverageBadge high', ecCoverageBadge('high', '2,0 meses').includes('ec-coverage-high'));
}

// ── 19. ecMobileCardList ──────────────────────────────────────────────────────

group('19. ecMobileCardList');
{
  const html = ecMobileCardList([
    { title: 'UG 01', badge: '<span>OK</span>', fields: [{ label: 'Local', value: 'SP' }], actions: '<button>Ver</button>' },
  ]);
  assert('19.1 retorna string', typeof html === 'string');
  assert('19.2 contém ec-card-list', html.includes('ec-card-list'));
  assert('19.3 título presente', html.includes('UG 01'));
  assert('19.4 campo presente', html.includes('Local'));
  assert('19.5 valor presente', html.includes('SP'));
  assert('19.6 lista vazia retorna mensagem', ecMobileCardList([]).includes('Nenhum registro'));
}

// ── 20. ecShellHtml e ecModalHtml ─────────────────────────────────────────────

group('20. ecShellHtml / ecModalHtml');
{
  const shell = ecShellHtml();
  assert('20.1 shell retorna string', typeof shell === 'string');
  assert('20.2 shell tem ec-sidebar-wrapper', shell.includes('ec-sidebar-wrapper'));
  assert('20.3 shell tem ec-topbar', shell.includes('ec-topbar'));
  assert('20.4 shell tem ec-main-content', shell.includes('ec-main-content'));
  assert('20.5 shell tem ec-drawer-overlay', shell.includes('ec-drawer-overlay'));

  const modal = ecModalHtml({ title: 'Teste', body: '<p>Conteúdo</p>' });
  assert('20.6 modal retorna string', typeof modal === 'string');
  assert('20.7 modal tem ec-modal-backdrop', modal.includes('ec-modal-backdrop'));
  assert('20.8 modal tem título', modal.includes('Teste'));
  assert('20.9 modal tem conteúdo', modal.includes('Conteúdo'));
  assert('20.10 modal-lg com size=lg', ecModalHtml({ title: 'T', body: 'B', size: 'lg' }).includes('ec-modal-lg'));
}

// ── 21. EnergyCreditsApp construtor ───────────────────────────────────────────

group('21. EnergyCreditsApp — construtor');
{
  const mockProvider  = { getCapabilities: () => ({ ok: true, data: {} }) };
  const mockElement   = { classList: { add: () => {}, remove: () => {} }, innerHTML: '', addEventListener: () => {}, removeEventListener: () => {}, querySelector: () => null };

  let threw = false;
  try { new EnergyCreditsApp({}); } catch (e) { threw = true; }
  assert('21.1 lança sem provider', threw);

  threw = false;
  try { new EnergyCreditsApp({ provider: mockProvider }); } catch (e) { threw = true; }
  assert('21.2 lança sem mountElement', threw);

  const app = new EnergyCreditsApp({ provider: mockProvider, mountElement: mockElement });
  assert('21.3 cria sem erros com args válidos', app instanceof EnergyCreditsApp);
  assert('21.4 getCurrentRoute retorna initial', app.getCurrentRoute() === 'dashboard');
  assert('21.5 getState retorna objeto', typeof app.getState() === 'object');
  assert('21.6 getState.persistenceMode = preview', app.getState().persistenceMode === 'preview');

  const app2 = new EnergyCreditsApp({ provider: mockProvider, mountElement: mockElement, options: { persistenceMode: 'persist', initialRoute: 'reports' } });
  assert('21.7 initialRoute customizado', app2.getCurrentRoute() === 'reports');
  assert('21.8 persistenceMode customizado', app2.getState().persistenceMode === 'persist');
}

// ── 22. createEnergyCreditsApp factory ────────────────────────────────────────

group('22. createEnergyCreditsApp factory');
{
  const mockProvider = { getCapabilities: () => ({ ok: true, data: {} }) };
  const mockEl = { classList: { add: () => {}, remove: () => {} }, innerHTML: '', addEventListener: () => {}, removeEventListener: () => {}, querySelector: () => null };

  const app = createEnergyCreditsApp({ provider: mockProvider, mountElement: mockEl });
  assert('22.1 factory retorna EnergyCreditsApp', app instanceof EnergyCreditsApp);
}

// ── 23. Router resolve por classe ─────────────────────────────────────────────

group('23. Router — verifica classes resolvidas');
{
  const router = createEnergyCreditsRouter();
  const dashClass = router.resolve('dashboard');
  assert('23.1 dashboard resolve para classe com prototype', typeof dashClass?.prototype === 'object');

  const routesAll = router.getRoutes();
  let allResolve = true;
  routesAll.forEach((r) => { if (router.resolve(r) === null) allResolve = false; });
  assert('23.2 todas as 9 rotas resolvem', allResolve);
  assert('23.3 total de rotas = 9', routesAll.length === 9);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`energy-credits-ui-app: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
