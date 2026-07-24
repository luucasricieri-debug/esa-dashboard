'use strict';
/**
 * ESA OS — Relatórios: correção da fórmula do "Percentual médio da meta"
 *
 * Incidente: as 3 colunas do relatório ("Novos Clientes", "Leads
 * Qualificados", "Atendimentos Realizados") exibiam percentuais consolidados
 * corretos, mas a coluna principal "Percentual médio da meta" mostrava um
 * valor diferente da média simples dessas 3 colunas visíveis.
 *
 * Causa raiz: reports-performance-goal-average.js calculava o valor
 * principal via computePeriodGoalAveragePercentage(), que é a MÉDIA DAS
 * MÉDIAS DIÁRIAS (cada dia contribui sua própria média de 3 indicadores
 * capados individualmente por dia, depois essas médias diárias são
 * calculadas). Isso diverge matematicamente da fórmula oficial: a média dos
 * 3 percentuais CONSOLIDADOS do período inteiro (realizadoTotal/metaTotal
 * por indicador, teto de 100%, depois média simples dos 3).
 *
 * Correção: nova função computeConsolidatedGoalAveragePercentage() em
 * assets/performance-goals.js, usada pelo backend para computar os totais do
 * período uma única vez — o mesmo valor retornado é usado tanto para as 3
 * colunas quanto para a coluna principal, eliminando qualquer divergência.
 *
 * Suites:
 *   CP1 — computeConsolidatedGoalAveragePercentage(): os 4 exemplos exatos do incidente
 *   CP2 — casos de borda (teto 100%, meta zero/ausente, realizado zero, sem compensação cruzada)
 *   CP3 — backend: valor principal é sempre a média das 3 colunas retornadas (integração real)
 *   CP4 — backend: prova de divergência entre a fórmula antiga (dia-a-dia) e a nova (consolidada)
 *   CP5 — regressão: Novos Clientes/Leads Qualificados/Atendimentos Realizados inalterados
 *
 * Rodar: npx tsx tests/report-consolidated-percentage.manual-test.ts
 */

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
function assertClose(label: string, actual: number, expected: number, tolerance = 0.01): void {
  assert(`${label} (obtido=${actual}, esperado=${expected})`, Math.abs(actual - expected) <= tolerance);
}

const goals = require(path.join(ROOT, 'assets/performance-goals.js'));

// ═══════════════════════════════════════════════════════════════════════════
// Suite CP1 — Os 4 exemplos exatos do incidente confirmado em produção
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite CP1 — computeConsolidatedGoalAveragePercentage(): exemplos exatos do incidente');

