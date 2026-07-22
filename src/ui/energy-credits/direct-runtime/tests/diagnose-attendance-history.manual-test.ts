'use strict';
/**
 * ESA OS — scripts/diagnose-attendance-history.js
 *
 * Testa o núcleo do script de diagnóstico (diagnoseAttendanceHistory) contra
 * um Firebase fake — execução real, nunca toca no Firebase real. Este script
 * NÃO pôde ser executado contra a produção real nesta sessão (sem
 * FIREBASE_SERVICE_ACCOUNT_JSON/DATABASE_URL configurados neste ambiente) —
 * ver ressalva na entrega final.
 *
 * Rodar: npx tsx tests/diagnose-attendance-history.manual-test.ts
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

const diag = require(path.join(ROOT, 'scripts/diagnose-attendance-history.js'));

type Tree = Record<string, unknown>;
function makeFakeDb(tree: Tree) {
  return {
    ref(p: string) {
      return {
        async once(_e: string) {
          const val = Object.prototype.hasOwnProperty.call(tree, p) ? tree[p] : null;
          return { val: () => val };
        },
      };
    },
  };
}

console.log('\nSuite DA1 — máscaras (execução real, nunca expõe PII completa)');

assert('DA01 maskUid mascara uid longo', diag.maskUid('lucas_vizentin') === 'lu***in');
assert('DA02 maskName mascara nome completo, preservando iniciais', diag.maskName('Lucas Vizentin').includes('L') && !diag.maskName('Lucas Vizentin').includes('ucas Vizenti'));
assert('DA03 CANDIDATE_NODES inclui os nós citados na tarefa', ['agEvs', 'agenda', 'dailyGoals', 'dailyResults', 'metas'].every((n) => diag.CANDIDATE_NODES.includes(n)));

console.log('\nSuite DA2 — diagnoseAttendanceHistory(): execução real contra Firebase fake');

async function run() {
  const db = makeFakeDb({
    'users/lucas_vizentin': { uid: 'lucas_vizentin', name: 'Lucas Vizentin', level: 'diretor' },
    events: {
      '2026-07-05': { e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } },
      '2026-07-12': {
        e2: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' },
        e3: { author: 'Lucas Vizentin', resultado: 'insucesso', tipo_atendimento: 'cliente' }, // excluído por status
        e4: { author: 'Outro Usuário', resultado: 'sucesso', tipo_atendimento: 'cliente' },    // excluído por usuário
        e5: { author: 'Lucas Vizentin', resultado: 'sucesso', type: 'retomada' },                 // excluído por retomada
      },
      '2026-08-01': { e6: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } }, // fora do mês
    },
  });

  const report = await diag.diagnoseAttendanceHistory(db, { uid: 'lucas_vizentin', month: '2026-07' });

  assert('DA04 usuário encontrado', report.userFound === true);
  assert('DA05 uid nunca aparece em texto puro no relatório', report.uidMasked !== 'lucas_vizentin');
  assert('DA06 nó events existe e foi identificado', report.nodes.events.exists === true);
  assert('DA07 chaves de data encontradas incluem julho e agosto de 2026', report.nodes.events.totalDateKeysFound === 3);
  assert('DA08 filtro por mês (julho/2026): apenas as 2 chaves de julho consideradas (agosto excluído)', report.eventsMonth.dateKeysInMonth === 2);
  assert('DA09 total de eventos no mês (antes de qualquer filtro de elegibilidade): 5 (e1,e2,e3,e4,e5 — e6 é de agosto, excluído)', report.eventsMonth.totalEventsInMonth === 5);
  assert('DA10 eventos referenciando o usuário por nome (author/guest): 4 (e1,e2,e3,e5 — e4 é de outro usuário, excluído)', report.eventsMonth.eventsReferencingUserByName === 4);
  assert('DA11 excludedBreakdown.retomada conta e5 corretamente', report.eventsMonth.excludedBreakdown.retomada === 1);
  assert('DA12 excludedBreakdown.naoSucesso conta e3 corretamente', report.eventsMonth.excludedBreakdown.naoSucesso === 1);
  assert('DA13 campos de estrutura detectados incluem author/resultado/tipo_atendimento', ['author', 'resultado', 'tipo_atendimento'].every((f) => report.eventsMonth.structureFieldsSeenAcrossEvents.includes(f)));
  assert('DA14 relatório nunca contém o conteúdo bruto de nenhum evento (só contadores e nomes de campos)', !JSON.stringify(report).includes('Lucas Vizentin'));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Diagnose Attendance History Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
