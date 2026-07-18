# Gate 3E — Imports & Alerts Runtime Mapping

## Scope

Connects the following screens to real provider data in `?runtime=real` mode:

| Screen | State / Source | Loader |
|---|---|---|
| Importar Fatura | `rt.extractUtilityBill`, `rt.confirmBillExtraction` | On impStart click |
| Importar CSV (template) | `rt.getCsvTemplate(type)` | Already connected (Gate 3B) |
| Link bill → UB | `rt.linkBillToBeneficiary(extractionId, ubId)` | On impLinkConfirm click |
| Substituir dados | `rt.replaceBillData` → `capability: not_available` | On impConfirmReplace click |
| Histórico de importações | `rt.getImportHistory()` → `[]` (honest empty) | Inline in render |
| Alertas (lista) | `_rtAlData` | `_loadRealAlerts(alMonth)` |
| Alerta drawer/detalhe | `_rtAlData` | — (reads from loaded list) |
| Resolução de alerta | `rt.resolveAlert` → `capability: not_available` | On aldConfirmNote click |
| Ignorar alerta | `rt.ignoreAlert` → `capability: not_available` | On aldConfirmNote click |
| Alerta em análise | `rt.markAlertInAnalysis` → `capability: not_available` | On aldMarkAnalise click |

---

## State fields added (Gate 3E)

```javascript
// energy-credits-v2.html — initial state
_rtAlData: null,        // AlertRecord[] loaded for alMonth
_rtAlLoading: false,
```

---

## `_loadRealAlerts(month)` method

Uses `_alSeq` stale guard (prevents race conditions on rapid month changes):

```javascript
_loadRealAlerts(month) {
  const rt = window.ESA_ENERGY_CREDITS_RUNTIME;
  if (!rt || rt.mode !== "real") return;
  this._alSeq = (this._alSeq || 0) + 1;
  const seq = this._alSeq;
  this.setState({ _rtAlLoading: true, _rtAlData: null });
  rt.listAlerts({ month }).then((alerts) => {
    if (seq !== this._alSeq) return;
    this.setState({ _rtAlData: alerts || [], _rtAlLoading: false });
  }).catch(() => this.setState({ _rtAlLoading: false }));
}
```

Triggered by:
- Entering `alertas` view (`prevState.view !== "alertas"`)
- `alMonth` change while in `alertas` view

---

## OCR capability

`rt.extractUtilityBill()` calls `uiProvider.createUtilityBillImport()` which currently returns `null` from Core.

| Result | UI behavior |
|---|---|
| `null` | Reset to `impPhase: "idle"` + toast "OCR não conectado — Extração automática indisponível no runtime atual." |
| `{ ... }` (data) | Set `impPhase` based on `isDuplicate`/`ucMatched`, set `impData` |

In real mode: `impHistory = []` (Core has no history API).

---

## Alert mutation honesty table

| Method | Returns |
|---|---|
| `resolveAlert(id, note)` | `{ ok: false, persisted: false, capability: 'not_available', message: 'Resolução de alerta indisponível: persistência ainda não habilitada.' }` |
| `ignoreAlert(id, note)` | `{ ok: false, persisted: false, capability: 'not_available', message: 'Ignorar alerta indisponível: persistência ainda não habilitada.' }` |
| `markAlertInAnalysis(id, note)` | `{ ok: false, persisted: false, capability: 'not_available', message: 'Alteração de status de alerta indisponível: persistência ainda não habilitada.' }` |
| `replaceBillData(extractionId, reason)` | `{ ok: false, persisted: false, capability: 'not_available', message: 'Substituição de registro não disponível no runtime atual.' }` |

None of these alter local state or set `alertOv` in real mode.

---

## `getAlertDetail` implementation

Core has no single-alert endpoint. The provider derives it from `listAlerts`:

```typescript
async getAlertDetail(id: string): Promise<AlertRecord | null> {
  const d = unwrap(uiProvider.getAlertsSummary({})) as any;
  const all: AlertRecord[] = (d?.alerts ?? []) as AlertRecord[];
  return all.find((a) => a.id === id) ?? null;
},
```

---

## Alert drawer data mapping (real mode)

| `alVals` field | Source |
|---|---|
| `aldTitle` | `alA.title ?? ALERT_TITLES[alA.code] ?? alA.code` |
| `aldRows[3]` (Valor detectado) | `alA.detectedValue \|\| "—"` |
| `aldRows[4]` (Limite esperado) | `alA.threshold \|\| "—"` |
| `aldImpact` | `alA.impact \|\| alA.message` |
| `aldHist` | `alA.history.map(h => ({ at: h.at, label: h.label }))` |
| `aldSt` | Derived from `alA.status` via `AL_STATUS_META` |
| `aldCanAnalise` | `alA.status === "ativo"` |
| `aldCanResolve` | `alA.status === "ativo" \|\| alA.status === "em_analise"` |

---

## Nav badge (alertas)

```javascript
// Real mode: count from _rtAlData (alerts screen data)
S._rtMode === "real"
  ? (S._rtAlData || []).filter(a => ["ativo", "em_analise"].includes(a.status)).length
  : this.ALERTS.filter(a => ["ativo", "em_analise"].includes(this.alertState(a.id).status)).length
```

---

## Import flow: real mode UB/UG source

```javascript
// Real mode: use _rtUbs / _rtUgs — no UB-001/UG-001 fallback
impUb = _rtUbsSrc.find(u => u.id === S.impUbId) || _rtUbsSrc[0] || { id: "", name: "—", ... }
impUg = (S._rtUgs || []).find(g => g.id === impUb.ugId) || { id: "", name: "—" }

// UB link dropdown: real UBs only
impUbOptions: (S._rtUbs || []).map(u => ({ value: u.id, label: u.name + " · UC " + (u.uc || "—") }))
```

---

## Invariants (Gate 3E)

- `?runtime=real`: never show UG-001 or UB-001 demo IDs
- `?runtime=real`: `impHistory` is always `[]` (Core has no history API)
- `?runtime=real`: OCR result `null` → back to `idle`, show toast, no demo data shown
- `?runtime=real`: alert mutations never call `setAlertStatus` (no local state mutation)
- `?runtime=real`: alert mutations show `capability: not_available` message, never `ok: true`
- Stale guard: `_alSeq` prevents race conditions in alert loading
- Demo mode: all existing `ALERTS`, `alertState`, `setAlertStatus`, `IMP_HISTORY`, `impExtract` behavior preserved unchanged

---

## Test file

`src/ui/energy-credits/direct-runtime/tests/imports-alerts-gate3e.manual-test.ts`

Suites BA–BL: 58 assertions, 0 failures.
