'use strict';
/**
 * ESA OS — Campo "Origem do Lead" no CRM
 *
 * Testa, com EXECUÇÃO REAL de assets/lead-origin.js e do código extraído de
 * index.html (crmOpenNew, crmOpenEdit, validação em crmSaveDeal): as 4
 * opções oficiais, validação obrigatória na criação/edição, compatibilidade
 * com leads antigos sem origem (nunca classificados silenciosamente),
 * persistência e exibição no detalhe.
 *
 * Rodar: npx tsx tests/lead-origin.manual-test.ts
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

const leadOrigin = require(path.join(ROOT, 'assets/lead-origin.js'));
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
// Suite LO1 — As 4 opções oficiais (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite LO1 — LEAD_ORIGINS: as 4 opções oficiais, ids estáveis, labels em português');

assert('LO01 active_prospecting → "Prospecção Ativa"', leadOrigin.LEAD_ORIGINS.active_prospecting.label === 'Prospecção Ativa');
assert('LO02 sdr → "SDR"', leadOrigin.LEAD_ORIGINS.sdr.label === 'SDR');
assert('LO03 paid_traffic → "Tráfego Pago"', leadOrigin.LEAD_ORIGINS.paid_traffic.label === 'Tráfego Pago');
assert('LO04 ambassadors → "Embaixadores"', leadOrigin.LEAD_ORIGINS.ambassadors.label === 'Embaixadores');
assert('LO05 exatamente 4 opções oficiais, nem mais nem menos', Object.keys(leadOrigin.LEAD_ORIGINS).length === 4);

// ═══════════════════════════════════════════════════════════════════════════
// Suite LO2 — validateLeadOriginForSave(): execução real
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite LO2 — validateLeadOriginForSave(): ausência bloqueia, valor inválido bloqueia');

assert('LO06 ausência (string vazia) é rejeitada com reason=missing', leadOrigin.validateLeadOriginForSave('').reason === 'missing');
assert('LO07 undefined é rejeitado com reason=missing', leadOrigin.validateLeadOriginForSave(undefined).reason === 'missing');
assert('LO08 null é rejeitado com reason=missing', leadOrigin.validateLeadOriginForSave(null).reason === 'missing');
assert('LO09 valor fora da lista oficial é rejeitado com reason=invalid', leadOrigin.validateLeadOriginForSave('valor_qualquer').reason === 'invalid');
['active_prospecting', 'sdr', 'paid_traffic', 'ambassadors'].forEach((id) => {
  assert(`LO10.${id} id oficial "${id}" é aceito (valid=true)`, leadOrigin.validateLeadOriginForSave(id).valid === true && leadOrigin.validateLeadOriginForSave(id).id === id);
});

// ═══════════════════════════════════════════════════════════════════════════
// Suite LO3 — Aliases históricos normalizam; valor desconhecido NUNCA é classificado
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite LO3 — alias histórico normaliza; valor desconhecido permanece pendência (nunca classificado silenciosamente)');

assert('LO11 "prospeccao" normaliza para active_prospecting', leadOrigin.normalizeLeadOrigin('prospeccao') === 'active_prospecting');
assert('LO12 "prospecção" (com acento) normaliza para active_prospecting', leadOrigin.normalizeLeadOrigin('prospecção') === 'active_prospecting');
assert('LO13 "trafego" normaliza para paid_traffic', leadOrigin.normalizeLeadOrigin('trafego') === 'paid_traffic');
assert('LO14 "tráfego pago" normaliza para paid_traffic', leadOrigin.normalizeLeadOrigin('tráfego pago') === 'paid_traffic');
assert('LO15 "embaixador" normaliza para ambassadors', leadOrigin.normalizeLeadOrigin('embaixador') === 'ambassadors');
assert('LO16 "indicação embaixador" normaliza para ambassadors', leadOrigin.normalizeLeadOrigin('indicação embaixador') === 'ambassadors');
assert('LO17 valor livre/desconhecido ("Prospecção João", texto dinâmico histórico) NÃO é classificado — retorna null, nunca um palpite',
  leadOrigin.normalizeLeadOrigin('Prospecção João') === null);
assert('LO18 string vazia/ausente retorna null sem lançar', leadOrigin.normalizeLeadOrigin('') === null && leadOrigin.normalizeLeadOrigin(undefined) === null);
assert('LO19 validateLeadOriginForSave aceita alias histórico e resolve para o id canônico',
  leadOrigin.validateLeadOriginForSave('trafego').valid === true && leadOrigin.validateLeadOriginForSave('trafego').id === 'paid_traffic');

// ═══════════════════════════════════════════════════════════════════════════
// Suite LO4 — Static: campo presente no formulário, 4 opções, obrigatório
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite LO4 — formulário do CRM: campo Origem do Lead presente com as 4 opções');

assert('LO20 label "Origem do Lead *" presente no HTML do modal', currentHtml.includes('Origem do Lead *'));
assert('LO21 select id="cd-origem" presente', currentHtml.includes('id="cd-origem"'));
assert('LO22 opção "Prospecção Ativa" (active_prospecting) presente', currentHtml.includes('value="active_prospecting">Prospecção Ativa'));
assert('LO23 opção "SDR" (sdr) presente', currentHtml.includes('value="sdr">SDR'));
assert('LO24 opção "Tráfego Pago" (paid_traffic) presente', currentHtml.includes('value="paid_traffic">Tráfego Pago'));
assert('LO25 opção "Embaixadores" (ambassadors) presente', currentHtml.includes('value="ambassadors">Embaixadores'));
assert('LO26 opção placeholder "Selecione..." presente (campo começa vazio, não pré-selecionado)', currentHtml.includes('<option value="">Selecione...</option>'));
assert('LO27 index.html carrega assets/lead-origin.js', currentHtml.includes('<script src="/assets/lead-origin.js"></script>'));
assert('LO28 script do módulo carregado antes do script principal', currentHtml.indexOf('/assets/lead-origin.js') < currentHtml.indexOf('window.crmSaveDeal'));

// ═══════════════════════════════════════════════════════════════════════════
// Suite LO5 — Execução real: crmOpenNew()/crmOpenEdit() populam cd-origem corretamente
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite LO5 — crmOpenNew()/crmOpenEdit(): execução real do estado do campo');

{
  function makeDom() {
    const store = new Map<string, any>();
    return {
      getElementById: (id: string) => {
        if (!store.has(id)) store.set(id, { id, value: '', textContent: '', disabled: false, style: {}, classList: { add() {}, remove() {} } });
        return store.get(id);
      },
      store,
    };
  }

  const crmOpenNewSrc = extractFunction(currentHtml, /function crmOpenNew\(\)/);
  const crmOpenEditSrc = extractFunction(currentHtml, /window\.crmOpenEdit=function\(id\)/);
  const crmOpenEditDriver = `${crmOpenEditSrc}\nthis.__crmOpenEdit = window.crmOpenEdit;`;

  // crmOpenNew: campo deve começar vazio (nenhuma origem pré-selecionada).
  {
    const dom = makeDom();
    const context = vm.createContext({
      console, Object,
      document: dom,
      window: {} as Record<string, unknown>,
      CU: { uid: 'u1', name: 'User' },
      crmDeals: {},
      crmEditId: null as string | null,
      openModal: () => {},
      closeModal: () => {},
      crmPopulateFunilSelect: () => {},
      crmPopulateEtapaSelect: () => {},
      crmUpdateValorField: () => {},
      crmPopulateRespSelect: () => {},
      crmDealEtapaChanged: () => {},
      crmDealObjecaoChanged: () => {},
      CRM_FUNIS: { venda_ufv: { etapas: ['Lead'] } },
      crmFunilAtual: 'venda_ufv',
    });
    vm.runInContext(`${crmOpenNewSrc}\nthis.__crmOpenNew = crmOpenNew;`, context);
    (context.__crmOpenNew as () => void)();
    assert('LO29 crmOpenNew(): cd-origem começa vazio ("")', dom.getElementById('cd-origem').value === '');
    assert('LO30 crmOpenNew(): hint de origem começa vazio', dom.getElementById('cd-origem-hint').textContent === '');
  }

  // crmOpenEdit: deal antigo SEM origem -> campo vazio + hint "não informada".
  {
    const dom = makeDom();
    const context = vm.createContext({
      console, Object,
      document: dom,
      window: {} as Record<string, unknown>,
      CU: { uid: 'u1', name: 'User' },
      crmDeals: { d1: { nome: 'Cliente Antigo', funil: 'venda_ufv', etapa: 'Lead', responsavelUid: 'u1' } }, // sem campo origem
      crmEditId: null as string | null,
      allUsers: { u1: { name: 'User' } },
      openModal: () => {},
      crmPopulateFunilSelect: () => {},
      crmPopulateEtapaSelect: () => {},
      crmUpdateValorField: () => {},
      crmPopulateRespSelect: () => {},
      crmDealEtapaChanged: () => {},
      crmDealObjecaoChanged: () => {},
      crmRenderHistPanel: () => {},
      crmCanEditDeal: () => true,
      showToast: () => {},
      ESALeadOrigin: leadOrigin,
    });
    vm.runInContext(crmOpenEditDriver, context);
    (context.__crmOpenEdit as (id: string) => void)('d1');
    assert('LO31 deal antigo sem origem: continua visível para edição (não bloqueado, não apagado)', !!(context.crmDeals as any).d1);
    assert('LO32 deal antigo sem origem: cd-origem fica vazio (não adivinha um valor)', dom.getElementById('cd-origem').value === '');
    assert('LO33 deal antigo sem origem: hint "Origem não informada" exibido', dom.getElementById('cd-origem-hint').textContent.includes('não informada'));
  }

  // crmOpenEdit: deal com alias histórico reconhecível -> normaliza e pré-seleciona.
  {
    const dom = makeDom();
    const context = vm.createContext({
      console, Object,
      document: dom,
      window: {} as Record<string, unknown>,
      CU: { uid: 'u1', name: 'User' },
      crmDeals: { d2: { nome: 'Cliente Trafego', funil: 'venda_ufv', etapa: 'Lead', responsavelUid: 'u1', origem: 'trafego' } },
      crmEditId: null as string | null,
      allUsers: { u1: { name: 'User' } },
      openModal: () => {},
      crmPopulateFunilSelect: () => {},
      crmPopulateEtapaSelect: () => {},
      crmUpdateValorField: () => {},
      crmPopulateRespSelect: () => {},
      crmDealEtapaChanged: () => {},
      crmDealObjecaoChanged: () => {},
      crmRenderHistPanel: () => {},
      crmCanEditDeal: () => true,
      showToast: () => {},
      ESALeadOrigin: leadOrigin,
    });
    vm.runInContext(crmOpenEditDriver, context);
    (context.__crmOpenEdit as (id: string) => void)('d2');
    assert('LO34 deal com alias histórico "trafego": normaliza e pré-seleciona paid_traffic', dom.getElementById('cd-origem').value === 'paid_traffic');
    assert('LO35 deal com alias reconhecido: hint fica vazio (origem já informada)', dom.getElementById('cd-origem-hint').textContent === '');
  }

  // crmOpenEdit: deal com valor livre não reconhecível ("Prospecção João") -> pendência, não adivinha.
  {
    const dom = makeDom();
    const context = vm.createContext({
      console, Object,
      document: dom,
      window: {} as Record<string, unknown>,
      CU: { uid: 'u1', name: 'User' },
      crmDeals: { d3: { nome: 'Cliente Livre', funil: 'venda_ufv', etapa: 'Lead', responsavelUid: 'u1', origem: 'Prospecção João' } },
      crmEditId: null as string | null,
      allUsers: { u1: { name: 'User' } },
      openModal: () => {},
      crmPopulateFunilSelect: () => {},
      crmPopulateEtapaSelect: () => {},
      crmUpdateValorField: () => {},
      crmPopulateRespSelect: () => {},
      crmDealEtapaChanged: () => {},
      crmDealObjecaoChanged: () => {},
      crmRenderHistPanel: () => {},
      crmCanEditDeal: () => true,
      showToast: () => {},
      ESALeadOrigin: leadOrigin,
    });
    vm.runInContext(crmOpenEditDriver, context);
    (context.__crmOpenEdit as (id: string) => void)('d3');
    assert('LO36 valor livre não reconhecível: campo fica vazio (não classifica silenciosamente)', dom.getElementById('cd-origem').value === '');
    assert('LO37 valor livre não reconhecível: dado histórico original NÃO foi apagado do deal', (context.crmDeals as any).d3.origem === 'Prospecção João');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite LO6 — Static: crmSaveDeal() valida e persiste a origem canônica
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite LO6 — crmSaveDeal(): validação obrigatória + persistência da chave canônica');

assert('LO38 crmSaveDeal chama validateLeadOriginForSave antes de qualquer escrita', currentHtml.includes('ESALeadOrigin.validateLeadOriginForSave(_origemInput)'));
assert('LO39 mensagem de erro exata "Selecione a origem do lead."', currentHtml.includes("errEl.textContent='Selecione a origem do lead.'"));
assert('LO40 validação de origem ocorre ANTES do primeiro fbSet/fbPatch de criação', (() => {
  const validationIdx = currentHtml.indexOf('Selecione a origem do lead.');
  const firstWriteIdx = currentHtml.indexOf("await fbSet('crm/deals/'+id,data)");
  return validationIdx > 0 && firstWriteIdx > validationIdx;
})());
assert('LO41 objeto persistido grava origem com a chave canônica (_origemCheck.id), não texto livre', currentHtml.includes('origem:_origemCheck.id'));
assert('LO42 cd-origem incluído na lista de campos desabilitados em modo visualização (view-only)', /'cd-responsavel','cd-origem'/.test(currentHtml));

console.log(`\n${'='.repeat(60)}`);
console.log(`Lead Origin Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
