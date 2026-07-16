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
| Unidades Geradoras | `ug` | *(não disponível)* | 🔜 PENDENTE | `views/GeneratingUnits.tsx` | Ver §4.4 |
| Unidades Beneficiárias | `ub` | *(não disponível)* | 🔜 PENDENTE | `views/BeneficiaryUnits.tsx` | Ver §4.5 |
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
| Logo icon | `h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700` | Idêntico | ✅ |
| Logo text "ESA Energia" | `text-sm font-semibold text-slate-900` | Idêntico | ✅ |
| Logo subtext | `text-[10px] text-emerald-700 font-semibold tracking-wider uppercase` | Idêntico | ✅ |
| Nav item active | `bg-emerald-50 text-emerald-800 font-semibold` | Idêntico | ✅ |
| Nav item inactive | `text-slate-600 hover:bg-slate-50 hover:text-slate-900` | Idêntico | ✅ |
| Nav hint badges | `bg-emerald-600 text-white` (ativo) / `bg-emerald-100 text-emerald-700` | Idêntico | ✅ |
| Collapse button | `absolute -right-3 top-20 h-6 w-6 rounded-full border border-slate-200` | Idêntico | ✅ |
| Sidebar footer card | `rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-3.5` | Idêntico | ✅ |
| Header height | `h-14 md:h-16` | `h-14 md:h-16` | ✅ |
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
| Chart área (2/3 + 1/3) | `grid lg:grid-cols-3 gap-4`, `lg:col-span-2` | Idêntico | ✅ |
| Chart "Geração vs. Consumo" | BarChart/LineChart com toggle Por UG/Consolidado | Idêntico | ✅ |
| Chart "Receita vs. Repasse" | LineChart com Receita + Repasse + Spread dashed | Idêntico | ✅ |
| Ranking UGs | progress bar `bg-gradient-to-r from-emerald-500 to-emerald-600` | Idêntico | ✅ |
| Top Beneficiárias | lista com Economia + faturaEsa + StatusPill | Idêntico | ✅ |
| Card Alertas | 4 alertas máx, tone por severity (rose/amber/sky/slate) | Idêntico | ✅ |
| Drill-down Sheet | `sm:max-w-lg overflow-y-auto`, todos os tipos de drill | Idêntico | ✅ |
| Cores dos charts | `#059669` (emerald-600), `#a7f3d0` (emerald-200), `#94a3b8`, `#10b981` | Idênticas | ✅ |

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

### 4.4 Unidades Geradoras — 🔜 PENDENTE

**Arquivo:** `components/esa/views/GeneratingUnits.tsx`  
**Referência:** *(arquivo não disponível no material exportado)*

Revisão visual pendente via `.dc.html`. O arquivo existente usa `useEsaProvider()` e implementa CRUD de UGs. Comparação detalhada agendada para etapa futura.

---

### 4.5 Unidades Beneficiárias — 🔜 PENDENTE

**Arquivo:** `components/esa/views/BeneficiaryUnits.tsx`  
**Referência:** *(arquivo não disponível no material exportado)*

Revisão visual pendente via `.dc.html`.

---

### 4.6 Importação CSV — 🔜 PENDENTE

**Arquivo:** `components/esa/views/CsvImport.tsx`  
**Referência:** *(arquivo não disponível no material exportado)*

Revisão visual pendente via `.dc.html`. Nota: a integração com `EnergyCreditsCsvTemplateService` via adapter foi corrigida (Missão 17 — mapeamento de chaves `ug` → `generating-units` e campos `csvText` → `example`).

---

### 4.7 Relatórios — 🔜 PENDENTE

**Arquivo:** `components/esa/views/Reports.tsx`  
**Referência:** *(arquivo não disponível no material exportado)*

Revisão visual pendente via `.dc.html`. Nota: tratamento de exceções do Core corrigido (Missão 18 — `UNIT_NOT_FOUND` retorna null em vez de crash).

---

### 4.8 Financeiro — 🔜 PENDENTE

**Arquivo:** `components/esa/views/Financial.tsx`  
**Referência:** *(arquivo não disponível no material exportado)*

Revisão visual pendente via `.dc.html`. Nota: dados históricos fictícios removidos (Missão 19 — `const trend` hardcoded substituído por `provider.getMonthlyTrend({})`).

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
| **Etapa 1 (atual)** | Design system + Shell + Visão Geral | ✅ CONCLUÍDO |
| Etapa 2 | Unidades Geradoras + Unidades Beneficiárias | 🔜 Pendente |
| Etapa 3 | Apuração Mensal (refinamentos visuais) | 🔜 Pendente |
| Etapa 4 | Importação CSV + Relatórios | 🔜 Pendente |
| Etapa 5 | Financeiro + Alertas | 🔜 Pendente |
| Etapa 6 | Revisão final + Pixel Perfect com .dc.html | 🔜 Pendente |

---

## 7. Glossário de Status

| Símbolo | Significado |
|---|---|
| ✅ ALINHADO | Implementação visualmente fiel ao design de referência; sem alteração necessária |
| ⚠️ DIVERGÊNCIA | Diferença identificada; alteração planejada ou em andamento |
| 🔜 PENDENTE | Referência não disponível ou revisão visual agendada para etapa futura |
| ❌ GAP | Componente presente no design mas ausente na implementação |
