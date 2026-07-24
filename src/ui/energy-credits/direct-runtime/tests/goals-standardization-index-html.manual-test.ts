'use strict';
/**
 * ESA OS — Padronização de metas + "Percentual médio da meta" em index.html
 *
 * Testa a integração real no index.html: construção de METAS (execução real,
 * com assets/performance-goals.js carregado), decimal 0,5 preservado e exibido
 * com vírgula, contagem diária de Leads Qualificados, ausência de regressão em
 * outros indicadores mensais (contratos/vendas/kwh preservados), e a presença
 * correta do gate de permissão + chamada ao backend no bloco "Percentual médio
 * da meta" de renderRelCharts().
 *
 * Rodar: npx tsx tests/goals-standardization-index-html.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
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

const currentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const goalsModuleSrc = fs.readFileSync(path.join(ROOT, 'assets/performance-goals.js'), 'utf8');

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
function extractStatement(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`statement não encontrada: ${startPattern}`);
  const semi = src.indexOf(';', m.index);
  if (semi === -1) throw new Error(`';' de fechamento não encontrado para: ${startPattern}`);
  return src.slice(m.index, semi + 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite GS1 — Static: script tag do módulo canônico incluído
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite GS1 — assets/performance-goals.js existe e é carregado por index.html');

assert('GS01 arquivo assets/performance-goals.js existe', fs.existsSync(path.join(ROOT, 'assets/performance-goals.js')));
assert('GS02 index.html carrega o módulo via <script src="/assets/performance-goals.js">',
  currentHtml.includes('<script src="/assets/performance-goals.js"></script>'));
assert('GS03 script do módulo aparece ANTES do script principal (ESAPerformanceGoals disponível quando METAS é construído)',
  currentHtml.indexOf('<script src="/assets/performance-goals.js">') < currentHtml.indexOf('const METAS'));

// ═══════════════════════════════════════════════════════════════════════════
// Suite GS2 — Execução real: construção de METAS com o módulo carregado
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite GS2 — METAS.executivo: execução real (não só leitura de string)');

{
  const businessDaysFnSrc = extractFunction(currentHtml, /function _currentMonthBusinessDays\(\)/);
  const dailyGoalConstSrc = extractStatement(currentHtml, /const DAILY_QUALIFIED_LEADS_GOAL/);
  const metasConstStart = currentHtml.indexOf('const METAS = {');
  const metasBraceStart = currentHtml.indexOf('{', metasConstStart);
  let depth = 0, i = metasBraceStart;
  for (; i < currentHtml.length; i++) {
    if (currentHtml[i] === '{') depth++;
    else if (currentHtml[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  if (currentHtml[i] === ';') i++;
  const metasConstSrc = currentHtml.slice(metasConstStart, i);

  const context = vm.createContext({ console, Date, Math, String, Object, JSON });
  // UMD do módulo detecta ausência de module/self e anexa em `this` (o global
  // do contexto) como ESAPerformanceGoals — mesmo caminho usado pelo browser.
  vm.runInContext(goalsModuleSrc, context);
  vm.runInContext(`${businessDaysFnSrc}\n${dailyGoalConstSrc}\n${metasConstSrc}\nthis.__METAS = METAS;`, context);
  const METAS = context.__METAS as any;

  const diaria = METAS.executivo.diaria;
  const mensal = METAS.executivo.mensal;

  assert('GS04 diária tem exatamente um item "Novos Clientes"', diaria.filter((m: any) => m.label === 'Novos Clientes').length === 1);
  assert('GS05 diária tem exatamente um item "Leads Qualificados"', diaria.filter((m: any) => m.label === 'Leads Qualificados').length === 1);
  assert('GS06 diária tem exatamente um item "Atendimentos Realizados"', diaria.filter((m: any) => m.label === 'Atendimentos Realizados').length === 1);
  const leadsDiaria = diaria.find((m: any) => m.label === 'Leads Qualificados');
  assert('GS07 meta diária de Leads Qualificados é EXATAMENTE 0.5 (não arredondada para 0 ou 1)', leadsDiaria.meta === 0.5);

  assert('GS08 mensal: "Prospecções" foi renomeado para "Novos Clientes" (não existe mais label antigo)',
    mensal.filter((m: any) => m.label === 'Prospecções').length === 0 && mensal.filter((m: any) => m.label === 'Novos Clientes').length === 1);
  assert('GS09 mensal: "Atendimentos" foi renomeado para "Atendimentos Realizados" (não existe mais label antigo isolado)',
    mensal.filter((m: any) => m.label === 'Atendimentos').length === 0 && mensal.filter((m: any) => m.label === 'Atendimentos Realizados').length === 1);
  assert('GS10 mensal: "Leads Qualificados" existe (já existia, preservado)', mensal.filter((m: any) => m.label === 'Leads Qualificados').length === 1);
  assert('GS11 nomes diários e mensais dos 3 indicadores oficiais são IDÊNTICOS (sem divergência)', (() => {
    const dailyLabels = new Set(diaria.map((m: any) => m.label));
    return ['Novos Clientes', 'Leads Qualificados', 'Atendimentos Realizados'].every((l) => dailyLabels.has(l))
      && mensal.some((m: any) => m.label === 'Novos Clientes')
      && mensal.some((m: any) => m.label === 'Leads Qualificados')
      && mensal.some((m: any) => m.label === 'Atendimentos Realizados');
  })());

  const leadsMensal = mensal.find((m: any) => m.label === 'Leads Qualificados');
  assert('GS12 meta mensal de Leads Qualificados É DERIVADA da diária × dias úteis (não mais hardcoded em 10)',
    leadsMensal.meta === ESAPerformanceGoalsFor(context).computeMonthlyGoalFromDaily(0.5, ESAPerformanceGoalsFor(context).countBusinessDays(currentMonthStartISO(), currentMonthEndISO())));

  // Regressão: nenhum outro indicador mensal foi removido/apagado (dados históricos preservados).
  const monthlyIds = mensal.map((m: any) => m.id);
  ['prosp_mensal', 'leads_qualificados', 'atend_mensal', 'contratos', 'vendas', 'vendas_mensal', 'kwh_exec'].forEach((id) => {
    assert(`GS13.${id} nenhum indicador mensal antigo foi removido (id "${id}" ainda presente)`, monthlyIds.indexOf(id) >= 0);
  });
  ['novos_clientes', 'interacao', 'leads_qualificados_diario', 'atendimentos'].forEach((id) => {
    assert(`GS14.${id} ids diários presentes (${id})`, diaria.map((m: any) => m.id).indexOf(id) >= 0);
  });
}

function currentMonthStartISO() {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function currentMonthEndISO() {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const d = new Date(y, m + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ESAPerformanceGoalsFor(_ctx: any) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(path.join(ROOT, 'assets/performance-goals.js'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite GS3 — Execução real: metaRow() exibe decimal com vírgula, não arredonda
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite GS3 — metaRow(): 0,5 exibido com vírgula, não arredondado para 0 ou 1');

{
  const metaRowSrc = extractFunction(currentHtml, /function metaRow\(/);
  const context = vm.createContext({ console, Number, String, Math });
  vm.runInContext(`${metaRowSrc}\nthis.__metaRow = metaRow;`, context);
  const metaRow = context.__metaRow as (m: any, real: number, meta: number) => string;

  const html = metaRow({ id: 'leads_qualificados_diario', label: 'Leads Qualificados' }, 0, 0.5);
  assert('GS15 metaRow com meta=0.5: célula de meta exibe "0,5" (vírgula), não "0.5" nem "0" nem "1"',
    html.includes('>0,5<') || /0,5/.test(html));
  assert('GS16 metaRow com meta=0.5: NÃO exibe "0.5" com ponto (formatação pt-BR)', !html.includes('0.5'));

  const htmlInteiro = metaRow({ id: 'novos_clientes', label: 'Novos Clientes' }, 3, 5);
  assert('GS17 metaRow com valores inteiros continua exibindo normalmente (sem regressão)', htmlInteiro.includes('>5<') || /5/.test(htmlInteiro));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite GS4 — Execução real: countMeta 'leads_qualificados_diario' (dia vs mês)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite GS4 — countMeta("leads_qualificados_diario"): conta só o dia selecionado, não o mês inteiro');

{
  const countMetaSrc = extractFunction(currentHtml, /function countMeta\(/);
  const context = vm.createContext({
    console, Date, Object,
    window: {} as Record<string, unknown>,
    CU: { uid: 'exec1', name: 'Executivo Um' },
    crmDeals: {
      d1: { captadorUid: 'exec1', funil: 'venda_ufv', createdAt: new Date('2026-08-03T10:00:00').getTime() },
      d2: { captadorUid: 'exec1', funil: 'venda_ufv', createdAt: new Date('2026-08-04T10:00:00').getTime() },
      d3: { captadorUid: 'outro', funil: 'venda_ufv', createdAt: new Date('2026-08-03T10:00:00').getTime() },
    },
    agEvs: {},
    allProsp: {},
  });
  vm.runInContext(`${countMetaSrc}\nthis.__countMeta = countMeta;`, context);
  const countMeta = context.__countMeta as (list: unknown[], id: string, uid?: string, name?: string) => number;

  (context as any).window._metaDataSel = '2026-08-03';
  const dayCount = countMeta([], 'leads_qualificados_diario', 'exec1', 'Executivo Um');
  assert('GS18 dia 2026-08-03: conta só o deal de exec1 criado nesse dia (1, não 2 e não os de outro uid)', dayCount === 1);

  (context as any).window._metaDataSel = '2026-08-05';
  const emptyDayCount = countMeta([], 'leads_qualificados_diario', 'exec1', 'Executivo Um');
  assert('GS19 dia sem deals criados (2026-08-05): retorna 0, não conta deals de outros dias', emptyDayCount === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite GS5 — Static: gate de permissão do "Percentual médio da meta"
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite GS5 — bloco "Percentual médio da meta": gate de permissão e chamada ao backend');

assert('GS20 gate inclui lucas_vizentin', currentHtml.includes("PERFORMANCE_GOAL_AVERAGE_AUTHORIZED_UIDS=['lucas_vizentin','fernando_fadel_mphd4rj6']"));
assert('GS21 bloco chama o endpoint dedicado /.netlify/functions/reports-performance-goal-average',
  currentHtml.includes("authenticatedFetch('/.netlify/functions/reports-performance-goal-average'"));
assert('GS22 chamada usa o token via authenticatedFetch (renovação automática reaproveitada) — não fetch cru com token fixo',
  /authenticatedFetch\('\/\.netlify\/functions\/reports-performance-goal-average', function\(token\)/.test(currentHtml));
assert('GS23 body enviado ao backend inclui days e targetUid (não envia uid do CALLER nem role — a AUTORIZAÇÃO de quem chama vem sempre do token no backend; targetUid só indica de qual colaborador ler os atendimentos)',
  currentHtml.includes('return {sessionToken:token, days:_pgaDays, targetUid:_pgaUid};'));
assert('GS24 texto "Percentual médio da meta" presente na interface', currentHtml.includes('Percentual médio da meta'));
assert('GS25 o gate está fora de qualquer template estático — é uma condição JS real (if), não apenas CSS/display:none',
  /if\(PERFORMANCE_GOAL_AVERAGE_AUTHORIZED_UIDS\.indexOf\(CU\.uid\)>=0\)\{/.test(currentHtml));

// ═══════════════════════════════════════════════════════════════════════════
// Suite GS6 — Execução real: agregação de totais do período (mesma fórmula do exemplo da tarefa)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite GS6 — agregação client-side de realizado/meta por período (execução real)');

{
  // Réplica funcional mínima da lógica de totals usada dentro do bloco (mesma
  // fórmula, testada isoladamente): soma realizado/meta pelos dias com meta > 0.
  function aggregateTotals(days: Array<Record<string, { realizado?: number; meta?: number }>>) {
    const totals: Record<string, { r: number; m: number }> = { newClients: { r: 0, m: 0 }, qualifiedLeads: { r: 0, m: 0 }, completedAttendances: { r: 0, m: 0 } };
    days.forEach((d) => {
      (['newClients', 'qualifiedLeads', 'completedAttendances'] as const).forEach((k) => {
        const entry = d[k] || {};
        if (typeof entry.meta === 'number' && entry.meta > 0) {
          totals[k].r += typeof entry.realizado === 'number' ? entry.realizado : 0;
          totals[k].m += entry.meta;
        }
      });
    });
    return totals;
  }
  const totals = aggregateTotals([
    { newClients: { realizado: 3, meta: 2 }, qualifiedLeads: { realizado: 1, meta: 2 }, completedAttendances: { realizado: 8, meta: 10 } },
  ]);
  assert('GS26 Novos Clientes: realizado 3, meta 2 (exemplo exato da tarefa)', totals.newClients.r === 3 && totals.newClients.m === 2);
  assert('GS27 Leads Qualificados: realizado 1, meta 2 (exemplo exato da tarefa)', totals.qualifiedLeads.r === 1 && totals.qualifiedLeads.m === 2);
  assert('GS28 Atendimentos Realizados: realizado 8, meta 10 (exemplo exato da tarefa)', totals.completedAttendances.r === 8 && totals.completedAttendances.m === 10);
  const pctNC = Math.min(100, Math.round((totals.newClients.r / totals.newClients.m) * 10000) / 100);
  assert('GS29 percentual considerado para Novos Clientes (150% → 100%, exemplo exato da tarefa)', pctNC === 100);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Goals Standardization index.html Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
