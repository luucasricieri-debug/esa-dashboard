# GATE-3C — Apuração Mensal Connection Mapping

**Branch:** `core-v2`
**Data:** 2026-07-15
**Status:** Gate 3C — Apuração Mensal conectada ao ESA OS runtime

---

## Objetivo

Conectar a tela de **Apuração Mensal** do `energy-credits-v2.html` (modo `?runtime=real`) ao provedor real via `window.ESA_ENERGY_CREDITS_RUNTIME`, preservando o modo demo intacto.

---

## Mapeamento — Seletores (cabeçalho da tela)

| Campo visual | Fonte demo | Fonte real | Provider method | Fallback | Risco |
|---|---|---|---|---|---|
| Dropdown mês | `this.AP_MONTHS` (strings) | `(_rtMonths \|\| MONTHS_AV).map(m => m.value)` | `listMonths()` (já carregado) | `MONTHS_AV` se `_rtMonths` nulo | Baixo |
| Dropdown UG | `this.UGS` | `_rtUgs \|\| []` | `listGeneratingUnits()` (já carregado) | Array vazio | Baixo |
| Badge status ciclo | `cycBadge(computeAllocationPlan(...).status)` | `apStatus` de `_rtMonths[apMonth].status` | `listMonths()` | `"aberto"` | Baixo |

---

## Mapeamento — KPIs operacionais

| Campo visual | Fonte demo | Fonte real | Transformation | Capability absent | Risco |
|---|---|---|---|---|---|
| Geração (kWh) | `plan.generation` | `_rtPlan.generation` | `totalGenerationKwh` de `getGeneratingUnitSummary()` | `ug.monthlyGeneration` como fallback | Médio |
| Fator de utilização (%) | `plan.totalPct × 100` | `_rtPlan.totalPct × 100` | `sum(allocationPct)` das UBs | `"—"` se sem UBs | Baixo |
| Total compensado (kWh) | `plan.totalCompensated` | `_rtPlan.totalCompensated` | `sum(min(consumption, avail))` | `0` se sem UBs | Baixo |
| Saldo final (kWh) | `plan.totalFinalBalance` | `_rtPlan.totalFinalBalance` | `sum(avail - compensated)` | `0` se sem UBs | Baixo |
| Qtd. beneficiárias | `plan.rows.length` | `_rtPlan.rows.length` | `listBeneficiaryUnits({ ugId }).length` | `0` se sem UBs | Baixo |

---

## Mapeamento — Modo automático / manual

| Campo visual | Fonte demo | Fonte real | Notas |
|---|---|---|---|
| Toggle automático | `S.apAutoMode` (state) | `S.apAutoMode` (state, iniciado `true`) | Sem persistência em real (persist=false) |
| Rateio recomendado % | `prow.recommendedPct` | `_rtPlan.rows[i].recommendedPct` | Calculado no provider a partir de `needs` / `sumNeeds` |
| Rateio aplicado % | `prow.allocationPct × 100` | `displayPct = (S.ov[ub.id]?.allocationPct ?? r.allocationPct) × 100` | Override local no estado |
| Pct inválido (≠100%) | `totalDisplayPct !== 1.0` | `Math.abs(totalDisplayPct - 1) > 0.005` | Bloqueia fechar mês |

---

## Mapeamento — Plano de rateio (tabela por UB)

