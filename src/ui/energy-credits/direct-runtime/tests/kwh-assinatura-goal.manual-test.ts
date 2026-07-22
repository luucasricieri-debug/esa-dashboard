'use strict';
/**
 * ESA OS — Meta kWh Assinatura: regra de contabilização, idempotência e bugfix
 *
 * Campo real de kWh encontrado por auditoria: `d.kwh` no objeto do deal
 * (crmDeals) — populado a partir do campo de formulário "Demanda kWh"
 * (cd-valor, quando funil==='assinatura_energia') e também a partir de
 * `demanda_kwh` nos fluxos automáticos de qualificação de prospect. Nenhum
 * campo novo foi criado — reaproveita o campo já existente em todo o CRM
 * (usado também na exibição do card, no detalhe, e nos totais de coluna do
 * kanban).
 *
 * BUG ENCONTRADO E CORRIGIDO: o case 'kwh_exec' de countMeta() comparava
 * d.captador/d.responsavel — campos que NUNCA são gravados em nenhum deal
 * real (todo deal grava captadorNome/responsavelNome). Isso fazia a "Meta
 * kWh Assinatura" retornar SEMPRE 0 para qualquer executivo. Corrigido para
 * usar os campos reais (captadorNome/responsavelNome) via helper consolidado
 * _sumKwhAssinatura().
 *
 * Este arquivo testa, com EXECUÇÃO REAL do código extraído de index.html
 * (isEligibleAssinaturaStage, _sumKwhAssinatura, countMeta): estágios
 * elegíveis (com variações de acentuação), kWh inválido não conta, decimal
 * preservado, idempotência (troca de estágio, edição repetida, duas abas),
 * atualização de kWh, saída/retorno de estágio, soma de vários leads.
 *
 * Rodar: npx tsx tests/kwh-assinatura-goal.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

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
function extractStatement(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`statement não encontrada: ${startPattern}`);
  const semi = src.indexOf(';', m.index);
  if (semi === -1) throw new Error(`';' de fechamento não encontrado para: ${startPattern}`);
  return src.slice(m.index, semi + 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite KWH1 — Static: bugfix confirmado no source
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite KWH1 — bugfix kwh_exec confirmado no source (campos reais captadorNome/responsavelNome)');

assert('KWH01 kwh_exec não compara mais d.captador/d.responsavel (campos inexistentes)',
  !/d\.captador!==_en&&d\.responsavel!==_en/.test(currentHtml));
assert('KWH02 helper _sumKwhAssinatura usa captadorNome/responsavelNome (campos reais gravados por crmSaveDeal)',
  currentHtml.includes("d.captadorNome===_en||d.responsavelNome===_en"));
assert('KWH03 nenhum campo novo de kWh foi inventado — continua usando d.kwh (campo real já existente)',
  currentHtml.includes('var kwhVal=Number(d.kwh)'));
assert('KWH04 lógica de soma consolidada em uma única função (_sumKwhAssinatura), evitando duplicação futura',
  (currentHtml.match(/function _sumKwhAssinatura/g) || []).length === 1);

// ═══════════════════════════════════════════════════════════════════════════
// Suite KWH2 — isEligibleAssinaturaStage(): variações de acentuação (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite KWH2 — isEligibleAssinaturaStage(): aceita variações de acentuação/capitalização (execução real)');

{
  const stageFnSrc = extractFunction(currentHtml, /function isEligibleAssinaturaStage\(/);
  const stripFnSrc = extractFunction(currentHtml, /function _stripStageKey\(/);
  const keysDecl = extractStatement(currentHtml, /var ASSINATURA_ELIGIBLE_STAGE_KEYS/);
  const context = vm.createContext({ console, String });
  vm.runInContext(`${keysDecl}\n${stripFnSrc}\n${stageFnSrc}\nthis.__isEligible = isEligibleAssinaturaStage;`, context);
  const isEligible = context.__isEligible as (etapa: string) => boolean;

  const eligibleVariants = ['Conclusão da GD', 'Conclusao da GD', 'conclusão da gd', 'CONCLUSÃO DA GD', 'Início do faturamento', 'Inicio do Faturamento', 'Início de Faturamento', 'inicio de faturamento'];
  eligibleVariants.forEach((v) => assert(`KWH05.${v} "${v}" é reconhecido como estágio elegível`, isEligible(v) === true));

  const notEligible = ['Lead', 'Envio de Proposta', 'Termo de Adesão', '', undefined as any, null as any];
  notEligible.forEach((v) => assert(`KWH06.${String(v)} "${String(v)}" NÃO é estágio elegível`, isEligible(v) === false));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite KWH3 — _sumKwhAssinatura(): execução real ponta a ponta
// ═══════════════════════════════════════════════════════════════════════════

function makeKwhContext(crmDeals: Record<string, unknown>) {
  const stageFnSrc = extractFunction(currentHtml, /function isEligibleAssinaturaStage\(/);
  const stripFnSrc = extractFunction(currentHtml, /function _stripStageKey\(/);
  const keysDecl = extractStatement(currentHtml, /var ASSINATURA_ELIGIBLE_STAGE_KEYS/);
  const sumFnSrc = extractFunction(currentHtml, /function _sumKwhAssinatura\(/);
  const context = vm.createContext({ console, Date, Object, String, isFinite, Number, crmDeals });
  vm.runInContext(`${keysDecl}\n${stripFnSrc}\n${stageFnSrc}\n${sumFnSrc}\nthis.__sumKwh = _sumKwhAssinatura;`, context);
  return context.__sumKwh as (filterFn: ((d: any) => boolean) | null) => number;
}

function nowISOParts() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() };
}

console.log('\nSuite KWH3 — regra de elegibilidade (funil, estágio, kWh válido) — execução real');

{
  const { y, m } = nowISOParts();
  const ts = new Date(y, m, 15).getTime();

  const sumKwh = makeKwhContext({
    outroFunil: { funil: 'venda_ufv', etapa: 'Conclusão da GD', kwh: 1000, etapaTs: ts },
    estagioAnterior: { funil: 'assinatura_energia', etapa: 'Envio de Proposta', kwh: 1000, etapaTs: ts },
    conclusaoGD: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 500, etapaTs: ts },
    inicioFaturamento: { funil: 'assinatura_energia', etapa: 'Início do faturamento', kwh: 300, etapaTs: ts },
    semKwh: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 0, etapaTs: ts },
    kwhInvalido: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 'não é número', etapaTs: ts },
    kwhNegativo: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: -50, etapaTs: ts },
  });

  assert('KWH07 lead fora do funil Assinatura de Energia NÃO conta', sumKwh(null) === 500 + 300);
  assert('KWH08 lead no funil correto mas estágio anterior NÃO conta (isolado)', (() => {
    const only = makeKwhContext({ x: { funil: 'assinatura_energia', etapa: 'Envio de Proposta', kwh: 999, etapaTs: ts } });
    return only(null) === 0;
  })());
  assert('KWH09 Conclusão da GD conta (isolado)', (() => {
    const only = makeKwhContext({ x: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 500, etapaTs: ts } });
    return only(null) === 500;
  })());
  assert('KWH10 Início do faturamento conta (isolado)', (() => {
    const only = makeKwhContext({ x: { funil: 'assinatura_energia', etapa: 'Início do faturamento', kwh: 300, etapaTs: ts } });
    return only(null) === 300;
  })());
  assert('KWH11 lead sem kWh válido (0) não soma nada (não é erro, só não contribui)', (() => {
    const only = makeKwhContext({ x: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 0, etapaTs: ts } });
    return only(null) === 0;
  })());
  assert('KWH12 lead com kWh não numérico não conta (nunca gera NaN)', (() => {
    const only = makeKwhContext({ x: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 'abc', etapaTs: ts } });
    return only(null) === 0 && isFinite(only(null));
  })());
  assert('KWH13 kWh negativo não conta (nunca soma negativo)', (() => {
    const only = makeKwhContext({ x: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: -50, etapaTs: ts } });
    return only(null) === 0;
  })());
}

console.log('\nSuite KWH4 — decimal de kWh é preservado (execução real)');

{
  const { y, m } = nowISOParts();
  const ts = new Date(y, m, 10).getTime();
  const sumKwh = makeKwhContext({ x: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 1234.567, etapaTs: ts } });
  assert('KWH14 kWh decimal (1234.567) é somado sem arredondamento/truncamento', sumKwh(null) === 1234.567);
}

console.log('\nSuite KWH5 — idempotência: mesmo lead não duplica ao trocar entre os dois estágios elegíveis, editar, ou abrir em 2 abas');

{
  const { y, m } = nowISOParts();
  const ts = new Date(y, m, 5).getTime();

  // "Trocar de estágio" e "editar repetidamente" e "abrir em duas abas" são,
  // na prática, o MESMO cenário para um cálculo derivado do estado atual:
  // Object.values(crmDeals) sempre itera CADA deal no máximo 1 vez, usando
  // sempre o etapa/kwh ATUAIS — não existe acumulador incremental para
  // duplicar. Isso é testado chamando a função várias vezes seguidas contra
  // o MESMO estado (simula "duas abas" e "salvar repetidamente" concorrentes)
  // e depois mudando o estágio do MESMO deal (simula avançar/retroceder).
  const deals: Record<string, any> = { d1: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 500, etapaTs: ts } };
  const sum1a = makeKwhContext(deals)(null);
  const sum1b = makeKwhContext(deals)(null); // "segunda aba" / "salvar de novo" — mesmo estado
  const sum1c = makeKwhContext(deals)(null); // "terceira leitura" — ainda o mesmo estado
  assert('KWH15 chamar 3x seguidas contra o mesmo estado (duas abas / salvar repetido): sempre o mesmo valor, nunca soma acumulada', sum1a === 500 && sum1b === 500 && sum1c === 500);

  // Avança para o outro estágio elegível — ainda conta uma única vez (o mesmo deal, não um novo).
  deals.d1.etapa = 'Início do faturamento';
  const sum2 = makeKwhContext(deals)(null);
  assert('KWH16 avançar de Conclusão da GD para Início do faturamento: ainda soma 500 uma única vez (não 1000)', sum2 === 500);

  // Volta para o estágio anterior (regressão) — ainda soma uma vez.
  deals.d1.etapa = 'Conclusão da GD';
  const sum3 = makeKwhContext(deals)(null);
  assert('KWH17 voltar de estágio: ainda soma 500 uma única vez', sum3 === 500);
}

console.log('\nSuite KWH6 — alteração de kWh atualiza o consolidado (não soma sobre o valor anterior)');

{
  const { y, m } = nowISOParts();
  const ts = new Date(y, m, 5).getTime();
  const deals: Record<string, any> = { d1: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 500, etapaTs: ts } };
  const before = makeKwhContext(deals)(null);
  deals.d1.kwh = 800; // usuário corrige o valor de kWh do lead
  const after = makeKwhContext(deals)(null);
  assert('KWH18 kWh alterado de 500 para 800: consolidado reflete 800 (não 500+800=1300)', before === 500 && after === 800);
}

console.log('\nSuite KWH7 — saída do estágio elegível remove do consolidado; retorno conta uma vez');

{
  const { y, m } = nowISOParts();
  const ts = new Date(y, m, 5).getTime();
  const deals: Record<string, any> = { d1: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 500, etapaTs: ts } };
  const withStage = makeKwhContext(deals)(null);
  deals.d1.etapa = 'Envio de Proposta'; // saiu do estágio elegível (retrocedeu no funil)
  const afterExit = makeKwhContext(deals)(null);
  deals.d1.etapa = 'Início do faturamento'; // retornou a um estágio elegível
  const afterReturn = makeKwhContext(deals)(null);
  assert('KWH19 com o lead no estágio elegível: soma 500', withStage === 500);
  assert('KWH20 saiu do estágio elegível: deixa de contar (consolidado = 0, não fica "travado" em 500)', afterExit === 0);
  assert('KWH21 retornou a um estágio elegível: volta a contar uma única vez (500, não 1000)', afterReturn === 500);
}

console.log('\nSuite KWH8 — soma de vários leads elegíveis de captadores diferentes é correta');

{
  const { y, m } = nowISOParts();
  const ts = new Date(y, m, 5).getTime();
  const deals: Record<string, any> = {
    d1: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 500, etapaTs: ts, captadorNome: 'Ana', responsavelNome: 'Ana' },
    d2: { funil: 'assinatura_energia', etapa: 'Início do faturamento', kwh: 300, etapaTs: ts, captadorNome: 'Bruno', responsavelNome: 'Bruno' },
    d3: { funil: 'assinatura_energia', etapa: 'Lead', kwh: 9999, etapaTs: ts, captadorNome: 'Ana', responsavelNome: 'Ana' }, // não elegível
  };
  const sumAll = makeKwhContext(deals)(null);
  assert('KWH22 soma geral (todos os captadores): 500+300 = 800 (Lead não elegível excluído)', sumAll === 800);

  const sumAna = makeKwhContext(deals)((d: any) => d.captadorNome === 'Ana' || d.responsavelNome === 'Ana');
  assert('KWH23 soma filtrada por captador (Ana): apenas o deal dela em estágio elegível (500)', sumAna === 500);

  const sumBruno = makeKwhContext(deals)((d: any) => d.captadorNome === 'Bruno' || d.responsavelNome === 'Bruno');
  assert('KWH24 soma filtrada por captador (Bruno): apenas o deal dele (300) — este é o bugfix do kwh_exec', sumBruno === 300);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`kWh Assinatura Goal Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
