# DATA-CONTRACT-AUDIT — Energy Credits Direct Runtime

**Branch:** `core-v2`
**Data:** 2026-07-18
**Status:** GATE 2 — Contrato estabilizado, providers criados, bridge pronta

---

## Resumo

| Item | Status |
|---|---|
| Contrato de tipos (`types.ts`) | ✓ Completo |
| Interface do contrato (`EnergyCreditsRuntimeContract.ts`) | ✓ 42 membros |
| Demo provider (`demoRuntimeProvider.ts`) | ✓ Todos os dados extraídos do Project HTML |
| Real provider (`esaRuntimeProvider.ts`) | ✓ Skeleton com delega para provider-adapter |
| Bridge (`runtimeBridge.ts`) | ✓ IIFE — `window.ESA_ENERGY_CREDITS_RUNTIME` |
| Build config (`vite.bridge.config.ts`) | ✓ Output IIFE em `assets/energy-credits-runtime/bridge.js` |
| `energy-credits-v2.html` ajustado | ✓ Carrega bridge.js |

---

## Auditoria por Tela

### 1. Dashboard

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Geração total (kWh) | `aggregate(results).generation` | `DashboardData.current.generation` | Sim | `totalGenerationKwh` | `getExecutiveSummary` | — | Baixo |
| Energia compensada (kWh) | `aggregate(results).compensated` | `DashboardData.current.compensated` | Sim | `totalCompensatedKwh` | `getExecutiveSummary` | — | Baixo |
| Saldo atual (kWh) | `aggregate(results).balance` | `DashboardData.current.balance` | Sim | `totalCurrentBalanceKwh` | `getExecutiveSummary` | — | Baixo |
| Receita ESA (R$) | `aggregate(results).revenue` | `DashboardData.current.revenue` | Sim | `totalEsaRevenue` | `getExecutiveSummary` | — | Baixo |
| Repasse proprietário (R$) | `aggregate(results).ownerPayment` | `DashboardData.current.ownerPayment` | Sim | `totalOwnerReturn` | `getExecutiveSummary` | — | Baixo |
| Spread ESA (R$) | `aggregate(results).spread` | `DashboardData.current.spread` | Sim | `grossSpread` | `getExecutiveSummary` | — | Baixo |
| Alertas críticos | `CRITICAL[month]` | `DashboardData.criticalAlerts` | Sim | `criticalAlertCount` | `getExecutiveSummary` | — | Baixo |
| Trend gráfico (Receita, Repasse, Spread) | computado por mês | `TrendRow[]` | Sim | `getFinancialSummary` | `getMonthlyTrend` | Geracao, Consumo | Médio |
| Deltas MoM | computado | `AggregateMetrics.previous` | Não | N/D | Requer dois meses | N/D | Alto |
| Resultados por UG | `scaledResults()` | `SettlementResult[]` | Sim | N/D | Sem equivalente Core | Core não detalha por UG | Alto |

### 2. Unidades Geradoras

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Lista de UGs | `UGS` | `GeneratingUnit[]` | Sim | — | `listGeneratingUnits` | — | Baixo |
| Nome, proprietário, UC, distribuidora | `UGS[*]` | `GeneratingUnit` | Sim | — | `listGeneratingUnits` | — | Baixo |
| Status (ativa/manutencao) | `UGS[*].status` | `UGStatus` | Sim | — | `listGeneratingUnits` | — | Baixo |
| Preço de compra | `UGS[*].purchasePrice` | `number` | Sim | — | Core não expõe via search | `purchasePrice` ausente no search | Médio |
| Geração mensal | `UGS[*].monthlyGeneration` | `number` | Sim | — | Core não expõe via search | `monthlyGeneration` ausente | Médio |
| Saldo anterior | `UGS[*].previousBalance` | `number` | Sim | — | Core não expõe via search | `previousBalance` ausente | Médio |
| Destinatário pagamento (payee) | `PAYEES[ugId]` | `Payee` | Sim | — | `getSettlementRecipient` | — | Baixo |
| Preço histórico aplicado | `APPLIED_HIST[ugId][month]` | `number` | Sim | — | Sem equivalente Core | Core não persiste histórico de preço | Alto |

