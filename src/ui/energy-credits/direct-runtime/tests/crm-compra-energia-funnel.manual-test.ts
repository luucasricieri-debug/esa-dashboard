'use strict';
/**
 * ESA OS — CRM: novo funil "Compra de Energia"
 *
 * Testa, com EXECUÇÃO REAL do código extraído de index.html (vm sandbox):
 * a configuração do novo funil em CRM_FUNIS (id interno, 7 etapas, ordem,
 * labels, ausência de acentos nos ids internos de etapa); criação de lead
 * (crmSaveDeal, real); movimentação entre colunas (crmMoveDeal, real) em
 * todas as 6 transições e retorno; isolamento entre funis (crmFilteredDeals,
 * real); persistência simulando reload; preservação de anexos/histórico/
 * origem/responsável/captador; ausência de duplicação; funis existentes
 * inalterados; Meta kWh Assinatura não afetada; filtros continuam
 * funcionando; e checagens estáticas de CSS mobile (overflow/wrap).
 *
 * Rodar: npx tsx tests/crm-compra-energia-funnel.manual-test.ts
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
const leadOrigin = require(path.join(ROOT, 'assets/lead-origin.js'));

function extractStatement(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`statement não encontrada: ${startPattern}`);
  const semi = src.indexOf(';', m.index);
  if (semi === -1) throw new Error(`';' de fechamento não encontrado para: ${startPattern}`);
  return src.slice(m.index, semi + 1);
}
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
// Para atribuições window.X=async function(){...}; — mesma busca por chaves
// balanceadas, mas o statement completo é a atribuição, não uma "function" nomeada.
function extractAssignment(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`atribuição não encontrada: ${startPattern}`);
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
// Suite CE1 — CRM_FUNIS.compra_energia: configuração (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite CE1 — CRM_FUNIS.compra_energia: id, 7 etapas, ordem, labels, ids sem acento');

const crmFunisSrc = extractStatement(currentHtml, /const CRM_FUNIS = \{/);
const funisContext = vm.createContext({});
vm.runInContext(`${crmFunisSrc}\nthis.__CRM_FUNIS = CRM_FUNIS;`, funisContext);
const CRM_FUNIS = (funisContext as any).__CRM_FUNIS;

{
  assert('CE01 funil "compra_energia" existe em CRM_FUNIS', !!CRM_FUNIS.compra_energia);
  assert('CE02 id interno é exatamente "compra_energia" (chave do objeto, não o nome visível)', Object.prototype.hasOwnProperty.call(CRM_FUNIS, 'compra_energia'));
  assert('CE03 nome visível é "Compra de Energia"', CRM_FUNIS.compra_energia.nome === 'Compra de Energia');
  assert('CE04 nome visível NUNCA é usado como chave (a chave é "compra_energia", não "Compra de Energia")', !Object.prototype.hasOwnProperty.call(CRM_FUNIS, 'Compra de Energia'));

  const etapas = CRM_FUNIS.compra_energia.etapas;
  assert('CE05 possui exatamente 7 etapas', Array.isArray(etapas) && etapas.length === 7);

  const expectedLabels = ['Lead', 'Proposta', 'Visita Técnica', 'Documentação', 'Contrato', 'Pagamento Adesão', 'Homologação'];
  assert('CE06 ordem e labels das 7 etapas conferem exatamente (com acentuação preservada)', JSON.stringify(etapas) === JSON.stringify(expectedLabels));
  expectedLabels.forEach((label, i) => {
    assert(`CE06.${i + 1} etapa[${i}] === "${label}"`, etapas[i] === label);
  });

  assert('CE07 "Lead" é a etapa inicial (índice 0)', etapas[0] === 'Lead');
  assert('CE08 "Homologação" é a etapa final (último índice)', etapas[etapas.length - 1] === 'Homologação');

  const etapaIds = CRM_FUNIS.compra_energia.etapaIds;
  const expectedIds = ['lead', 'proposta', 'visita_tecnica', 'documentacao', 'contrato', 'pagamento_adesao', 'homologacao'];
  assert('CE09 etapaIds possui exatamente 7 ids, mesma ordem de etapas', Array.isArray(etapaIds) && etapaIds.length === 7);
  assert('CE10 ids internos conferem exatamente (sugeridos na tarefa)', JSON.stringify(etapaIds) === JSON.stringify(expectedIds));
  etapaIds.forEach((id: string, i: number) => {
    assert(`CE11.${i + 1} id "${id}" não possui nenhum caractere acentuado`, id === id.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    assert(`CE12.${i + 1} id "${id}" não possui espaços nem letras maiúsculas`, /^[a-z_]+$/.test(id));
  });
  assert('CE13 primeiro id interno é "lead"', etapaIds[0] === 'lead');
  assert('CE14 último id interno é "homologacao" (sem acento)', etapaIds[etapaIds.length - 1] === 'homologacao');
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite CE2 — Funis existentes permanecem inalterados (regressão)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite CE2 — funis existentes inalterados (regressão)');

{
  const expected: Record<string, { nome: string; etapas: string[] }> = {
    venda_ufv: { nome: 'Venda UFV', etapas: ['Lead', 'Visita Técnica', 'Orçamento Bruto', 'Orçamento Econômico', 'Apresentação', 'Negociação', 'Elaboração do contrato', 'Contrato enviado', 'Contrato assinado'] },
    eletromobilidade: { nome: 'Eletromobilidade', etapas: ['Lead', 'Visita Técnica', 'Orçamento Bruto', 'Orçamento Econômico', 'Apresentação', 'Negociação', 'Elaboração do contrato', 'Contrato enviado', 'Contrato assinado'] },
    copel: { nome: 'Análise Copel', etapas: ['Lead', 'Recebimento de documentos', 'Elaboração de proposta', 'Prospecção enviada', 'Prospecção assinada', 'Protocolo Copel protocolado', 'Protocolo em análise', 'Protocolo finalizado', 'Apresentação ao cliente', 'Válido', 'Inválido'] },
    assinatura_energia: { nome: 'Assinatura de Energia', etapas: ['Lead', 'Lead Triado', 'Lead Quarto', 'Pedido de Documento', 'Envio de Proposta', 'Termo de Adesão', 'Conclusão da GD', 'Início do faturamento'] },
    pre_vendas: { nome: 'Pré-vendas', etapas: ['Lead Desqualificado', 'Lead Frio', 'Lead Passando', 'Lead Quarto', 'Maduro Aguardando', 'Maduro Real Validado'] },
    om: { nome: 'Funil O&M', etapas: ['Lead', 'Visita Técnica', 'Elaboração de Proposta', 'Negociação', 'Assinatura GD', 'Conclusão GD', 'Início do faturamento'] },
  };
  Object.keys(expected).forEach((key) => {
    assert(`CE15.${key} nome inalterado`, CRM_FUNIS[key].nome === expected[key].nome);
    assert(`CE16.${key} etapas inalteradas (ordem e conteúdo)`, JSON.stringify(CRM_FUNIS[key].etapas) === JSON.stringify(expected[key].etapas));
  });
  assert('CE17 total de funis é 7 (6 existentes + Compra de Energia)', Object.keys(CRM_FUNIS).length === 7);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite CE3/CE4/CE5 — Execução real: criação, movimentação, isolamento
// ═══════════════════════════════════════════════════════════════════════════

const crmSaveDealSrc = extractAssignment(currentHtml, /window\.crmSaveDeal=async function\(\)\{/);
const crmMoveDealSrc = extractFunction(currentHtml, /async function crmMoveDeal\(id,novaEtapa\)\{/);
const crmFilteredDealsSrc = extractFunction(currentHtml, /function crmFilteredDeals\(\)\{/);
const crmDealsListSrc = extractFunction(currentHtml, /function crmDealsList\(\)\{/);

type Tree = Record<string, unknown>;
function makeFakeFirebase() {
  const tree: Tree = {};
  function setAtPath(p: string, value: unknown) {
    const parts = p.split('/');
    let cur: any = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  function getAtPath(p: string): unknown {
    const parts = p.split('/');
    let cur: any = tree;
    for (const part of parts) {
      if (cur == null) return null;
      cur = cur[part];
    }
    return cur === undefined ? null : cur;
  }
  return {
    tree,
    async fbSet(p: string, data: unknown) { setAtPath(p, data); return data; },
    async fbPatch(p: string, data: Record<string, unknown>) {
      const existing = (getAtPath(p) as Record<string, unknown>) || {};
      setAtPath(p, Object.assign({}, existing, data));
    },
    async fbGet(p: string) { return getAtPath(p); },
  };
}

function makeDom(values: Record<string, string>) {
  const store = new Map<string, any>();
  Object.keys(values).forEach((id) => store.set(id, { value: values[id], textContent: '', style: {} }));
  return {
    getElementById(id: string) {
      if (!store.has(id)) store.set(id, { value: '', textContent: '', style: {}, disabled: false });
      return store.get(id);
    },
    store,
  };
}

function buildDealCreationContext(fake: ReturnType<typeof makeFakeFirebase>, formValues: Record<string, string>) {
  const dom = makeDom(formValues);
  const crmDeals: Record<string, any> = {};
  const allUsers = { resp_1: { uid: 'resp_1', name: 'Executivo Teste', level: 'executivo' } };
  const CU = { uid: 'resp_1', name: 'Executivo Teste', level: 'executivo' };
  const toasts: Array<{ msg: string; ok: boolean }> = [];
  const context = vm.createContext({
    console, Object, Number, Date, Math, String, JSON,
    document: dom,
    window: {} as Record<string, unknown>,
    getVal: (id: string) => { const e = dom.getElementById(id); return e ? e.value : ''; },
    ESALeadOrigin: leadOrigin,
    allUsers,
    CU,
    crmEditId: null,
    crmDeals,
    fbSet: fake.fbSet,
    fbPatch: fake.fbPatch,
    showToast: (msg: string, ok?: boolean) => { toasts.push({ msg, ok: ok !== false }); },
    closeModal: () => {},
    openModal: () => {},
    crmRenderView: () => {},
    registrarInteracao: async () => {},
  });
  vm.runInContext(`${crmSaveDealSrc}\nthis.__crmSaveDeal = window.crmSaveDeal;`, context);
  return { context, crmDeals, toasts };
}

console.log('\nSuite CE3 — crmSaveDeal(): criação real de lead no funil Compra de Energia');

async function run() {
  {
    const fake = makeFakeFirebase();
    const formValues = {
      'cd-nome': 'Cliente Teste CE',
      'cd-empresa': 'Empresa Teste',
      'cd-telefone': '11999990000',
      'cd-valor': '5000',
      'cd-produto': 'Compra de Energia — Piloto',
      'cd-funil': 'compra_energia',
      'cd-etapa': 'Lead',
      'cd-status': 'Em andamento',
      'cd-responsavel': 'resp_1',
      'cd-origem': 'active_prospecting',
      'cd-objecao-cliente': '',
      'cd-objecao-yn': 'nao',
      'cd-objecao-descricao': '',
    };
    const { context, crmDeals } = buildDealCreationContext(fake, formValues);
    await (context as any).__crmSaveDeal();

    const dealIds = Object.keys(crmDeals);
    assert('CE18 exatamente 1 deal foi criado (nenhuma duplicação)', dealIds.length === 1);
    const created = crmDeals[dealIds[0]];
    assert('CE19 lead criado com funil="compra_energia"', created.funil === 'compra_energia');
    assert('CE20 lead criado com etapa="Lead" (etapa inicial)', created.etapa === 'Lead');
    assert('CE21 Origem do Lead preservada e persistida com a chave canônica', created.origem === 'active_prospecting');
    assert('CE22 responsável preservado', created.responsavelUid === 'resp_1' && created.responsavelNome === 'Executivo Teste');
    assert('CE23 captador preservado (mesmo responsável na criação)', created.captadorUid === 'resp_1' && created.captadorNome === 'Executivo Teste');
    assert('CE24 empresa/telefone/produto preservados', created.empresa === 'Empresa Teste' && created.telefone === '11999990000' && created.produto === 'Compra de Energia — Piloto');
    assert('CE25 persistido de fato no Firebase fake (fbSet chamado)', !!fake.tree['crm'] && !!(fake.tree['crm'] as any).deals);

    // Isolamento: o mesmo lead não pode aparecer em outro funil.
    assert('CE26 o lead recém-criado tem funil="compra_energia", nunca outro funil', created.funil !== 'venda_ufv' && created.funil !== 'assinatura_energia');
  }

  console.log('\nSuite CE4 — crmMoveDeal(): movimentação real por todas as 6 transições + retorno');
  {
    const fake = makeFakeFirebase();
    const dealId = 'deal_ce_test_1';
    const initialDeal = {
      nome: 'Lead Movimentação', funil: 'compra_energia', etapa: 'Lead', etapaTs: Date.now(),
      responsavelUid: 'resp_1', responsavelNome: 'Executivo Teste', captadorUid: 'resp_1', captadorNome: 'Executivo Teste',
      origem: 'sdr', arquivos: { arq1: { nome: 'contrato.pdf', url: 'https://x/contrato.pdf' } }, historico: {},
      createdAt: Date.now(), createdBy: 'resp_1',
    };
    const crmDeals: Record<string, any> = { [dealId]: initialDeal };
    fake.tree['crm'] = { deals: { [dealId]: initialDeal } };
    const CU = { uid: 'resp_1', name: 'Executivo Teste', level: 'executivo' };
    const toasts: string[] = [];
    const context = vm.createContext({
      console, Object, Date,
      window: {} as Record<string, unknown>,
      CU,
      crmDeals,
      fbSet: fake.fbSet,
      fbPatch: fake.fbPatch,
      showToast: (msg: string) => { toasts.push(msg); },
      crmRenderView: () => {},
      registrarInteracao: async () => {},
    });
    vm.runInContext(`${crmMoveDealSrc}\nthis.__crmMoveDeal = crmMoveDeal;`, context);
    const moveDeal = (context as any).__crmMoveDeal as (id: string, etapa: string) => Promise<void>;

    // Pequeno intervalo entre movimentações: crmMoveDeal() (código pré-
    // existente, não alterado por esta missão) gera a chave do histórico só
    // com Date.now() (sem sufixo aleatório) — chamadas na MESMA milissegundo
    // colidiriam na chave, o que nunca acontece em uso real (arrastar cards
    // manualmente sempre leva mais de 1ms entre movimentações). Simula esse
    // espaçamento real para testar o comportamento genuíno, o mesmo já válido
    // para todos os demais funis.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const stages = ['Proposta', 'Visita Técnica', 'Documentação', 'Contrato', 'Pagamento Adesão', 'Homologação'];
    for (const stage of stages) {
      await moveDeal(dealId, stage);
      await sleep(2);
      assert(`CE27.${stage} movimentação para "${stage}" persiste etapa corretamente`, crmDeals[dealId].etapa === stage);
      assert(`CE28.${stage} dado real gravado no Firebase fake (crm/deals/${dealId}/etapa)`, (fake.tree.crm as any).deals[dealId].etapa === stage);
      assert(`CE29.${stage} anexos preservados durante a movimentação`, JSON.stringify(crmDeals[dealId].arquivos) === JSON.stringify(initialDeal.arquivos));
      assert(`CE30.${stage} origem preservada durante a movimentação`, crmDeals[dealId].origem === 'sdr');
      assert(`CE31.${stage} responsável e captador preservados`, crmDeals[dealId].responsavelUid === 'resp_1' && crmDeals[dealId].captadorUid === 'resp_1');
      assert(`CE32.${stage} nenhuma duplicação (ainda existe só 1 deal)`, Object.keys(crmDeals).length === 1);
    }
    assert('CE33 histórico registrou as 6 movimentações (uma entrada por transição)', Object.keys(crmDeals[dealId].historico || {}).length === 6);

    // Retorno de etapa: de Homologação de volta para Contrato.
    await moveDeal(dealId, 'Contrato');
    assert('CE34 retorno de etapa (Homologação → Contrato) funciona', crmDeals[dealId].etapa === 'Contrato');
    assert('CE35 retorno de etapa: histórico agora tem 7 entradas', Object.keys(crmDeals[dealId].historico || {}).length === 7);
    assert('CE36 retorno de etapa: dados preservados (origem/anexos/responsável)', crmDeals[dealId].origem === 'sdr' && JSON.stringify(crmDeals[dealId].arquivos) === JSON.stringify(initialDeal.arquivos) && crmDeals[dealId].responsavelUid === 'resp_1');

    console.log('\nSuite CE-reload — persistência simulando reload (reconstrução a partir do Firebase fake)');
    // Simula reload: descarta o crmDeals em memória e reconstrói a partir do
    // que está gravado no Firebase fake — exatamente o que loadAllData() faz
    // ao reabrir a página.
    const reloadedDeals = JSON.parse(JSON.stringify((fake.tree.crm as any).deals));
    assert('CE37 após "reload" simulado, a etapa persistida é a última gravada (Contrato)', reloadedDeals[dealId].etapa === 'Contrato');
    assert('CE38 após "reload" simulado, nenhum dado foi perdido (anexos, origem, responsável)', reloadedDeals[dealId].origem === 'sdr' && JSON.stringify(reloadedDeals[dealId].arquivos) === JSON.stringify(initialDeal.arquivos));
  }

  console.log('\nSuite CE5 — crmFilteredDeals(): isolamento entre funis (execução real)');
  {
    const crmDeals: Record<string, any> = {
      deal_ce: { funil: 'compra_energia', etapa: 'Lead', responsavelUid: 'resp_1', captadorUid: 'resp_1', status: 'Em andamento' },
      deal_ufv: { funil: 'venda_ufv', etapa: 'Lead', responsavelUid: 'resp_1', captadorUid: 'resp_1', status: 'Em andamento' },
      deal_ass: { funil: 'assinatura_energia', etapa: 'Lead', responsavelUid: 'resp_1', captadorUid: 'resp_1', status: 'Em andamento', kwh: 1000 },
    };
    const CU = { uid: 'resp_1', name: 'Executivo Teste', level: 'diretor' }; // diretor => verTodos=true
    const context = vm.createContext({
      console, Object,
      CU,
      crmDeals,
      crmFunilAtual: 'compra_energia',
      crmFiltResp: '', crmFiltStatus: '', crmFiltProduto: '',
    });
    vm.runInContext(`${crmDealsListSrc}\n${crmFilteredDealsSrc}\nthis.__filtered = crmFilteredDeals;`, context);
    const getFiltered = () => (context as any).__filtered() as any[];

    let result = getFiltered();
    assert('CE39 filtro por compra_energia: retorna só o deal desse funil (1)', result.length === 1 && result[0].funil === 'compra_energia');

    (context as any).crmFunilAtual = 'venda_ufv';
    result = getFiltered();
    assert('CE40 trocar para venda_ufv: o lead de Compra de Energia NÃO aparece', result.length === 1 && result[0].funil === 'venda_ufv');

    (context as any).crmFunilAtual = 'assinatura_energia';
    result = getFiltered();
    assert('CE41 trocar para assinatura_energia: o lead de Compra de Energia NÃO aparece', result.length === 1 && result[0].funil === 'assinatura_energia');

    (context as any).crmFunilAtual = 'compra_energia';
    result = getFiltered();
    assert('CE42 voltar para compra_energia: o lead reaparece', result.length === 1 && result[0].funil === 'compra_energia');

    console.log('\nSuite CE6 — filtros por responsável/status continuam funcionando para o novo funil');
    (context as any).crmFiltResp = 'resp_1';
    result = getFiltered();
    assert('CE43 filtro por responsável funciona para compra_energia', result.length === 1);
    (context as any).crmFiltResp = 'outro_uid_qualquer';
    result = getFiltered();
    assert('CE44 filtro por responsável exclui quando não bate', result.length === 0);
    (context as any).crmFiltResp = '';
    (context as any).crmFiltStatus = 'Vendido';
    result = getFiltered();
    assert('CE45 filtro por status exclui deal "Em andamento" quando status filtrado é "Vendido"', result.length === 0);
  }

  console.log('\nSuite CE7 — Meta kWh Assinatura NÃO é afetada pelo novo funil (execução real)');
  {
    const isEligibleSrc = extractFunction(currentHtml, /function isEligibleAssinaturaStage\(etapa\)\{/);
    const stripKeySrc = extractFunction(currentHtml, /function _stripStageKey\(s\)\{/);
    const stageKeysDecl = extractStatement(currentHtml, /var ASSINATURA_ELIGIBLE_STAGE_KEYS=/);
    const sumKwhSrc = extractFunction(currentHtml, /function _sumKwhAssinatura\(filterFn\)\{/);

    const crmDeals: Record<string, any> = {
      deal_ce_homolog: { funil: 'compra_energia', etapa: 'Homologação', kwh: 99999, etapaTs: Date.now(), captadorNome: 'X', responsavelNome: 'X' },
      deal_ass_ok: { funil: 'assinatura_energia', etapa: 'Conclusão da GD', kwh: 500, etapaTs: Date.now(), captadorNome: 'X', responsavelNome: 'X' },
    };
    const context = vm.createContext({ console, Object, String, Number, Date, isFinite, crmDeals });
    vm.runInContext(`${stageKeysDecl}\n${stripKeySrc}\n${isEligibleSrc}\n${sumKwhSrc}\nthis.__sum = _sumKwhAssinatura;`, context);
    const sum = (context as any).__sum(null);
    assert('CE46 Meta kWh Assinatura soma APENAS deals de funil=assinatura_energia (500), nunca o de compra_energia (99999)', sum === 500);
    assert('CE47 o valor da soma NÃO inclui o kwh do deal de Compra de Energia mesmo em etapa "Homologação" (nome parecido não confunde)', sum !== 99999 && sum !== 100499);
  }

  console.log('\nSuite CE8 — checagens estáticas: seletor genérico, mobile CSS, nenhuma lista hardcoded de funis');
  {
    assert('CE48 aba de funis é gerada via Object.entries(CRM_FUNIS) — nunca uma lista hardcoded', currentHtml.includes("Object.entries(CRM_FUNIS).map(function(e){"));
    assert('CE49 seletor de funil do modal (crmPopulateFunilSelect) também é genérico sobre CRM_FUNIS', currentHtml.includes("function crmPopulateFunilSelect(selId,selectedKey){") && /crmPopulateFunilSelect[\s\S]{0,200}Object\.entries\(CRM_FUNIS\)/.test(currentHtml));
    assert('CE50 populador de etapas (crmPopulateEtapaSelect) é genérico, parametrizado por funilKey', currentHtml.includes('var etapas=(CRM_FUNIS[funilKey]||{}).etapas||[];'));
    assert('CE51 Kanban (.crm-board) usa overflow-x:auto — colunas navegáveis horizontalmente no mobile', currentHtml.includes('.crm-board{display:flex;gap:12px;overflow-x:auto'));
    assert('CE52 seletor de funis (.crm-funnel-tabs) usa flex-wrap:wrap — acessível em telas estreitas', currentHtml.includes('.crm-funnel-tabs{display:flex;gap:8px;flex-wrap:wrap'));
    assert('CE53 nenhuma coluna é cortada de forma irreversível: .crm-col tem min-width/max-width fixos e o container rola (não colapsa)', /\.crm-col\{[^}]*min-width:250px[^}]*max-width:250px/.test(currentHtml));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`CRM Compra de Energia Funnel Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
