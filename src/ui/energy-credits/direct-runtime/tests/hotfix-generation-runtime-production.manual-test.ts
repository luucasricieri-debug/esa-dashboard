'use strict';
/**
 * ESA OS — Hotfix: generation undefined + render loop
 *
 * Valida que energy-credits-v2.html não quebra com:
 *   1. plan undefined em modo real (crash plan.generation)
 *   2. loop infinito de componentDidUpdate (prevState sempre {})
 *   3. Propriedades irmãs de generation com dados parciais
 *
 * Rodar: npx tsx tests/hotfix-generation-runtime-production.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const HTML = path.join(ROOT, 'energy-credits-v2.html');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

const src = fs.readFileSync(HTML, 'utf-8');

// ── Suite 1: plan.generation guarded in shared return block ───────────────────

console.log('\nSuite 1 — plan.generation guarded in real mode');

assert(
  'totGenTxt usa S._rtMode === "real" para guard',
  src.includes('S._rtMode === "real" ? kwh(S._rtApPlan ? S._rtApPlan.generation : 0) : kwh(plan.generation)'),
);
assert(
  'totConsTxt usa S._rtMode === "real" para guard',
  src.includes('S._rtMode === "real" ? kwh(S._rtApPlan ? S._rtApPlan.totalConsumption : 0) : kwh(plan.totalConsumption)'),
);
assert(
  'totGenTxt não acessa plan.generation diretamente na linha',
  !src.includes('totGenTxt: kwh(plan.generation)'),
);
assert(
  'totConsTxt não acessa plan.totalConsumption diretamente na linha',
  !src.includes('totConsTxt: kwh(plan.totalConsumption)'),
);

// ── Suite 2: dashRT.current guarded ──────────────────────────────────────────

console.log('\nSuite 2 — dashRT.current guarded');

assert(
  '_dashCurr = dashRT ? (dashRT.current || {}) : {} presente',
  src.includes('const _dashCurr = dashRT ? (dashRT.current || {}) : {};'),
);
assert(
  'genKwh usa _dashCurr.generation',
  src.includes('const genKwh = _dashCurr.generation || 0;'),
);
assert(
  'balKwh usa _dashCurr.balance',
  src.includes('const balKwh = _dashCurr.balance || 0;'),
);
assert(
  'dashRT.current.generation não é acessado diretamente',
  !src.includes('dashRT.current.generation'),
);

// ── Suite 3: componentDidUpdate loop fix ──────────────────────────────────────

console.log('\nSuite 3 — componentDidUpdate loop fix (key dedup)');

assert(
  'dashKey usa state não prevState',
  src.includes("const dashKey = (this.state.dashMonth || '') + '|' + (this.state.ugFilter || 'all');"),
);
assert(
  'check usa dashKey !== _rtLastDashKey',
  src.includes('dashKey !== this.state._rtLastDashKey && !this.state._rtLoading'),
);
assert(
  '_rtLastDashKey init null no estado',
  src.includes('_rtLastDashKey: null'),
);
assert(
  '_loadRealDash stampa _rtLastDashKey antes do fetch',
  src.includes('_rtLastDashKey: dashKey') && src.includes('_rtLoading: true, _rtLastDashKey: dashKey'),
);
assert(
  'apKey usa apUgId|apMonth de state',
  src.includes("const apKey = (this.state.apUgId || '') + '|' + (this.state.apMonth || '');"),
);
assert(
  '_rtLastApKey usado na condicional',
  src.includes('apKey !== this.state._rtLastApKey && !this.state._rtApPlanLoading'),
);
assert(
  'repKey usa repUgId|repMonth de state',
  src.includes("const repKey = (this.state.repUgId || '') + '|' + (this.state.repMonth || '');"),
);
assert(
  '_rtLastRepKey usado na condicional',
  src.includes('repKey !== this.state._rtLastRepKey && !this.state._rtRepAllLoading'),
);
assert(
  '_rtLastFinMonth compara com finMonth do state',
  src.includes('this.state.finMonth !== this.state._rtLastFinMonth && !this.state._rtFinAllLoading'),
);
assert(
  '_rtLastAlMonth compara com alMonth do state',
  src.includes('this.state.alMonth !== this.state._rtLastAlMonth && !this.state._rtAlLoading'),
);

// ── Suite 4: load functions stamp key before async ────────────────────────────

console.log('\nSuite 4 — load functions stamp key at setState start');

assert(
  '_loadRealApPlan stampa _rtLastApKey',
  src.includes('_rtLastApKey: apKey'),
);
assert(
  '_loadRealReports stampa _rtLastRepKey',
  src.includes('_rtLastRepKey: repKey'),
);
assert(
  '_loadRealFin stampa _rtLastFinMonth',
  src.includes('_rtLastFinMonth: month'),
);
assert(
  '_loadRealAlerts stampa _rtLastAlMonth',
  src.includes('_rtLastAlMonth: month'),
);

// ── Suite 5: render error containment ─────────────────────────────────────────

console.log('\nSuite 5 — render error containment (try/catch + error state)');

assert(
  'renderVals tem try { return {',
  src.includes('try { return {'),
);
assert(
  'renderVals tem catch (_renderErr)',
  src.includes('catch (_renderErr)'),
);
assert(
  '_renderFatalLogged previne loop após primeiro erro',
  src.includes('this._renderFatalLogged = true'),
);
assert(
  'console.error no catch com mensagem não silenciosa',
  src.includes("console.error('[ESA] renderVals fatal error — transitioning to error state:'"),
);
assert(
  'catch faz setState _rtStatus: error',
  src.includes("setState({ _rtStatus: 'error', _rtError: 'render_error' })"),
);
assert(
  'rtRetry para render_error reseta _renderFatalLogged',
  src.includes('this._renderFatalLogged = false'),
);

// ── Suite 6: error message render_error ───────────────────────────────────────

console.log('\nSuite 6 — rtErrorMsg cobre render_error');

assert(
  'rtErrorMsg tem case render_error',
  src.includes('S._rtError === "render_error"'),
);
assert(
  'render_error tem mensagem não-técnica',
  src.includes('Erro ao processar dados do runtime. Tente novamente.'),
);

// ── Suite 7: UG detail dedup ──────────────────────────────────────────────────

console.log('\nSuite 7 — UG/UB detail id dedup');

assert(
  '_rtLastUgDetailId init null',
  src.includes('_rtLastUgDetailId: null'),
);
assert(
  'UG detail compara com _rtLastUgDetailId',
  src.includes('this.state.ugDetailId !== this.state._rtLastUgDetailId'),
);
assert(
  '_rtLastUbDetailId init null',
  src.includes('_rtLastUbDetailId: null'),
);
assert(
  'UB detail compara com _rtLastUbDetailId',
  src.includes('this.state.ubDetailId !== this.state._rtLastUbDetailId'),
);

// ── Suite 8: demo preserved ───────────────────────────────────────────────────

console.log('\nSuite 8 — demo mode preserved');

assert(
  'demo apuracao usa plan = computeAllocationPlan()',
  src.includes('plan = this.computeAllocationPlan(apUg, effOv);'),
);
assert(
  'demo totGenTxt usa kwh(plan.generation)',
  src.includes('kwh(plan.generation)'),
);
assert(
  'scaledResults preservado',
  src.includes('scaledResults(month, ugId)'),
);
assert(
  'aggregate preservado',
  src.includes('aggregate(results)'),
);
assert(
  'nenhum dado fictício adicionado',
  !src.includes('DEMO_GENERATION') && !src.includes('ficticio'),
);

// ── Suite 9: sibling properties guarded ──────────────────────────────────────

console.log('\nSuite 9 — sibling properties guarded');

assert(
  'r.generation || 0 usado no map do dashboard (chartGenVsCons)',
  src.includes('Math.round(r.generation || 0)'),
);
assert(
  'results.flatMap usa r.rows || []',
  src.includes('results.flatMap((r) => (r.rows || [])'),
);
assert(
  'r.ug guarded antes de acessar r.ug.name',
  src.includes('r.ug ? r.ug.name'),
);
assert(
  'repR.generation acessado via objeto com default',
  src.includes('generation: (repUg && repUg.monthlyGeneration) || 0'),
);

// ── Suite 10: loop prevention verified via state keys ─────────────────────────

console.log('\nSuite 10 — all dedup state keys initialized in initial state');

const stateBlock = src.match(/_rtLastDashKey: null[\s\S]*?_rtLastUbDetailId: null/);
assert(
  'todos os 7 dedup keys presentes no bloco de estado',
  !!stateBlock &&
  stateBlock[0].includes('_rtLastDashKey: null') &&
  stateBlock[0].includes('_rtLastApKey: null') &&
  stateBlock[0].includes('_rtLastRepKey: null') &&
  stateBlock[0].includes('_rtLastFinMonth: null') &&
  stateBlock[0].includes('_rtLastAlMonth: null') &&
  stateBlock[0].includes('_rtLastUgDetailId: null') &&
  stateBlock[0].includes('_rtLastUbDetailId: null'),
);
assert(
  'componentDidUpdate não usa prevState.dashMonth',
  !src.includes('prevState.dashMonth'),
);
assert(
  'componentDidUpdate não usa prevState.ugFilter',
  !src.includes('prevState.ugFilter'),
);
assert(
  'componentDidUpdate não usa prevState.apUgId',
  !src.includes('prevState.apUgId'),
);
assert(
  'componentDidUpdate não usa prevState.finMonth',
  !src.includes('prevState.finMonth'),
);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Hotfix generation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
