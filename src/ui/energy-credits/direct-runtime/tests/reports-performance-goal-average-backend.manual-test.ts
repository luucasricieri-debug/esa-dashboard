'use strict';
/**
 * ESA OS — Relatórios: backend do indicador "Percentual médio da meta"
 *
 * Testa, com EXECUÇÃO REAL de netlify/functions/reports-performance-goal-average.js
 * e netlify/functions/_shared/reports-permissions.js (Firebase fake injetado via
 * require.cache — nenhum Firebase real é tocado): Lucas visualiza, Fernando
 * visualiza, outro usuário é bloqueado, uid do body é ignorado (fonte de
 * verdade é sempre o token verificado), validação de entrada, e ausência de
 * NaN/Infinity na resposta.
 *
 * Rodar: npx tsx tests/reports-performance-goal-average-backend.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
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

process.env.UPLOAD_SESSION_SECRET = 'test-secret-for-reports-suite';

const uploadSession = require(path.join(NF, '_shared/upload-session.js'));
const permissions = require(path.join(NF, '_shared/reports-permissions.js'));
const SECRET = process.env.UPLOAD_SESSION_SECRET as string;

// ── Fake RTDB (mesma interface: db.ref(path).once('value')) ─────────────────

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
    id: fbAdminPath,
    filename: fbAdminPath,
    loaded: true,
    exports: { getDatabase: () => db },
  } as unknown as NodeModule;
}

function freshRequire(modPath: string) {
  const resolved = require.resolve(modPath);
  delete require.cache[resolved];
  return require(resolved);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite RPA1 — reports-permissions.js: allowlist + capability (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite RPA1 — hasPerformanceGoalAveragePermission(): allowlist + capability grant');

assert('RPA01 lucas_vizentin autorizado (uid direto)', permissions.hasPerformanceGoalAveragePermission('lucas_vizentin', {}));
assert('RPA02 fernando_fadel_mphd4rj6 autorizado (uid direto)', permissions.hasPerformanceGoalAveragePermission('fernando_fadel_mphd4rj6', {}));
assert('RPA03 outro uid qualquer NÃO autorizado por padrão', !permissions.hasPerformanceGoalAveragePermission('outro_uid_qualquer', {}));
assert('RPA04 uid não autorizado, mas com capability explícita concedida no Firebase: autorizado',
  permissions.hasPerformanceGoalAveragePermission('qualquer_outro', { capabilities: { [permissions.PERMISSION_KEY]: true } }));
assert('RPA05 capability com valor não-true não concede acesso',
  !permissions.hasPerformanceGoalAveragePermission('qualquer_outro', { capabilities: { [permissions.PERMISSION_KEY]: 'sim' } }));
assert('RPA06 PERMISSION_KEY é exatamente "reports.performanceGoalAverage.read"', permissions.PERMISSION_KEY === 'reports.performanceGoalAverage.read');
assert('RPA07 usuário nulo/indefinido não quebra a checagem (sem capability, sem uid autorizado -> false)',
  !permissions.hasPerformanceGoalAveragePermission('outro', undefined as any));

// ═══════════════════════════════════════════════════════════════════════════
// Suite RPA2 — reports-performance-goal-average.js: execução real ponta a ponta
// ═══════════════════════════════════════════════════════════════════════════

async function run() {
  console.log('\nSuite RPA2 — Lucas Vizentin visualiza (execução real)');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);
    const days = [{ date: '2026-08-03', newClients: { realizado: 3, meta: 2 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 8, meta: 10 } }];
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days }) } as any);
    const resBody = JSON.parse(res.body);
    assert('RPA08 Lucas: HTTP 200', res.statusCode === 200);
    assert('RPA09 Lucas: ok === true', resBody.ok === true);
    assert('RPA10 Lucas: percentualMédio do exemplo da tarefa === 76.67', resBody.periodGoalAveragePercentage === 76.67);
    assert('RPA11 Lucas: validDaysCount === 1', resBody.validDaysCount === 1);
    assert('RPA12 Lucas: breakdown por indicador presente (newClients capped=100)', resBody.days[0].indicators.newClients.capped === 100);
  }

  console.log('\nSuite RPA3 — Fernando Fadel visualiza (execução real)');
  {
    const db = makeFakeDb({ 'users/fernando_fadel_mphd4rj6': { uid: 'fernando_fadel_mphd4rj6', name: 'Fernando Fadel', level: 'gestor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('fernando_fadel_mphd4rj6', SECRET);
    const days = [{ date: '2026-08-03', newClients: { realizado: 5, meta: 5 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 4, meta: 4 } }];
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days }) } as any);
    assert('RPA13 Fernando: HTTP 200', res.statusCode === 200);
    assert('RPA14 Fernando: ok === true', JSON.parse(res.body).ok === true);
  }

  console.log('\nSuite RPA4 — outro usuário é bloqueado no backend (não apenas escondido no frontend)');
  {
    const db = makeFakeDb({ 'users/outro_executivo': { uid: 'outro_executivo', name: 'Outro Executivo', level: 'executivo' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('outro_executivo', SECRET);
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: [] }) } as any);
    const resBody = JSON.parse(res.body);
    assert('RPA15 outro usuário: HTTP 403', res.statusCode === 403);
    assert('RPA16 outro usuário: code === no_permission', resBody.code === 'no_permission');
    assert('RPA17 outro usuário: nenhum dado de cálculo vaza na resposta de bloqueio', resBody.days === undefined && resBody.periodGoalAveragePercentage === undefined);
  }

  console.log('\nSuite RPA5 — uid do body é ignorado: só o uid do token verificado decide a permissão');
  {
    const db = makeFakeDb({
      'users/outro_executivo': { uid: 'outro_executivo', name: 'Outro Executivo', level: 'executivo' },
      'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' },
    });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    // Token pertence a "outro_executivo", mas o body finge ser lucas_vizentin — não deve enganar o backend.
    const tokenOutro = uploadSession.generateToken('outro_executivo', SECRET);
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: tokenOutro, uid: 'lucas_vizentin', days: [] }) } as any);
    assert('RPA18 uid falso no body não concede acesso — bloqueado (403), pois a checagem usa o uid do TOKEN', res.statusCode === 403);
  }

  console.log('\nSuite RPA6 — capability concedida via Firebase (extensão sem novo deploy)');
  {
    const db = makeFakeDb({ 'users/uid_com_capability': { uid: 'uid_com_capability', name: 'Alguém', level: 'executivo', capabilities: { 'reports.performanceGoalAverage.read': true } } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('uid_com_capability', SECRET);
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: [] }) } as any);
    assert('RPA19 uid fora da allowlist mas com capability no Firebase: autorizado (200)', res.statusCode === 200);
  }

  console.log('\nSuite RPA7 — validação de entrada e ausência de NaN/Infinity/negativo');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);

    const resNotArray = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: 'não é array' }) } as any);
    assert('RPA20 days não é array: HTTP 400', resNotArray.statusCode === 400);

    const resBadDate = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: [{ date: 'não-é-data' }] }) } as any);
    assert('RPA21 data mal formatada: HTTP 400', resBadDate.statusCode === 400);

    // meta 0 / ausente não gera divisão inválida — vira missing_goal, resposta sempre 200
    const resZeroGoal = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: [{ date: '2026-08-03', newClients: { realizado: 5, meta: 0 } }] }) } as any);
    const bodyZeroGoal = JSON.parse(resZeroGoal.body);
    assert('RPA22 meta 0: HTTP 200 (não é erro — é sinalizado como missing_goal)', resZeroGoal.statusCode === 200);
    assert('RPA23 meta 0: indicador sinalizado como missing_goal, não NaN/Infinity', bodyZeroGoal.days[0].indicators.newClients.status === 'missing_goal');

    // Nenhum indicador do dia com meta configurada -> status not_configured, average null
    const resNoConfig = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: [{ date: '2026-08-03' }] }) } as any);
    const bodyNoConfig = JSON.parse(resNoConfig.body);
    assert('RPA24 dia totalmente sem meta configurada: validDaysCount=0 (não conta como dia zerado)', bodyNoConfig.validDaysCount === 0);
    assert('RPA25 dia totalmente sem meta: periodGoalAveragePercentage === null (não 0 silencioso)', bodyNoConfig.periodGoalAveragePercentage === null);

    // Realizado negativo -> vira 0, nunca percentual negativo
    const resNegative = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: [{ date: '2026-08-03', newClients: { realizado: -100, meta: 5 } }] }) } as any);
    const bodyNegative = JSON.parse(resNegative.body);
    assert('RPA26 realizado negativo: percentual capado nunca fica negativo', (bodyNegative.days[0].indicators.newClients.capped as number) >= 0);

    // Período de vários dias, sem duplicar
    const manyDays = [
      { date: '2026-08-03', newClients: { realizado: 5, meta: 5 }, qualifiedLeads: { realizado: 2, meta: 2 }, completedAttendances: { realizado: 2, meta: 2 } },
      { date: '2026-08-04', newClients: { realizado: 0, meta: 5 }, qualifiedLeads: { realizado: 0, meta: 2 }, completedAttendances: { realizado: 0, meta: 2 } },
    ];
    const resPeriod = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: manyDays }) } as any);
    const bodyPeriod = JSON.parse(resPeriod.body);
    assert('RPA27 período de 2 dias: validDaysCount === 2', bodyPeriod.validDaysCount === 2);
    assert('RPA28 período de 2 dias: (100+0)/2 = 50', bodyPeriod.periodGoalAveragePercentage === 50);
    assert('RPA29 nenhum valor NaN/Infinity na resposta inteira', !JSON.stringify(bodyPeriod).match(/NaN|Infinity/));
  }

  console.log('\nSuite RPA8 — token expirado/inválido bloqueado (reutiliza o mesmo fluxo seguro)');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const resNoToken = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ days: [] }) } as any);
    assert('RPA30 sem sessionToken: HTTP 401 invalid_session', resNoToken.statusCode === 401 && JSON.parse(resNoToken.body).code === 'invalid_session');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Reports Performance Goal Average Backend Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
