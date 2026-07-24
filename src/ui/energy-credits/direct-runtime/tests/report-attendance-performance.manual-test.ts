'use strict';
/**
 * ESA OS — Relatórios: correção de "Atendimentos Realizados" (Percentual médio da meta)
 *
 * Incidente: no relatório "Percentual médio da meta", a coluna "Atendimentos
 * Realizados (realizado/meta)" mostrava sempre 0/48 (0%) para todos os
 * colaboradores, mesmo havendo histórico real de atendimentos no período —
 * porque renderRelCharts() nunca chamava ensureAgEvsLoaded() (só renderMetas()
 * chamava), então o cálculo client-side (countMetaFor(...,'atendimentos',...))
 * rodava contra agEvs={} sempre que o usuário não tivesse visitado
 * Agenda/Minhas Metas na mesma sessão.
 *
 * Correção: o backend (reports-performance-goal-average.js) agora lê
 * events/{date} diretamente via Firebase Admin (apenas as datas do período,
 * nunca o nó inteiro) e calcula o realizado usando assets/attendance-
 * performance.js — nova fonte única, testada aqui em paridade exata com a
 * regra já usada (e comprovada em produção) por countMeta('atendimentos') em
 * index.html (tela Minhas Metas, que este teste NÃO altera).
 *
 * Suites:
 *   AP1 — paridade exata: attendance-performance.js vs countMeta('atendimentos') real
 *   AP2 — regras de negócio isoladas (autor/convidado/status/retomada/nome)
 *   AP3 — período (inclusão de bordas, sem deslocamento de fuso horário)
 *   AP4 — backend reports-performance-goal-average.js: targetUid lê events e sobrescreve realizado
 *   AP5 — diagnósticos (REPORT_ATTENDANCE_DIAGNOSTICS) e scripts/diagnose-report-attendances.js
 *   AP6 — regressão: Novos Clientes/Leads Qualificados/fórmula/permissão inalterados
 *
 * Rodar: npx tsx tests/report-attendance-performance.manual-test.ts
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

const currentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const attendance = require(path.join(ROOT, 'assets/attendance-performance.js'));

function extractFunction(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`função não encontrada: ${startPattern}`);
  const start = m.index;
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  if (src[i] === ';') i++;
  return src.slice(start, i);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite AP1 — Paridade exata com countMeta('atendimentos') (Minhas Metas)
// ═══════════════════════════════════════════════════════════════════════════

console.log("\nSuite AP1 — attendance-performance.js reproduz EXATAMENTE a regra de countMeta('atendimentos')");

{
  const countMetaSrc = extractFunction(currentHtml, /function countMeta\(/);
  const context = vm.createContext({
    console, Date, Object,
    window: { _metaDataSel: null } as Record<string, unknown>,
    CU: { uid: 'x', name: 'x' },
    crmDeals: {},
    allProsp: {},
    agEvs: {} as Record<string, unknown>,
  });
  vm.runInContext(`${countMetaSrc}\nthis.__countMeta = countMeta;`, context);
  const countMeta = context.__countMeta as (list: unknown[], id: string, uid?: string, name?: string) => number;

  // Nota de fidelidade: a regra REAL de countMeta('atendimentos') exige
  // resultado==='sucesso' E (tipo_atendimento ausente OU==='cliente') E
  // exclui type/tipo_atendimento==='retomada'. attendance-performance.js
  // replica essa MESMA regra (ver isAttendanceSuccessfullyCompleted) —
  // preservando a paridade exigida com a tela Minhas Metas, já corrigida e
  // validada em produção.
  type Ev = Record<string, unknown>;
  const fixtures: Array<{ label: string; day: string; events: Record<string, Ev>; person: string }> = [
    {
      label: 'autor com sucesso e cliente conta',
      day: '2026-07-01',
      events: { e1: { author: 'Felipe dos Santos', resultado: 'sucesso', tipo_atendimento: 'cliente', guests: [] } },
      person: 'Felipe dos Santos',
    },
    {
      label: 'convidado confirmado conta',
      day: '2026-07-02',
      events: { e1: { author: 'Outra Pessoa', resultado: 'sucesso', tipo_atendimento: 'cliente', guests: [{ name: 'Felipe dos Santos', status: 'confirmed' }] } },
      person: 'Felipe dos Santos',
    },
    {
      label: 'convidado pendente NÃO conta',
      day: '2026-07-03',
      events: { e1: { author: 'Outra Pessoa', resultado: 'sucesso', tipo_atendimento: 'cliente', guests: [{ name: 'Felipe dos Santos', status: 'pending' }] } },
      person: 'Felipe dos Santos',
    },
    {
      label: 'resultado != sucesso NÃO conta',
      day: '2026-07-04',
      events: { e1: { author: 'Felipe dos Santos', resultado: 'cancelado', tipo_atendimento: 'cliente', guests: [] } },
      person: 'Felipe dos Santos',
    },
    {
      label: 'tipo_atendimento retomada NÃO conta',
      day: '2026-07-05',
      events: { e1: { author: 'Felipe dos Santos', resultado: 'sucesso', tipo_atendimento: 'retomada', guests: [] } },
      person: 'Felipe dos Santos',
    },
    {
      label: 'type retomada (campo alternativo) NÃO conta',
      day: '2026-07-06',
      events: { e1: { author: 'Felipe dos Santos', type: 'retomada', resultado: 'sucesso', tipo_atendimento: 'cliente', guests: [] } },
      person: 'Felipe dos Santos',
    },
    {
      label: 'tipo_atendimento diferente de cliente/ausente NÃO conta (paridade com Minhas Metas)',
      day: '2026-07-07',
      events: { e1: { author: 'Felipe dos Santos', resultado: 'sucesso', tipo_atendimento: 'interno', guests: [] } },
      person: 'Felipe dos Santos',
    },
    {
      label: 'autor E convidado confirmado no MESMO evento conta uma única vez',
      day: '2026-07-08',
      events: { e1: { author: 'Felipe dos Santos', resultado: 'sucesso', tipo_atendimento: 'cliente', guests: [{ name: 'Felipe dos Santos', status: 'confirmed' }] } },
      person: 'Felipe dos Santos',
    },
  ];

  fixtures.forEach((fx, idx) => {
    (context as any).agEvs = { [fx.day]: fx.events };
    (context as any).window._metaDataSel = fx.day;
    const real = countMeta([], 'atendimentos', 'uid-x', fx.person);
    const shared = attendance.countAttendancesForPersonOnDate(fx.events, fx.person);
    assert(`AP01.${idx + 1} paridade "${fx.label}": countMeta=${real} === attendance-performance=${shared}`, real === shared);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite AP2 — Regras de negócio isoladas (Seção 12 da tarefa)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite AP2 — regras isoladas: autor/convidado/status/retomada/nome');

{
  const base = { resultado: 'sucesso', tipo_atendimento: 'cliente' };

  assert('AP02 autor com sucesso conta', attendance.isAttendanceSuccessfullyCompleted({ ...base, author: 'Felipe dos Santos' })
    && attendance.isPersonParticipantInAttendance({ ...base, author: 'Felipe dos Santos' }, 'Felipe dos Santos'));

  assert('AP03 convidado confirmado conta', attendance.isPersonParticipantInAttendance(
    { guests: [{ name: 'Felipe dos Santos', status: 'confirmed' }] }, 'Felipe dos Santos'));

  assert('AP04 convidado pendente NÃO conta', !attendance.isPersonParticipantInAttendance(
    { guests: [{ name: 'Felipe dos Santos', status: 'pending' }] }, 'Felipe dos Santos'));

  assert('AP05 convidado recusado (declined) NÃO conta', !attendance.isPersonParticipantInAttendance(
    { guests: [{ name: 'Felipe dos Santos', status: 'declined' }] }, 'Felipe dos Santos'));

  assert('AP06 convidado convidado/invited NÃO conta', !attendance.isPersonParticipantInAttendance(
    { guests: [{ name: 'Felipe dos Santos', status: 'invited' }] }, 'Felipe dos Santos'));

  assert('AP07 convidado sem status NÃO conta', !attendance.isPersonParticipantInAttendance(
    { guests: [{ name: 'Felipe dos Santos' }] }, 'Felipe dos Santos'));

  assert('AP08 resultado != sucesso NÃO conta', !attendance.isAttendanceSuccessfullyCompleted({ ...base, resultado: 'falha', author: 'x' }));

  assert('AP09 resultado ausente NÃO conta', !attendance.isAttendanceSuccessfullyCompleted({ tipo_atendimento: 'cliente', author: 'x' }));

  assert('AP10 retomada (tipo_atendimento) NÃO conta', !attendance.isAttendanceSuccessfullyCompleted({ resultado: 'sucesso', tipo_atendimento: 'retomada' }));

  assert('AP11 retomada (type) NÃO conta', !attendance.isAttendanceSuccessfullyCompleted({ resultado: 'sucesso', type: 'retomada', tipo_atendimento: 'cliente' }));

  assert('AP12 outro usuário (autor diferente, sem ser convidado) NÃO conta', !attendance.isPersonParticipantInAttendance(
    { author: 'Outra Pessoa', guests: [] }, 'Felipe dos Santos'));

  assert('AP13 evento com autor e convidado confirmado (mesma pessoa) conta apenas 1 (boolean único, sem soma dupla)',
    attendance.countAttendancesForPersonOnDate(
      { e1: { ...base, author: 'Felipe dos Santos', guests: [{ name: 'Felipe dos Santos', status: 'confirmed' }] } },
      'Felipe dos Santos',
    ) === 1);

  // Normalização de nome
  assert('AP14 acento: "José" casa com "Jose"', attendance.normalizePersonName('José') === attendance.normalizePersonName('Jose'));
  assert('AP15 case: "FELIPE DOS SANTOS" casa com "felipe dos santos"',
    attendance.normalizePersonName('FELIPE DOS SANTOS') === attendance.normalizePersonName('felipe dos santos'));
  assert('AP16 espaços extras: "Felipe   dos Santos " normaliza igual a "Felipe dos Santos"',
    attendance.normalizePersonName('Felipe   dos Santos ') === attendance.normalizePersonName('Felipe dos Santos'));
  assert('AP17 nomes parecidos NÃO são confundidos: "Felipe dos Santos" != "Felipe Santos Junior"',
    attendance.normalizePersonName('Felipe dos Santos') !== attendance.normalizePersonName('Felipe Santos Junior'));
  assert('AP18 correspondência nunca é por substring: "Felipe" isolado não casa com "Felipe dos Santos"',
    !attendance.isPersonParticipantInAttendance({ author: 'Felipe dos Santos' }, 'Felipe'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite AP3 — Período: bordas inclusivas, múltiplos dias/eventos/usuários
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite AP3 — período (2026-07-01 a 2026-07-24): bordas inclusivas, sem deslocamento de fuso');

{
  const base = { resultado: 'sucesso', tipo_atendimento: 'cliente' };
  const eventsByDate: Record<string, Record<string, unknown>> = {
    '2026-07-01': { e1: { ...base, author: 'Felipe dos Santos' } }, // primeiro dia do período
    '2026-07-10': {
      e1: { ...base, author: 'Felipe dos Santos' },
      e2: { ...base, author: 'Jéssica Lane' },
      e3: { ...base, guests: [{ name: 'Felipe dos Santos', status: 'confirmed' }] },
    }, // múltiplos eventos, múltiplos usuários, mesmo dia
    '2026-07-24': { e1: { ...base, author: 'Felipe dos Santos' } }, // último dia do período (inclusivo)
    '2026-07-25': { e1: { ...base, author: 'Felipe dos Santos' } }, // FORA do período — não deve contar
    '2026-06-30': { e1: { ...base, author: 'Felipe dos Santos' } }, // FORA do período (antes do início)
  };

  const felipeCount = attendance.countAttendancesForPersonInPeriod(eventsByDate, 'Felipe dos Santos', '2026-07-01', '2026-07-24');
  const felipeCountIncludingNextDay = attendance.countAttendancesForPersonInPeriod(eventsByDate, 'Felipe dos Santos', '2026-07-01', '2026-07-25');
  assert('AP19 primeiro dia do período (2026-07-01) conta', attendance.countAttendancesForPersonOnDate(eventsByDate['2026-07-01'], 'Felipe dos Santos') === 1);
  assert('AP20 último dia do período (2026-07-24) conta (borda inclusiva)', attendance.countAttendancesForPersonOnDate(eventsByDate['2026-07-24'], 'Felipe dos Santos') === 1);
  assert('AP21 data posterior ao período (2026-07-25) NÃO conta quando endDate=2026-07-24 (só conta se o período for estendido até 07-25)', felipeCountIncludingNextDay === felipeCount + 1);
  assert('AP22 múltiplos eventos no mesmo dia (2026-07-10): Felipe aparece como autor em 1 e convidado confirmado em outro = 2 no dia',
    attendance.countAttendancesForPersonOnDate(eventsByDate['2026-07-10'], 'Felipe dos Santos') === 2);
  assert('AP23 múltiplos usuários no mesmo dia: Jéssica Lane conta separadamente (1)',
    attendance.countAttendancesForPersonOnDate(eventsByDate['2026-07-10'], 'Jéssica Lane') === 1);
  assert('AP24 total do período para Felipe dos Santos = 1(dia1) + 2(dia10) + 1(dia24) = 4 (dias fora do período excluídos)', felipeCount === 4);

  const noMatchOtherPeriod = attendance.countAttendancesForPersonInPeriod(eventsByDate, 'Felipe dos Santos', '2026-08-01', '2026-08-31');
  assert('AP25 período diferente (agosto) não enxerga eventos de julho', noMatchOtherPeriod === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite AP4 — Backend: reports-performance-goal-average.js lê events/{date} via targetUid
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite AP4 — backend: targetUid faz o endpoint ler events/{date} e sobrescrever completedAttendances.realizado');

process.env.UPLOAD_SESSION_SECRET = 'test-secret-for-attendance-report-suite';
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

// Fixture fiel ao incidente relatado: período 2026-07-01 a 2026-07-24, Felipe
// dos Santos com histórico real de atendimentos, um segundo colaborador
// (Jéssica Lane) também com histórico.
function buildAttendanceFixtureTree(): Tree {
  const base = { resultado: 'sucesso', tipo_atendimento: 'cliente' };
  return {
    'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' },
    'users/felipe_santos': { uid: 'felipe_santos', name: 'Felipe dos Santos', level: 'executivo' },
    'users/jessica_lane': { uid: 'jessica_lane', name: 'Jéssica Lane', level: 'executivo' },
    'events/2026-07-01': { e1: { ...base, author: 'Felipe dos Santos' }, e2: { ...base, author: 'Jéssica Lane' } },
    'events/2026-07-02': { e1: { ...base, author: 'Felipe dos Santos' } },
    'events/2026-07-10': {
      e1: { ...base, author: 'Felipe dos Santos' },
      e2: { ...base, resultado: 'cancelado', author: 'Felipe dos Santos' }, // não deve contar
      e3: { ...base, tipo_atendimento: 'retomada', author: 'Felipe dos Santos' }, // não deve contar
      e4: { ...base, guests: [{ name: 'Jéssica Lane', status: 'confirmed' }] },
    },
    'events/2026-07-24': { e1: { ...base, author: 'Felipe dos Santos' } }, // último dia (borda inclusiva)
    'events/2026-07-25': { e1: { ...base, author: 'Felipe dos Santos' } }, // fora do período
  };
}

async function runBackendSuites() {
  {
    const db = makeFakeDb(buildAttendanceFixtureTree());
    installFakeFirebaseAdmin(db);
    delete process.env.REPORT_ATTENDANCE_DIAGNOSTICS;
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);

    // Meta diária de 2/dia × 24 dias = 48, exatamente como no incidente relatado.
    const dates = ['2026-07-01', '2026-07-02', '2026-07-10', '2026-07-24'];
    const days = dates.map((date) => ({
      date,
      newClients: { realizado: 0, meta: 2 },
      qualifiedLeads: { realizado: 0, meta: 2 },
      completedAttendances: { realizado: 0, meta: 2 }, // placeholder do cliente — deve ser IGNORADO
    }));

    const res = await fn.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ sessionToken: token, days, targetUid: 'felipe_santos' }),
    } as any);
    const body = JSON.parse(res.body);

    assert('AP26 HTTP 200', res.statusCode === 200);
    const byDate: Record<string, any> = {};
    body.days.forEach((d: any) => { byDate[d.date] = d; });

    assert('AP27 2026-07-01: Felipe tem 1 atendimento (autor), realizado sobrescrito pelo backend', byDate['2026-07-01'].completedAttendances.realizado === 1);
    assert('AP28 2026-07-02: Felipe tem 1 atendimento', byDate['2026-07-02'].completedAttendances.realizado === 1);
    assert('AP29 2026-07-10: Felipe tem 1 (cancelado e retomada excluídos corretamente, mesmo havendo 3 eventos com seu nome)', byDate['2026-07-10'].completedAttendances.realizado === 1);
    assert('AP30 2026-07-24 (último dia do período): Felipe tem 1 atendimento (borda inclusiva)', byDate['2026-07-24'].completedAttendances.realizado === 1);
    assert('AP31 meta permanece 2 por dia (backend não altera a meta, só o realizado)', byDate['2026-07-01'].completedAttendances.meta === 2);
    assert('AP32 total de atendimentos de Felipe no período = 4 (1+1+1+1), não 0/48 do incidente', dates.reduce((s, d) => s + byDate[d].completedAttendances.realizado, 0) === 4);

    // percentual individual do dia: 1/2 = 50%, capado a 100 (não se aplica aqui pois <100)
    assert('AP33 percentual individual de completedAttendances no dia 07-01 é 50 (1/2*100), não 0%', byDate['2026-07-01'].indicators.completedAttendances.capped === 50);
  }

  console.log('\nSuite AP4b — segundo colaborador (Jéssica Lane) também corrigido, sem confundir com Felipe');
  {
    const db = makeFakeDb(buildAttendanceFixtureTree());
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);
    const dates = ['2026-07-01', '2026-07-10'];
    const days = dates.map((date) => ({ date, completedAttendances: { realizado: 0, meta: 2 } }));
    const res = await fn.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ sessionToken: token, days, targetUid: 'jessica_lane' }),
    } as any);
    const body = JSON.parse(res.body);
    const byDate: Record<string, any> = {};
    body.days.forEach((d: any) => { byDate[d.date] = d; });
    assert('AP34 Jéssica Lane em 2026-07-01: 1 atendimento (autor)', byDate['2026-07-01'].completedAttendances.realizado === 1);
    assert('AP35 Jéssica Lane em 2026-07-10: 1 atendimento (convidada confirmada)', byDate['2026-07-10'].completedAttendances.realizado === 1);
  }

  console.log('\nSuite AP4c — sem targetUid: comportamento antigo preservado (confia no realizado do cliente) — compatibilidade');
  {
    const db = makeFakeDb(buildAttendanceFixtureTree());
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);
    const res = await fn.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ sessionToken: token, days: [{ date: '2026-07-01', completedAttendances: { realizado: 7, meta: 2 } }] }),
    } as any);
    const body = JSON.parse(res.body);
    assert('AP36 sem targetUid: realizado do cliente é preservado (não sobrescrito)', body.days[0].completedAttendances.realizado === 7);
  }

  console.log('\nSuite AP5 — diagnósticos gated por REPORT_ATTENDANCE_DIAGNOSTICS');
  {
    const db = makeFakeDb(buildAttendanceFixtureTree());
    installFakeFirebaseAdmin(db);
    process.env.REPORT_ATTENDANCE_DIAGNOSTICS = 'true';
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);
    const days = [{ date: '2026-07-01', completedAttendances: { realizado: 0, meta: 2 } }];
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days, targetUid: 'felipe_santos' }) } as any);
    const body = JSON.parse(res.body);
    assert('AP37 com flag=true: attendanceDiagnostics presente na resposta', !!body.attendanceDiagnostics);
    assert('AP38 attendanceDiagnostics.sourceNode === "events"', body.attendanceDiagnostics.sourceNode === 'events');
    assert('AP39 attendanceDiagnostics.resolvedPersonName === "Felipe dos Santos"', body.attendanceDiagnostics.resolvedPersonName === 'Felipe dos Santos');
    assert('AP40 attendanceDiagnostics.matchedAsAuthor >= 1', body.attendanceDiagnostics.matchedAsAuthor >= 1);
    assert('AP41 attendanceDiagnostics não expõe descrição do evento nem tokens/secrets', !JSON.stringify(body.attendanceDiagnostics).match(/secret|token|SECRET|TOKEN/));
    delete process.env.REPORT_ATTENDANCE_DIAGNOSTICS;

    const fn2 = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const res2 = await fn2.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days, targetUid: 'felipe_santos' }) } as any);
    const body2 = JSON.parse(res2.body);
    assert('AP42 com flag ausente/false: attendanceDiagnostics NÃO aparece na resposta', body2.attendanceDiagnostics === undefined);
  }

  console.log('\nSuite AP6 — regressão: Novos Clientes/Leads Qualificados/fórmula/permissão inalterados');
  {
    const db = makeFakeDb(buildAttendanceFixtureTree());
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);
    const days = [{
      date: '2026-07-01',
      newClients: { realizado: 3, meta: 2 },
      qualifiedLeads: { realizado: 1, meta: 2 },
      completedAttendances: { realizado: 0, meta: 2 },
    }];
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days, targetUid: 'felipe_santos' }) } as any);
    const body = JSON.parse(res.body);
    assert('AP43 Novos Clientes não é afetado por targetUid (permanece o valor enviado pelo cliente: 3/2 capado a 100)', body.days[0].indicators.newClients.capped === 100);
    assert('AP44 Leads Qualificados não é afetado por targetUid (1/2 = 50%)', body.days[0].indicators.qualifiedLeads.capped === 50);
    assert('AP45 nenhum NaN/Infinity na resposta inteira', !JSON.stringify(body).match(/NaN|Infinity/));

    const dbBloqueado = makeFakeDb({ 'users/outro_uid': { uid: 'outro_uid', name: 'Outro', level: 'executivo' } });
    installFakeFirebaseAdmin(dbBloqueado);
    const fnBloqueado = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const tokenOutro = uploadSession.generateToken('outro_uid', SECRET);
    const resBloqueado = await fnBloqueado.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: tokenOutro, days: [], targetUid: 'felipe_santos' }) } as any);
    assert('AP46 permissão continua bloqueando quem não é Lucas/Fernando, mesmo com targetUid no body', resBloqueado.statusCode === 403);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Suite AP7 — scripts/diagnose-report-attendances.js (execução real, Firebase fake)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\nSuite AP7 — scripts/diagnose-report-attendances.js: núcleo testável (Firebase fake)');
  {
    const diag = require(path.join(ROOT, 'scripts/diagnose-report-attendances.js'));
    const db = makeFakeDb(buildAttendanceFixtureTree());
    const report = await diag.diagnoseReportAttendances(db, { startDate: '2026-07-01', endDate: '2026-07-24', uid: 'felipe_santos' });

    assert('AP47 period reflete o intervalo pedido', report.period.startDate === '2026-07-01' && report.period.endDate === '2026-07-24');
    assert('AP48 datesRead cobre exatamente 24 dias (2026-07-01 a 2026-07-24, inclusive)', report.datesRead.length === 24);
    assert('AP49 datesRead começa em 2026-07-01 e termina em 2026-07-24', report.datesRead[0] === '2026-07-01' && report.datesRead[report.datesRead.length - 1] === '2026-07-24');
    assert('AP50 resolvedPersonName === "Felipe dos Santos" (resolvido via users/{uid})', report.resolvedPersonName === 'Felipe dos Santos');
    assert('AP51 eventsRead > 0 (leu registros reais)', report.eventsRead > 0);
    assert('AP52 successfulEvents conta os eventos com resultado=sucesso e tipo_atendimento válido', report.successfulEvents > 0);
    assert('AP53 excludedRetomada === 1 (o evento e3 do dia 07-10)', report.excludedRetomada === 1);
    assert('AP54 matchedAsAuthor conta os eventos onde Felipe é autor', report.matchedAsAuthor >= 3);
    assert('AP55 finalTotal === 4 (mesmo total computado pelo backend)', report.finalTotal === 4);
    assert('AP56 namesFoundInEvents inclui "Felipe dos Santos" e "Jéssica Lane"',
      report.namesFoundInEvents.includes('Felipe dos Santos') && report.namesFoundInEvents.includes('Jéssica Lane'));
    assert('AP57 relatório não inclui tokens/secrets', !JSON.stringify(report).match(/secret|SECRET/));

    const reportByName = await diag.diagnoseReportAttendances(db, { startDate: '2026-07-01', endDate: '2026-07-24', name: 'Felipe dos Santos' });
    assert('AP58 funciona também via --name direto (sem --uid)', reportByName.finalTotal === 4 && reportByName.userFound === null);

    const reportOutOfRange = await diag.diagnoseReportAttendances(db, { startDate: '2026-08-01', endDate: '2026-08-31', uid: 'felipe_santos' });
    assert('AP59 período sem eventos (agosto): finalTotal === 0', reportOutOfRange.finalTotal === 0);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Report Attendance Performance Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

runBackendSuites();