{
  // Cada indicador recebe {realized, goal} escolhido para que o percentual
  // consolidado resultante seja EXATAMENTE o percentual do incidente relatado
  // (realized/goal*100 = percentual desejado, com goal=100 por simplicidade).
  function fx(newClientsPct: number, qualifiedLeadsPct: number, completedAttendancesPct: number) {
    return {
      newClients: { realized: newClientsPct, goal: 100 },
      qualifiedLeads: { realized: qualifiedLeadsPct, goal: 100 },
      completedAttendances: { realized: completedAttendancesPct, goal: 100 },
    };
  }

  const yasmin = goals.computeConsolidatedGoalAveragePercentage(fx(24.17, 100, 47.92));
  assertClose('CP01 Yasmin Crosoletti: (24,17 + 100 + 47,92) / 3 = 57,36', yasmin.averagePercentage, 57.36);

  const jessica = goals.computeConsolidatedGoalAveragePercentage(fx(100, 25, 20.83));
  assertClose('CP02 Jéssica Lane: (100 + 25 + 20,83) / 3 = 48,61', jessica.averagePercentage, 48.61);

  const jaqueline = goals.computeConsolidatedGoalAveragePercentage(fx(12.5, 50, 10.42));
  assertClose('CP03 Jaqueline Demarchi: (12,5 + 50 + 10,42) / 3 = 24,31', jaqueline.averagePercentage, 24.31);

  const felipe = goals.computeConsolidatedGoalAveragePercentage(fx(61.67, 100, 91.67));
  assertClose('CP04 Felipe dos Santos: (61,67 + 100 + 91,67) / 3 = 84,45', felipe.averagePercentage, 84.45);

  assert('CP05 Yasmin: cappedPercentage de cada indicador é preservado sem arredondamento adicional (24.17 exato)', yasmin.indicators.newClients.cappedPercentage === 24.17);
  assert('CP06 Yasmin: status === "ok" (os 3 indicadores configurados)', yasmin.status === 'ok');
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite CP2 — Casos de borda
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite CP2 — casos de borda: teto, meta zero/ausente, realizado zero, sem compensação cruzada');

{
  const teto = goals.computeConsolidatedGoalAveragePercentage({
    newClients: { realized: 150, goal: 100 },
    qualifiedLeads: { realized: 50, goal: 100 },
    completedAttendances: { realized: 50, goal: 100 },
  });
  assert('CP07 percentual acima de 100 recebe teto (150% -> 100%)', teto.indicators.newClients.cappedPercentage === 100);
  assertClose('CP08 média com teto aplicado: (100+50+50)/3 = 66.67, não (150+50+50)/3=83.33', teto.averagePercentage, 66.67);

  const semCompensacao = goals.computeConsolidatedGoalAveragePercentage({
    newClients: { realized: 300, goal: 100 }, // 300% -> capado a 100
    qualifiedLeads: { realized: 0, goal: 100 },
    completedAttendances: { realized: 0, goal: 100 },
  });
  assert('CP09 realizado muito acima da meta NÃO compensa outros indicadores zerados (não vira 100%)', semCompensacao.averagePercentage !== 100);
  assertClose('CP10 excesso de um indicador não compensa os outros: (100+0+0)/3 = 33.33', semCompensacao.averagePercentage, 33.33);

  const metaZero = goals.computeConsolidatedGoalAveragePercentage({
    newClients: { realized: 5, goal: 0 },
    qualifiedLeads: { realized: 50, goal: 100 },
    completedAttendances: { realized: 50, goal: 100 },
  });
  assert('CP11 meta zero em um indicador: esse indicador não conta na soma (cappedPercentage null)', metaZero.indicators.newClients.cappedPercentage === null);
  assert('CP12 meta zero: status = incomplete_configuration (não trava o cálculo dos outros 2)', metaZero.status === 'incomplete_configuration');
  assertClose('CP13 meta zero: média ainda divide por 3 (0+50+50)/3 = 33.33, indicador ausente contribui 0', metaZero.averagePercentage, 33.33);

  const metaAusente = goals.computeConsolidatedGoalAveragePercentage({
    newClients: { realized: 5 }, // goal ausente
    qualifiedLeads: { realized: 50, goal: 100 },
    completedAttendances: { realized: 50, goal: 100 },
  });
  assert('CP14 meta ausente: mesmo tratamento de meta zero (missing_goal)', metaAusente.indicators.newClients.cappedPercentage === null);

  const todasAusentes = goals.computeConsolidatedGoalAveragePercentage({
    newClients: { realized: 5, goal: 0 },
    qualifiedLeads: { realized: 5, goal: 0 },
    completedAttendances: { realized: 5, goal: 0 },
  });
  assert('CP15 as 3 metas ausentes: status = not_configured', todasAusentes.status === 'not_configured');
  assert('CP16 as 3 metas ausentes: averagePercentage === null (nunca 0 silencioso)', todasAusentes.averagePercentage === null);

  const realizadoZero = goals.computeConsolidatedGoalAveragePercentage({
    newClients: { realized: 0, goal: 100 },
    qualifiedLeads: { realized: 0, goal: 100 },
    completedAttendances: { realized: 0, goal: 100 },
  });
  assert('CP17 realizado zero (com meta configurada): 0%, não missing_goal', realizadoZero.indicators.newClients.cappedPercentage === 0);
  assert('CP18 realizado zero nos 3: averagePercentage === 0 (calculado, não null)', realizadoZero.averagePercentage === 0);

  const realizadoNegativo = goals.computeConsolidatedGoalAveragePercentage({
    newClients: { realized: -50, goal: 100 },
    qualifiedLeads: { realized: 50, goal: 100 },
    completedAttendances: { realized: 50, goal: 100 },
  });
  assert('CP19 realizado negativo é tratado como 0 (nunca percentual negativo)', realizadoNegativo.indicators.newClients.cappedPercentage === 0);

  // Nenhuma ocorrência de NaN/Infinity em nenhum dos casos acima
  [teto, semCompensacao, metaZero, metaAusente, todasAusentes, realizadoZero, realizadoNegativo].forEach((r, i) => {
    assert(`CP20.${i + 1} nenhum NaN/Infinity no resultado`, !JSON.stringify(r).match(/NaN|Infinity/));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite CP3/CP4 — Backend: integração real (Firebase fake)
// ═══════════════════════════════════════════════════════════════════════════

process.env.UPLOAD_SESSION_SECRET = 'test-secret-for-consolidated-percentage-suite';
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
  console.log('\nSuite CP3 — backend: averagePercentage é SEMPRE a média das 3 colunas retornadas (período de vários dias)');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);

    // Período de 3 dias com valores desiguais entre si — isso faz a fórmula
    // "média das médias diárias" (antiga) divergir da fórmula consolidada
    // (nova), provando que a correção realmente muda o resultado.
    const days = [
      { date: '2026-07-01', newClients: { realizado: 10, meta: 5 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 0, meta: 2 } },
      { date: '2026-07-02', newClients: { realizado: 0, meta: 5 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 2, meta: 2 } },
      { date: '2026-07-03', newClients: { realizado: 2, meta: 5 }, qualifiedLeads: { realizado: 0, meta: 2 }, completedAttendances: { realizado: 1, meta: 2 } },
    ];
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days }) } as any);
    const body = JSON.parse(res.body);

    assert('CP21 HTTP 200', res.statusCode === 200);
    const ind = body.indicators;
    const manualAverage = (ind.newClients.cappedPercentage + ind.qualifiedLeads.cappedPercentage + ind.completedAttendances.cappedPercentage) / 3;
    const manualAverageRounded = Math.round(manualAverage * 100) / 100;
    assert('CP22 averagePercentage === média EXATA das 3 colunas retornadas (fonte única, sem recálculo divergente)', body.averagePercentage === manualAverageRounded);

    // Totais esperados: newClients = (10+0+2)/(5+5+5) = 12/15 = 80%.
    // qualifiedLeads = (1+1+0)/(2+2+2) = 2/6 = 33.33%.
    // completedAttendances = (0+2+1)/(2+2+2) = 3/6 = 50%.
    assertClose('CP23 Novos Clientes consolidado: 12/15 = 80%', ind.newClients.cappedPercentage, 80);
    assertClose('CP24 Leads Qualificados consolidado: 2/6 = 33.33%', ind.qualifiedLeads.cappedPercentage, 33.33);
    assertClose('CP25 Atendimentos Realizados consolidado: 3/6 = 50%', ind.completedAttendances.cappedPercentage, 50);
    assertClose('CP26 averagePercentage = (80+33.33+50)/3 = 54.44', body.averagePercentage, 54.44);
  }

  console.log('\nSuite CP4 — prova de divergência: fórmula antiga (dia-a-dia) vs nova (consolidada)');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);

    const days = [
      { date: '2026-07-01', newClients: { realizado: 10, meta: 5 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 0, meta: 2 } },
      { date: '2026-07-02', newClients: { realizado: 0, meta: 5 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 2, meta: 2 } },
      { date: '2026-07-03', newClients: { realizado: 2, meta: 5 }, qualifiedLeads: { realizado: 0, meta: 2 }, completedAttendances: { realizado: 1, meta: 2 } },
    ];
    const res = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days }) } as any);
    const body = JSON.parse(res.body);

    // Fórmula ANTIGA (média das médias diárias), recomputada manualmente a
    // partir do MESMO breakdown por dia que o backend ainda retorna em
    // body.days[i].dailyGoalAveragePercentage — prova que o valor principal
    // NÃO é mais igual a essa grandeza.
    const oldStyleAverage = goals.computePeriodGoalAveragePercentage(
      body.days.map((d: any) => ({ date: d.date, dailyGoalAveragePercentage: d.dailyGoalAveragePercentage })),
    ).average;

    assert('CP27 a fórmula antiga (dia-a-dia) e a nova (consolidada) produzem valores DIFERENTES neste período (prova da correção)', Math.abs(body.averagePercentage - oldStyleAverage) > 0.01);
    assertClose('CP28 o valor retornado é o da fórmula NOVA (consolidada), não o da antiga', body.averagePercentage, 54.44);
  }

  console.log('\nSuite CP5 — regressão: Novos Clientes/Leads Qualificados/Atendimentos Realizados inalterados; período de 1 dia; sem NaN/Infinity');
  {
    const db = makeFakeDb({ 'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' } });
    installFakeFirebaseAdmin(db);
    const fn = freshRequire(path.join(NF, 'reports-performance-goal-average.js'));
    const token = uploadSession.generateToken('lucas_vizentin', SECRET);

    // Período de 1 dia: fórmula antiga e nova coincidem matematicamente
    // (não há diferença possível entre "média de 1 dia" e "total de 1 dia").
    const oneDay = [{ date: '2026-07-10', newClients: { realizado: 3, meta: 2 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 8, meta: 10 } }];
    const resOneDay = await fn.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, days: oneDay }) } as any);
    const bodyOneDay = JSON.parse(resOneDay.body);
    assertClose('CP29 período de 1 dia: averagePercentage = 76.67 (mesmo valor de antes da correção, por coincidência matemática de N=1)', bodyOneDay.averagePercentage, 76.67);
    assert('CP30 Novos Clientes: realizado=3, meta=2, cappedPercentage=100 (150% capado) — indicador inalterado', bodyOneDay.indicators.newClients.realized === 3 && bodyOneDay.indicators.newClients.goal === 2 && bodyOneDay.indicators.newClients.cappedPercentage === 100);
    assert('CP31 Leads Qualificados: realizado=1, meta=2, cappedPercentage=50 — indicador inalterado', bodyOneDay.indicators.qualifiedLeads.realized === 1 && bodyOneDay.indicators.qualifiedLeads.cappedPercentage === 50);
    assert('CP32 Atendimentos Realizados: realizado=8, meta=10, cappedPercentage=80 — indicador inalterado (contagem de realizado não foi tocada por esta correção)', bodyOneDay.indicators.completedAttendances.realized === 8 && bodyOneDay.indicators.completedAttendances.cappedPercentage === 80);
    assert('CP33 nenhum NaN/Infinity na resposta completa', !JSON.stringify(bodyOneDay).match(/NaN|Infinity/));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Report Consolidated Percentage Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
