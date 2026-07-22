'use strict';
/**
 * ESA OS — Metas diárias/mensais padronizadas + "Percentual médio da meta"
 *
 * Testa, com EXECUÇÃO REAL (não apenas leitura de source), o módulo canônico
 * assets/performance-goals.js — fonte única das fórmulas de percentual/teto/
 * média/dias úteis/aliases usada tanto pelo backend
 * (netlify/functions/reports-performance-goal-average.js) quanto pelo
 * frontend (index.html, via <script src="/assets/performance-goals.js">).
 *
 * Rodar: npx tsx tests/performance-goals.manual-test.ts
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const goals = require(path.join(ROOT, 'assets/performance-goals.js'));

// ═══════════════════════════════════════════════════════════════════════════
// Suite PG1 — Normalização de aliases históricos (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PG1 — normalizeIndicatorKey(): aliases históricos → indicadores oficiais');

assert('PG01 "Prospecção" normaliza para newClients', goals.normalizeIndicatorKey('Prospecção') === 'newClients');
assert('PG02 "prospecção" (minúsculo) normaliza para newClients', goals.normalizeIndicatorKey('prospecção') === 'newClients');
assert('PG03 "Prospecções" (plural) normaliza para newClients', goals.normalizeIndicatorKey('Prospecções') === 'newClients');
assert('PG04 "prospeccao" (sem acento) normaliza para newClients', goals.normalizeIndicatorKey('prospeccao') === 'newClients');
assert('PG05 "novosClientes" normaliza para newClients', goals.normalizeIndicatorKey('novosClientes') === 'newClients');
assert('PG06 "novos_clientes" (id legado) normaliza para newClients', goals.normalizeIndicatorKey('novos_clientes') === 'newClients');
assert('PG07 "prosp_mensal" (id legado) normaliza para newClients', goals.normalizeIndicatorKey('prosp_mensal') === 'newClients');
assert('PG08 "Atendimento" normaliza para completedAttendances', goals.normalizeIndicatorKey('Atendimento') === 'completedAttendances');
assert('PG09 "atendimentos" (plural) normaliza para completedAttendances', goals.normalizeIndicatorKey('atendimentos') === 'completedAttendances');
assert('PG10 "atend_mensal" (id legado) normaliza para completedAttendances', goals.normalizeIndicatorKey('atend_mensal') === 'completedAttendances');
assert('PG11 "leadsQualificados" normaliza para qualifiedLeads', goals.normalizeIndicatorKey('leadsQualificados') === 'qualifiedLeads');
assert('PG12 "leads_qualificados" (id legado) normaliza para qualifiedLeads', goals.normalizeIndicatorKey('leads_qualificados') === 'qualifiedLeads');
assert('PG13 chave canônica "newClients" retorna ela mesma (idempotente)', goals.normalizeIndicatorKey('newClients') === 'newClients');
assert('PG14 chave desconhecida retorna null (não lança, não inventa indicador)', goals.normalizeIndicatorKey('coisa_aleatoria') === null);
assert('PG15 valor não-string retorna null sem lançar', goals.normalizeIndicatorKey(undefined as any) === null && goals.normalizeIndicatorKey(null as any) === null);

console.log('\nSuite PG2 — PERFORMANCE_INDICATORS: os 3 oficiais com os labels corretos');
assert('PG16 newClients.label === "Novos Clientes"', goals.PERFORMANCE_INDICATORS.newClients.label === 'Novos Clientes');
assert('PG17 qualifiedLeads.label === "Leads Qualificados"', goals.PERFORMANCE_INDICATORS.qualifiedLeads.label === 'Leads Qualificados');
assert('PG18 completedAttendances.label === "Atendimentos Realizados"', goals.PERFORMANCE_INDICATORS.completedAttendances.label === 'Atendimentos Realizados');
assert('PG19 INDICATOR_KEYS tem exatamente os 3 oficiais, nesta ordem', JSON.stringify(goals.INDICATOR_KEYS) === JSON.stringify(['newClients', 'qualifiedLeads', 'completedAttendances']));

// ═══════════════════════════════════════════════════════════════════════════
// Suite PG3 — Dias úteis e meta mensal derivada da diária (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PG3 — countBusinessDays() / computeMonthlyGoalFromDaily(): nunca hardcoded em 22');

assert('PG20 fevereiro/2027 (não bissexto, começa numa segunda): 20 dias úteis', goals.countBusinessDays('2027-02-01', '2027-02-28') === 20);
assert('PG21 uma única segunda-feira: 1 dia útil', goals.countBusinessDays('2026-08-03', '2026-08-03') === 1);
assert('PG22 um único sábado: 0 dias úteis', goals.countBusinessDays('2026-08-01', '2026-08-01') === 0);
assert('PG23 data final antes da inicial: 0 (nunca negativo)', goals.countBusinessDays('2026-08-10', '2026-08-01') === 0);
assert('PG24 0,5 × 22 dias úteis = 11 (exemplo exato da tarefa)', goals.computeMonthlyGoalFromDaily(0.5, 22) === 11);
assert('PG25 0,5 × 20 dias úteis = 10 (exemplo exato da tarefa)', goals.computeMonthlyGoalFromDaily(0.5, 20) === 10);
assert('PG26 meta diária negativa não gera meta mensal negativa (vira 0)', goals.computeMonthlyGoalFromDaily(-5, 20) === 0);
assert('PG27 meta mensal não é hardcoded — usa o argumento businessDays real, não uma constante 22 fixa',
  goals.computeMonthlyGoalFromDaily(1, 15) === 15 && goals.computeMonthlyGoalFromDaily(1, 23) === 23);

// ═══════════════════════════════════════════════════════════════════════════
// Suite PG4 — Percentual de indicador individual, com teto de 100% (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PG4 — computeIndicatorPercentage(): teto 100%, negativo vira 0, meta ausente sinalizada');

assert('PG28 percentual abaixo de 100 (1/2 = 50%)', goals.computeIndicatorPercentage(1, 2).capped === 50);
assert('PG29 percentual exatamente 100 (2/2 = 100%)', goals.computeIndicatorPercentage(2, 2).capped === 100);
assert('PG30 percentual acima de 100 recebe teto (3/2 = 150% → 100%)', goals.computeIndicatorPercentage(3, 2).capped === 100);
assert('PG31 percentual "cru" (não capado) continua disponível para diagnóstico (150)', goals.computeIndicatorPercentage(3, 2).percentage === 150);
assert('PG32 realizado negativo vira 0 (não gera percentual negativo)', goals.computeIndicatorPercentage(-10, 5).capped === 0);
assert('PG33 meta 0 é sinalizada como missing_goal (não gera divisão por zero/Infinity)', goals.computeIndicatorPercentage(5, 0).status === 'missing_goal');
assert('PG34 meta ausente (undefined) é sinalizada como missing_goal', goals.computeIndicatorPercentage(5, undefined).status === 'missing_goal');
assert('PG35 meta negativa é sinalizada como missing_goal (meta > 0 é obrigatória)', goals.computeIndicatorPercentage(5, -3).status === 'missing_goal');
assert('PG36 realizado ausente é tratado como 0 (não gera NaN)', goals.computeIndicatorPercentage(undefined, 10).capped === 0);
assert('PG37 realizado Infinity não vaza para o resultado (sem Infinity no capped)', isFinite(goals.computeIndicatorPercentage(Infinity, 10).capped as number));
assert('PG38 resultado nunca é NaN mesmo com entradas inválidas', !isNaN(goals.computeIndicatorPercentage(NaN as any, 10).capped as number));

// ═══════════════════════════════════════════════════════════════════════════
// Suite PG5 — Percentual médio diário (média dos 3, sempre dividido por 3)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PG5 — computeDailyGoalAveragePercentage(): exemplo 100/50/80 → 76,67%');

{
  const r = goals.computeDailyGoalAveragePercentage({
    newClients: { realizado: 3, meta: 2 },          // 150% -> capped 100
    qualifiedLeads: { realizado: 1, meta: 2 },        // 50%
    completedAttendances: { realizado: 8, meta: 10 }, // 80%
  });
  assert('PG39 Novos Clientes (150%) é capado para 100 na composição da média', r.indicators.newClients.capped === 100);
  assert('PG40 Leads Qualificados fica em 50%', r.indicators.qualifiedLeads.capped === 50);
  assert('PG41 Atendimentos Realizados fica em 80%', r.indicators.completedAttendances.capped === 80);
  assert('PG42 média (100+50+80)/3 = 76.67 (exemplo EXATO da tarefa)', r.average === 76.67);
  assert('PG43 status ok quando os 3 indicadores têm meta configurada', r.status === 'ok');
  assert('PG44 nenhum indicador acima de 100 "compensa" outro abaixo — cada um é capado ANTES da média',
    r.indicators.newClients.capped as number <= 100);
}

{
  // Meta ausente em 1 dos 3 -> incomplete_configuration, ainda divide por 3
  const r2 = goals.computeDailyGoalAveragePercentage({
    newClients: { realizado: 5, meta: 5 },   // 100%
    qualifiedLeads: { realizado: 1, meta: 0 }, // meta ausente
    completedAttendances: { realizado: 5, meta: 5 }, // 100%
  });
  assert('PG45 1 de 3 indicadores sem meta: status = incomplete_configuration', r2.status === 'incomplete_configuration');
  assert('PG46 mesmo com 1 ausente, divide por 3 (sempre 3, nunca 2): (100+0+100)/3 = 66.67', r2.average === 66.67);
  assert('PG47 indicador ausente listado em missingIndicators', r2.missingIndicators.indexOf('qualifiedLeads') >= 0);
}

{
  // Nenhum dos 3 configurado -> not_configured, average null (nunca 0 silencioso)
  const r3 = goals.computeDailyGoalAveragePercentage({
    newClients: {}, qualifiedLeads: {}, completedAttendances: {},
  });
  assert('PG48 nenhum indicador configurado: status = not_configured (não "0")', r3.status === 'not_configured');
  assert('PG49 nenhum indicador configurado: average === null (não vira 0 silenciosamente)', r3.average === null);
}

assert('PG50 average sempre entre 0 e 100 (nunca negativo, nunca > 100)', (() => {
  const r = goals.computeDailyGoalAveragePercentage({ newClients: { realizado: 1000, meta: 1 }, qualifiedLeads: { realizado: 1000, meta: 1 }, completedAttendances: { realizado: 1000, meta: 1 } });
  return r.average !== null && r.average >= 0 && r.average <= 100;
})());

// ═══════════════════════════════════════════════════════════════════════════
// Suite PG6 — Percentual médio do período (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite PG6 — computePeriodGoalAveragePercentage(): 1 dia, vários dias, duplicados, dias sem meta');

assert('PG51 período de 1 dia: retorna o próprio valor do dia', goals.computePeriodGoalAveragePercentage([{ date: '2026-08-03', dailyGoalAveragePercentage: 76.67 }]).average === 76.67);

{
  const r = goals.computePeriodGoalAveragePercentage([
    { date: '2026-08-03', dailyGoalAveragePercentage: 100 },
    { date: '2026-08-04', dailyGoalAveragePercentage: 50 },
  ]);
  assert('PG52 período de vários dias: média simples dos percentuais médios diários ((100+50)/2=75)', r.average === 75);
  assert('PG53 validDaysCount reflete a quantidade de dias válidos', r.validDaysCount === 2);
}

{
  // Dia duplicado — não deve contar duas vezes
  const r = goals.computePeriodGoalAveragePercentage([
    { date: '2026-08-03', dailyGoalAveragePercentage: 100 },
    { date: '2026-08-03', dailyGoalAveragePercentage: 100 }, // duplicado — ignorado
    { date: '2026-08-04', dailyGoalAveragePercentage: 0 },
  ]);
  assert('PG54 dias duplicados não são contados duas vezes (validDaysCount=2, não 3)', r.validDaysCount === 2);
  assert('PG55 média com duplicata ignorada: (100+0)/2 = 50', r.average === 50);
}

{
  // Dia sem meta configurada (null) é EXCLUÍDO, não zerado
  const r = goals.computePeriodGoalAveragePercentage([
    { date: '2026-08-03', dailyGoalAveragePercentage: 100 },
    { date: '2026-08-04', dailyGoalAveragePercentage: null },  // not_configured — excluído
    { date: '2026-08-05', dailyGoalAveragePercentage: 50 },
  ]);
  assert('PG56 dia sem meta configurada (null) é EXCLUÍDO do denominador (validDaysCount=2, não 3)', r.validDaysCount === 2);
  assert('PG57 dia sem meta configurada NUNCA vira 0 silenciosamente na média: (100+50)/2=75, não (100+0+50)/3', r.average === 75);
}

{
  const r = goals.computePeriodGoalAveragePercentage([{ date: '2026-08-03', dailyGoalAveragePercentage: null }]);
  assert('PG58 todos os dias sem meta configurada: status = no_valid_days, average null', r.status === 'no_valid_days' && r.average === null);
}

assert('PG59 período vazio (sem dias): no_valid_days, sem lançar exceção', goals.computePeriodGoalAveragePercentage([]).status === 'no_valid_days');
assert('PG60 nenhum resultado do módulo jamais é NaN/Infinity para entradas normais', (() => {
  const r = goals.computePeriodGoalAveragePercentage([{ date: '2026-08-01', dailyGoalAveragePercentage: 999999 }]);
  return isFinite(r.average as number);
})());

console.log(`\n${'='.repeat(60)}`);
console.log(`Performance Goals Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
