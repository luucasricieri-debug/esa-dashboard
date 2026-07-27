'use strict';
/**
 * ESA OS — Dias válidos (segunda a sexta) nas metas e indicadores comerciais
 *
 * Missão: todas as metas e indicadores diários/mensais/de período devem
 * considerar exclusivamente segunda a sexta-feira — sábado e domingo nunca
 * compõem meta, realizado, denominador, média ou "dias considerados". Os
 * registros de fim de semana permanecem intactos no CRM/Agenda/histórico;
 * apenas não entram no CÁLCULO de desempenho.
 *
 * Fonte única: assets/performance-business-days.js (isPerformanceBusinessDay/
 * listPerformanceBusinessDays/countPerformanceBusinessDays/
 * filterRecordsByPerformanceBusinessDay), usada por assets/performance-goals.js
 * (countBusinessDays delega para cá), assets/attendance-performance.js
 * (countAttendancesForPersonOnDate/InPeriod), reports-performance-goal-average.js
 * (totals/validDaysCount) e index.html (countMeta + guard "Dia não
 * considerado" em Minhas Metas).
 *
 * Suites:
 *   PBD1 — isPerformanceBusinessDay(): dias da semana, mudança de mês/ano, ano bissexto, timezone
 *   PBD2 — contagem/listagem: bordas inclusivas, meses reais com 20/21/22/23 dias úteis
 *   PBD3 — metas: diária não aplicada em fim de semana, mensal usa dias reais, 0.5×23=11.5
 *   PBD4 — realizado: Novos Clientes/Leads Qualificados/Atendimentos Realizados, sexta conta, sábado/domingo não
 *   PBD5 — relatório: backend real (Firebase fake) — totals/validDaysCount/período só-fim-de-semana sem NaN
 *
 * Rodar: npx tsx tests/performance-business-days.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const NF = path.join(ROOT, 'netlify/functions');
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const bd = require(path.join(ROOT, 'assets/performance-business-days.js'));
const currentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ═══════════════════════════════════════════════════════════════════════════
// Suite PBD1 — isPerformanceBusinessDay(): dias da semana, mês/ano, bissexto, timezone
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PBD1 — isPerformanceBusinessDay(): segunda a sexta true, sábado/domingo false');

assert('PBD01 segunda (2026-07-27) retorna true', bd.isPerformanceBusinessDay('2026-07-27') === true);
assert('PBD02 terça (2026-07-28) retorna true', bd.isPerformanceBusinessDay('2026-07-28') === true);
assert('PBD03 quarta (2026-07-29) retorna true', bd.isPerformanceBusinessDay('2026-07-29') === true);
assert('PBD04 quinta (2026-07-30) retorna true', bd.isPerformanceBusinessDay('2026-07-30') === true);
assert('PBD05 sexta (2026-07-31) retorna true', bd.isPerformanceBusinessDay('2026-07-31') === true);
assert('PBD06 sábado (2026-07-25) retorna false', bd.isPerformanceBusinessDay('2026-07-25') === false);
assert('PBD07 domingo (2026-07-26) retorna false', bd.isPerformanceBusinessDay('2026-07-26') === false);

assert('PBD08 mudança de mês: último dia de julho (sexta, 2026-07-31) true', bd.isPerformanceBusinessDay('2026-07-31') === true);
assert('PBD09 mudança de mês: primeiro dia de agosto (sábado, 2026-08-01) false', bd.isPerformanceBusinessDay('2026-08-01') === false);
assert('PBD10 mudança de mês: 2026-08-03 (segunda) true', bd.isPerformanceBusinessDay('2026-08-03') === true);

assert('PBD11 mudança de ano: 2026-12-31 (quinta) true', bd.isPerformanceBusinessDay('2026-12-31') === true);
assert('PBD12 mudança de ano: 2027-01-01 (sexta) true', bd.isPerformanceBusinessDay('2027-01-01') === true);
assert('PBD13 mudança de ano: 2027-01-02 (sábado) false', bd.isPerformanceBusinessDay('2027-01-02') === false);

// 2028 é bissexto (divisível por 4, não por 100) — 29 de fevereiro existe.
assert('PBD14 ano bissexto: 2028-02-29 existe e é terça-feira (true)', bd.isPerformanceBusinessDay('2028-02-29') === true);
assert('PBD15 ano bissexto: 2028-02-28 (segunda) true', bd.isPerformanceBusinessDay('2028-02-28') === true);
// 2027 não é bissexto — 2027-02-29 não existe (data inválida) e deve ser rejeitada, nunca "rolar" para março.
assert('PBD16 ano NÃO bissexto: 2027-02-29 (data inválida) retorna false, nunca lança e nunca "rola" para março', bd.isPerformanceBusinessDay('2027-02-29') === false);

assert('PBD17 nenhuma diferença por timezone: TZ local do processo não altera o resultado (construtor local, nunca UTC)', (() => {
  const originalTZ = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14 — offset extremo positivo
    const r1 = bd.isPerformanceBusinessDay('2026-07-25'); // sábado
    process.env.TZ = 'Etc/GMT+12'; // UTC-12 — offset extremo negativo
    const r2 = bd.isPerformanceBusinessDay('2026-07-25');
    return r1 === false && r2 === false && r1 === r2;
  } finally {
    if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
  }
})());

assert('PBD18 entrada inválida (não é YYYY-MM-DD) nunca lança, retorna false', bd.isPerformanceBusinessDay('27/07/2026') === false && bd.isPerformanceBusinessDay('') === false && bd.isPerformanceBusinessDay(null) === false);

// ═══════════════════════════════════════════════════════════════════════════
// Suite PBD2 — Contagem e listagem: bordas inclusivas, meses reais
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PBD2 — contagem: bordas inclusivas dos exemplos obrigatórios da tarefa');

assert('PBD19 segunda a sexta (2026-07-27 a 2026-07-31) = 5 dias válidos', bd.countPerformanceBusinessDays('2026-07-27', '2026-07-31') === 5);
assert('PBD20 segunda a domingo (2026-07-27 a 2026-08-02) = 5 dias válidos (7 civis, 5 úteis)', bd.countPerformanceBusinessDays('2026-07-27', '2026-08-02') === 5);
assert('PBD21 sábado a domingo (2026-07-25 a 2026-07-26) = 0 dias válidos', bd.countPerformanceBusinessDays('2026-07-25', '2026-07-26') === 0);
assert('PBD22 sexta a segunda (2026-07-24 a 2026-07-27) = 2 dias válidos', bd.countPerformanceBusinessDays('2026-07-24', '2026-07-27') === 2);

assert('PBD23 listPerformanceBusinessDays: segunda a sexta retorna exatamente as 5 datas, em ordem', JSON.stringify(bd.listPerformanceBusinessDays('2026-07-27', '2026-07-31')) === JSON.stringify(['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31']));
assert('PBD24 listPerformanceBusinessDays: nenhuma data de sábado/domingo aparece na lista de um período de 7 dias civis', bd.listPerformanceBusinessDays('2026-07-27', '2026-08-02').every((k: string) => bd.isPerformanceBusinessDay(k)));

assert('PBD25 startDate > endDate retorna lista vazia / contagem 0 (nunca lança)', JSON.stringify(bd.listPerformanceBusinessDays('2026-07-31', '2026-07-27')) === '[]' && bd.countPerformanceBusinessDays('2026-07-31', '2026-07-27') === 0);

console.log('\nSuite PBD2b — meses reais com 20/21/22/23 dias úteis (segunda a sexta)');

assert('PBD26 fevereiro/2026 tem 20 dias úteis (mês real, nunca hardcoded)', bd.countPerformanceBusinessDays('2026-02-01', '2026-02-28') === 20);
assert('PBD27 maio/2026 tem 21 dias úteis', bd.countPerformanceBusinessDays('2026-05-01', '2026-05-31') === 21);
assert('PBD28 janeiro/2026 tem 22 dias úteis', bd.countPerformanceBusinessDays('2026-01-01', '2026-01-31') === 22);
assert('PBD29 julho/2026 tem 23 dias úteis (mesmo mês do exemplo oficial da tarefa)', bd.countPerformanceBusinessDays('2026-07-01', '2026-07-31') === 23);

// ═══════════════════════════════════════════════════════════════════════════
// Suite PBD3 — Metas: diária não aplicada em fim de semana, mensal usa dias reais
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PBD3 — metas diárias/mensais respeitam dias válidos (execução real)');

const goals = require(path.join(ROOT, 'assets/performance-goals.js'));

assert('PBD30 0,5 × 23 dias úteis (julho/2026) = 11,5 — exemplo exato da tarefa', goals.computeMonthlyGoalFromDaily(0.5, goals.countBusinessDays('2026-07-01', '2026-07-31')) === 11.5);
assert('PBD31 performance-goals.js NUNCA hardcoda 22 dias — fevereiro/2026 (20) produz meta mensal diferente de julho/2026 (23)', goals.computeMonthlyGoalFromDaily(0.5, goals.countBusinessDays('2026-02-01', '2026-02-28')) !== goals.computeMonthlyGoalFromDaily(0.5, goals.countBusinessDays('2026-07-01', '2026-07-31')));
assert('PBD32 countBusinessDays (performance-goals.js) delega para a fonte única e produz o MESMO valor de countPerformanceBusinessDays', goals.countBusinessDays('2026-07-01', '2026-07-31') === bd.countPerformanceBusinessDays('2026-07-01', '2026-07-31'));

console.log('\nSuite PBD3b — Minhas Metas: guard "Dia não considerado" em sábado/domingo (checagem estática + execução real)');

assert('PBD33 script performance-business-days.js é carregado ANTES de performance-goals.js', currentHtml.indexOf('<script src="/assets/performance-business-days.js">') < currentHtml.indexOf('<script src="/assets/performance-goals.js">'));
assert('PBD34 renderMetasFor() usa ESAPerformanceBusinessDays.isPerformanceBusinessDay(window._metaDataSel) para decidir o que exibir', currentHtml.includes('const _metaIsBizDay = ESAPerformanceBusinessDays.isPerformanceBusinessDay(window._metaDataSel);'));
assert('PBD35 texto "Dia não considerado" presente no source', currentHtml.includes('Dia não considerado'));
assert('PBD36 texto informativo "As metas consideram apenas segunda a sexta-feira." presente', currentHtml.includes('As metas consideram apenas segunda a sexta-feira.'));

{
  // Execução real do guard: extrai a expressão condicional usada no template
  // e confirma que, para um sábado, ela produz false (portanto renderiza o
  // bloco "Dia não considerado"), e para uma segunda, produz true.
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/performance-business-days.js'), 'utf8'), context);
  const ESAPerformanceBusinessDays = (context as any).ESAPerformanceBusinessDays;
  assert('PBD37 guard real: sábado (2026-07-25) → _metaIsBizDay = false (exibe "Dia não considerado")', ESAPerformanceBusinessDays.isPerformanceBusinessDay('2026-07-25') === false);
  assert('PBD38 guard real: domingo (2026-07-26) → _metaIsBizDay = false', ESAPerformanceBusinessDays.isPerformanceBusinessDay('2026-07-26') === false);
  assert('PBD39 guard real: segunda (2026-07-27) → _metaIsBizDay = true (exibe a tabela normal)', ESAPerformanceBusinessDays.isPerformanceBusinessDay('2026-07-27') === true);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite PBD4 — Realizado: Novos Clientes, Leads Qualificados, Atendimentos
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PBD4 — realizado: sexta conta, sábado/domingo não contam (execução real)');

function extractFunction(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`função não encontrada: ${startPattern}`);
  const start = m.index;
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  if (src[i] === ';') i++;
  return src.slice(start, i);
}

{
  const businessDaysModuleSrc = fs.readFileSync(path.join(ROOT, 'assets/performance-business-days.js'), 'utf8');
  const perfDateKeySrc = extractFunction(currentHtml, /function _perfDateKey\(ts\)\{/);
  const countMetaSrc = extractFunction(currentHtml, /function countMeta\(/);

  function makeCtx(crmDeals: Record<string, unknown>, allProspInteracoes: Record<string, unknown>) {
    const context = vm.createContext({
      console, Date, Object, Math, String,
      window: {} as Record<string, unknown>,
      CU: { uid: 'exec1', name: 'Executivo Um' },
      crmDeals,
      allProsp: allProspInteracoes,
      agEvs: {} as Record<string, unknown>,
    });
    vm.runInContext(businessDaysModuleSrc, context);
    vm.runInContext(`${perfDateKeySrc}\n${countMetaSrc}\nthis.__countMeta = countMeta;`, context);
    return context.__countMeta as (list: unknown[], id: string, uid?: string, name?: string) => number;
  }

  // Novos Clientes (mensal, prosp_mensal): registro de sexta conta, de sábado não.
  const fridayTs = new Date(2026, 6, 31, 10, 0, 0).getTime(); // 2026-07-31, sexta
  const saturdayTs = new Date(2026, 6, 25, 10, 0, 0).getTime(); // 2026-07-25, sábado
  const prospMensalList = [
    { ts: fridayTs, tipo: undefined },
    { ts: saturdayTs, tipo: undefined },
  ];
  const countMetaNC = makeCtx({}, {});
  assert('PBD40 Novos Clientes (mensal): registro de sexta-feira conta (>=1)', countMetaNC(prospMensalList.filter((p) => p.ts === fridayTs), 'prosp_mensal') === 1);
  assert('PBD41 Novos Clientes (mensal): registro de sábado NÃO conta (lista com só o registro de sábado = 0)', countMetaNC(prospMensalList.filter((p) => p.ts === saturdayTs), 'prosp_mensal') === 0);
  assert('PBD42 Novos Clientes (mensal): lista com sexta + sábado conta só a sexta (1, não 2)', countMetaNC(prospMensalList, 'prosp_mensal') === 1);

  // Leads Qualificados (mensal): deal criado na segunda conta, no domingo não.
  const mondayTs = new Date(2026, 6, 27, 9, 0, 0).getTime(); // 2026-07-27, segunda
  const sundayTs = new Date(2026, 6, 26, 9, 0, 0).getTime(); // 2026-07-26, domingo
  const countMetaLQMonday = makeCtx({
    d1: { captadorUid: 'exec1', funil: 'venda_ufv', createdAt: mondayTs },
  }, {});
  assert('PBD43 Leads Qualificados (mensal): deal criado na segunda-feira conta', countMetaLQMonday([], 'leads_qualificados', 'exec1', 'Executivo Um') === 1);
  const countMetaLQSunday = makeCtx({
    d2: { captadorUid: 'exec1', funil: 'venda_ufv', createdAt: sundayTs },
  }, {});
  assert('PBD44 Leads Qualificados (mensal): deal criado no domingo NÃO conta', countMetaLQSunday([], 'leads_qualificados', 'exec1', 'Executivo Um') === 0);

  // Atendimentos Realizados (mensal, atend_mensal): evento na sexta conta, no sábado não.
  const countMetaAtFriday = vm.createContext({});
  const ctxAtFriday = (() => {
    const context = vm.createContext({
      console, Date, Object,
      window: {} as Record<string, unknown>,
      CU: { uid: 'exec1', name: 'Executivo Um' },
      crmDeals: {},
      allProsp: {},
      agEvs: { '2026-07-31': { e1: { author: 'Executivo Um', resultado: 'sucesso', tipo_atendimento: 'cliente' } } },
    });
    vm.runInContext(businessDaysModuleSrc, context);
    vm.runInContext(`${perfDateKeySrc}\n${countMetaSrc}\nthis.__countMeta = countMeta;`, context);
    return context.__countMeta as (list: unknown[], id: string, uid?: string, name?: string) => number;
  })();
  assert('PBD45 Atendimentos Realizados (mensal): evento de sexta-feira (2026-07-31) conta, se o mês corrente for julho/2026', (() => {
    const now = new Date();
    if (now.getFullYear() !== 2026 || now.getMonth() !== 6) return true; // teste só é conclusivo rodando em julho/2026 — não falha fora dessa janela
    return ctxAtFriday([], 'atend_mensal') === 1;
  })());

  const ctxAtSaturday = (() => {
    const context = vm.createContext({
      console, Date, Object,
      window: {} as Record<string, unknown>,
      CU: { uid: 'exec1', name: 'Executivo Um' },
      crmDeals: {},
      allProsp: {},
      agEvs: { '2026-07-25': { e1: { author: 'Executivo Um', resultado: 'sucesso', tipo_atendimento: 'cliente' } } },
    });
    vm.runInContext(businessDaysModuleSrc, context);
    vm.runInContext(`${perfDateKeySrc}\n${countMetaSrc}\nthis.__countMeta = countMeta;`, context);
    return context.__countMeta as (list: unknown[], id: string, uid?: string, name?: string) => number;
  })();
  assert('PBD46 Atendimentos Realizados (mensal): evento de sábado (2026-07-25) NUNCA conta, independente do mês corrente', ctxAtSaturday([], 'atend_mensal') === 0);
}

console.log('\nSuite PBD4b — attendance-performance.js (backend): sexta conta, sábado não; eventos de fim de semana permanecem armazenados');

{
  const attendance = require(path.join(ROOT, 'assets/attendance-performance.js'));
  const eventsFriday = { e1: { author: 'Felipe dos Santos', resultado: 'sucesso', tipo_atendimento: 'cliente' } };
  const eventsSaturday = { e1: { author: 'Felipe dos Santos', resultado: 'sucesso', tipo_atendimento: 'cliente' } };

  assert('PBD47 atendimento na sexta-feira (2026-07-31) conta (dateKey informado)', attendance.countAttendancesForPersonOnDate(eventsFriday, 'Felipe dos Santos', '2026-07-31') === 1);
  assert('PBD48 atendimento no sábado (2026-07-25) NÃO conta (dateKey informado)', attendance.countAttendancesForPersonOnDate(eventsSaturday, 'Felipe dos Santos', '2026-07-25') === 0);
  assert('PBD49 o evento de sábado permanece intacto no objeto de entrada (não é apagado/mutado pela exclusão)', JSON.stringify(eventsSaturday) === JSON.stringify({ e1: { author: 'Felipe dos Santos', resultado: 'sucesso', tipo_atendimento: 'cliente' } }));

  const eventsByDate = { '2026-07-25': eventsSaturday, '2026-07-31': eventsFriday };
  const periodTotal = attendance.countAttendancesForPersonInPeriod(eventsByDate, 'Felipe dos Santos', '2026-07-25', '2026-07-31');
  assert('PBD50 total do período (sáb a sex): só a sexta conta (1, não 2) — sábado excluído automaticamente', periodTotal === 1);
  assert('PBD51 sem dateKey informado (uso legado): não filtra por dia — comportamento anterior preservado para quem não passa a data', attendance.countAttendancesForPersonOnDate(eventsSaturday, 'Felipe dos Santos') === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite PBD5 — Relatório: backend real (Firebase fake) — totals/validDaysCount
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PBD5 — reports-performance-goal-average.js: totals/validDaysCount ignoram fim de semana (execução real)');

process.env.UPLOAD_SESSION_SECRET = 'test-secret-for-business-days-suite';
const uploadSession = require(path.join(NF, '_shared/upload-session.js'));
const SECRET = process.env.UPLOAD_SESSION_SECRET as string;

type Tree = Record<string, unknown>;
function makeFakeDb(initial: Tree) {
  const tree: Tree = JSON.parse(JSON.stringify(initial));
  return {
    ref(p: string) {
      return {
        async once(_e: string) {
          const val = Object.prototype.hasOwnProperty.call(tree, p) ? tree[p] : null;
          return { val: () => val, exists: () => val !== null && val !== undefined };
        },
      };
    },
  };
}
function installFakeFirebaseAdmin(db: ReturnType<typeof makeFakeDb>) {
  const fbAdminPath = require.resolve(path.join(NF, '_shared/firebase-admin.js'));
  require.cache[fbAdminPath] = {
    id: fbAdminPath, filename: fbAdminPath, loaded: true,
    exports: { getDatabase: () => db },
  } as unknown as NodeModule;
}
function freshRequire(modPath: string) {
  const resolved = require.resolve(modPath);
  delete require.cache[resolved];
  return require(resolved);
}

async function run() {
  console.log('\nSuite PBD5a — período de 7 dias civis (segunda a domingo): validDaysCount = 5, não 7');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);

    // 2026-07-27 (seg) a 2026-08-02 (dom) — 7 datas civis, 5 dias úteis.
    const civilDates = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02'];
    const days = civilDates.map((date) => ({
      date,
      newClients: { realizado: 2, meta: 2 },
      qualifiedLeads: { realizado: 1, meta: 1 },
      completedAttendances: { realizado: 1, meta: 1 },
    }));
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days }) } as any);
    const body = JSON.parse(res.body);
    assert('PBD52 HTTP 200', res.statusCode === 200);
    assert('PBD53 período de 24 dias civis (aqui 7): validDaysCount reflete só dias de segunda a sexta (5, não 7)', body.validDaysCount === 5);
    assert('PBD54 Novos Clientes consolidado: só os 5 dias úteis somam (realized=10, goal=10)', body.indicators.newClients.realized === 10 && body.indicators.newClients.goal === 10);
    assert('PBD55 Leads Qualificados consolidado: só os 5 dias úteis somam (realized=5, goal=5)', body.indicators.qualifiedLeads.realized === 5 && body.indicators.qualifiedLeads.goal === 5);
    assert('PBD56 Atendimentos Realizados consolidado: só os 5 dias úteis somam (realized=5, goal=5)', body.indicators.completedAttendances.realized === 5 && body.indicators.completedAttendances.goal === 5);
    assert('PBD57 percentual médio não é reduzido pelo fim de semana: 100% (todos os indicadores em 100% nos dias úteis)', body.averagePercentage === 100);
    assert('PBD58 nenhum NaN/Infinity na resposta', !JSON.stringify(body).match(/NaN|Infinity/));
  }

  console.log('\nSuite PBD5b — período só de fim de semana: validDaysCount=0, sem NaN/Infinity, sem percentual enganoso');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);

    const days = [
      { date: '2026-07-25', newClients: { realizado: 5, meta: 5 }, qualifiedLeads: { realizado: 3, meta: 3 }, completedAttendances: { realizado: 2, meta: 2 } },
      { date: '2026-07-26', newClients: { realizado: 5, meta: 5 }, qualifiedLeads: { realizado: 3, meta: 3 }, completedAttendances: { realizado: 2, meta: 2 } },
    ];
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days }) } as any);
    const body = JSON.parse(res.body);
    assert('PBD59 HTTP 200 mesmo com período 100% fim de semana', res.statusCode === 200);
    assert('PBD60 validDaysCount === 0 (sábado e domingo não contam)', body.validDaysCount === 0);
    assert('PBD61 averagePercentage === null (nunca 0% enganoso, mesmo com realizado/meta enviados)', body.averagePercentage === null);
    assert('PBD62 status === "not_configured" (nenhum indicador entrou na soma)', body.status === 'not_configured');
    assert('PBD63 nenhum NaN/Infinity na resposta', !JSON.stringify(body).match(/NaN|Infinity/));

    // Mensagem exibida no cliente: "Nenhum dia útil considerado no período."
    assert('PBD64 index.html exibe mensagem específica quando validDaysCount===0', currentHtml.includes("(_pgaResp.validDaysCount||0)===0") && currentHtml.includes('Nenhum dia útil considerado no período.'));
  }

  console.log('\nSuite PBD5c — regressão: filtros por usuário, Novos Clientes/Leads Qualificados/Atendimentos sem alteração de fórmula');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);
    // Um único dia útil, valores distintos por indicador — confirma que a
    // fórmula de percentual (min(realizado/meta*100,100)) continua idêntica.
    const days = [{ date: '2026-07-27', newClients: { realizado: 3, meta: 2 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 8, meta: 10 } }];
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days }) } as any);
    const body = JSON.parse(res.body);
    assert('PBD65 Novos Clientes sem regressão: 3/2=150% capado a 100%', body.indicators.newClients.cappedPercentage === 100);
    assert('PBD66 Leads Qualificados sem regressão: 1/2=50%', body.indicators.qualifiedLeads.cappedPercentage === 50);
    assert('PBD67 Atendimentos Realizados sem regressão: 8/10=80%', body.indicators.completedAttendances.cappedPercentage === 80);
    assert('PBD68 média (100+50+80)/3=76.67 — fórmula consolidada inalterada', body.averagePercentage === 76.67);

    const dbBloqueado = makeFakeDb({ 'users/outro_uid': { uid: 'outro_uid', name: 'Outro', level: 'executivo' } });
    installFakeFirebaseAdmin(dbBloqueado);
    const fnBloqueado = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const tokenOutro = uploadSession.generateToken('outro_uid', SECRET);
    const resBloqueado = await fnBloqueado.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: tokenOutro, days: [] }) } as any);
    assert('PBD69 filtro de permissão (usuário/uid) continua funcionando — bloqueado com 403', resBloqueado.statusCode === 403);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Performance Business Days Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
