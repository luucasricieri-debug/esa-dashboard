'use strict';
/**
 * ESA OS — Preservação do contador histórico de "Atendimentos Realizados"
 *
 * Incidente relatado: após renomear o label mensal de "Atendimentos" para
 * "Atendimentos Realizados", o contador mensal teria aparecido zerado.
 *
 * Auditoria (leitura + execução real): os IDS internos usados em METAS
 * (index.html) — 'atendimentos' (diário) e 'atend_mensal' (mensal) — NUNCA
 * foram renomeados na missão anterior, só os labels exibidos. countMeta()
 * continua contando os mesmos registros de agEvs (agenda) que sempre contou.
 * Não há acesso posicional a essas duas entradas específicas (diferente do
 * bug de dm[2] já corrigido para o meta LOOKUP na tela de atividades — aqui
 * o "realizado" nunca dependeu de posição).
 *
 * A lacuna REAL encontrada: assets/performance-goals.js não reconhecia o
 * alias "atendimento_realizado" (singular) explicitamente listado na tarefa
 * — corrigido. Este arquivo prova, com execução real, que:
 *   - todos os aliases históricos de atendimento normalizam para
 *     completedAttendances;
 *   - o id histórico 'atendimentos'/'atend_mensal' segue intacto;
 *   - countMeta() continua somando os mesmos registros de agEvs de sempre
 *     (contador mensal e diário não zeram com dados reais);
 *   - múltiplos aliases apontando pro mesmo indicador não duplicam a soma
 *     (é sempre uma soma por REGISTRO real, nunca por alias);
 *   - o percentual da meta usa o valor preservado (nunca 0 quando há dados).
 *
 * Rodar: npx tsx tests/attendance-counter-preservation.manual-test.ts
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

const goals = require(path.join(ROOT, 'assets/performance-goals.js'));
const currentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

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

// ═══════════════════════════════════════════════════════════════════════════
// Suite AC1 — Todos os aliases de Atendimentos normalizam (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite AC1 — aliases de Atendimentos → completedAttendances (execução real)');

const attendanceAliases = [
  'atendimento', 'Atendimento', 'atendimentos', 'Atendimentos',
  'atendimento_realizado', 'atendimentos_realizados', 'atendimentosRealizados',
  'Atendimentos Realizados', 'completedAttendances', 'atend_mensal',
];
attendanceAliases.forEach((alias) => {
  assert(`AC01.${alias} "${alias}" normaliza para completedAttendances`, goals.normalizeIndicatorKey(alias) === 'completedAttendances');
});

console.log('\nSuite AC2 — mapeamento canônico → id histórico (fonte única, explícita)');

assert('AC02 CANONICAL_TO_LEGACY_METAS_ID.completedAttendances.daily === "atendimentos" (id histórico preservado)',
  goals.CANONICAL_TO_LEGACY_METAS_ID.completedAttendances.daily === 'atendimentos');
assert('AC03 CANONICAL_TO_LEGACY_METAS_ID.completedAttendances.monthly === "atend_mensal" (id histórico preservado)',
  goals.CANONICAL_TO_LEGACY_METAS_ID.completedAttendances.monthly === 'atend_mensal');
assert('AC04 nenhum id novo foi inventado — id mensal é o mesmo de sempre (atend_mensal)',
  currentHtml.includes("{id:'atend_mensal',       label:'Atendimentos Realizados', meta:40}"));
assert('AC05 nenhum id novo foi inventado — id diário é o mesmo de sempre (atendimentos)',
  currentHtml.includes("{id:'atendimentos',         label:'Atendimentos Realizados',  meta:2}"));

// ═══════════════════════════════════════════════════════════════════════════
// Suite AC3 — countMeta('atendimentos'/'atend_mensal'): execução real, dados não zeram
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite AC3 — countMeta(): contador diário e mensal continuam somando os mesmos registros (execução real)');

{
  // atend_mensal usa o mês corrente REAL (new Date()) internamente — a
  // fixture precisa usar datas do mês/ano atuais, não uma data fixa arbitrária.
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const iso = (day: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const day1 = iso(3), day2 = iso(4), day3 = iso(10);

  const countMetaSrc = extractFunction(currentHtml, /function countMeta\(/);
  const context = vm.createContext({
    console, Date, Object, Math, String,
    window: {} as Record<string, unknown>,
    CU: { uid: 'exec1', name: 'Executivo Um' },
    crmDeals: {},
    allProsp: {},
    agEvs: {
      [day1]: {
        e1: { author: 'Executivo Um', resultado: 'sucesso', tipo_atendimento: 'cliente' },
        e2: { author: 'Outro', resultado: 'sucesso', tipo_atendimento: 'cliente' },
      },
      [day2]: {
        e3: { author: 'Executivo Um', resultado: 'sucesso', tipo_atendimento: 'cliente' },
        e4: { author: 'Executivo Um', resultado: 'insucesso', tipo_atendimento: 'cliente' },
      },
      [day3]: {
        e5: { guests: [{ name: 'Executivo Um', status: 'confirmed' }], resultado: 'sucesso', tipo_atendimento: 'cliente' },
      },
    },
  });
  vm.runInContext(`${countMetaSrc}\nthis.__countMeta = countMeta;`, context);
  const countMeta = context.__countMeta as (list: unknown[], id: string, uid?: string, name?: string) => number;

  (context as any).window._metaDataSel = day1;
  const dailyCount = countMeta([], 'atendimentos', 'exec1', 'Executivo Um');
  assert('AC06 contador diário (dia 1 da fixture): conta 1 atendimento do próprio executivo (não zerado)', dailyCount === 1);

  const monthlyCount = countMeta([], 'atend_mensal', 'exec1', 'Executivo Um');
  assert('AC07 contador mensal: soma os 3 atendimentos válidos do executivo no mês inteiro (não zerado)', monthlyCount === 3);
  assert('AC08 contador mensal não conta o atendimento de outro executivo (isolamento por usuário preservado)', monthlyCount < 4);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite AC4 — Aliases não duplicam soma (é soma por registro, não por alias)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite AC4 — múltiplos aliases apontando para o mesmo indicador não duplicam a contagem');

{
  // A soma real vem SEMPRE de countMeta(id, ...) sobre os registros de agEvs —
  // normalizeIndicatorKey() é só para RESOLVER qual indicador um id/label
  // representa; ele nunca soma nada duas vezes por si só, porque não itera
  // registros — é uma função pura de mapeamento de string para string.
  const aliasesForSameIndicator = ['atendimento', 'atendimentos', 'atend_mensal', 'Atendimentos Realizados'];
  const resolved = aliasesForSameIndicator.map((a) => goals.normalizeIndicatorKey(a));
  assert('AC09 todos os aliases testados resolvem para a MESMA chave canônica única', resolved.every((r) => r === 'completedAttendances'));
  assert('AC10 normalizeIndicatorKey é uma função pura sem efeito colateral (chamar 100x não altera nada)', (() => {
    for (let i = 0; i < 100; i++) goals.normalizeIndicatorKey('atendimentos');
    return goals.normalizeIndicatorKey('atendimentos') === 'completedAttendances';
  })());
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite AC5 — Percentual da meta usa o valor preservado (nunca zerado com dados reais)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite AC5 — percentual de Atendimentos Realizados usa o valor real (não fica zerado)');

{
  const r = goals.computeIndicatorPercentage(3, 2); // 3 atendimentos reais, meta diária 2 (executivo)
  assert('AC11 realizado preservado (3) gera percentual > 0% (não zerado)', (r.capped as number) > 0);
  assert('AC12 3/2 = 150%, capado a 100% — nunca 0', r.capped === 100);

  const daily = goals.computeDailyGoalAveragePercentage({
    newClients: { realizado: 5, meta: 5 },
    qualifiedLeads: { realizado: 1, meta: 0.5 },
    completedAttendances: { realizado: 3, meta: 2 }, // valor real preservado
  });
  assert('AC13 média diária considera Atendimentos Realizados com valor > 0 (não contamina com 0 falso)', daily.indicators.completedAttendances.capped as number > 0);
  assert('AC14 status ok (nenhum indicador sinalizado como missing_goal por engano)', daily.status === 'ok');
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Attendance Counter Preservation Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
