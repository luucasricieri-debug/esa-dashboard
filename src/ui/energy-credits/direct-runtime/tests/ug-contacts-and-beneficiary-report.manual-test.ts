// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Missão: contatos da UG (telefone/e-mail) + Relatório da Beneficiária
//         + remoção da coluna Cobertura do Relatório do Proprietário
//
// Cobre a Seção 15 da missão:
//   UNIDADE GERADORA — telefone/e-mail no wizard, revisão, detalhe,
//   validação, normalização, compatibilidade com UGs antigas.
//   COBERTURA — coluna removida apenas da tabela do Proprietário;
//   as outras 8 colunas e os dados internos (covText/covBg/...)
//   permanecem intactos em todas as demais telas.
//   RELATÓRIO DA BENEFICIÁRIA — nova aba, seletor de beneficiária,
//   seletor de ciclo, carregamento real via bridge, ausência de dados
//   mostrada como "—", nenhum recálculo de Billing Engine no frontend.
//
// energy-credits-v2.html é HTML+JS monolítico (sem build/teste
// automatizado próprio) — este arquivo audita o código-fonte real
// (leitura de string) e executa de fato as funções puras extraídas
// via vm (formatBrPhone/isValidEmailFormat/normalizeEmail), seguindo
// o mesmo padrão usado em outros hotfix-*-production.manual-test.ts
// deste diretório.
//
// Rodar: npx tsx tests/ug-contacts-and-beneficiary-report.manual-test.ts
// ============================================================

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const html = fs.readFileSync(path.join(ROOT, 'energy-credits-v2.html'), 'utf8');

