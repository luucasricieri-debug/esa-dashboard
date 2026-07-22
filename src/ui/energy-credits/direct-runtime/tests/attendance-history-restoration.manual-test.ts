'use strict';
/**
 * ESA OS — Restauração do histórico de Atendimentos (causa raiz real)
 *
 * INCIDENTE: "Atendimentos Realizados" (diário e mensal) exibia 0 mesmo com
 * atendimentos históricos reais no Firebase.
 *
 * CAUSA RAIZ REAL (confirmada por auditoria de código + execução real —
 * NÃO era um problema de alias/label, como investigado e descartado na
 * missão anterior):
 *
 *   countMeta('atendimentos')/countMeta('atend_mensal') sempre leram a
 *   variável em memória `agEvs`. `agEvs` só era populado por agInit()/
 *   agPoll() (fetch de DB+'/events.json'), chamados EXCLUSIVAMENTE por
 *   renderAgenda() — a página Agenda. loadAllData() (chamado no boot e a
 *   cada 60s) só busca events/{hoje} em `allEventsToday`, uma variável
 *   DIFERENTE que nunca é lida por countMeta(). Resultado: qualquer usuário
 *   que abrisse "Minhas Metas" sem antes visitar a Agenda via `agEvs = {}`
 *   (valor inicial nunca populado) — os contadores de Atendimentos
 *   Realizados eram SEMPRE 0, independentemente de quantos atendimentos
 *   reais existissem em events/.
 *
 * FONTE REAL DOS DADOS: nó Firebase `events/{data ISO}/{eventId}`. Campo de
 * data: a CHAVE do nó (sempre ISO YYYY-MM-DD, construída por agDk()). Campo
 * de usuário: `ev.author` (nome) ou `ev.guests[].name` com
 * `guests[].status === 'confirmed'` — por NOME, não uid. Campo de status:
 * `ev.resultado === 'sucesso'` (evento "cancelado"/não realizado tem
 * resultado !== 'sucesso' ou ausente). Exclusão adicional:
 * `ev.type/tipo_atendimento === 'retomada'` (retomada de SDR nunca conta
 * como atendimento) e `tipo_atendimento` deve ser 'cliente' ou ausente.
 * Eventos excluídos são removidos via DELETE do Firebase (agDelEv) — não
 * existe um campo "excluído"; a ausência do registro já resolve isso.
 *
 * CORREÇÃO: ensureAgEvsLoaded() — carrega o nó `events` completo em agEvs
 * uma única vez por sessão, chamado por renderMetas() antes de calcular
 * qualquer indicador. Nenhuma regra de negócio de contagem foi alterada.
 *
 * Rodar: npx tsx tests/attendance-history-restoration.manual-test.ts
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
const goals = require(path.join(ROOT, 'assets/performance-goals.js'));

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
function extractStatement(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`statement não encontrada: ${startPattern}`);
  const semi = src.indexOf(';', m.index);
  if (semi === -1) throw new Error(`';' de fechamento não encontrado para: ${startPattern}`);
  return src.slice(m.index, semi + 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite AH1 — Static: causa raiz confirmada e correção presente no source
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite AH1 — causa raiz confirmada e correção presente (source)');

assert('AH01 agEvs só era populado por agInit/agPoll, ambos chamados só por renderAgenda',
  currentHtml.includes("agUser=CU?CU.name:''; agInit();"));
assert('AH02 loadAllData() busca events/{hoje} em allEventsToday, NÃO em agEvs (variável diferente, nunca lida por countMeta)',
  currentHtml.includes("allEventsToday = await fbGet('events/'+_todayStr)") && !currentHtml.includes('agEvs = await fbGet'));
assert('AH03 ensureAgEvsLoaded() foi adicionada', currentHtml.includes('async function ensureAgEvsLoaded()'));
assert('AH04 ensureAgEvsLoaded() busca o nó events completo (mesma fonte de agPoll)', currentHtml.includes("fetch(DB+'/events.json')"));
assert('AH05 renderMetas() agora é async e chama ensureAgEvsLoaded() antes de renderizar',
  currentHtml.includes('async function renderMetas(c)') && /async function renderMetas\(c\) \{[\s\S]{0,1000}await ensureAgEvsLoaded\(\)/.test(currentHtml));
assert('AH06 nenhuma regra de negócio de contagem (countMeta) foi alterada — só o carregamento de dados',
  currentHtml.includes('if((isAuthor||isGuest)&&isSucesso&&isCliente) count++;'));

// ═══════════════════════════════════════════════════════════════════════════
// Suite AH2 — ensureAgEvsLoaded(): execução real (fetch único, idempotente)
// ═══════════════════════════════════════════════════════════════════════════

function makeAgEvsLoaderContext(eventsPayload: Record<string, unknown> | null) {
  const declSrc = extractStatement(currentHtml, /let _agEvsLoadedOnce=false, _agEvsLoadPromise=null;/);
  const ensureSrc = extractFunction(currentHtml, /async function ensureAgEvsLoaded\(\)/);
  let fetchCallCount = 0;
  const context = vm.createContext({
    console, Promise,
    agEvs: {} as Record<string, unknown>,
    DB: 'https://fake-rtdb.firebaseio.com',
    fetch: async (url: string) => {
      fetchCallCount++;
      if (!url.includes('events.json')) return { ok: false };
      return { ok: eventsPayload !== null, json: async () => eventsPayload };
    },
  });
  vm.runInContext(`${declSrc}\n${ensureSrc}\nthis.__ensure = ensureAgEvsLoaded;`, context);
  return { ensure: context.__ensure as () => Promise<void>, context, getFetchCallCount: () => fetchCallCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite AH3 — countMeta(): fixtures realistas do formato REAL confirmado
// ═══════════════════════════════════════════════════════════════════════════

function makeCountMetaContext(agEvs: Record<string, unknown>, crmDeals: Record<string, unknown> = {}) {
  const countMetaSrc = extractFunction(currentHtml, /function countMeta\(/);
  const context = vm.createContext({
    console, Date, Object, Math, String,
    window: {} as Record<string, unknown>,
    CU: { uid: 'lucas_vizentin', name: 'Lucas Vizentin' },
    crmDeals,
    allProsp: {},
    agEvs,
  });
  vm.runInContext(`${countMetaSrc}\nthis.__countMeta = countMeta;`, context);
  return { countMeta: context.__countMeta as (list: unknown[], id: string, uid?: string, name?: string) => number, context };
}

async function run() {
  console.log('\nSuite AH2 — ensureAgEvsLoaded(): execução real (fetch único, idempotente)');

  {
    const { ensure, context, getFetchCallCount } = makeAgEvsLoaderContext({ '2026-07-10': { e1: { author: 'A' } } });
    await ensure();
    assert('AH07 primeira chamada: agEvs populado a partir do fetch', Object.keys(context.agEvs as object).length === 1);
    assert('AH08 primeira chamada: exatamente 1 fetch realizado', getFetchCallCount() === 1);
    await ensure();
    await ensure();
    assert('AH09 chamadas subsequentes: NÃO refazem o fetch (idempotente — carrega uma única vez por sessão)', getFetchCallCount() === 1);
  }

  {
    const { ensure, getFetchCallCount } = makeAgEvsLoaderContext({ '2026-07-10': { e1: {} } });
    await Promise.all([ensure(), ensure(), ensure()]);
    assert('AH10 3 chamadas concorrentes na mesma sessão: apenas 1 fetch real', getFetchCallCount() === 1);
  }

  console.log('\nSuite AH3 — countMeta() com fixtures do formato REAL de events/ (execução real)');

  const y = 2026, m = 7; // julho/2026 — mês citado no incidente
  const iso = (day: number) => `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  {
    const { countMeta, context } = makeCountMetaContext({
      [iso(10)]: { e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } },
    });
    (context as any).window._metaDataSel = iso(10);
    assert('AH11 1 atendimento no dia: contador diário = 1 (não zerado)', countMeta([], 'atendimentos') === 1);
  }

  {
    const { countMeta, context } = makeCountMetaContext({
      [iso(10)]: {
        e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' },
        e2: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' },
        e3: { guests: [{ name: 'Lucas Vizentin', status: 'confirmed' }], resultado: 'sucesso' },
      },
    });
    (context as any).window._metaDataSel = iso(10);
    assert('AH12 3 atendimentos no dia (autor + convidado confirmado): contador diário = 3', countMeta([], 'atendimentos') === 3);
  }

  {
    const { countMeta } = makeCountMetaContext({
      [iso(3)]: { e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } },
      [iso(10)]: { e2: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } },
      [iso(25)]: { e3: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } },
    });
    assert('AH13 3 atendimentos em dias diferentes do mesmo mês: contador mensal (julho/2026) = 3 (não zerado)', countMeta([], 'atend_mensal') === 3);
  }

  {
    const { countMeta, context } = makeCountMetaContext({
      [iso(10)]: { e1: { author: 'Outro Executivo', resultado: 'sucesso', tipo_atendimento: 'cliente' } },
    });
    (context as any).window._metaDataSel = iso(10);
    assert('AH14 evento de outro usuário: NÃO conta para Lucas Vizentin', countMeta([], 'atendimentos') === 0);
  }

  {
    const { countMeta } = makeCountMetaContext({
      '2026-08-05': { e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } }, // agosto, fora do mês
    });
    assert('AH15 atendimento em agosto/2026: NÃO conta no mensal de julho/2026', countMeta([], 'atend_mensal') === 0);
  }

  {
    const { countMeta, context } = makeCountMetaContext({
      [iso(10)]: {
        e1: { author: 'Lucas Vizentin', resultado: 'insucesso', tipo_atendimento: 'cliente' },
        e2: { author: 'Lucas Vizentin', tipo_atendimento: 'cliente' }, // sem resultado — não realizado
      },
    });
    (context as any).window._metaDataSel = iso(10);
    assert('AH16 evento "cancelado"/não realizado (resultado !== sucesso, ou ausente): NÃO conta', countMeta([], 'atendimentos') === 0);
  }

  {
    const dayEvents: Record<string, unknown> = { e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } };
    const { countMeta, context } = makeCountMetaContext({ [iso(10)]: dayEvents });
    (context as any).window._metaDataSel = iso(10);
    const first = countMeta([], 'atendimentos');
    const second = countMeta([], 'atendimentos');
    assert('AH17 chamar countMeta 2x seguidas contra o mesmo estado: sempre o mesmo valor (1), nunca soma acumulada', first === 1 && second === 1);
  }

  {
    const { countMeta, context } = makeCountMetaContext({
      '2026-07-01': { e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } },
    });
    (context as any).window._metaDataSel = '2026-07-01';
    assert('AH18 chave de data no formato real (YYYY-MM-DD com padStart, ex. dia 01): reconhecida corretamente', countMeta([], 'atendimentos') === 1);
  }

  {
    const { countMeta, context } = makeCountMetaContext({
      [iso(10)]: { e1: { resultado: 'sucesso', tipo_atendimento: 'cliente' } },
    });
    (context as any).window._metaDataSel = iso(10);
    assert('AH19 evento sem usuário (sem author/guests): não conta, não lança erro', countMeta([], 'atendimentos') === 0);
  }

  {
    const { countMeta, context } = makeCountMetaContext({});
    (context as any).window._metaDataSel = iso(15);
    assert('AH20 dia sem nenhum evento registrado: retorna 0 sem lançar erro', countMeta([], 'atendimentos') === 0);
  }

  {
    const { countMeta, context } = makeCountMetaContext({
      [iso(5)]: { e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' } },
      [iso(12)]: {
        e2: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' },
        e3: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' },
      },
    });
    (context as any).window._metaDataSel = iso(12);
    const daily = countMeta([], 'atendimentos');
    const monthly = countMeta([], 'atend_mensal');
    assert('AH21 diário (dia 12): 2 atendimentos', daily === 2);
    assert('AH22 mensal (julho inteiro): 3 atendimentos (5 tem 1, 12 tem 2) — diário e mensal coerentes entre si', monthly === 3);
  }

  {
    const { countMeta, context } = makeCountMetaContext({
      [iso(10)]: { e1: { author: 'Lucas Vizentin', resultado: 'sucesso', type: 'retomada' } },
    });
    (context as any).window._metaDataSel = iso(10);
    assert('AH23 retomada com resultado=sucesso: NÃO conta (regra histórica preservada, não alterada)', countMeta([], 'atendimentos') === 0);
  }

  console.log('\nSuite AH4 — percentual médio da meta usa o valor restaurado (execução real)');

  {
    const beforeFix = goals.computeIndicatorPercentage(0, 2);
    assert('AH24 ANTES da correção (agEvs vazio): percentual seria 0% mesmo com histórico real', beforeFix.capped === 0);

    const { countMeta, context } = makeCountMetaContext({
      [iso(10)]: {
        e1: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' },
        e2: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' },
        e3: { author: 'Lucas Vizentin', resultado: 'sucesso', tipo_atendimento: 'cliente' },
      },
    });
    (context as any).window._metaDataSel = iso(10);
    const realizado = countMeta([], 'atendimentos');
    const afterFix = goals.computeIndicatorPercentage(realizado, 2);
    assert('AH25 DEPOIS da correção: realizado restaurado (3) gera percentual capado a 100%, não mais 0%', afterFix.capped === 100);

    const daily = goals.computeDailyGoalAveragePercentage({
      newClients: { realizado: 5, meta: 5 },
      qualifiedLeads: { realizado: 1, meta: 0.5 },
      completedAttendances: { realizado, meta: 2 },
    });
    assert('AH26 percentual médio da meta (3 indicadores) usa o completedAttendances restaurado, não 0', daily.indicators.completedAttendances.capped === 100 && daily.status === 'ok');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Attendance History Restoration Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
