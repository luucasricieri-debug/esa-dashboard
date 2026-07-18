# GATE-3A — Dashboard Connection Mapping

**Branch:** `core-v2`
**Data:** 2026-07-18
**Status:** Gate 3 — Visão Geral conectada ao ESA OS

---

## Objetivo

Conectar a tela **Visão Geral** do `energy-credits-v2.html` (modo `?runtime=real`) ao provedor real de dados do ESA OS via `window.ESA_ENERGY_CREDITS_RUNTIME`, sem alterar o modo demo.

---

## Mapeamento de Dados — Demo vs Real

| Dado exibido | Fonte demo | Fonte real (Gate 3) | Provider method | Notas |
|---|---|---|---|---|
| Geração total (kWh) | `aggregate(scaledResults()).generation` | `getExecutiveSummary.totalGenerationKwh` | `getDashboardData` | ✓ Mapeado |
| Energia compensada (kWh) | `aggregate().compensated` | `getExecutiveSummary.totalCompensatedKwh` | `getDashboardData` | ✓ Mapeado |
| Saldo atual (kWh) | `aggregate().balance` (canônico: 10.900) | `getExecutiveSummary.totalCurrentBalanceKwh` | `getDashboardData` | ✓ Mapeado |
| Receita ESA (R$) | `aggregate().revenue` | `getExecutiveSummary.totalEsaRevenue` | `getDashboardData` | ✓ Mapeado |
| Repasse proprietário (R$) | `aggregate().ownerPayment` | `getExecutiveSummary.totalOwnerReturn` | `getDashboardData` | ✓ Mapeado |
| Spread bruto ESA (R$) | `aggregate().spread` | `getExecutiveSummary.grossSpread` | `getDashboardData` | ✓ Mapeado |
| Economia dos clientes (R$) | `aggregate().savings` | `getExecutiveSummary.totalMonthlyDiscount` | `getDashboardData` | ✓ Mapeado |
| Alertas críticos | `CRITICAL[month]` | `getExecutiveSummary.criticalAlertCount` | `getDashboardData` | ✓ Mapeado |
| Deltas MoM (%) | computa mês anterior com `scaledResults` | busca `getExecutiveSummary` do mês anterior | `getDashboardData.previous` | ✓ Mapeado — null se não há mês anterior |
| Qtd. Unidades Geradoras | `UGS.length` | `getExecutiveSummary.generatingUnitCount` | `getDashboardData` | ✓ Mapeado |
| Qtd. Unidades Beneficiárias | `UBS.length` | `getExecutiveSummary.beneficiaryUnitCount` | `getDashboardData` | ✓ Mapeado |
| Histórico financeiro (Receita × Repasse) | computa por mês via `scaledResults` | `getFinancialSummary` por mês | `getDashboardData.trendData` | ✓ Mapeado — Geracao/Consumo = 0 (Core não expõe) |
| Gráfico Geração × Consumo por UG | `results.map(r => { Geração, Consumo })` | ❌ Core não expõe por UG | `getDashboardData.results = []` | Gráfico bar vazio em real |
| Gráfico Consolidado (linha) | trend.Geracao / trend.Consumo | ❌ Core não expõe por ciclo | `TrendRow.Geracao = 0` | Linhas zero em real |
| Ranking UGs | `results.sort(by generation)` | ❌ Core não detalha por UG | `results = []` → ranking vazio | Vazio em real |
| Ranking Top UBs | `results.flatMap(rows).sort()` | ❌ Core não detalha por UB | `results = []` → ranking vazio | Vazio em real |
| Cards de alertas | `ALERTS.filter(month, ugId)` | `getAlertsSummary().alerts` | `listAlerts({ month })` | ✓ Mapeado |
| Status do ciclo | `MONTHS_AV[mi].status` | `AVAILABLE_MONTHS[mi].status` | `getDashboardData.cycleStatus` | ✓ Mapeado |
| Lista de meses (dropdown) | `this.MONTHS_AV` | `rt.listMonths()` | `listMonths` | ✓ Mapeado |
| Lista de UGs (dropdown filtro) | `this.UGS` | `rt.listGeneratingUnits()` | `listGeneratingUnits` | ✓ Mapeado |