### 3. Unidades Beneficiárias

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Lista de UBs | `UBS` | `BeneficiaryUnit[]` | Sim | — | `listBeneficiaryUnits` | — | Baixo |
| Percentual de rateio, margem preventiva | `UBS[*]` | `BeneficiaryUnit` | Sim | — | `listBeneficiaryUnits` | Core pode não incluir | Médio |
| Saldo anterior de créditos | `UBS[*].previousCreditBalance` | `number` | Sim | — | `getBeneficiaryCreditBalance` | Requer chamada extra | Médio |
| Histórico mensal de consumo | `UB_HIST_*` | `MonthlyHistoryRow[]` | Sim | — | `getBeneficiaryHistory` | — | Baixo |
| Histórico de economia | `buildSavingsHistory()` | `SavingsHistoryRow[]` | Sim | — | `getBeneficiaryHistory` | — | Baixo |
| Média de consumo anual | `UBS[*].annualAverage` | `ConsumptionAverage` | Sim | — | `getBeneficiaryConsumptionAverage` | — | Baixo |
| Cliente desde | `UBS[*].customerSince` | `string` | Não | — | Sem equivalente Core | — | Baixo |
| Economia acumulada | `UBS[*].accumulatedSavings` | `number` | Não | — | Sem equivalente Core | — | Médio |

### 4. Apuração Mensal (Rateio)

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Plano de alocação (percentuais, saldos) | `computeAllocationPlan()` | `AllocationPlan` | Sim | — | `getAllocationPlan` | Core shape diferente | Alto |
| Total percentual rateio | `plan.totalPct` | `number` | Sim | — | Derivado | — | Médio |
| Crédito alvo, saldo final | Computed | `AllocationRow` | Sim | — | Core shape não mapeia diretamente | Mapeamento Gate 3 | Alto |
| Fechamento de ciclo | Ação | `MutationResult` | Sim | — | `closeMonthlySettlement` | Core não tem equivalente | Alto |

### 5. Fatura ESA — Beneficiário

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Fatura completa com cálculos | `buildInvoice()` | `BeneficiaryInvoice` | Sim | — | `getBeneficiaryMonthlyReport` | Shape pode diferir | Médio |
| Economia mensal / acumulada | Computed | `number` | Sim | — | Core inclui na fatura | — | Baixo |
| Status de pagamento | `UBS[*].paymentStatus` | `PaymentStatus` | Sim | — | Incluído no relatório | — | Baixo |

### 6. Importação de Dados

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Histórico de importações | `IMP_HISTORY` | `ImportHistoryRecord[]` | Sim | — | Sem equivalente Core | Core não expõe lista | Alto |
| Template CSV | Estático | `CsvTemplate` | Sim | — | `getCsvTemplate` | — | Baixo |
| Extração de fatura distribuidora | Simulação | `ExtractedBillData` | Sim | — | `createUtilityBillImport` | — | Baixo |
| Vinculação de fatura | Ação | `MutationResult` | Sim | — | `linkUtilityBillToBeneficiary` | — | Baixo |

### 7. Relatórios

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Relatório do proprietário | Computed | `OwnerReport` | Sim | — | `getOwnerMonthlyReport` | Shape pode diferir | Médio |
| Relatório interno | N/D no Core | `InternalReport` | Não | — | Sem equivalente | — | Baixo |
| Relatório financeiro | Computed | `FinancialReport` | Não | — | Sem equivalente direto | — | Médio |

### 8. Financeiro

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Faturas a receber | `scaledResults()` | `PaymentRecord[]` | Sim | — | Core não retorna lista | Somente totais via `getFinancialSummary` | Alto |
| Pagamentos ao proprietário | Computed | `PaymentRecord[]` | Sim | — | Sem equivalente lista | — | Alto |
| Confirmar / reopenar pagamento | Ações | `MutationResult` | Sim | — | `confirmInvoicePayment`, `reopenInvoicePayment` | — | Baixo |

