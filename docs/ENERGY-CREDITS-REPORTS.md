# Gestão de Créditos — Contatos da UG e Relatório da Beneficiária

Runtime oficial: [`energy-credits-v2.html`](../energy-credits-v2.html)
(`?runtime=real`). Este documento cobre três ajustes ao módulo:
telefone/e-mail na Unidade Geradora, remoção da coluna Cobertura do
Relatório do Proprietário, e a nova aba Relatório da Beneficiária.

## 1. Contatos da Unidade Geradora (UG)

### 1.1 Campos

Etapa "Identificação" do wizard de cadastro/edição de UG, na ordem exigida:

```
Proprietário → CPF/CNPJ do proprietário → Telefone → E-mail
```

- **Telefone** (`ownerPhone`): opcional. Máscara visual pt-BR aplicada em
  tempo real por [`formatBrPhone()`](../energy-credits-v2.html) — fixo
  `(43) 9999-9999` ou celular `(43) 99999-9999`, conforme a quantidade de
  dígitos digitados. Números internacionais (iniciados por `+`) não são
  mascarados — são preservados como digitados. Enviado ao backend com
  `.trim()`, sem outra transformação (a máscara já normaliza o formato
  nacional).
- **E-mail** (`ownerEmail`): opcional. Campo `type="email"`. Validado
  sinteticamente por `isValidEmailFormat()` (regex simples, não é um
  validador RFC5322 completo — string vazia é tratada como "ausente", não
  como inválida). Normalizado por `normalizeEmail()` (`trim()` +
  `toLowerCase()`) antes de persistir. Se inválido, o wizard **bloqueia o
  avanço** da etapa 0 com um toast — nunca deixa passar silenciosamente.

### 1.2 Schema / persistência

- Domínio (`src/domains/energy/credits/service.js`,
  `EnergyCreditsService.createGeneratingUnit`): grava
  `ownerPhone: input.ownerPhone || null` e `ownerEmail: input.ownerEmail || null`
  no objeto `GeneratingUnit`.
- Validação (`src/domains/energy/credits/validator.js`,
  `validateGeneratingUnit`): rejeita `ownerEmail` fora do formato
  `algo@algo.algo` quando presente e não-vazio (`INVALID_FORMAT`, campo
  `ownerEmail`). `ownerPhone` não tem formato imposto no domínio — aceita
  nacional ou internacional; a máscara é responsabilidade exclusiva do
  formulário.
- Runtime direto (`window.ESA_ENERGY_CREDITS_RUNTIME`,
  `createGeneratingUnit`/`updateGeneratingUnit` em
  `src/ui/energy-credits/direct-runtime/providers/esaRuntimeProvider.ts`):
  faz **spread completo** do input — nenhum remapeamento de campo é
  necessário para `ownerPhone`/`ownerEmail` chegarem ao domínio.
- Tipos TS (`src/ui/energy-credits/direct-runtime/contracts/types.ts`):
  `ownerPhone?: string; ownerEmail?: string;` adicionados a
  `GeneratingUnit` e `CreateGeneratingUnitInput` (aditivo — tipos são
  erased em runtime, não alteram o comportamento de `energy-credits-v2.html`,
  que é JS puro).

### 1.3 Compatibilidade com UGs antigas

UGs cadastradas antes desta missão não têm `ownerPhone`/`ownerEmail`. Todos
os pontos de leitura usam fallback seguro:

- Abrir para edição: `ownerPhone: ug.ownerPhone || "", ownerEmail: ug.ownerEmail || ""`.
- Revisão do wizard: `dash(GF.ownerPhone)` / `dash(GF.ownerEmail)` → exibe
  "—" quando vazio.
- Detalhe da UG (`ugdPixRows`): `(ugRT && ugRT.ownerPhone) ? ugRT.ownerPhone : "—"`
  (idem para e-mail).

Nenhuma UG antiga quebra ao abrir, editar ou exibir detalhe.

### 1.4 Bug pré-existente corrigido (fora do escopo original, aprovado pelo usuário)

