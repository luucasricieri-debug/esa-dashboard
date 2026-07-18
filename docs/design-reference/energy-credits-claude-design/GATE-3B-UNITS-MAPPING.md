# GATE-3B — UG/UB Connection Mapping

**Branch:** `core-v2`
**Data:** 2026-07-18
**Status:** Gate 3B — Unidades Geradoras e Beneficiárias conectadas ao ESA OS

---

## Objetivo

Conectar as telas de **Unidades Geradoras** e **Unidades Beneficiárias** do `energy-credits-v2.html` (modo `?runtime=real`) ao provedor real via `window.ESA_ENERGY_CREDITS_RUNTIME`, sem alterar o modo demo.

---

## Mapeamento — Lista de UGs

| Dado exibido | Fonte demo | Fonte real | Provider method | Notas |
|---|---|---|---|---|
| Nome da UG | `this.UGS[i].name` | `_rtUgs[i].name` | `listGeneratingUnits()` | ✓ |
| ID / Código | `ug.id` | `ug.id` | `listGeneratingUnits()` | ✓ |
| Proprietário | `ug.owner` | `ug.owner` | `listGeneratingUnits()` | ✓ |
| UC | `ug.uc` | `ug.uc` | `listGeneratingUnits()` | ✓ |
| Distribuidora | `ug.distributor` | `ug.distributor` | `listGeneratingUnits()` | ✓ |
| Saldo atual | `computeSettlement().currentBalance` | `ug.previousBalance \|\| 0` | `listGeneratingUnits()` | Limitação: sem cálculo de ciclo |
| Geração | `ug.monthlyGeneration` | `ug.monthlyGeneration \|\| 0` | `listGeneratingUnits()` | ✓ |
| Preço de compra | `ug.purchasePrice` | `ug.purchasePrice \|\| 0` | `listGeneratingUnits()` | ✓ |
| Qtd. beneficiárias | `r.rows.length` | `"—"` | Não disponível na lista | Requer detalhe |
| Status (pill) | `ug.status` | `ug.status \|\| "ativa"` | `listGeneratingUnits()` | ✓ |

---

## Mapeamento — Detalhe de UG

| Dado exibido | Fonte demo | Fonte real | Provider method | Notas |
|---|---|---|---|---|
| Geração do mês | `r.generation` | `dash.current.generation` | `getDashboardData({ month, ugId })` | ✓ |
| Saldo atual | `r.currentBalance` | `dash.current.balance` | `getDashboardData({ month, ugId })` | ✓ |
| Qtd. beneficiárias | `r.rows.length` | `bens.length` | `listBeneficiaryUnits({ ugId })` | ✓ |
| Repasse do mês | `r.ownerPayment` | `dash.current.ownerPayment` | `getDashboardData({ month, ugId })` | ✓ |
| Créditos compensados | `r.totalCompensated` | `dash.current.compensated` | `getDashboardData({ month, ugId })` | ✓ |
| Preço de compra | `ugdU.purchasePrice` | `ugRT.purchasePrice` | `getGeneratingUnit(id)` | ✓ |
| Tab Beneficiárias | `plan2.rows` (AllocationPlan) | `bens[]` (lista básica) | `listBeneficiaryUnits({ ugId })` | consTxt=real; compTxt=saldoTxt="—" |
| Tab Condição comercial | `ugdU.purchasePrice` | `ugRT.purchasePrice` | `getGeneratingUnit(id)` | Vigência="—" em real |
| Tab Recebedor / PIX | `PAYEES[ugId]` | `payeeRT` | `getGeneratingUnitPayee(ugId)` | ✓ |
| Tab Histórico | `MONTHS_AV.map(...)` com `MONTH_FACTOR` | `[]` (vazio) | Não disponível via Core | Limitação conhecida |
| Alertas no resumo | `ALERTS.filter(unit)` | `_rtAlerts.filter(unit)` | `listAlerts` (carregado no dashboard) | ✓ |

---

## Mapeamento — Lista de UBs