### 9. Alertas

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Lista de alertas | `ALERTS` | `AlertRecord[]` | Sim | — | `getAlertsSummary` | Campos extendidos (impact, history) | Médio |
| Detalhe do alerta | Computed | `AlertRecord` | Sim | — | Sem lookup individual no Core | — | Médio |
| Ações (resolver, ignorar, em análise) | Ações | `MutationResult` | Sim | — | Sem equivalente Core | — | Alto |

### 10. Ciclos / Meses

| Dado exibido | Origem no HTML | Tipo contrato | Req? | Equivalente ESA OS | Método real disponível | Campos faltando no real | Risco Gate 3 |
|---|---|---|---|---|---|---|---|
| Lista de meses disponíveis | `MONTHS_AV` | `MonthOption[]` | Sim | — | Hardcoded (mesmos 5 meses) | — | Baixo |
| Status do ciclo | `MONTHS_AV[*].status` | `CycleStatus` | Sim | — | Derivado da lista | — | Baixo |

---

## Riscos Identificados para Gate 3

| Risco | Tela | Impacto | Mitigação |
|---|---|---|---|
| Core não expõe `SettlementResult[]` por UG | Dashboard | Alto — gráfico de barras por UG ficará vazio | Gate 3: calcular via listGeneratingUnits + beneficiaries |
| Core `AllocationPlan` shape incompatível | Apuração | Alto — tela de rateio vazia no modo real | Gate 3: mapear shape do Core para `AllocationRow[]` |
| Core não tem histórico de importações | Importação | Alto — lista sempre vazia no real | Gate 3: implementar na camada de aplicação ou persistir no Firestore |
| Core não expõe `PaymentRecord[]` por ciclo | Financeiro | Alto — tela financeira vazia | Gate 3: compor a partir dos relatórios por UB/UG |
| Core não tem lookup por alerta individual | Alertas | Médio — drawer de detalhe vazio | Gate 3: filtrar a lista por id |
| Campos `purchasePrice`, `monthlyGeneration` ausentes no search | UGs | Médio — cards de UG sem preço/geração | Gate 3: buscar via getGeneratingUnitSummary |
| Core não persiste histórico de preço aplicado | UGs | Alto — detalhe de ciclo sem histórico de preço | Gate 3: armazenar no Firestore ou Billing Engine |

---

## Arquivos Criados

| Arquivo | Descrição |
|---|---|
| `src/ui/energy-credits/direct-runtime/contracts/types.ts` | 40+ tipos cobrindo todos os 10 screens |
| `src/ui/energy-credits/direct-runtime/contracts/EnergyCreditsRuntimeContract.ts` | Interface com 42 membros |
| `src/ui/energy-credits/direct-runtime/providers/demoRuntimeProvider.ts` | Todos os dados extraídos do Project HTML |
| `src/ui/energy-credits/direct-runtime/providers/esaRuntimeProvider.ts` | Skeleton delegando ao provider-adapter |
| `src/ui/energy-credits/direct-runtime/bridge/runtimeBridge.ts` | Expõe `window.ESA_ENERGY_CREDITS_RUNTIME` |
| `src/ui/energy-credits/direct-runtime/vite.bridge.config.ts` | Build IIFE para `assets/energy-credits-runtime/bridge.js` |
| `src/ui/energy-credits/direct-runtime/tsconfig.json` | TypeScript config strict |
| `src/ui/energy-credits/direct-runtime/package.json` | Scripts: typecheck, build, test:contract |
| `src/ui/energy-credits/direct-runtime/tests/contract.manual-test.ts` | 5 suites, 50+ asserções |
| `docs/design-reference/energy-credits-claude-design/DATA-CONTRACT-AUDIT.md` | Este documento |

## Arquivos Modificados

| Arquivo | Modificação |
|---|---|
| `energy-credits-v2.html` | Adicionado `<script src="/assets/energy-credits-runtime/bridge.js">` após support.js |
