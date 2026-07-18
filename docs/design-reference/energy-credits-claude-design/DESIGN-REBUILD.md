# DESIGN-REBUILD — Gate 1: Reconstrução Visual

**Branch:** `core-v2`
**Data:** 2026-07-17
**Aplicação:** `src/ui/energy-credits/design-app/`
**Status:** GATE 1 CONCLUÍDO — Preview funcional, integração por query string ativa

---

## Objetivo

Reconstruir a interface de Gestão de Créditos de Energia a partir do Claude Design oficial,
sem conectar o provider real. A nova camada de apresentação fica em `design-app/` e coexiste
com a implementação atual em `react-app/`.

---

## Telas Reconstruídas

| # | Tela | Arquivo | Status |
|---|---|---|---|
| 1 | Shell (sidebar + header + topbar) | `src/components/Shell.tsx` | ✅ |
| 2 | Visão Geral (Dashboard) | `src/views/Dashboard.tsx` | ✅ |
| 3 | Unidades Geradoras — lista | `src/views/GeneratingUnits.tsx` | ✅ |
| 4 | Cadastro de UG (modal stepper 4 passos) | `src/views/GeneratingUnits.tsx` | ✅ |
| 5 | Detalhe da UG (drawer) | `src/views/GeneratingUnits.tsx` | ✅ |
| 6 | Unidades Beneficiárias — lista | `src/views/BeneficiaryUnits.tsx` | ✅ |
| 7 | Cadastro de UB (modal stepper 4 passos) | `src/views/BeneficiaryUnits.tsx` | ✅ |
| 8 | Detalhe da UB (drawer + histórico) | `src/views/BeneficiaryUnits.tsx` | ✅ |
| 9 | Apuração Mensal | `src/views/MonthlySettlement.tsx` | ✅ |
| 10 | Importação CSV (4 tipos) | `src/views/CsvImport.tsx` | ✅ |
| 11 | Importação de Fatura (stepper 4 etapas) | `src/views/CsvImport.tsx` | ✅ |
| 12 | Fatura ESA do Beneficiário (drawer) | `src/views/Reports.tsx` | ✅ |
| 13 | Relatórios — aba Proprietário | `src/views/Reports.tsx` | ✅ |
| 14 | Relatório do Proprietário (documento) | `src/views/Reports.tsx` | ✅ |
| 15 | Relatório Interno ESA | `src/views/Reports.tsx` | ✅ |
| 16 | Relatório Financeiro ESA | `src/views/Reports.tsx` | ✅ |
| 17 | Financeiro | `src/views/Financial.tsx` | ✅ |
| 18 | Alertas | `src/views/Alerts.tsx` | ✅ |

---

## Estados Reconstruídos

| Estado | Presente em |
|---|---|
| Estado preenchido (dados) | Todas as telas |
| Estado vazio (EmptyState) | Dashboard (alertas), GeneratingUnits, BeneficiaryUnits |
| Estado de loading (LoadingSpinner) | GeneratingUnits, BeneficiaryUnits, CsvImport |
| Estado de erro (ErrorBanner) | CsvImport, GeneratingUnits create |
| Estado de sucesso (SuccessBanner) | CsvImport, GeneratingUnits, BeneficiaryUnits |

---

## Modais Implementados

| Modal | Tela |
|---|---|
| Cadastro de UG (stepper 4 passos) | GeneratingUnits |
| Cadastro de UB (stepper 4 passos) | BeneficiaryUnits |
| Alterar preço do ciclo | MonthlySettlement |
| Confirmar pagamento | Financial |
| Reabertura de pagamento | Financial |

---

## Drawers Implementados

| Drawer | Tela |
|---|---|
| Detalhe da UG | GeneratingUnits |
| Detalhe da UB (+ histórico mensal) | BeneficiaryUnits |
| Drill-down KPIs (compensado, receita, owner, UG, UB, alerta) | Dashboard |
| Fatura ESA do Beneficiário | Reports |
| Detalhe do alerta (+ ação recomendada) | Alerts |

---

## Navegação

- Sidebar com 8 itens de navegação
- Botão recolher/expandir sidebar
- Sheet mobile (hamburger menu)
- Botão `← Dashboard` quando `onExit` fornecido
- Tabs dentro de: Reports (3 tabs), CsvImport (2 tabs)
- Steppers: Cadastro UG (4), Cadastro UB (4), Importação de Fatura (4)
- Accordion: relatório por beneficiária em Relatório do Proprietário
- Filtros: Dashboard (mês + UG), MonthlySettlement (mês + UG), Financial (mês + UG), Alerts (severidade + mês)
- Modo de rateio: Automático / Manual (MonthlySettlement)
- Modo de gráfico: Por UG / Consolidado (Dashboard)

---

## Design System

Componentes em `src/components/ui/index.tsx`:

| Componente | Descrição |
|---|---|
| `Card` | rounded-xl border border-slate-200 bg-white shadow-sm |
| `KpiCard` | Card de KPI com delta indicator e interactive variant |
| `SectionTitle` | Título de seção com desc e slot direito |
| `Badge` | tone: slate/green/amber/red/blue/emerald/neutral |
| `Button` | variant: primary/ghost/outline/soft/danger; size: sm/md |
| `StatusPill` | pago/aberto/vencido/ativa/inativa/manutencao |
| `CycleBadge` | aberto/em_apuracao/fechado |
| `Modal` | Overlay modal com header/body/footer e tamanhos sm/md/lg/xl |
| `Drawer` | Painel lateral direito com overlay |
| `Stepper` | Indicador de etapas compacto |
| `Field` + `inputClass` | Primitivos de formulário |
| `EmptyState` | Estado vazio com icon/title/desc/action |
| `LoadingSpinner` | Spinner animado com label |
| `SuccessBanner` | Banner de sucesso dismissável |
| `ErrorBanner` | Banner de erro dismissável |
| `FieldRow` | Campo de leitura em grid (label + value) |

---

## Preview Isolado

```bash
cd src/ui/energy-credits/design-app
npm run preview-dev
# Abre em http://localhost:5173 (ou porta disponível)
```

O preview carrega a interface completa sem o dashboard legado.

---

## Build

```bash
cd src/ui/energy-credits/design-app
npm run build
# Output: assets/energy-credits-design/energy-credits-design.js (1,055 kB)
#         assets/energy-credits-design/energy-credits-design.css (46.7 kB)
```

---

## Integração Experimental (Query String)

```
http://localhost/?energyCreditsDesignV2=1
```

O `index.html` detecta a query string e importa dinamicamente o bundle
`/assets/energy-credits-design/energy-credits-design.js`, montando a nova
interface fullscreen (`position:fixed; inset:0; z-index:10000`) sobre o dashboard legado.

Sem a query string, o dashboard funciona normalmente.

---

## Restrições Respeitadas

| Restrição | Status |
|---|---|
| Core intocado | ✅ |
| Billing Engine intocado | ✅ |
| provider-adapter intocado | ✅ |
| Firebase Rules intocadas | ✅ |
| Autenticação intocada | ✅ |
| main intocado | ✅ |
| Interface antiga mantida (`react-app/`) | ✅ |
| Provider real não conectado | ✅ |
| Sem mocks importados pela aplicação integrada final | ✅ (dados em `src/lib/demo.ts`) |
| Sem iframe | ✅ |
| Sem Shadow DOM | ✅ |

---

## Typecheck & Build

```
tsc --noEmit → 0 erros
vite build   → ✓ built in 1.49s
577 testes existentes → todos passando
```