| Dado exibido | Fonte demo | Fonte real | Provider method | Notas |
|---|---|---|---|---|
| Nome da UB | `ub.name` | `ub.name` | `listBeneficiaryUnits()` | ✓ |
| Documento | `UB_DOCS[ub.id]` | `ub.document` | `listBeneficiaryUnits()` | ✓ |
| UG vinculada | `UGS.find(g.id===ub.ugId).name` | `_rtUgs.find(g.id===ub.ugId).name` | `listBeneficiaryUnits()` + `_rtUgs` | ✓ |
| Consumo | `buildInvoice().consumption` | `ub.monthlyConsumption` | `listBeneficiaryUnits()` | Sem fatura por UB na lista |
| Compensado | `buildInvoice().compensated` | `"—"` | Não disponível na lista | Requer detalhe |
| Saldo | `buildInvoice().finalBalance` | `"—"` | Não disponível na lista | Requer detalhe |
| Cobertura | `finalBalance / consumption` | `"—"` | Não disponível na lista | Requer detalhe |
| Fatura ESA | `buildInvoice().faturaEsa` | `"—"` | Não disponível na lista | Requer detalhe |
| Economia | `buildInvoice().monthlySavings` | `"—"` | Não disponível na lista | Requer detalhe |
| Status pagamento | `ub.paymentStatus` | `ub.paymentStatus \|\| ub.status` | `listBeneficiaryUnits()` | ✓ |

---

## Mapeamento — Detalhe de UB

| Dado exibido | Fonte demo | Fonte real | Provider method | Notas |
|---|---|---|---|---|
| Consumo atual | `invd.consumption` | `invRT.consumption \|\| ub.monthlyConsumption` | `getBeneficiaryInvoice(id, month)` | ✓ |
| Compensado | `invd.compensated` | `invRT.compensated` | `getBeneficiaryInvoice(id, month)` | ✓ |
| Saldo de créditos | `invd.finalBalance` | `invRT.finalBalance` | `getBeneficiaryInvoice(id, month)` | ✓ |
| Cobertura em meses | `finalBalance / consumption` | `covUbRT = finalBalance / monthlyConsumption` | Calculado no visual | ✓ (não é billing) |
| Média mensal | `prow.monthlyAverage` | `avgRT.monthlyAverage` | `getBeneficiaryConsumptionAverage(id)` | ✓ |
| Margem preventiva | `prow.preventiveMargin` | `ubRT.preventiveMargin` | `listBeneficiaryUnits()` | ✓ |
| Crédito alvo | `prow.targetCredit` | `monthlyAvg × (1 + margin)` | Calculado no visual | ✓ (não é billing) |
| Economia no mês | `invd.monthlySavings` | `invRT.monthlySavings` | `getBeneficiaryInvoice(id, month)` | ✓ |
| Economia acumulada | `ACCUM_SAVINGS[id]` | `ubRT.accumulatedSavings \|\| 0` | `listBeneficiaryUnits()` | ✓ se campo disponível |
| Saldo anterior | `invd.previousBalance` | `invRT.previousBalance` | `getBeneficiaryInvoice(id, month)` | ✓ |
| Créditos recebidos | `invd.receivedCredits` | `invRT.receivedCredits` | `getBeneficiaryInvoice(id, month)` | ✓ |
| Crédito rec. adicional | `prow.recommendedAdd` | `"—"` | Não disponível via Core | Limitação conhecida |
| Percentual de rateio | `prow.allocationPct` | `ubRT.allocationPct` | `listBeneficiaryUnits()` | ✓ |
| Histórico mensal | `MONTHS_AV.map(...)` | `histRT.map(...)` | `getBeneficiaryMonthlyHistory(id)` | ✓ |
| Detalhe do mês | `MONTH_FACTOR × dados demo` | `histRow.{consumptionKwh, origin, file, importedAt}` | `getBeneficiaryMonthlyHistory(id)` | Campos disponíveis do Core |
| Preço ESA | `ubdU.esaPrice` | `ubRT.esaPrice` | `listBeneficiaryUnits()` | ✓ |
| Nota média | `"5 meses confirmados"` | `hasSufficientHistory ? "confirmado" : "insuficiente"` | `getBeneficiaryConsumptionAverage(id)` | ✓ |

---

## Mapeamento — Wizard de UG (4 etapas)