Auditoria do fluxo revelou que o wizard de UG **nunca funcionava de
verdade**: o payload enviado (`owner`, `utilityCode`, `distributor`) nunca
batia com os campos exigidos pelo validador do domínio (`ownerName`, `uc`,
`utilityCompany`) — toda criação/edição retornava `result.ok === false`,
mas a UI nunca checava esse retorno e sempre mostrava um toast de sucesso.
Corrigido junto com a adição de telefone/e-mail (mesmo trecho de código):

- Payload agora usa `ownerName`/`ownerDocument`/`uc`/`utilityCompany`.
- `ugWizNext` agora checa `result.ok === false` antes de fechar o wizard e
  mostrar sucesso; em caso de erro, mostra a mensagem real do backend e
  mantém o wizard aberto.
- O mesmo bug de leitura (`ug.owner`/`ug.distributor` em vez de
  `ug.ownerName`/`ug.utilityCompany`) foi corrigido em dois pontos
  diretamente adjacentes ao trabalho desta missão: abertura do wizard para
  edição (`openUgWiz`) e detalhe da UG (`ugdVals` — `ugdMeta`,
  `ugdPixRows`, `ugdPixEqual`, `ugdPixDiff`).

**Bugs análogos conhecidos e intencionalmente NÃO corrigidos nesta
missão** (fora do escopo dos três ajustes pedidos — documentados para
decisão futura):

- Relatório do Proprietário (`repHeader`): mesma classe de mismatch de
  campo, função diferente, não tocada.
- Wizard de Unidade Beneficiária (UB): mesma classe de bug pode existir no
  payload de criação/edição de UB — não auditado nem corrigido aqui.

## 2. Remoção da coluna "Cobertura" (Relatório do Proprietário)

A coluna foi removida **apenas** da tabela "Destino dos créditos
energéticos" da aba **Relatório do Proprietário** — cabeçalho (`<th>`),
célula (`<td>`/badge `covText`/`covBg`/`covColor`/`covBorder`) e largura
reservada (`min-width` reduzido de `860px` para `760px`, aproveitando o
espaço liberado).

Colunas restantes (8, na ordem): **Beneficiária · UC/Distribuidora · %
Rateio · Créditos Recebidos · Consumo · Compensado · Saldo Anterior ·
Saldo Final**.

Não removido / não alterado:

- Dado interno `repDest` (view-model) continua computando
  `covText`/`covBg`/`covColor`/`covBorder` normalmente — apenas não é mais
  renderizado nesta tabela específica.
- Billing Engine, regras de rateio e demais cálculos: intocados.
- Outras telas que usam a mesma métrica de cobertura (Alocação
  Recomendada, Relatório Interno ESA — tabela "Saldos das beneficiárias",
  Fatura da beneficiária) continuam exibindo a coluna normalmente — são
  tabelas diferentes, fora do escopo do pedido.
- Não existe exportação em PDF/CSV desta tabela hoje — nada a ajustar
  além do HTML.

## 3. Relatório da Beneficiária (nova aba)

### 3.1 Posição e navegação

Quarta aba de relatórios, na 2ª posição (ordem exigida):

```
Relatório do Proprietário → Relatório da Beneficiária → Relatório Interno ESA → Relatório Financeiro ESA
```

### 3.2 Filtros

- **Seletor principal: Unidade Beneficiária** (`repBenId`/`repBenOpts`) —
  não é um seletor de UG. A UG vinculada é exibida no cabeçalho do
  relatório (`repBenHeader.ugName`) quando existe, mas nunca é o filtro
  primário.
- **Seletor de ciclo/mês**: reaproveita o mesmo `repMonth`/`onRepMonth`/
  `repMonthOpts` já usado pelas outras 3 abas — sem duplicar lógica de
  seleção de mês.

### 3.3 Fonte de dados — sempre o Billing Engine, nunca recalculado no frontend

O carregamento (`_loadRealBenReport(ubId, month)`) busca, nesta ordem:

1. `rt.listBeneficiaryUnits()` — popula o seletor.
2. `rt.getBeneficiaryUnit(ubId)` — dados cadastrais da beneficiária.
3. `rt.getBeneficiaryInvoice(ubId, month)` — **este é o mesmo bridge que
   já expõe** `EnergyCreditsReportService.buildBeneficiaryMonthlyReport()`
   (`src/reports/energy-credits/energy-credits-report-service.js`), a
   função read-only e já testada (`energy-credits-report-service.manual-test.js`,
   243 cenários) que não recalcula rateio/compensação/repasse — apenas
   lê e formata o que o Billing Engine já produziu e persistiu.
4. `rt.getGeneratingUnit(ugId)` — apenas quando a beneficiária tem
   `generatingUnitId` (UG vinculada).

O view-model no HTML (`repBenHeader`/`repBenCards`/`repBenSections`) só
faz **leitura** de campos já prontos (`rep.summary`, `rep.sections.*`,
`rep.target`) — nenhuma fórmula (`*`, `/`, `+` sobre kWh/R$) é aplicada
sobre os dados do relatório. Cada requisição tem um `seq` guard
(`_benRepSeq`) para que uma resposta obsoleta nunca sobrescreva um estado
mais novo (troca rápida de beneficiária/ciclo).

### 3.4 Status do ciclo — correção de fonte

Durante a implementação, foi identificado que o campo "status do ciclo"
(open/review/closed/...) **não pertence ao registro mensal da
beneficiária** (`beneficiaryMonthlyRecords`) — pertence ao
`monthlyStatement` da **UG**, em `metadata.status`. A primeira versão de
`_benSummary()` lia `rec.status` (sempre `undefined`/`null`, pois o
read-model normaliza e não inclui esse campo no registro da
beneficiária). Corrigido em
`EnergyCreditsReportService.buildBeneficiaryMonthlyReport()`: agora busca
`this._qs.getMonthlyStatement(unit.generatingUnitId, referenceMonth)` e
usa `stmt.metadata.status` — continua sendo uma leitura direta de um
campo já persistido, nunca calculado. Coberto por
`energy-credits-report-service.manual-test.js` (cenários 2.22b, 2.36,
2.37).

### 3.5 Conteúdo exibido

**Cabeçalho**: nome, UC, distribuidora, ciclo (mês + selo de status),
status do ciclo, UG vinculada.

**Indicadores** (8 cards): consumo do mês, créditos recebidos, créditos
compensados, saldo anterior, saldo final, % de rateio, economia, valor
faturado.

**4 seções de detalhe** (reaproveitam `mkSection`/`mkCell`, os mesmos
helpers já usados no Relatório Interno/Financeiro):

- **A. Identificação** — beneficiária, CPF/CNPJ, UC, distribuidora,
  endereço, UG associada. E-mail/telefone da beneficiária exibem **"—"**
  — esta missão não adicionou esses campos ao cadastro de Unidade
  Beneficiária (apenas ao de UG); mostrar "—" é o comportamento correto
  (dado ausente, nunca inventado), não um bug.
- **B. Energia do ciclo** — consumo, créditos alocados/recebidos,
  compensados, saldo anterior/final, créditos expirados/pendentes.
- **C. Resultado financeiro** — tarifa da distribuidora, preço aplicado
  por kWh, economia, valor faturado, desconto do mês, situação
  financeira.
- **D. Histórico/observações** — status de fechamento do ciclo, contagem
  de alertas, data de emissão.

Todo valor ausente (`null`) é formatado como **"—"** (`fmtKwh`/`fmtBrl`/
`fmtPct`); valores `0` reais nunca são confundidos com ausência.

### 3.6 Estados vazios

| Estado | Condição | Tratamento |
|---|---|---|
| Nenhuma beneficiária cadastrada | `repBenNoUbs` | Mensagem dedicada, seletor sem opções |
| Beneficiária ainda não selecionada | `repBenNoSelection` | Mensagem pedindo seleção |
| Ciclo sem apuração | `repBenNoApuracao` (consumo/alocado/compensado todos `null`) | Mensagem de "sem apuração"; cabeçalho ainda mostra dados cadastrais |
| Ciclo em apuração (não fechado) | `cycleKey === "em_apuracao"` | Nota "Este ciclo ainda está em apuração." |
| Beneficiária sem UG vinculada | `ug === null` | `ugName` exibe "—", resto do relatório funciona normalmente |

