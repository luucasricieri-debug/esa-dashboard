# MIGRATION-MAP — ESA Energia: Claude Design → Módulo React

**Branch:** `core-v2`  
**Auditado em:** 2026-07-16  
**Escopo desta etapa:** Design system + Shell + Visão Geral (Dashboard)

---

## 1. Resumo Executivo

A auditoria comparou o material do Claude Design (`docs/design-reference/energy-credits-claude-design/reference/`) contra a implementação React em `src/ui/energy-credits/react-app/src/`. O protótipo Lovable já foi usado como base fiel para a implementação, portanto a maior parte das telas está **visualmente alinhada** ao design de referência.

A principal diferença estrutural entre o protótipo e o módulo integrado é a camada de dados:

| Protótipo (Claude Design) | Módulo Integrado |
|---|---|
| `energyCreditsProvider` (mock, `mockData.ts`) | `useEsaProvider()` → `createProviderAdapter(uiProvider)` → Core real |
| Dados fictícios sempre disponíveis | Core retorna zeros com repositório vazio |
| Sem integração com ESA OS | Integrado via `EnergyCreditsUIProvider` |

Nenhuma view deve retornar ao `energyCreditsProvider` mock. Toda integração de dados passa exclusivamente pelo `provider-adapter.ts`.

---

## 2. Design System

### 2.1 Tokens CSS (`index.css`)

**Status: ✅ ALINHADO — nenhuma alteração necessária**