| Etapa | Campo | Real mode |
|---|---|---|
| Identificação | Preenche a partir de `_rtUgs.find(id)` se editando | ✓ |
| Condição de compra | Campos manuais, igual ao demo | ✓ |
| Recebedor / PIX | Preenche a partir de `_rtUgDetail.payee` se já carregado | ✓ |
| Revisar + Confirmar | Chama `rt.createGeneratingUnit(input)` ou `rt.updateGeneratingUnit(id, input)` | ✓ Real persiste |

---

## Mapeamento — Wizard de UB (5 etapas)

| Etapa | Campo | Real mode |
|---|---|---|
| Identificação | Campos manuais | ✓ |
| Vinculação energética | UG dropdown usa `_rtUgs` | ✓ |
| Condições comerciais | Campos manuais | ✓ |
| Saldo inicial | `hasSufficientHistory` do Core via `_rtUbDetail.avg` | ✓ Real verifica histórico |
| Revisar + Confirmar | Chama `rt.createBeneficiaryUnit(input)` ou `rt.updateBeneficiaryUnit(id, input)` | ✓ Real persiste |

---

## Fluxo de Carregamento (modo real)

```
Navegação → "unidades" view
  └─ componentDidUpdate detecta view change
       └─ _loadRealUbs() → rt.listBeneficiaryUnits() → setState({ _rtUbs })

Clique em detalhe UG:
  └─ setState({ ugDetailId })
       └─ componentDidUpdate detecta ugDetailId change
            └─ _loadRealUgDetail(ugId):
                 ├─ rt.getGeneratingUnit(ugId)
                 ├─ rt.getGeneratingUnitPayee(ugId)
                 ├─ rt.listBeneficiaryUnits({ ugId })
                 └─ rt.getDashboardData({ month, ugId })
                 → setState({ _rtUgDetail: { ug, payee, bens, dash } })

Clique em detalhe UB:
  └─ setState({ ubDetailId })
       └─ componentDidUpdate detecta ubDetailId change
            └─ _loadRealUbDetail(ubId):
                 ├─ rt.getBeneficiaryUnit(ubId)
                 ├─ rt.getBeneficiaryInvoice(ubId, month)
                 ├─ rt.getBeneficiaryConsumptionAverage(ubId)
                 └─ rt.getBeneficiaryMonthlyHistory(ubId)
                 → setState({ _rtUbDetail: { ub, invoice, avg, history } })
```

---

## Limitações Conhecidas (Gate 3B)

| Limitação | Motivo | Impacto |
|---|---|---|
| Qtd. beneficiárias na lista de UGs = "—" | Core não retorna count na lista | Mostra "—" |
| Compensado/Saldo/Cobertura/Fatura/Eco na lista de UBs = "—" | Sem fatura por UB no endpoint de lista | Mostra "—" |
| Tab "Histórico" da UG vazio em real | Core não expõe histórico por UG | Lista vazia |
| Crédito recomendado adicional = "—" em real | Core não calcula `AllocationPlan.recommendedAdd` | Mostra "—" |
| Condição comercial: Vigência = "—" em real | Core não expõe validade de contrato | Mostra "—" |

---

## Arquivos Alterados

| Arquivo | Modificação |
|---|---|
| `energy-credits-v2.html` | Resolvers UG/UB lista+detalhe+wizards; novos state fields; _loadRealUbs/UgDetail/UbDetail; componentDidUpdate; openUgWiz/openUbWiz com real mode; ugWizNext/ubWizNext real API calls |
| `src/ui/energy-credits/direct-runtime/providers/esaRuntimeProvider.ts` | safeCall em listGeneratingUnits, listBeneficiaryUnits, getBeneficiaryConsumptionAverage, getBeneficiaryMonthlyHistory, getMonthlyTrend; monthlyAverage direto; getBeneficiaryInvoice catch-all |
| `src/ui/energy-credits/direct-runtime/tests/units-gate3b.manual-test.ts` | 7 suites (O–U), 81 asserções — todas passando |
| `docs/design-reference/energy-credits-claude-design/GATE-3B-UNITS-MAPPING.md` | Este documento |