---

## Fluxo de Inicialização (modo real)

```
1. browser carrega energy-credits-v2.html
2. <script bridge.js> executa:
   - lê ?runtime=real
   - aguarda window.__ESA_UI_PROVIDER__
   - chama createEsaRuntimeProvider(uiProvider)
   - seta window.ESA_ENERGY_CREDITS_RUNTIME
   - dispara esa:runtime:ready
3. DC Component renderiza com state._rtMode = "demo" (padrão)
4. componentDidMount():
   - chama _initRealMode()
   - registra listener em esa:runtime:ready
5. _initRealMode():
   - verifica window.ESA_ENERGY_CREDITS_RUNTIME.mode === 'real'
   - chama listMonths() + listGeneratingUnits() em paralelo
   - setState { _rtMode: 'real', _rtMonths, _rtUgs, dashMonth }
   - chama _loadRealDash(initMonth, 'all')
6. _loadRealDash(month, ugFilter):
   - setState { _rtLoading: true }
   - chama getDashboardData({ month, ugId }) + listAlerts({ month }) em paralelo
   - setState { _rtDash, _rtAlerts, _rtLoading: false }
7. renderVals():
   - _rtData = S._rtDash (já carregado)
   - resolver usa dados reais para todos os KPIs
   - filter dropdowns usam S._rtMonths e S._rtUgs
8. componentDidUpdate():
   - detecta mudança em dashMonth ou ugFilter
   - chama _loadRealDash() novamente sem recarregar página
```

---

## Estado Vazio Real (sem dados do ESA OS)

| Campo | Valor |
|---|---|
| Geração | 0 kWh |
| Compensado | 0 kWh |
| Saldo | 0 kWh |
| Receita ESA | R$ 0 |
| Repasse | R$ 0 |
| Spread | R$ 0 |
| Alertas críticos | 0 |
| Deltas MoM | estável (flat) |
| Gráfico barras | vazio (sem barras) |
| Gráfico linhas | linhas zeradas |
| Ranking UGs | vazio |
| Ranking UBs | vazio |
| Cards alertas | nenhum alerta |

Nenhum crash. Nenhum fallback silencioso para dados demo.

---

## Limitações Conhecidas (Gate 3)

| Limitação | Motivo | Impacto | Gate futuro |
|---|---|---|---|
| Gráfico "Por UG" vazio em real | Core não expõe `SettlementResult[]` por UG | Barras não aparecem | Gate 4+ |
| Gráfico consolidado Geração/Consumo zerado | Core não expõe totais de geração/consumo por ciclo | Linhas zeradas | Gate 4+ |
| Ranking UGs vazio | Depende de `results[]` | Seção vazia | Gate 4+ |
| Ranking UBs vazio | Depende de `results[].rows` | Seção vazia | Gate 4+ |
| `prevCrit` = `currCrit` em real | Core não expõe alertas críticos do mês anterior | Delta de alertas sempre "estável" | Gate 4+ |

---

## Arquivos Alterados

| Arquivo | Modificação |
|---|---|
| `src/ui/energy-credits/direct-runtime/providers/esaRuntimeProvider.ts` | `getDashboardData` implementado com `previous` + `trendData` reais |
| `energy-credits-v2.html` | resolver demo/real, `componentDidUpdate`, `_initRealMode`, `_loadRealDash`, filtros dinâmicos |
| `src/ui/energy-credits/direct-runtime/tests/dashboard-gate3.manual-test.ts` | 8 suites, 50+ asserções |
| `docs/design-reference/energy-credits-claude-design/GATE-3A-DASHBOARD-MAPPING.md` | Este documento |
