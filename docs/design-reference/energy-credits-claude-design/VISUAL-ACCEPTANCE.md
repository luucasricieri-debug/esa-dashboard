# VISUAL-ACCEPTANCE — Missão 22

**Missão:** Alinhar Dashboard, Relatórios e Financeiro ao Claude Design  
**Branch:** `core-v2`  
**Commit alvo:** `feat: alinha dashboard ao Claude Design em visao geral e financeiro`  
**Data:** 2026-07-17  
**Referência:** `ESA Energia - Gestão de Créditos.dc.html` (406 KB, 10 screens)

---

## Critérios de Aceite Verificados

### Shell (Shell.tsx)

| Critério | Esperado | Verificado |
|---|---|---|
| Logo gradient | `from-[#00bd78] to-[#006644]` | ✅ |
| Sidebar footer card gradient | `from-[#00875a] to-[#063a28]` | ✅ |
| Header title color | `text-[#062e20]` | ✅ |
| Header height | `h-16` (64px fixo) | ✅ |

### Visão Geral (Dashboard.tsx)

| Critério | Esperado | Verificado |
|---|---|---|
| Chart grid | `md:grid-cols-2` (colunas iguais) | ✅ |
| Rankings grid | `md:grid-cols-3` | ✅ |
| Chart bar color (geração) | `#00a86b` | ✅ |
| Chart bar color (consumo) | `#a9e4cb` | ✅ |
| Repositório vazio: sem crash | KPIs zerados, gráficos sem dados fictícios | ✅ |

### Relatórios (Reports.tsx)

| Critério | Esperado | Verificado |
|---|---|---|
| Estrutura | 3 tabs inline (Proprietário, Interno, Financeiro) | ✅ |
| Abordagem anterior removida | 4 cards + Modal overlay | ✅ (removido) |
| Tab ativo | `border-[#a9e4cb] bg-[#eaf8f1] text-[#00875a] font-semibold` | ✅ |
| Tab inativo | `border-slate-200 bg-white text-slate-500` | ✅ |
| Container do documento | `rounded-[14px] border-slate-200 shadow` | ✅ |
| Header do documento | `bg-gradient-to-br from-slate-50 to-emerald-50/50` | ✅ |
| max-width | `max-w-[1040px]` | ✅ |
| Filter bars por tab | UG+Ciclo / Mês / Mês+Status | ✅ |
| Botões desabilitados | PDF / E-mail / WhatsApp | ✅ |
| Botão ativo | "Entrega manual" | ✅ |
| Barras de distribuição | Progress bars horizontais com % (não pie chart) | ✅ |
| Tabela distribuição | 9 colunas incluindo "UC / Distribuidora" combinado | ✅ |
| Panel Recebedor PIX | Info + badge recebedor≠proprietário + copiar chave | ✅ |
| Panel Repasse | Dados do ciclo + CycleBadge | ✅ |
| Relatório Interno | 6+8 KPI cards + Status ciclos (2x2) + Alertas (2x2) + Pendências + seções expansíveis | ✅ |
| Relatório Financeiro | 8 KPIs + 3 charts + 2 seções colapsáveis + Conciliação | ✅ |
| Repositório vazio: sem crash | Mensagens de estado vazio em todas as seções | ✅ |
| Sem mockData | Dados exclusivamente de `useEsaProvider()` | ✅ |

### Financeiro (Financial.tsx)

| Critério | Esperado | Verificado |
|---|---|---|
| Seletor de mês | Presente no topo | ✅ |
| Botão "Relatório do proprietário" | Presente, navega para `'relatorios'` | ✅ |
| Fatura ESA value | `computeAll().row.faturaEsa` (sem fórmula JSX) | ✅ |
| Settlement status padrão | `'aberto'` (sem hardcode de UG-001) | ✅ |
| Due date | `computeDueDate(month)` dinâmico (sem hardcode) | ✅ |
| Chart subtitle | "Histórico dos ciclos apurados — sem projeções" | ✅ |
| Chart grid | `md:grid-cols-2` (colunas iguais) | ✅ |
| Cores dos charts | `#00a86b` e `#cbd5e1` | ✅ |
| "Ver Fatura ESA" | Modal com BeneficiaryInvoicePreview | ✅ |
| "Ver beneficiária" | Navega para `'beneficiarias'` | ✅ |
| "Reabrir" repasses | `provider.reopenInvoicePayment()` | ✅ |
| "Ver dados PIX" | PixModal com dados do recebedor + Copy | ✅ |
| "Ver UG" | Navega para `'unidades-geradoras'` | ✅ |
| Badge recebedor≠proprietário | Aparece quando `recipientName !== owner` | ✅ |
| min-width faturas | `1020px` | ✅ |
| min-width repasses | `1120px` | ✅ |
| Estado vazio (faturas) | Mensagem sem crash | ✅ |
| Estado vazio (repasses) | Mensagem sem crash | ✅ |

---

## Restrições Arquiteturais Respeitadas