| Token | Referência | Implementado | Status |
|---|---|---|---|
| `--radius` | `0.625rem` | `0.625rem` | ✅ |
| `--background` | `oklch(1 0 0)` | `oklch(1 0 0)` | ✅ |
| `--foreground` | `oklch(0.129 0.042 264.695)` | `oklch(0.129 0.042 264.695)` | ✅ |
| `--border` | `oklch(0.929 0.013 255.508)` | `oklch(0.929 0.013 255.508)` | ✅ |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.577 0.245 27.325)` | ✅ |
| `--chart-1..5` | 5 valores oklch | Idênticos | ✅ |
| Tokens `.dark` | 18 valores oklch | Idênticos | ✅ |
| `@theme inline` | 31 mapeamentos | Idênticos | ✅ |

Nota: o protótipo usa `@import "tailwindcss" source(none)` + `@source "../src"` enquanto o módulo usa `@import "tailwindcss"` (escaneia tudo por padrão). Diferença de escopo de build, sem impacto visual.

### 2.2 Componentes compartilhados (`ui.tsx`)

**Status: ✅ ALINHADO — nenhuma alteração necessária**

| Componente | Props referência | Props implementado | Status |
|---|---|---|---|
| `Card` | `children, className?` | `children, className?` | ✅ |
| `KpiCard` | `label, value, hint?, tone?, icon?, delta?, deltaLabel?, onClick?, invertDelta?` | Idêntico | ✅ |
| `DeltaLine` (interno) | `delta, invert?, label?` | Idêntico | ✅ |
| `SectionTitle` | `title, desc?, right?` | Idêntico | ✅ |
| `Badge` | `children, tone?: slate\|green\|amber\|red\|blue\|emerald\|neutral` | Idêntico | ✅ |
| `Button` | `variant: primary\|ghost\|outline\|soft\|danger`, `size: sm\|md` | Idêntico | ✅ |
| `StatusPill` | `status: pago\|aberto\|vencido\|ativa\|inativa\|manutencao\|string` | Idêntico | ✅ |
| `CycleBadge` | `status: aberto\|em_apuracao\|fechado` | Idêntico | ✅ |
| `Modal` | `open, onClose, title, desc?, size?, children, footer?` | Idêntico | ✅ |
| `Stepper` | `steps, current` | Idêntico | ✅ |
| `Field` | `label, hint?, children, colSpan?` | Idêntico | ✅ |
| `inputClass` | string constante | Idêntica | ✅ |

---

## 3. Auditoria por Tela

| Tela | Chave de Rota | Arquivo de Referência | Status Visual | Arquivo Implementado | Notas |
|---|---|---|---|---|---|
| Shell / Layout | — | `src__components__esa__Shell.tsx` | ✅ ALINHADO | `components/esa/Shell.tsx` | Ver §4.1 |
| Visão Geral | `dashboard` | `src__components__esa__views__Dashboard.tsx` | ✅ ALINHADO | `views/Dashboard.tsx` | Ver §4.2 |
| Apuração Mensal | `apuracao` | `src__components__esa__views__MonthlySettlement.tsx` | ✅ ALINHADO | `views/MonthlySettlement.tsx` | Ver §4.3 |
| Unidades Geradoras | `ug` | *(não disponível)* | ✅ MIGRADO | `views/GeneratingUnits.tsx` | Ver §4.4 |
| Unidades Beneficiárias | `ub` | *(não disponível)* | ✅ MIGRADO | `views/BeneficiaryUnits.tsx` | Ver §4.5 |
| Importação CSV | `csv` | *(não disponível)* | 🔜 PENDENTE | `views/CsvImport.tsx` | Ver §4.6 |
| Relatórios | `relatorios` | *(não disponível)* | 🔜 PENDENTE | `views/Reports.tsx` | Ver §4.7 |
| Financeiro | `financeiro` | *(não disponível)* | 🔜 PENDENTE | `views/Financial.tsx` | Ver §4.8 |
| Alertas | `alertas` | *(não disponível)* | 🔜 PENDENTE | `views/Alerts.tsx` | Ver §4.9 |

---

## 4. Detalhamento por Tela

### 4.1 Shell — ✅ ALINHADO

**Arquivo:** `components/esa/Shell.tsx`  
**Referência:** `reference/src__components__esa__Shell.tsx`

| Elemento | Referência | Implementado | Status |
|---|---|---|---|
| Sidebar width collapsed | `w-16` | `w-16` | ✅ |
| Sidebar width expanded | `w-60` | `w-60` | ✅ |
| Sidebar transition | `transition-[width] duration-200` | `transition-[width] duration-200` | ✅ |
| Logo icon | `bg-gradient-to-br from-[#00bd78] to-[#006644]` | `from-[#00bd78] to-[#006644]` | ✅ |
| Logo text "ESA Energia" | `text-sm font-semibold text-slate-900` | Idêntico | ✅ |
| Logo subtext | `text-[10px] text-emerald-700 font-semibold tracking-wider uppercase` | Idêntico | ✅ |
| Nav item active | `bg-emerald-50 text-emerald-800 font-semibold` | Idêntico | ✅ |
| Nav item inactive | `text-slate-600 hover:bg-slate-50 hover:text-slate-900` | Idêntico | ✅ |
| Nav hint badges | `bg-emerald-600 text-white` (ativo) / `bg-emerald-100 text-emerald-700` | Idêntico | ✅ |
| Collapse button | `absolute -right-3 top-20 h-6 w-6 rounded-full border border-slate-200` | Idêntico | ✅ |
| Sidebar footer card | `bg-gradient-to-br from-[#00875a] to-[#063a28]` | `from-[#00875a] to-[#063a28]` | ✅ |
| Header height | 64px fixo | `h-16` | ✅ |
| Header title color | `color:#062e20` | `text-[#062e20]` | ✅ |
| Search box | `rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 w-64 xl:w-72` | Idêntico | ✅ |
| Avatar ESA | `h-8 w-8 md:h-9 md:w-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700` | Idêntico | ✅ |
| Main content padding | `p-3 md:p-6 overflow-x-hidden` | Idêntico | ✅ |
| Toaster | `<Toaster richColors position="top-right" />` (dentro do Shell) | Presente em `mountEnergyCreditsReactApp.tsx` (nível de mount) | ✅ equiv. |

**Diferenças não-visuais:**
- Nome da variável do array nav: `nav` → `navItems` (sem impacto visual)
- Handler `onNavigate`: referência usa cast direto; implementação usa viewMap tipado (sem impacto visual)

---

### 4.2 Visão Geral (Dashboard) — ✅ ALINHADO

**Arquivo:** `components/esa/views/Dashboard.tsx`  
**Referência:** `reference/src__components__esa__views__Dashboard.tsx`

| Elemento | Referência | Implementado | Status |
|---|---|---|---|
| Filter card padding | `p-3 md:p-4` | `p-3 md:p-4` | ✅ |
| Select triggers | `h-9 w-[180px] text-sm font-medium` | Idêntico | ✅ |
| Section headers | `h-1 w-6 rounded-full bg-emerald-500` + `text-[11px] uppercase tracking-widest` | Idêntico | ✅ |
| KPI grid "Operação" | `grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 md:gap-3` | Idêntico | ✅ |
| KPI grid "Financeiro" | `grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 md:gap-3` | Idêntico | ✅ |
| Chart área (2 colunas iguais) | `grid md:grid-cols-2 gap-4` | `md:grid-cols-2` | ✅ |
| Chart "Geração vs. Consumo" | BarChart/LineChart com toggle Por UG/Consolidado | Idêntico | ✅ |
| Chart "Receita vs. Repasse" | LineChart com Receita + Repasse + Spread dashed | Idêntico | ✅ |
| Ranking UGs | progress bar `bg-gradient-to-r from-emerald-500 to-emerald-600` | Idêntico | ✅ |
| Top Beneficiárias | lista com Economia + faturaEsa + StatusPill | Idêntico | ✅ |
| Card Alertas | 4 alertas máx, tone por severity (rose/amber/sky/slate) | Idêntico | ✅ |
| Drill-down Sheet | `sm:max-w-lg overflow-y-auto`, todos os tipos de drill | Idêntico | ✅ |
| Cores dos charts | `#00a86b` (Claude Design green), `#a9e4cb` (Claude Design light) | `#00a86b`, `#a9e4cb` | ✅ |

**Diferença funcional (não visual):**
- Referência: `energyCreditsProvider.getExecutiveSummary()` retorna `results: SettlementResult[]` com dados
- Implementação: `provider.getExecutiveSummary()` → `results: []` com repositório vazio → renderiza estado vazio corretamente

---

### 4.3 Apuração Mensal — ✅ ALINHADO

**Arquivo:** `components/esa/views/MonthlySettlement.tsx`  
**Referência:** `reference/src__components__esa__views__MonthlySettlement.tsx`

| Elemento | Referência | Implementado | Status |
|---|---|---|---|
| Seletor Mês/UG | `<select>` nativos com classes idênticas | `<select>` nativos com classes idênticas | ✅ |
| Botões de ação (Salvar, Fechar mês, etc.) | 4 botões no topo | Idênticos | ✅ |
| KPI grid de ciclo | `grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3` | Idêntico | ✅ |
| Tabela de rateio | colunas UB, %, Créditos Alocados, Consumo, Compensado, Margem, Status, Ações | Idêntico | ✅ |
| Modo auto/manual toggle | `Mode = 'auto' | 'manual'` com lógica de effectiveOverrides | Idêntico | ✅ |

**Diferença funcional:**
- Referência: usa `generatingUnits` e `months` de `mockData` diretamente
- Implementação: usa `provider.listGeneratingUnits()` e `provider.listMonths()` — correto
- Com repositório vazio: `generatingUnits = []`, `ugId = ''`, `cycle = null`, `plan = null` → componente retorna `null` → tela em branco sem crash

---

### 4.4 Unidades Geradoras — ✅ MIGRADO (Missão 21)

**Arquivo:** `components/esa/views/GeneratingUnits.tsx`  
**Referência:** Spec textual da Missão 21 (`.dc.html` não disponível para comparação pixel)

| Elemento | Descrição | Status |
|---|---|---|
| Lista UGs com filtro | Busca por nome, proprietário e UC; colunas: UG, Proprietário, UC, Distribuidora, Geração, Saldo, Créditos comp., Beneficiárias, Status | ✅ |
| Estado vazio | Mensagem diferenciada: sem UGs cadastradas vs. sem resultados de busca | ✅ |
| UGDetail — 5 abas | Resumo, Beneficiárias, Histórico, Termos Comerciais, Destinatário | ✅ |
| UGResumoTab | Geração do mês, Saldo atual, Créditos compensados, Beneficiárias, Preço padrão, Repasse do mês, Alertas recentes | ✅ |
| UGBenefTab | Plano de alocação via `getCreditAllocationPlan`; colunas: Beneficiária, UC, Consumo, Compensado, Saldo, Cobertura | ✅ |
| UGHistoricoTab | Histórico mensal via `listMonths()` + `getGeneratingUnitCreditDestinationReport`; CycleBadge por status; estado vazio | ✅ |
| Wizard cadastro UG | 3 etapas: Dados Básicos, Termos Comerciais, Revisar; botão "Cadastrar Unidade Geradora"; banner de modo prévia | ✅ |
| `getCreditAllocationPlan` null safety | `(plan?.rows ?? [])` — seguro para null (repo vazio) e emptyAllocationPlan | ✅ |

---

### 4.5 Unidades Beneficiárias — ✅ MIGRADO (Missão 21)

**Arquivo:** `components/esa/views/BeneficiaryUnits.tsx`  
**Referência:** Spec textual da Missão 21 (`.dc.html` não disponível para comparação pixel)

| Elemento | Descrição | Status |
|---|---|---|
| Lista UBs com filtro | Busca por nome, documento e UC; colunas novas: Saldo atual, Cobertura via `getBeneficiaryCreditBalance` | ✅ |
| 4 botões de ação | Ver detalhes (Eye), Editar (Pencil), Histórico mensal (History → abre aba histórico), Ver Fatura ESA (FileText) | ✅ |
| UBDetail com `initialTab` | Aceita `tab: 'overview' \| 'history'`; botão Histórico abre diretamente na aba correta | ✅ |
| UBOverviewTab expandido | 4 KPI cards (Consumo, Compensado, Saldo, Cobertura); 4 média cards; Movimentação de créditos; Condição comercial | ✅ |
| Wizard cadastro UB — 5 etapas | Dados Básicos, Condição Comercial, Método de Cálculo, Revisar, Confirmar; botão "Cadastrar Unidade Beneficiária" | ✅ |
| UBStep1: UGSummaryCard | Exibe info da UG selecionada: proprietário, geração, UBs vinculadas, preço padrão | ✅ |
| UBStep2: observações | Campo `commercialObservation` adicionado ao formulário | ✅ |
| `hasSufficientHistory` | Constante `false` para nova UB (sem histórico existente); badge "HISTÓRICO INSUFICIENTE"; campo média manual; opção histórico desabilitada | ✅ |

---

### 4.6 Importação CSV — 🔜 PENDENTE

**Arquivo:** `components/esa/views/CsvImport.tsx`  
**Referência:** *(arquivo não disponível no material exportado)*

Revisão visual pendente via `.dc.html`. Nota: a integração com `EnergyCreditsCsvTemplateService` via adapter foi corrigida (Missão 17 — mapeamento de chaves `ug` → `generating-units` e campos `csvText` → `example`).

---

### 4.7 Relatórios — ✅ MIGRADO (Missão 22)

**Arquivo:** `components/esa/views/Reports.tsx`  
**Referência:** `.dc.html` linhas 1310–1717 (screen label "Relatórios")

| Elemento | Claude Design | Implementado | Status |
|---|---|---|---|
| Estrutura da tela | 3 tabs inline (Proprietário, Interno, Financeiro) | 3 tabs inline com `ReportTab` state | ✅ |
| Abordagem anterior | 4 cards em grid + Modal overlay | — (removido) | ✅ |
| Tab buttons | `border-radius:8px; border/bg/color por estado` | `border-[#a9e4cb] bg-[#eaf8f1] text-[#00875a]` (ativo) | ✅ |
| Container do documento | `border-radius:14px; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(15,23,42,.05)` | `rounded-[14px] border border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,.05)]` | ✅ |
| Header do documento | `background:linear-gradient(135deg, #f8fafc, rgba(234,248,241,.5))` | `bg-gradient-to-br from-slate-50 to-emerald-50/50` | ✅ |
| Filter bar por tab | UG+Ciclo (Proprietário), Mês (Interno), Mês+Status (Financeiro) | Idêntico | ✅ |
| Botões de ação | PDF/email/WhatsApp (disabled) + "Entrega manual" (ativo) | Idêntico | ✅ |
| max-width do container | `1040px` | `max-w-[1040px] mx-auto` | ✅ |
| Relatório Proprietário | Barras de distribuição horizontal + tabela detalhada + PIX panel + Repasse panel | Idêntico | ✅ |
| Relatório Interno | 6 cards operação + 8 cards financeiro + Status ciclos (2x2) + Alertas (2x2) + Pendências + seções expansíveis | Idêntico | ✅ |
| Relatório Financeiro | 8 KPIs + 3 charts (BarChart, LineChart, barras horizontais) + 2 seções colapsáveis + Conciliação | Idêntico | ✅ |
| BeneficiaryInvoicePreview | Exportado — acessível a partir de Financial.tsx via "Ver Fatura ESA" | ✅ exportado | ✅ |
| Valores financeiros | Sem fórmulas JSX — `row.faturaEsa` de `computeAll()` + `getFinancialSummary()` | ✅ | ✅ |
| Estado vazio | Mensagens de "Sem dados" em todas as seções quando repositório vazio | ✅ | ✅ |

**Fatura ESA — Beneficiário (`.dc.html` linhas 501–703):**
Não é uma tab de Relatórios. É acessada via botão "Ver Fatura ESA" em Financial.tsx (abre Modal com BeneficiaryInvoicePreview).

---

### 4.8 Financeiro — ✅ MIGRADO (Missão 22)

**Arquivo:** `components/esa/views/Financial.tsx`  
**Referência:** `.dc.html` linhas 1167–1305 (screen label "Financeiro")

| Elemento | Claude Design | Implementado | Status |
|---|---|---|---|
| Seletor de mês | `select` no topo com `provider.listMonths()` | ✅ | ✅ |
| Botão "Relatório do proprietário" | `border-[#a9e4cb] bg-[#eaf8f1]` no topo direito | ✅ com `onNavigate('relatorios')` | ✅ |
| Fatura ESA value | ~~`u.monthlyConsumption * u.esaPrice`~~ | `invoiceValueByUbId.get(u.id) ?? 0` via `computeAll()` | ✅ |
| Settlement status | ~~`r.ug.id === 'UG-001' ? 'pago' : 'aberto'`~~ | default `'aberto'` sem hardcode | ✅ |
| Datas hardcoded | ~~`'15/08/2026'`, `'12/08/2026'`~~ | `computeDueDate(month)` dinâmico | ✅ |
| Charts subtitle | ~~"Últimos 6 meses"~~ | "Histórico dos ciclos apurados — sem projeções" | ✅ |
| Chart grid | `lg:grid-cols-3` (2:1) | `md:grid-cols-2` (igual) | ✅ |
| Cores dos charts | `#059669` | `#00a86b` (Claude Design green) | ✅ |
| "Ver Fatura ESA" | Ausente | Abre Modal com `BeneficiaryInvoicePreview` | ✅ |
| "Ver beneficiária" | Ausente | Navega para `'beneficiarias'` | ✅ |
| "Reabrir" repasses | Ausente | `provider.reopenInvoicePayment()` | ✅ |
| "Ver dados PIX" | Ausente | Abre `PixModal` com recipient info + Copy | ✅ |
| "Ver UG" | Ausente | Navega para `'unidades-geradoras'` | ✅ |
| Badge recebedor≠proprietário | Ausente | `RECEBEDOR ≠ PROPRIETÁRIO` badge em RecipientCell | ✅ |
| min-width faturas table | 1020px | `style={{ minWidth: 1020 }}` | ✅ |
| min-width repasses table | 1120px | `style={{ minWidth: 1120 }}` | ✅ |
| Estado vazio (faturas) | Mensagem centralizada | `"Nenhuma fatura para o mês selecionado."` | ✅ |
| Estado vazio (repasses) | Mensagem centralizada | `"Nenhum repasse para o mês selecionado."` | ✅ |

---

### 4.9 Alertas — 🔜 PENDENTE

**Arquivo:** `components/esa/views/Alerts.tsx`  
**Referência:** *(arquivo não disponível no material exportado)*

Revisão visual pendente via `.dc.html`. O arquivo existente implementa filtro por severidade (critico/risco/atencao/info) com Sheet de detalhe.

---

## 5. Regras de Migração

As regras abaixo devem ser observadas em todas as etapas futuras:

| Regra | Descrição |
|---|---|
| **NÃO copiar mockData** | Nenhum valor de `reference/src__lib__esa__mockData.ts` deve entrar no código de produção |
| **NÃO copiar fórmulas** | Fórmulas de `scaledResults`, `monthFactor`, `aggregate` são do protótipo mock — o Core faz os cálculos |
| **NÃO alterar provider-adapter** | Sem incompatibilidade comprovada e teste de regressão |
| **NÃO tocar em main** | Toda mudança em `core-v2` |
| **Manter modo imersivo** | `body.esa-energy-credits-active`, lifecycle React, bridge não são afetados |
| **Preservar Core** | ESAApplication, EnergyCreditsUIProvider, Billing Engine, Read Models, Queries, Reports, Importadores intocáveis |
| **Usar `useEsaProvider()`** | Toda view usa o hook — nunca importa `energyCreditsProvider` mock diretamente |

---

## 6. Roadmap de Migração

| Etapa | Escopo | Status |
|---|---|---|
| **Etapa 1** | Design system + Shell + Visão Geral | ✅ CONCLUÍDO |
| **Etapa 2** | Unidades Geradoras + Unidades Beneficiárias | ✅ CONCLUÍDO |
| **Etapa 3** | Relatórios + Financeiro + Shell/Dashboard refinements | ✅ CONCLUÍDO (Missão 22) |
| Etapa 4 | Apuração Mensal (refinamentos visuais) | 🔜 Pendente |
| Etapa 5 | Importação CSV | 🔜 Pendente |
| Etapa 6 | Alertas | 🔜 Pendente |
| Etapa 7 | Revisão final + Pixel Perfect com .dc.html | 🔜 Pendente |

---

## 7. Glossário de Status

| Símbolo | Significado |
|---|---|
| ✅ ALINHADO | Implementação visualmente fiel ao design de referência; sem alteração necessária |
| ⚠️ DIVERGÊNCIA | Diferença identificada; alteração planejada ou em andamento |
| 🔜 PENDENTE | Referência não disponível ou revisão visual agendada para etapa futura |
| ❌ GAP | Componente presente no design mas ausente na implementação |