### 3.7 Permissões e isolamento organizacional

O Relatório da Beneficiária **reutiliza integralmente** o mesmo
`window.ESA_ENERGY_CREDITS_RUNTIME` (bridge real) já usado por todas as
outras telas do módulo — `getBeneficiaryUnit`, `getBeneficiaryInvoice`
(= `getBeneficiaryMonthlyReport`), `getGeneratingUnit`,
`listBeneficiaryUnits`. Nenhuma chamada nova ao backend/Netlify foi
criada; a validação de `organizationId`/membership/role já testada pelas
suítes de multitenancy (`gate8a-multitenancy`, `gate8b-dual-read`,
`gate8e-org-activation`, `gate8f-*`) se aplica sem alteração — o
`organizationId` nunca é enviado pelo cliente, é sempre resolvido no
backend a partir da sessão.

### 3.8 Controles reaproveitados

Botões "Baixar PDF / e-mail / WhatsApp — em breve" (desabilitados) e
"Entrega manual" (funcional, via `repManualDelivery`) são os mesmos
componentes já usados nas outras 3 abas — sem duplicação de lógica.

## 4. `calculationMemory`

Confirmado (busca em todo o arquivo `energy-credits-v2.html` e nos
serviços tocados): `calculationMemory` nunca é lido, referenciado ou
exposto ao frontend. O ponto único de sanitização
(`EnergyCreditsUINormalizer`, em
`src/ui/energy-credits/energy-credits-ui-provider.js`) já removia esse
campo antes desta missão; nenhuma mudança foi necessária ali.

## 5. Testes

- `src/domains/energy/credits/energy-credits.manual-test.js` — suite
  `[9b]` (6 cenários novos: UG sem contato, com contato válido, e-mail
  ausente, e-mail inválido, e-mail vazio tratado como ausente, telefone
  internacional).
- `src/reports/energy-credits/energy-credits-report-service.manual-test.js`
  — cenários 2.22b/2.36/2.37 (status do ciclo lido do `monthlyStatement`,
  nunca do registro da beneficiária, nunca calculado).
- `src/ui/energy-credits/direct-runtime/tests/ug-contacts-and-beneficiary-report.manual-test.ts`
  — 87 cenários novos, 9 suítes (A–I): campos no wizard, execução real de
  `formatBrPhone`/`isValidEmailFormat`/`normalizeEmail` via `vm`, payload e
  checagem de `result.ok`, revisão/detalhe/compatibilidade com UGs
  antigas, remoção da coluna Cobertura (com preservação das 8 colunas
  restantes e dos dados internos), estrutura da nova aba, fonte única de
  dados, estados vazios, reaproveitamento de controles existentes.

Toda a suíte de regressão de Gestão de Créditos (domínio, engines,
queries, read-models, repositórios, importadores, UI provider, e as 43
suítes `.manual-test.ts` do direct-runtime, incluindo multitenancy/gates)
foi executada após as mudanças — 0 falhas.

## 6. Validação em produção (pendente de execução manual)

Este documento e os testes cobrem o comportamento com dados de exemplo.
Antes de considerar a missão encerrada em produção, validar manualmente
em `/energy-credits-v2.html?runtime=real`, logado com uma organização
real:

1. Cadastrar uma UG nova informando telefone e e-mail; confirmar que a
   máscara aplica corretamente e que os dados aparecem no detalhe da UG
   após reload (persistência real, não só otimista).
2. Editar uma UG existente **sem** telefone/e-mail (dado legado);
   confirmar que abre sem erro e mostra "—" nesses campos.
3. Abrir o Relatório do Proprietário de uma UG com beneficiárias reais;
   confirmar visualmente que a coluna Cobertura não aparece e que as 8
   colunas restantes exibem os valores corretos.
4. Abrir a aba Relatório da Beneficiária, selecionar uma beneficiária e
   um ciclo fechado; conferir que os indicadores batem com os mesmos
   valores já exibidos na Fatura dessa beneficiária (mesma fonte).
5. Repetir o passo 4 com um ciclo em apuração e com uma beneficiária sem
   UG vinculada, confirmando as mensagens de estado vazio.
