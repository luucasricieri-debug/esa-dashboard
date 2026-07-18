# Gate 3D — Financial & Reports Runtime Mapping

## Scope

Connects the following screens to real provider data in `?runtime=real` mode:

| Screen | State aggregate | Loader |
|---|---|---|
| Relatório do Proprietário | `_rtRepAll` | `_loadRealReports(ugId, month)` |
| Relatório Interno ESA | `_rtRepAll` | `_loadRealReports(ugId, month)` |
| Relatório Financeiro ESA | `_rtRepAll` | `_loadRealReports(ugId, month)` |
| Tela Financeiro (KPIs, faturas, repasses) | `_rtFinAll` | `_loadRealFin(month)` |
| Modais de pagamento / reabertura | `_rtFinAll` | — (reads from loaded aggregate) |
| Drawer detalhe financeiro | `_rtFinAll` | — (reads from loaded aggregate) |

**Not connected (per spec):** Importação CSV/Fatura, tela completa de Alertas.

---

## State fields added (Gate 3D)

```javascript
// energy-credits-v2.html — initial state
_rtRepAll: null,           // { ownerReport, ug, payee, ugs, ubs, alerts, execDash, allocationPlan, ubInvoices, ugOwnerReports, ugAllocationPlans, ugPayees }
_rtRepAllLoading: false,
_rtFinAll: null,           // { ugs, ubs, ubInvoices, ugPayees, ugOwnerReports, trend }
_rtFinAllLoading: false,
```

---

## `_rtRepAll` shape

| Field | Source | Provider method |
|---|---|---|
| `ownerReport` | Owner report for selected UG + month | `rt.getOwnerReport(ugId, month)` |
| `ug` | Selected UG object | `rt.getGeneratingUnit(ugId)` |
| `payee` | Payee for selected UG | `rt.getGeneratingUnitPayee(ugId)` |
| `ugs` | All generating units | `rt.listGeneratingUnits()` |
| `ubs` | All beneficiary units | `rt.listBeneficiaryUnits()` |
| `alerts` | Alerts for month | `rt.listAlerts({ month })` |
| `execDash` | Executive dashboard (canonical balance) | `rt.getDashboardData({ month })` |
| `allocationPlan` | Allocation plan for selected UG + month | `rt.getAllocationPlan(ugId, month, {})` |
| `ubInvoices[ubId]` | Invoice per UB | `rt.getBeneficiaryInvoice(ub.id, month)` |
| `ugOwnerReports[ugId]` | Owner report per UG | `rt.getOwnerReport(g.id, month)` |
| `ugAllocationPlans[ugId]` | Allocation plan per UG | `rt.getAllocationPlan(g.id, month, {})` |
| `ugPayees[ugId]` | Payee per UG | `rt.getGeneratingUnitPayee(g.id)` |

---

## `_rtFinAll` shape

| Field | Source | Provider method |
|---|---|---|
| `ugs` | All generating units | `rt.listGeneratingUnits()` |
| `ubs` | All beneficiary units | `rt.listBeneficiaryUnits()` |
| `ubInvoices[ubId]` | Invoice per UB | `rt.getBeneficiaryInvoice(ub.id, month)` |
| `ugPayees[ugId]` | Payee per UG | `rt.getGeneratingUnitPayee(g.id)` |
| `ugOwnerReports[ugId]` | Owner report per UG | `rt.getOwnerReport(g.id, month)` |
| `trend` | Monthly trend | `rt.getMonthlyTrend({})` |

---

## Saldo Canônico

The canonical balance (`riSaldoUcs`) in Relatório Interno must come from a single source:

```javascript
// CORRECT — Gate 3D real mode:
const riSaldoUcs = (ra && ra.execDash && ra.execDash.current)
  ? (ra.execDash.current.balance || 0)
  : 0;

// WRONG — never compute from individual invoice sums in real mode:
// const riSaldoUcs = this.UBS.reduce((s, ub) => s + this.buildInvoice(ub.id, repMonth).finalBalance, 0)
```

---

## Repasse value source

`ownerPayment` must come from `ownerReport.ownerPayment` returned by Core — never re-calculated in HTML:

```javascript
// CORRECT:
amount: or ? (or.ownerPayment || 0) : 0

// WRONG — Gate 3D spec prohibits:
// amount: comp * price  (re-calculation in HTML)
```

---

## Payment mutations

| Method | Core ok:false | Core ok:true |
|---|---|---|
| `confirmInvoicePayment` | `{ ok: false, persisted: false, capability: 'rejected', message: core.message }` | `{ ok: true }` |
| `reopenInvoicePayment` | `{ ok: false, persisted: false, capability: 'rejected', message: core.message }` | `{ ok: true }` |
| `confirmOwnerPayment` | `{ ok: false, persisted: false, capability: 'rejected', message: core.message }` | `{ ok: true }` |

After successful payment confirmation or reopening, `_loadRealFin(finMonth)` is called to reload the data.

Repasse reopen (`rm.kind === "rep"`) always shows "Reabertura indisponível" without calling Core.

---

## `getOwnerReport` field mapping

Core may return different field names depending on version. The provider uses `??` fallback chains:

| OwnerReport field | Core field variants |
|---|---|
| `ugId` | `generatingUnitId` / `ugId` |
| `ugName` | `ugName` / `name` |
| `month` | `referenceMonth` / `month` |
| `totalCompensated` | `totalCompensatedKwh` / `totalCompensated` |
| `ownerPayment` | `ownerReturn` / `ownerPayment` |
| `beneficiaryBreakdown` | `beneficiaries` / `beneficiaryBreakdown` |
| `payee` | `payee` / `recipient` |
| `payee.document` | `document` / `cpf` / `cnpj` |
| `payee.pixKey` | `pixKey` / `pix` |
| `payee.pixType` | `pixType` / `type` |

---

## Invariants (Gate 3D)

- `?runtime=real`: never show UG-001 or UB-001 demo IDs
- `?runtime=real`: no MONTH_FACTOR applied (`finF = 1`, `repF = 1`)
- `?runtime=real`: no mock data, no projections, no demo scaling
- Stale guard: sequence counters `_repSeq` and `_finSeq` prevent race conditions
- Demo mode (`_rtMode !== "real"`): all existing behavior preserved unchanged

---

## Test file

`src/ui/energy-credits/direct-runtime/tests/financial-gate3d.manual-test.ts`

Suites AR–AZ: 58 assertions, 0 failures.