| Coluna tabela | Fonte demo | Fonte real | Transformation | Fallback |
|---|---|---|---|---|
| Nome da UB | `r.ub.name` | `r.ub.name` | `listBeneficiaryUnits({ ugId })[i].name` | `"—"` |
| UC | `r.ub.uc` | `r.ub.uc` | `listBeneficiaryUnits({ ugId })[i].uc` | `"—"` |
| Média mensal (kWh) | `r.monthlyAverage` | `r.monthlyAverage` | `ub.annualAverage / 12` | `0` |
| Margem preventiva (%) | `r.preventiveMargin × 100` | `ov.preventiveMargin ?? ub.preventiveMargin` | Override local | `0` |
| Crédito alvo (kWh) | `r.targetCredit` | `r.targetCredit` | `monthlyAverage × (1 + preventiveMargin)` | `0` |
| Saldo atual (kWh) | `r.currentBalance` | `r.currentBalance` | `ub.previousCreditBalance` | `0` |
| Rec. adicional (kWh) | `r.recommendedAdd` | `r.recommendedAdd` | `max(0, targetCredit - currentBalance)` | `0` |
| Rec. % | `r.recommendedPct × 100` | `r.recommendedPct × 100` | `recommendedAdd / sumNeeds` | `0` |
| % a alocar | `prow.displayPct × 100` | `displayPct × 100` | `ov.allocationPct ?? r.allocationPct` | `r.allocationPct` |
| Planejado (kWh) | `r.planned` | `displayPlanned` | `generation × displayPct` | `0` |
| Consumo (kWh) | `r.consumption` | `r.consumption` | `ub.monthlyConsumption` | `0` |
| Compensado (kWh) | `r.compensated` | calculado display | `min(consumption, currentBalance + displayPlanned)` | `0` |
| Saldo final (kWh) | `r.finalBalance` | calculado display | `(currentBalance + displayPlanned) - compensated` | `0` |
| Cobertura (meses) | badge `covBadge(...)` | badge `covBadge(...)` | `finalBalance / monthlyAverage` | `"—"` |
| Diff vs recomendado | `diff = displayPlanned - recommendedAdd` | igual | sinal `+`/`–`/`=` | neutro |

---

## Mapeamento — Condição de compra da UG

| Campo visual | Fonte demo | Fonte real | Provider method | Notas |
|---|---|---|---|---|
| Preço padrão | `"R$ " + ugd.purchasePrice + "/kWh"` | `"R$ " + apUg?.purchasePrice + "/kWh"` | `listGeneratingUnits()` | `"—"` se `apUg` null |
| Preço aplicado | `appliedPrices[key]` ou padrão | `appliedPrices[key]` ou `apUg?.purchasePrice ?? 0` | state local | Sem persistência |
| Modal preço | input `priceInput` | igual, com `apUg?.purchasePrice` como default | state local | Toast informa persist=false |

---

## Mapeamento — Resumo financeiro

| Campo visual | Fonte demo | Fonte real | Computation | Persist available | Risco |
|---|---|---|---|---|---|
| Preço aplicado | `appliedPrice` | `appliedPrice` (state local) | `appliedPrices[ugId+month]` ou `purchasePrice` | Não | persist=false documentado |
| Repasse ao proprietário | `ownerPayment` | `dispCompensated × appliedPrice` | display calc (não billing engine) | Não | Baixo — exibição apenas |
| Receita ESA | `esaRevenue` | `_rtPlan.esaRevenue` | `sum(compensated × ub.esaPrice)` no provider | Não | Médio — usa esaPrice do Core |
| Spread bruto | `esaRevenue - ownerPayment` | `esaRevenue - ownerPayment` | display calc | Não | Baixo |

**Regra:** Cálculos de `ownerPayment` (compensado × preço) e spread (receita − repasse) podem ser feitos no visual porque são apenas formatação de valores já calculados. `esaRevenue` é calculado no provider.

---

## Mapeamento — Ações

| Ação | Demo | Real | Provider method | Persistence | Bloqueio |
|---|---|---|---|---|---|
| Salvar rateio | toast demo | `rt.saveAllocationOverrides(ugId, month, ov)` | `saveAllocationOverrides` | persist=false (NOT_IMPLEMENTED no Core) | Loading state `_rtApSaving` |
| Fechar mês | toast demo | `rt.closeMonthlySettlement(ugId, month)` | `closeMonthlySettlement` | persist=false (NOT_IMPLEMENTED no Core) | `pctInvalid` bloqueia; `_rtApClosing` |
| Reabrir ciclo | (não implementado em demo) | não exposto (Core sem capability) | — | — | Botão ausente |
| Alterar preço | `appliedPrices[key]` local | `rt.updateCyclePrice(ugId, month, price, reason)` | `updateCyclePrice` | persist=false | Toast informa |

---

## Mapeamento — Estados especiais