| Restrição | Status |
|---|---|
| Sem fórmulas financeiras no JSX | ✅ — removido `u.monthlyConsumption * u.esaPrice` |
| Sem mockData | ✅ — nenhum import de `mockData.ts` |
| Sem fixtures do preview em produção | ✅ — sem import de `preview-provider.ts` |
| Sem `localStorage` operacional | ✅ |
| Sem `calculationMemory` exposto | ✅ |
| `provider-adapter.ts` intocado | ✅ — zero alterações |
| Firebase não importado em componentes React | ✅ |
| `main` intocado | ✅ |
| Modo imersivo preservado | ✅ |
| Billing Engine / Core intocados | ✅ |

---

## Testes

| Suite | Assertions | Status |
|---|---|---|
| `provider-adapter.first-render` | 70 | ✅ |
| `provider-adapter.monthly-settlement` | 39 | ✅ |
| `provider-adapter.csv-import` | 85 | ✅ |
| `provider-adapter.reports-empty-state` | 26 | ✅ |
| `provider-adapter.real-empty-trend` | 122 | ✅ |
| `provider-adapter.ug-ub-units` | 78 | ✅ |
| `provider-adapter.reports-financial` | 98 | ✅ (novo) |
| **Total** | **518** | **✅ 0 falhas** |

TypeScript: `npx tsc --noEmit` — limpo  
Build: `npx vite build` — 2.01s, sem erros  
`git diff --check` — apenas avisos de CRLF (Windows), sem trailing whitespace

---

## Fora do Escopo desta Missão

- Apuração Mensal (refinamentos visuais)
- Importação CSV
- Alertas (além dos ajustes de design system)
- Tela "Fatura ESA — Beneficiário" como página autônoma (está acessível via "Ver Fatura ESA" em Financial)

---

# VISUAL-ACCEPTANCE — Missão 23

**Missão:** Isolar estilos e corrigir escala do módulo de créditos  
**Branch:** `core-v2`  
**Commit alvo:** `fix: isola estilos e corrige escala do modulo de creditos`  
**Data:** 2026-07-17  
**Status:** PRONTO PARA VALIDAÇÃO MANUAL

---

## Problemas Corrigidos

| Problema relatado | Causa raiz identificada | Correção aplicada |
|---|---|---|
| Legacy header acima do módulo | `.topbar` mantido visível no modo imersivo (58px) + React Shell header (64px) = 122px de header | `.topbar` oculto no modo imersivo; botão "← Dashboard" adicionado ao Shell header |
| Módulo comprimido verticalmente | Shell usava `min-h-screen` em host com `overflow:hidden` e sem `overflow-y-auto` no main | Shell usa `h-full`; main tem `overflow-y-auto` |
| Tipografia herdando DM Sans do legado | Sem namespace CSS — body legado definia `font-family: DM Sans` herdado pelo módulo | Namespace `#esa-energy-credits-react-root` define `font-family: ui-sans-serif` e `font-size: 14px` |
| Botões/inputs com estilos legados | Tailwind preflight global + ausência de reset de namespace | Reset de `button/input/select/textarea` dentro do namespace |
| Colisão com `.btn`, `.card`, `.badge`, `.tab` | Classes legadas com estilos globais | `all: unset` preventivo para essas classes dentro do namespace |

---

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `index.html` | Modo imersivo: ocultar `.topbar`; `overflow:hidden` no host |
| `src/ui/energy-credits/react-app/src/mountEnergyCreditsReactApp.tsx` | Passa `options?.onExit` ao Shell |
| `src/ui/energy-credits/react-app/src/components/esa/Shell.tsx` | Prop `onExit`; `h-full`; `overflow-y-auto` em main; botão "← Dashboard" |
| `src/ui/energy-credits/react-app/src/index.css` | CSS namespace reset completo |
| `docs/.../INTEGRATION-CSS-AUDIT.md` | Novo — auditoria completa de CSS |

---

## Testes

| Suite | Assertions | Status |
|---|---|---|
| `css-isolation.manual-test` | 48 | ✅ (novo) |
| `provider-adapter.first-render` | 70 | ✅ |
| `provider-adapter.monthly-settlement` | 39 | ✅ |
| `provider-adapter.csv-import` | 85 | ✅ |
| `provider-adapter.reports-empty-state` | 26 | ✅ |
| `provider-adapter.real-empty-trend` | 122 | ✅ |
| `provider-adapter.ug-ub-units` | 78 | ✅ |
| `provider-adapter.reports-financial` | 98 | ✅ |
| **Total** | **566** | **✅ 0 falhas** |

TypeScript: `npx tsc --noEmit` — limpo  
Build: `npm run build` — 1.55s, sem erros  
`git diff --check` — apenas avisos de CRLF (Windows)

---

## Validação Manual Pendente

As seguintes telas devem ser validadas visualmente no browser após integração:

- [ ] Shell: topbar legado não aparece; botão "← Dashboard" aparece no header React
- [ ] Shell: sidebar 240px (não colapsado), header 64px, conteúdo rola corretamente dentro do módulo
- [ ] Dashboard: KPIs em tamanho correto, gráficos não achatados
- [ ] Financial: tabela com min-width correto, gráfico de barras visível
- [ ] Reports: 3 tabs funcionando, documento com max-width 1040px
- [ ] Tipografia: `ui-sans-serif` (não DM Sans) dentro do módulo
- [ ] Botões: padding e font-size corretos (não herdados do legado)
- [ ] Sem zoom ou transform scale em nenhuma tela