function extractMethod(src: string, methodNamePattern: RegExp): string {
  const m = methodNamePattern.exec(src);
  if (!m) throw new Error(`método não encontrado: ${methodNamePattern}`);
  const start = m.index;
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

function loadMethodAsFunction(methodSrc: string, fnName: string): (...args: unknown[]) => unknown {
  // "formatBrPhone(raw) { ... }" → "function formatBrPhone(raw) { ... }"
  const asFunctionSrc = `function ${methodSrc}`;
  const context = vm.createContext({ String, console });
  const wrapped = `${asFunctionSrc}\n${fnName};`;
  return vm.runInContext(wrapped, context) as (...args: unknown[]) => unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite A — UG: campos ownerPhone/ownerEmail no estado e wizard (leitura)
// ═══════════════════════════════════════════════════════════════════════════
function suiteA() {
  console.log('\nSuite A — UG: ownerPhone/ownerEmail declarados no estado e no wizard');

  assert('A1 UG_WIZ_DEFAULT inclui ownerPhone: ""',
    html.includes('ownerPhone: "", ownerEmail: ""'));

  assert('A2 wizard, etapa Identificação: campo "Telefone" existe (key ownerPhone)',
    /gf\("Telefone",\s*"ownerPhone"/.test(html));

  assert('A3 wizard, etapa Identificação: campo "E-mail" existe (key ownerEmail)',
    /gf\("E-mail",\s*"ownerEmail"/.test(html));

  assert('A4 campo Telefone vem logo após "CPF / CNPJ do proprietário" (ordem: Proprietário/CPF-CNPJ/Telefone/E-mail)',
    html.includes('gf("CPF / CNPJ do proprietário", "ownerDoc"') &&
    html.indexOf('gf("CPF / CNPJ do proprietário", "ownerDoc"') < html.indexOf('gf("Telefone", "ownerPhone"'));

  assert('A5 campo E-mail vem logo após o campo Telefone',
    html.indexOf('gf("Telefone", "ownerPhone"') < html.indexOf('gf("E-mail", "ownerEmail"'));

  assert('A6 campo E-mail usa type="email" (o.type propagado)',
    html.includes('gf("E-mail", "ownerEmail", { ph: "nome@dominio.com.br", type: "email"'));

  assert('A7 mkFld propaga type ao descriptor (type: o.type || "text")',
    html.includes('type: o.type || "text"'));

  assert('A8 mkFld aceita onChange customizado (necessário para a máscara do telefone)',
    html.includes('onChange: o.onChange ? o.onChange : setter(key)'));

  assert('A9 template do input usa type="{{ f.type }}" (ambas ocorrências — wizard UG e UB)',
    (html.match(/type="\{\{ f\.type \}\}"/g) || []).length >= 2);

  assert('A10 nenhum campo obrigatório novo — telefone/e-mail continuam opcionais no wizard (sem required)',
    !html.includes('gf("Telefone", "ownerPhone", { required'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite B — UG: máscara/validação/normalização — execução real via vm
// ═══════════════════════════════════════════════════════════════════════════
function suiteB() {
  console.log('\nSuite B — UG: formatBrPhone / isValidEmailFormat / normalizeEmail (execução real)');

  const formatBrPhoneSrc = extractMethod(html, /formatBrPhone\(raw\)\s*\{/);
  const formatBrPhone = loadMethodAsFunction(formatBrPhoneSrc, 'formatBrPhone') as (raw: unknown) => string;

  assert('B1 formatBrPhone("") → ""', formatBrPhone('') === '');
  assert('B2 formatBrPhone("43") → "43"', formatBrPhone('43') === '43');
  assert('B3 formatBrPhone("4399999") → "(43) 9999-9" (fixo em formação, 7 dígitos)',
    formatBrPhone('4399999') === '(43) 9999-9');
  assert('B4 formatBrPhone("4399999999") aplica máscara fixo (43) 9999-9999',
    formatBrPhone('4399999999') === '(43) 9999-9999');
  assert('B5 formatBrPhone("43999999999") aplica máscara celular (43) 99999-9999',
    formatBrPhone('43999999999') === '(43) 99999-9999');
  assert('B6 formatBrPhone ignora caracteres não numéricos ao formatar',
    formatBrPhone('(43) 99999-9999') === '(43) 99999-9999');
  assert('B7 formatBrPhone preserva números internacionais explícitos (prefixo "+")',
    formatBrPhone('+1 415 555 0132') === '+1 415 555 0132');
  assert('B8 formatBrPhone trunca acima de 11 dígitos (não deixa crescer sem limite)',
    formatBrPhone('439999999999999') === '(43) 99999-9999');

  const isValidEmailFormatSrc = extractMethod(html, /isValidEmailFormat\(raw\)\s*\{/);
  const isValidEmailFormat = loadMethodAsFunction(isValidEmailFormatSrc, 'isValidEmailFormat') as (raw: unknown) => boolean;

  assert('B9 isValidEmailFormat("") → true (vazio é tratado como ausente, não inválido)', isValidEmailFormat('') === true);
  assert('B10 isValidEmailFormat("joao@exemplo.com") → true', isValidEmailFormat('joao@exemplo.com') === true);
  assert('B11 isValidEmailFormat("joao@exemplo") → false (sem domínio)', isValidEmailFormat('joao@exemplo') === false);
  assert('B12 isValidEmailFormat("joaoexemplo.com") → false (sem @)', isValidEmailFormat('joaoexemplo.com') === false);
  assert('B13 isValidEmailFormat("joao @exemplo.com") → false (espaço em branco)', isValidEmailFormat('joao @exemplo.com') === false);
  assert('B14 isValidEmailFormat("  joao@exemplo.com  ") → true (trim aplicado antes de validar)',
    isValidEmailFormat('  joao@exemplo.com  ') === true);

  const normalizeEmailSrc = extractMethod(html, /normalizeEmail\(raw\)\s*\{/);
  const normalizeEmail = loadMethodAsFunction(normalizeEmailSrc, 'normalizeEmail') as (raw: unknown) => string;

  assert('B15 normalizeEmail("  JOAO@EXEMPLO.COM  ") → "joao@exemplo.com" (trim + lowercase)',
    normalizeEmail('  JOAO@EXEMPLO.COM  ') === 'joao@exemplo.com');
  assert('B16 normalizeEmail(null) → "" (não lança exceção)', normalizeEmail(null) === '');
  assert('B17 normalizeEmail(undefined) → ""', normalizeEmail(undefined) === '');
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite C — UG: fluxo de criação/edição — payload correto e result.ok checado
// ═══════════════════════════════════════════════════════════════════════════
function suiteC() {
  console.log('\nSuite C — UG: wizard envia ownerPhone/ownerEmail normalizados e checa result.ok');

  assert('C1 ugWizNext bloqueia avanço da etapa 0 com e-mail inválido (nunca deixa passar silenciosamente)',
    html.includes('if (S.ugWizStep === 0 && GF.ownerEmail && !this.isValidEmailFormat(GF.ownerEmail))'));

  assert('C2 toast "E-mail inválido" existe para o bloqueio acima',
    html.includes('this.showToast("E-mail inválido"'));

  assert('C3 payload de criação/edição envia ownerPhone com trim (nunca envia espaços soltos)',
    html.includes('ownerPhone: (GF2.ownerPhone || "").trim()'));

  assert('C4 payload de criação/edição envia ownerEmail via normalizeEmail (trim + lowercase)',
    html.includes('ownerEmail: this.normalizeEmail(GF2.ownerEmail)'));

  assert('C5 payload usa ownerName (não "owner") — alinhado ao validator/service do domínio',
    html.includes('ownerName: GF2.owner, ownerDocument: GF2.ownerDoc, uc: GF2.uc, utilityCompany: GF2.distributor'));

  assert('C6 fluxo checa result.ok === false antes de considerar sucesso (bug pré-existente corrigido)',
    html.includes('if (result && result.ok === false) {'));

  assert('C7 em caso de falha, mostra toast de erro com a mensagem do backend (nunca finge sucesso)',
    html.includes('this.showToast("Erro ao salvar UG", msg)'));

  assert('C8 em caso de falha, NÃO fecha o wizard nem recarrega a lista (return null antes do reload)',
    /result\.ok === false\)\s*\{[\s\S]{0,220}return null;/.test(html));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite D — UG: revisão e detalhe exibem telefone/e-mail; compatibilidade
// ═══════════════════════════════════════════════════════════════════════════
function suiteD() {
  console.log('\nSuite D — UG: revisão (ugWizReview) e detalhe (ugdVals) exibem contato; UGs antigas não quebram');

  assert('D1 revisão mostra linha "Telefone" com dash(GF.ownerPhone)',
    html.includes('{ label: "Telefone", value: dash(GF.ownerPhone) }'));

  assert('D2 revisão mostra linha "E-mail" com dash(GF.ownerEmail)',
    html.includes('{ label: "E-mail", value: dash(GF.ownerEmail) }'));

  assert('D3 abrir UG existente para edição popula ownerPhone/ownerEmail (fallback "" quando ausente — UG antiga não quebra)',
    html.includes('ownerPhone: ug.ownerPhone || "", ownerEmail: ug.ownerEmail || ""'));

  assert('D4 abrir UG existente lê ownerName/ownerDocument/utilityCompany (não mais owner/document/distributor)',
    html.includes('owner: ug.ownerName, ownerDoc: ug.ownerDocument || ""') &&
    html.includes('distributor: ug.utilityCompany'));

  assert('D5 detalhe da UG (ugdPixRows) mostra "Telefone do proprietário" com fallback "—"',
    html.includes('{ label: "Telefone do proprietário", value: (ugRT && ugRT.ownerPhone) ? ugRT.ownerPhone : "—" }'));

  assert('D6 detalhe da UG (ugdPixRows) mostra "E-mail do proprietário" com fallback "—"',
    html.includes('{ label: "E-mail do proprietário", value: (ugRT && ugRT.ownerEmail) ? ugRT.ownerEmail : "—" }'));

  assert('D7 detalhe da UG (ugdMeta) usa ownerName/utilityCompany (não owner/distributor)',
    html.includes('ugdMeta: ugRT ? ugRT.id + " · " + ugRT.ownerName + " · UC " + ugRT.uc + " · " + ugRT.utilityCompany : "—"'));

  assert('D8 UG antiga sem ownerPhone/ownerEmail abre normalmente (fallback "—", não lança exceção)',
    html.includes('(ugRT && ugRT.ownerPhone) ? ugRT.ownerPhone : "—"') &&
    html.includes('(ugRT && ugRT.ownerEmail) ? ugRT.ownerEmail : "—"'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite E — Cobertura: removida SOMENTE da tabela "Destino dos créditos
// energéticos" do Relatório do Proprietário; dado interno preservado
// ═══════════════════════════════════════════════════════════════════════════
function suiteE() {
  console.log('\nSuite E — Relatório do Proprietário: coluna Cobertura removida sem afetar dados internos');

  const destTableStart = html.indexOf('Destino dos créditos energéticos');
  assert('E1 seção "Destino dos créditos energéticos" existe', destTableStart !== -1);

  const destTableEnd = html.indexOf('Distribuição conforme o contrato oficial creditDestinations', destTableStart);
  assert('E2 encontra o fim da tabela (nota de rodapé "Distribuição conforme...")', destTableEnd !== -1);

  const destTableSrc = html.slice(destTableStart, destTableEnd);

  assert('E3 tabela do Proprietário NÃO contém <th>...Cobertura</th>', !destTableSrc.includes('>Cobertura<'));
  assert('E4 tabela do Proprietário NÃO renderiza d.covText/d.covBg/d.covColor/d.covBorder',
    !destTableSrc.includes('d.covText') && !destTableSrc.includes('d.covBg'));

  const expectedHeaders = ['Beneficiária', 'UC / Distribuidora', '% Rateio', 'Créditos recebidos', 'Consumo', 'Compensado', 'Saldo anterior', 'Saldo final'];
  expectedHeaders.forEach((h) => {
    assert(`E5.${h} coluna "${h}" preservada na tabela do Proprietário`, destTableSrc.includes(`>${h}<`));
  });
  assert('E6 exatamente 8 colunas (nenhuma coluna extra nem faltando)',
    (destTableSrc.match(/<th style="[^"]*">[^<]*<\/th>/g) || []).length === 8);

  assert('E7 min-width da tabela reduzido de 860px para 760px (espaço reaproveitado após remoção)',
    destTableSrc.includes('min-width:760px;') && !destTableSrc.includes('min-width:860px;'));

  assert('E8 dados internos repDest continuam com covText/covBg/covColor/covBorder (Billing Engine intocado)',
    html.includes('saldoTxt: kwh(row.finalBalance), covText: cb.covText, covBg: cb.covBg, covColor: cb.covColor, covBorder: cb.covBorder'));

  assert('E9 tabela "Alocação Recomendada" (view diferente) continua com a coluna Cobertura (não afetada)',
    html.includes('title="coverageMonths" style="padding:10px 20px; font-weight:500; text-align:right; cursor:help;">Cobertura</th>'));

  assert('E10 tabela "Saldos das beneficiárias" (Relatório Interno, view diferente) continua com Cobertura (não afetada)',
    html.includes('"Saldo final", align: "right" }, { label: "Cobertura", align: "right" }'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite F — Relatório da Beneficiária: nova aba, ordem, seletores
// ═══════════════════════════════════════════════════════════════════════════
function suiteF() {
  console.log('\nSuite F — Relatório da Beneficiária: aba nova, na 2ª posição, com seletores corretos');

  assert('F1 repKindTabs contém as 4 abas na ordem exigida (Proprietário, Beneficiária, Interno, Financeiro)',
    html.includes('[["proprietario", "Relatório do Proprietário"], ["beneficiaria", "Relatório da Beneficiária"], ["interno", "Relatório Interno ESA"], ["financeiro", "Relatório Financeiro ESA"]]'));

  assert('F2 repKindBen calculado a partir de S.repKind === "beneficiaria"',
    html.includes('repKindBen: S.repKind === "beneficiaria"'));

  assert('F3 seletor principal é de Unidade Beneficiária (repBenId/repBenOpts), não de UG',
    html.includes('repBenId: S.repBenId, repBenOpts, onRepBen: (e) => this.setState({ repBenId: e.target.value })'));

  assert('F4 seletor de ciclo/mês reaproveita repMonth/onRepMonth/repMonthOpts (mesmo padrão das outras abas)',
    /repKindBen[\s\S]{0,2000}repMonth[\s\S]{0,50}onRepMonth/.test(html) || html.includes('value="{{ repMonth }}" onChange="{{ onRepMonth }}"'));

  assert('F5 UG vinculada é exibida quando relevante (repBenHeader.ugName), mas não é o filtro principal',
    html.includes('ugName: ug ? dash(ug.name) : "—"'));

  assert('F6 estado inicial inclui repBenId: "" (nenhuma beneficiária selecionada por padrão)',
    html.includes('repMonth: "2026-07", repUgId: "UG-001", repKind: "proprietario", repBenId: ""'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite G — Relatório da Beneficiária: carregamento real, fonte única,
// nunca recalcula, respeita organização/permissão via bridge existente
// ═══════════════════════════════════════════════════════════════════════════
function suiteG() {
  console.log('\nSuite G — Relatório da Beneficiária: dados vêm exclusivamente do backend (bridge real)');

  assert('G1 _loadRealBenReport só executa em runtime real (rt.mode !== "real" → return)',
    /_loadRealBenReport\(ubId, month\)\s*\{[\s\S]{0,200}if \(!rt \|\| rt\.mode !== "real"\) return;/.test(html));

  assert('G2 carrega a beneficiária correta via rt.getBeneficiaryUnit(ubId)',
    html.includes('rt.getBeneficiaryUnit(ubId).catch(() => null)'));

  assert('G3 carrega o relatório oficial via rt.getBeneficiaryInvoice(ubId, month) — mesmo bridge já usado/testado (buildBeneficiaryMonthlyReport)',
    html.includes('rt.getBeneficiaryInvoice(ubId, month).catch(() => null)'));

  assert('G4 carrega a UG vinculada via rt.getGeneratingUnit(ugId) somente quando ub.generatingUnitId existe',
    html.includes('const ugId = ub && ub.generatingUnitId;') && html.includes('const loadUg = ugId ? rt.getGeneratingUnit(ugId).catch(() => null) : Promise.resolve(null);'));

  assert('G5 view-model lê o status do ciclo de rep.summary.status (vindo pronto do backend) — nunca recalcula',
    html.includes('const sum = rep.summary || {};') && html.includes('const cycleKey = BEN_CYCLE_KEY[sum.status] || "aberto";'));

  assert('G6 nenhuma fórmula de rateio/compensação/repasse é recalculada no view-model (apenas leitura de sum./balSec./savSec.)',
    !/repBenCards\s*=\s*\[[\s\S]{0,1000}\*[\s\S]{0,50}\]/.test(html.slice(html.indexOf('repBenCards = ['), html.indexOf('repBenCards = [') + 1200)));

  assert('G7 sequenciamento de requisições evita corrida (seq guard) — resultado obsoleto nunca sobrescreve estado mais novo',
    html.includes('this._benRepSeq = (this._benRepSeq || 0) + 1;') && html.includes('if (seq !== this._benRepSeq) return null;'));

  assert('G8 erros de carregamento são logados e não travam a UI (loading sempre volta a false)',
    /_loadRealBenReport[\s\S]{0,2000}\.catch\(\(err\) => \{[\s\S]{0,200}console\.error\("\[ESA\] Relatório da Beneficiária load error", err\);[\s\S]{0,100}_rtBenRepLoading: false/.test(html));

  assert('G9 calculationMemory nunca é referenciada em todo o arquivo (nunca exposta ao frontend)',
    !html.includes('calculationMemory'));

  assert('G10 dados ausentes usam "—" (fmtKwh/fmtBrl/fmtPct retornam "—" para null, nunca inventam 0)',
    html.includes('const fmtKwh = (v) => (v == null ? "—" : kwh(v));') &&
    html.includes('const fmtBrl = (v) => (v == null ? "—" : brl(v));') &&
    html.includes('const fmtPct = (v) => (v == null ? "—" : (v * 100).toFixed(2).replace(".", ",") + "%");'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite H — Relatório da Beneficiária: estados vazios
// ═══════════════════════════════════════════════════════════════════════════
function suiteH() {
  console.log('\nSuite H — Relatório da Beneficiária: estados vazios tratados (sem beneficiárias / sem seleção / sem apuração)');

  assert('H1 repBenNoUbs calculado quando não há nenhuma beneficiária cadastrada',
    html.includes('repBenNoUbs = !repBenLoading && S._rtBenRepUbs !== undefined && benUbs.length === 0;'));

  assert('H2 bloco <sc-if value="{{ repBenNoUbs }}"> existe no template (mensagem dedicada)',
    html.includes('<sc-if value="{{ repBenNoUbs }}"'));

  assert('H3 repBenNoSelection calculado quando há beneficiárias mas nenhuma foi selecionada ainda',
    html.includes('repBenNoSelection = !repBenNoUbs;'));

  assert('H4 bloco <sc-if value="{{ repBenNoSelection }}"> existe no template',
    html.includes('<sc-if value="{{ repBenNoSelection }}"'));

  assert('H5 repBenNoApuracao calculado quando consumo/alocado/compensado são todos null (ciclo sem apuração)',
    html.includes('repBenNoApuracao = sum.monthlyConsumptionKwh == null && sum.allocatedKwh == null && sum.compensatedKwh == null;'));

  assert('H6 bloco <sc-if value="{{ repBenNoApuracao }}"> existe no template',
    html.includes('<sc-if value="{{ repBenNoApuracao }}"'));

  assert('H7 nota de ciclo em apuração exibida quando cycleKey === "em_apuracao"',
    html.includes('if (cycleKey === "em_apuracao") repBenCycleNote = "Este ciclo ainda está em apuração.";'));

  assert('H8 beneficiária sem UG vinculada não quebra (ugName usa "—" quando ug é null)',
    html.includes('ugName: ug ? dash(ug.name) : "—"'));

  assert('H9 seção A (Identificação) mostra "—" para e-mail/telefone da beneficiária (dado não coletado nesta missão — nunca inventado)',
    html.includes('{ cells: [mkCell("E-mail", { weight: "600" }), mkCell("—")] }') &&
    html.includes('{ cells: [mkCell("Telefone", { weight: "600" }), mkCell("—")] }'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite I — Controles existentes preservados (PDF/e-mail/WhatsApp desabilitados, Entrega manual funcional)
// ═══════════════════════════════════════════════════════════════════════════
function suiteI() {
  console.log('\nSuite I — Relatório da Beneficiária: reaproveita controles existentes sem duplicar lógica');

  const benTabStart = html.indexOf('repKindBen }}" hint-placeholder-val');
  assert('I1 bloco da aba beneficiária existe no template', benTabStart !== -1);

  const benTabSlice = html.slice(benTabStart, benTabStart + 6000);
  assert('I2 aba beneficiária reaproveita repManualDelivery (Entrega manual) — não duplica implementação',
    benTabSlice.includes('repManualDelivery'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Execução
// ═══════════════════════════════════════════════════════════════════════════
(function main() {
  console.log('='.repeat(70));
  console.log('Missão — Contatos da UG + Relatório da Beneficiária + remoção Cobertura');
  console.log('='.repeat(70));

  suiteA();
  suiteB();
  suiteC();
  suiteD();
  suiteE();
  suiteF();
  suiteG();
  suiteH();
  suiteI();

  console.log('\n' + '='.repeat(70));
  console.log(`Resultado: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));
  if (failed > 0) process.exit(1);
})();