| Estado | Como detectado | Visual | Loading guard |
|---|---|---|---|
| Carregando | `_rtApPlanLoading === true` | KPIs "…", tabela "Carregando…" | `!_rtApPlanLoading` antes de novo load |
| Sem dados (UG sem UBs) | `_rtPlan.rows.length === 0` | Tabela vazia, KPIs zeros | — |
| Erro de carga | catch em `_loadRealApPlan` | `_rtApPlanLoading = false`, `_rtApPlan` null | — |
| Ciclo fechado | `apStatus === "fechado"` | Badge vermelho/cinza, ações bloqueadas | — |
| Pct inválido | `\|totalDisplayPct − 1\| > 0.005` | Badge pct vermelho, Fechar Mês desabilitado | — |
| Resposta stale | seq counter `_apPlanSeq` | resposta descartada silenciosamente | `if (seq !== this._apPlanSeq) return` |

---

## Fluxo de Carregamento (modo real)

```
Navegação → view "apuracao"
  └─ componentDidUpdate detecta viewEntered || ugMudou || mesMudou
       └─ _loadRealApPlan(apUgId, apMonth):
            ├─ incrementa _apPlanSeq
            ├─ setState({ _rtApPlanLoading: true, _rtApPlan: null })
            ├─ rt.getAllocationPlan(ugId, month, {})
            │    ├─ Promise.all([getGeneratingUnit(ugId), listBeneficiaryUnits({ ugId })])
            │    └─ getGeneratingUnitSummary(ugId, { referenceMonth: month }) → totalGenerationKwh
            └─ setState({ _rtApPlan: plan, _rtApPlanLoading: false })

Troca de UG ou mês:
  └─ onApUgChange / onApMonthChange → setState({ apUgId/apMonth, _rtApPlan: null })
       └─ componentDidUpdate → _loadRealApPlan() (novo seq, resposta antiga descartada)
```

---

## Restrições de Isolamento (Gate 3C)

| Regra | Status |
|---|---|
| Não alterar Core | ✓ Respeitado |
| Não alterar Billing Engine | ✓ Respeitado |
| Não alterar react-app / design-app | ✓ Respeitado |
| Não alterar Relatórios / Financeiro / Importações | ✓ Respeitado |
| provider-adapter não alterado | ✓ Respeitado (sem incompatibilidade comprovada) |
| esaRuntimeProvider não acessa Firebase direto | ✓ Respeitado |
| esaRuntimeProvider não expõe calculationMemory | ✓ Respeitado |
| Sem mocks em modo real | ✓ Arrays vazios permanecem vazios |
| IDs demo (UG-001 / UB-001) não usados como fallback | ✓ Respeitado |
| Demo preservado integralmente | ✓ Triple-branch: real / loading / demo |

---

## Limitações Conhecidas (Gate 3C)

| Limitação | Motivo | Impacto |
|---|---|---|
| `saveAllocationOverrides` sem persistência | Core não implementa (NOT_IMPLEMENTED) | Toast informa o usuário; estado local salvo |
| `closeMonthlySettlement` sem persistência | Core não implementa (NOT_IMPLEMENTED) | Toast informa; badge não muda após fechar |
| `updateCyclePrice` sem persistência | Core não implementa (persist=false) | Preço local até reload |
| Histórico de preços por ciclo | Core não expõe por ciclo | Sempre usa `purchasePrice` atual da UG |
| Reabrir ciclo | Core sem capability | Botão não exibido em real |
| `esaRevenue` usa `ub.esaPrice` atual | Core não expõe preço histórico ESA por UB/ciclo | Pode divergir de ciclos passados fechados |

---

## Arquivos Alterados

| Arquivo | Modificação |
|---|---|
| `energy-credits-v2.html` | Gate 3C state; triple-branch resolver apuração; `_loadRealApPlan`; `componentDidUpdate` Gate 3C block; `onSalvar`/`onFecharMes` real mode; `finSummaryKpis` real mode; `apMonths`/`apUgOptions` real mode |
| `src/ui/energy-credits/direct-runtime/providers/esaRuntimeProvider.ts` | `getAllocationPlan` real implementation; `getAppliedPrice` usa `purchasePrice` da UG; `AllocationRow` import adicionado |
| `src/ui/energy-credits/direct-runtime/tests/settlement-gate3c.manual-test.ts` | 13 suites (V–AH), cobertura de ciclo vazio, UG sem UBs, múltiplas UBs, modo auto/manual, validação pct, preços, salvar/fechar, erros, sem dados demo, demo preservado |
| `docs/design-reference/energy-credits-claude-design/GATE-3C-SETTLEMENT-MAPPING.md` | Este documento |
