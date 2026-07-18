/**
 * energyCreditsProvider (mock)
 *
 * Camada mockada que simula os métodos que futuramente virão do ESA OS.
 * Componentes NÃO devem importar mockData diretamente para dados executivos —
 * devem passar por este provider. No futuro, a implementação será substituída
 * por chamadas a `window.ESA_OS`.
 */
import {
  generatingUnits,
  beneficiaryUnits,
  computeAll,
  computeAllocationPlan,
  buildInvoice,
  alerts,
  type Alert,
  type GeneratingUnit,
  type BeneficiaryUnit,
  type SettlementResult,
  type AllocationPlan,
  type BeneficiaryInvoice,
} from "./mockData";

export type CycleStatus = "aberto" | "em_apuracao" | "fechado";

export interface PeriodFilter {
  month: string; // "2026-07"
  ugId?: string; // undefined = todas
}

export interface KpiDelta {
  value: number;
  pct: number;
  direction: "up" | "down" | "flat";
}

export interface ExecutiveSummary {
  month: string;
  cycleStatus: CycleStatus;
  operational: {
    generatingUnits: { total: number; active: number };
    beneficiaryUnits: { total: number; active: number };
    generation: number;
    compensated: number;
    balance: number;
  };
  financial: {
    revenue: number;
    ownerPayment: number;
    spread: number;
    savings: number;
    criticalAlerts: number;
  };
  deltas: {
    generation: KpiDelta;
    compensated: KpiDelta;
    balance: KpiDelta;
    revenue: KpiDelta;
    ownerPayment: KpiDelta;
    spread: KpiDelta;
    savings: KpiDelta;
    criticalAlerts: KpiDelta;
  };
  results: SettlementResult[];
}

export const availableMonths = [
  { value: "2026-07", label: "Julho de 2026", status: "em_apuracao" as CycleStatus },
  { value: "2026-06", label: "Junho de 2026", status: "fechado" as CycleStatus },
  { value: "2026-05", label: "Maio de 2026", status: "fechado" as CycleStatus },
  { value: "2026-04", label: "Abril de 2026", status: "fechado" as CycleStatus },
  { value: "2026-03", label: "Março de 2026", status: "fechado" as CycleStatus },
];

// Fator determinístico por mês para simular variação sem refatorar mockData
const monthFactor: Record<string, number> = {
  "2026-07": 1.0,
  "2026-06": 0.92,
  "2026-05": 0.88,
  "2026-04": 0.83,
  "2026-03": 0.79,
};

const criticalByMonth: Record<string, number> = {
  "2026-07": 2,
  "2026-06": 3,
  "2026-05": 2,
  "2026-04": 4,
  "2026-03": 3,
};

function delta(current: number, previous: number): KpiDelta {
  if (previous === 0)
    return { value: current, pct: 0, direction: current > 0 ? "up" : "flat" };
  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;
  const direction: KpiDelta["direction"] =
    Math.abs(pct) < 0.5 ? "flat" : diff > 0 ? "up" : "down";
  return { value: diff, pct, direction };
}

function scaledResults(month: string, ugId?: string): SettlementResult[] {
  const factor = monthFactor[month] ?? 1;
  const all = computeAll();
  const filtered = ugId ? all.filter((r) => r.ug.id === ugId) : all;
  return filtered.map((r) => ({
    ...r,
    generation: r.generation * factor,
    available: r.available * factor,
    totalAllocated: r.totalAllocated * factor,
    totalCompensated: r.totalCompensated * factor,
    totalPending: r.totalPending * factor,
    currentBalance: r.currentBalance * factor,
    ownerPayment: r.ownerPayment * factor,
    esaRevenue: r.esaRevenue * factor,
    spread: r.spread * factor,
    rows: r.rows.map((row) => ({
      ...row,
      allocated: row.allocated * factor,
      compensated: row.compensated * factor,
      faturaEsa: row.faturaEsa * factor,
      economia: row.economia * factor,
    })),
  }));
}

function previousMonth(month: string): string | undefined {
  const idx = availableMonths.findIndex((m) => m.value === month);
  return availableMonths[idx + 1]?.value;
}

function aggregate(results: SettlementResult[]) {
  return {
    generation: results.reduce((s, r) => s + r.generation, 0),
    compensated: results.reduce((s, r) => s + r.totalCompensated, 0),
    balance: results.reduce((s, r) => s + r.currentBalance, 0),
    revenue: results.reduce((s, r) => s + r.esaRevenue, 0),
    ownerPayment: results.reduce((s, r) => s + r.ownerPayment, 0),
    spread: results.reduce((s, r) => s + r.spread, 0),
    savings: results.reduce(
      (s, r) => s + r.rows.reduce((a, x) => a + x.economia, 0),
      0,
    ),
  };
}

export const energyCreditsProvider = {
  listMonths() {
    return availableMonths;
  },

  getCycleStatus(month: string): CycleStatus {
    return availableMonths.find((m) => m.value === month)?.status ?? "aberto";
  },

  listGeneratingUnits(): GeneratingUnit[] {
    return generatingUnits;
  },

  listBeneficiaryUnits(): BeneficiaryUnit[] {
    return beneficiaryUnits;
  },

  getExecutiveSummary(filters: PeriodFilter): ExecutiveSummary {
    const results = scaledResults(filters.month, filters.ugId);
    const curr = aggregate(results);

    const prevMonth = previousMonth(filters.month);
    const prev = prevMonth
      ? aggregate(scaledResults(prevMonth, filters.ugId))
      : curr;

    const currCritical = criticalByMonth[filters.month] ?? 0;
    const prevCritical = prevMonth ? (criticalByMonth[prevMonth] ?? currCritical) : currCritical;

    const activeUgs = filters.ugId
      ? generatingUnits.filter((u) => u.id === filters.ugId && u.status === "ativa").length
      : generatingUnits.filter((u) => u.status === "ativa").length;

    const totalUgs = filters.ugId ? 1 : generatingUnits.length;

    const ubList = filters.ugId
      ? beneficiaryUnits.filter((b) => b.ugId === filters.ugId)
      : beneficiaryUnits;

    return {
      month: filters.month,
      cycleStatus: this.getCycleStatus(filters.month),
      operational: {
        generatingUnits: { total: totalUgs, active: activeUgs },
        beneficiaryUnits: {
          total: ubList.length,
          active: ubList.filter((u) => u.status === "ativa").length,
        },
        generation: curr.generation,
        compensated: curr.compensated,
        balance: curr.balance,
      },
      financial: {
        revenue: curr.revenue,
        ownerPayment: curr.ownerPayment,
        spread: curr.spread,
        savings: curr.savings,
        criticalAlerts: currCritical,
      },
      deltas: {
        generation: delta(curr.generation, prev.generation),
        compensated: delta(curr.compensated, prev.compensated),
        balance: delta(curr.balance, prev.balance),
        revenue: delta(curr.revenue, prev.revenue),
        ownerPayment: delta(curr.ownerPayment, prev.ownerPayment),
        spread: delta(curr.spread, prev.spread),
        savings: delta(curr.savings, prev.savings),
        criticalAlerts: delta(currCritical, prevCritical),
      },
      results,
    };
  },

  getGeneratingUnitSummary(id: string, filters: PeriodFilter) {
    const results = scaledResults(filters.month);
    const result = results.find((r) => r.ug.id === id);
    if (!result) return null;
    const ubs = beneficiaryUnits.filter((b) => b.ugId === id);
    return { result, ubs };
  },

  getBeneficiarySummary(id: string, filters: PeriodFilter) {
    const results = scaledResults(filters.month);
    for (const r of results) {
      const row = r.rows.find((x) => x.ub.id === id);
      if (row) return { row, ug: r.ug };
    }
    return null;
  },

  getFinancialSummary(filters: PeriodFilter) {
    const results = scaledResults(filters.month, filters.ugId);
    return aggregate(results);
  },

  /**
   * Regra conceitual do alerta LOW_BENEFICIARY_CREDIT_BALANCE.
   *
   * IMPORTANTE: o alerta NÃO deve ser gerado apenas a partir de
   * coverageMonths — os badges "Baixa/Adequada/Elevada" são apenas
   * classificação visual da cobertura. O alerta real depende de:
   *
   *   currentBalanceKwh + plannedCreditsReceivedKwh < targetCreditKwh
   *
   * Este helper deixa a regra explícita para futura integração com o
   * ESA OS e substitui qualquer heurística baseada só em cobertura.
   */
  shouldEmitLowBalanceAlert(input: {
    currentBalanceKwh: number;
    plannedCreditsReceivedKwh: number;
    targetCreditKwh: number;
  }): boolean {
    return (
      input.currentBalanceKwh + input.plannedCreditsReceivedKwh <
      input.targetCreditKwh
    );
  },

  getAlertsSummary(filters: PeriodFilter): Alert[] {
    return alerts.filter(
      (a) => a.month === filters.month && (!filters.ugId || a.unit === filters.ugId),
    );
  },

  getMonthlyTrend(filters: Pick<PeriodFilter, "ugId">) {
    return [...availableMonths]
      .reverse()
      .map((m) => {
        const agg = aggregate(scaledResults(m.value, filters.ugId));
        return {
          month: m.value,
          label: m.label.split(" ")[0].slice(0, 3),
          Receita: agg.revenue,
          Repasse: agg.ownerPayment,
          Spread: agg.spread,
          Geracao: agg.generation,
          Consumo: agg.compensated + agg.generation * 0.05,
        };
      });
  },

  // =========================================================================
  // Novos métodos — rateio, saldo por UB, fatura, destino dos créditos
  // =========================================================================

  getCreditAllocationPlan(
    generatingUnitId: string,
    _month: string,
    overrides?: Record<string, { allocationPct?: number; preventiveMargin?: number }>,
  ): AllocationPlan | null {
    const ug = generatingUnits.find((u) => u.id === generatingUnitId);
    if (!ug) return null;
    const ubs = beneficiaryUnits.filter((b) => b.ugId === generatingUnitId);
    return computeAllocationPlan(ug, ubs, overrides);
  },

  getAllocationPercentages(generatingUnitId: string, _month: string) {
    const ubs = beneficiaryUnits.filter((b) => b.ugId === generatingUnitId);
    return ubs.map((u) => ({ ubId: u.id, name: u.name, pct: u.allocationPct }));
  },

  getBeneficiaryConsumptionAverage(id: string) {
    const ub = beneficiaryUnits.find((u) => u.id === id);
    if (!ub) return null;
    return {
      annual: ub.annualAverage,
      monthly: ub.annualAverage / 12,
    };
  },

  getBeneficiaryCreditBalance(id: string, month: string) {
    const invoice = buildInvoice(id, month);
    if (!invoice) return null;
    return {
      previous: invoice.previousBalance,
      received: invoice.receivedCredits,
      compensated: invoice.compensated,
      final: invoice.finalBalance,
      coverageMonths:
        invoice.ub.monthlyConsumption > 0
          ? invoice.finalBalance / invoice.ub.monthlyConsumption
          : 0,
    };
  },

  getBeneficiarySavingsHistory(id: string, upToMonth = "2026-07") {
    const invoice = buildInvoice(id, upToMonth);
    return invoice?.savingsHistory ?? [];
  },

  getBeneficiaryInvoice(id: string, month: string) {
    const inv = buildInvoice(id, month);
    if (!inv) return null;

    const componentesTarifarios = [
      { label: "Créditos cobrados pela ESA", value: inv.faturaEsa },
      { label: "Impostos", value: inv.taxes },
      { label: "Iluminação Pública / CIP", value: inv.cip },
      { label: "Outros encargos", value: inv.otherCharges },
    ];

    const billingSnapshot = {
      contaConcessionaria: inv.totalWithoutEsa,
      contaEsa: inv.totalWithEsa,
      economiaMensal: inv.monthlySavings,
      economiaPercentual: inv.discountPct,
      economiaAnual: inv.monthlySavings * 12,
      componentesTarifarios,
      creditos: {
        previousBalanceKwh: inv.previousBalance,
        creditsReceivedKwh: inv.receivedCredits,
        creditsCompensatedKwh: inv.compensated,
        finalBalanceKwh: inv.finalBalance,
        consumptionKwh: inv.consumption,
      },
      calculationSource: "legacy-copel-calculator" as const,
    };

    const creditBalance = {
      previousBalanceKwh: inv.previousBalance,
      creditsReceivedKwh: inv.receivedCredits,
      creditsCompensatedKwh: inv.compensated,
      currentBalanceKwh: inv.finalBalance,
      coverageMonths:
        inv.ub.monthlyConsumption > 0
          ? inv.finalBalance / inv.ub.monthlyConsumption
          : 0,
    };

    const settlementRecipient = {
      recipientName: inv.ug.payee.name,
      recipientDocument: inv.ug.payee.document,
      pixKey: inv.ug.payee.pixKey,
      pixKeyType: inv.ug.payee.pixType,
    };

    return {
      raw: inv,
      billingSnapshot,
      creditBalance,
      settlementRecipient,
      beneficiarySavingsHistory: inv.savingsHistory.map((h) => ({
        referenceMonth: h.month,
        label: h.label,
        billWithoutEsa: inv.totalWithoutEsa,
        billWithEsa: inv.totalWithEsa,
        monthlySavings: h.monthly,
        savingsPercentage: inv.discountPct,
        accumulatedSavings: h.cumulative,
      })),
    };
  },

  getBeneficiaryCreditBalanceHistory(id: string, filters: { month: string }) {
    const ub = beneficiaryUnits.find((u) => u.id === id);
    if (!ub) return [];
    // gera histórico sintético dos últimos 6 meses
    const months = [...availableMonths].reverse();
    let balance = ub.previousCreditBalance * 0.6;
    return months.map((m) => {
      const factor = monthFactor[m.value] ?? 1;
      const received = ub.annualAverage / 12 * ub.allocationPct * factor * 2;
      const compensated = ub.monthlyConsumption * factor * 0.98;
      balance = Math.max(0, balance + received - compensated);
      return {
        month: m.value,
        label: m.label.split(" ")[0].slice(0, 3),
        currentBalanceKwh: balance,
        creditsReceivedKwh: received,
        creditsCompensatedKwh: compensated,
      };
    });
  },

  getGeneratingUnitCycleSummary(id: string, filters: PeriodFilter) {
    const ug = generatingUnits.find((u) => u.id === id);
    if (!ug) return null;
    const plan = this.getCreditAllocationPlan(id, filters.month);
    if (!plan) return null;
    return {
      ug,
      month: filters.month,
      cycleStatus: this.getCycleStatus(filters.month),
      generationKwh: plan.generation,
      totalRecommendedKwh: plan.totalRecommended,
      totalPlannedKwh: plan.totalProjected,
      totalReceivedKwh: plan.totalProjected,
      totalCompensatedKwh: plan.totalCompensated,
      totalFinalBalanceKwh: plan.totalFinalBalance,
      beneficiariesCount: plan.rows.length,
      allocationPercentageTotal: plan.totalPct,
    };
  },

  getGeneratingUnitCreditDestinationReport(id: string, month: string) {
    const plan = this.getCreditAllocationPlan(id, month);
    if (!plan) return null;
    return {
      ug: plan.ug,
      month,
      generation: plan.generation,
      totalDistributed: plan.totalProjected,
      totalConsumed: plan.totalConsumption,
      totalCompensated: plan.totalCompensated,
      totalAccumulatedBalance: plan.totalFinalBalance,
      beneficiariesCount: plan.rows.length,
      ownerPayment: plan.ownerPayment,
      rows: plan.rows.map((r) => ({
        ub: r.ub,
        allocationPct: r.allocationPercentage,
        received: r.creditsReceivedKwh,
        consumption: r.monthlyConsumptionKwh,
        compensated: r.creditsCompensatedKwh,
        previousBalance: r.previousBalanceKwh,
        finalBalance: r.finalBalanceKwh,
        coverageMonths: r.coverageMonths,
      })),
    };
  },
  // =========================================================================
  // Novos métodos operacionais (mock)
  // =========================================================================

  createGeneratingUnit(input: Record<string, unknown>) {
    return { id: (input.id as string) ?? `UG-${Date.now()}`, ok: true, mock: true };
  },

  updateGeneratingUnit(id: string, _input: Record<string, unknown>) {
    return { id, ok: true, mock: true };
  },

  createBeneficiaryUnit(input: Record<string, unknown>) {
    return { id: (input.id as string) ?? `UB-${Date.now()}`, ok: true, mock: true };
  },

  updateBeneficiaryUnit(id: string, _input: Record<string, unknown>) {
    return { id, ok: true, mock: true };
  },

  getGeneratingUnitCommercialTerms(id: string) {
    const ug = generatingUnits.find((u) => u.id === id);
    if (!ug) return null;
    return {
      purchasePricePerKwh: ug.purchasePrice,
      effectiveDate: "2026-01-01",
      lastAppliedPricePerKwh: ug.purchasePrice,
      lastAppliedMonth: "2026-07",
      observation: "Valor padrão utilizado para cálculo do repasse ao proprietário.",
    };
  },

  getSettlementRecipient(generatingUnitId: string) {
    const ug = generatingUnits.find((u) => u.id === generatingUnitId);
    if (!ug) return null;
    return {
      recipientName: ug.payee.name,
      recipientDocument: ug.payee.document,
      pixKey: ug.payee.pixKey,
      pixKeyType: ug.payee.pixType,
    };
  },

  confirmInvoicePayment(
    invoiceId: string,
    payment: { paidAt: string; amount: number; note?: string },
  ) {
    return { invoiceId, paymentStatus: "paid" as const, paidAt: payment.paidAt, mock: true };
  },

  reopenInvoicePayment(invoiceId: string) {
    return { invoiceId, paymentStatus: "open" as const, mock: true };
  },

  confirmOwnerSettlementPayment(
    settlementId: string,
    payment: { paidAt: string; amount: number; note?: string },
  ) {
    return {
      settlementId,
      paymentStatus: "paid" as const,
      paidAt: payment.paidAt,
      mock: true,
    };
  },

  getCsvTemplate(importType: "ug" | "ub" | "rug" | "rub") {
    const templates: Record<string, { filename: string; headers: string[]; example: string }> = {
      ug: {
        filename: "modelo-unidades-geradoras.csv",
        headers: [
          "id",
          "nome",
          "proprietario",
          "documento",
          "unidadeConsumidora",
          "distribuidora",
          "status",
        ],
        example:
          "id;nome;proprietario;documento;unidadeConsumidora;distribuidora;status\nug-assai;UG Solar Assaí;João Pereira;12345678900;123456789;Copel;active",
      },
      ub: {
        filename: "modelo-unidades-beneficiarias.csv",
        headers: [
          "id",
          "unidadeGeradoraId",
          "nome",
          "documento",
          "unidadeConsumidora",
          "distribuidora",
          "status",
        ],
        example:
          "id;unidadeGeradoraId;nome;documento;unidadeConsumidora;distribuidora;status\nub-001;ug-assai;Mercado Central;12222333000144;111222333;Copel;active",
      },
      rug: {
        filename: "modelo-registros-mensais-ug.csv",
        headers: [
          "id",
          "unidadeGeradoraId",
          "mesReferencia",
          "saldoAnteriorKwh",
          "geracaoMensalKwh",
          "precoCompraKwh",
          "status",
        ],
        example:
          "id;unidadeGeradoraId;mesReferencia;saldoAnteriorKwh;geracaoMensalKwh;precoCompraKwh;status\nugm-ug-assai-2026-07;ug-assai;2026-07;2500;13000;0,35;review",
      },
      rub: {
        filename: "modelo-registros-mensais-ub.csv",
        headers: [
          "id",
          "unidadeBeneficiariaId",
          "unidadeGeradoraId",
          "mesReferencia",
          "consumoMensalKwh",
          "creditosAlocadosKwh",
          "creditosCompensadosKwh",
          "precoEsaKwh",
          "tarifaDistribuidoraKwh",
          "statusPagamento",
        ],
        example:
          "id;unidadeBeneficiariaId;unidadeGeradoraId;mesReferencia;consumoMensalKwh;creditosAlocadosKwh;creditosCompensadosKwh;precoEsaKwh;tarifaDistribuidoraKwh;statusPagamento\nubm-ub-001-2026-07;ub-001;ug-assai;2026-07;3950;4199;3950;0,55;0,85;paid",
      },
    };
    return templates[importType];
  },

  simulateUtilityBillExtraction(
    _file: { name: string; size?: number } | null,
    scenario: "matched" | "unmatched" | "duplicate" = "matched",
  ) {
    const ub = beneficiaryUnits[0];
    const ug = generatingUnits.find((g) => g.id === ub.ugId)!;
    const base = {
      extractionId: `EXT-${Date.now()}`,
      confidence: "review" as "high" | "review" | "unknown",
      fileName: _file?.name ?? "conta-copel-jul-2026.pdf",
      referenceMonth: "2026-07",
      teValue: 320.4,
      tusdValue: 512.75,
      fioB: 88.9,
      flagValue: 12.5,
      minimumBillableKwh: 30,
      scenario,
    };
    if (scenario === "unmatched") {
      return {
        ...base,
        confidence: "unknown" as const,
        utilityConsumerUnit: "999888777",
        beneficiaryUnitId: null as string | null,
        beneficiaryName: "PADARIA NOVO HORIZONTE LTDA",
        beneficiaryDocument: "31.222.444/0001-90",
        distributor: "Copel",
        consumptionKwh: 2840,
        cipValue: 24.5,
        taxesValue: 380.15,
        totalBillValue: 2840 * 0.85 + 380.15 + 24.5,
      };
    }
    return {
      ...base,
      confidence: scenario === "duplicate" ? "high" as const : "high" as const,
      utilityConsumerUnit: ub.uc,
      beneficiaryUnitId: ub.id,
      beneficiaryName: ub.name,
      beneficiaryDocument: ub.document,
      distributor: ug.distributor,
      consumptionKwh: scenario === "duplicate" ? ub.monthlyConsumption + 180 : ub.monthlyConsumption,
      cipValue: ub.cip,
      taxesValue: scenario === "duplicate" ? ub.taxes + 22.4 : ub.taxes,
      totalBillValue:
        (scenario === "duplicate" ? ub.monthlyConsumption + 180 : ub.monthlyConsumption) *
          ub.distributorTariff +
        ub.taxes +
        ub.cip,
    };
  },

  confirmUtilityBillExtraction(extractionId: string, _correctedData: unknown) {
    return { extractionId, ok: true, mock: true };
  },

  // =========================================================================
  // Fatura da distribuidora → Beneficiária / Registros mensais (mock)
  // =========================================================================

  matchUtilityBillToBeneficiary(extracted: {
    utilityConsumerUnit: string;
    distributor?: string;
  }) {
    const ub = beneficiaryUnits.find((u) => u.uc === extracted.utilityConsumerUnit);
    if (!ub) return { matched: false as const };
    const ug = generatingUnits.find((g) => g.id === ub.ugId);
    return {
      matched: true as const,
      beneficiaryUnitId: ub.id,
      beneficiaryName: ub.name,
      beneficiaryDocument: ub.document,
      uc: ub.uc,
      distributor: ub.distributor,
      generatingUnitId: ub.ugId,
      generatingUnitName: ug?.name ?? "—",
    };
  },

  getUnlinkedUtilityBills() {
    return [] as Array<{
      extractionId: string;
      fileName: string;
      utilityConsumerUnit: string;
      referenceMonth: string;
      importedAt: string;
    }>;
  },

  linkUtilityBillToBeneficiary(extractionId: string, beneficiaryUnitId: string) {
    return { extractionId, beneficiaryUnitId, ok: true, mock: true };
  },

  prepareBeneficiaryFromUtilityBill(extractionId: string) {
    return {
      extractionId,
      prefill: {
        name: "",
        document: "",
        uc: "",
        distributor: "",
      },
      mock: true,
    };
  },

  confirmBeneficiaryMonthlyRecordFromUtilityBill(
    extractionId: string,
    correctedData: {
      beneficiaryUnitId: string;
      referenceMonth: string;
      consumptionKwh: number;
    },
  ) {
    return {
      extractionId,
      beneficiaryUnitId: correctedData.beneficiaryUnitId,
      referenceMonth: correctedData.referenceMonth,
      recordId: `UBM-${correctedData.beneficiaryUnitId}-${correctedData.referenceMonth}`,
      status: "confirmado" as const,
      source: "utility_bill_import" as const,
      mock: true,
    };
  },

  getBeneficiaryMonthlyHistory(beneficiaryUnitId: string) {
    const ub = beneficiaryUnits.find((u) => u.id === beneficiaryUnitId);
    const baseConsumption = ub?.monthlyConsumption ?? 3800;
    const rows = [
      {
        month: "2026-07",
        label: "Jul/2026",
        consumptionKwh: Math.round(baseConsumption),
        source: "utility_bill_import" as const,
        sourceLabel: "Fatura importada",
        fileName: "conta-copel-jul-2026.pdf",
        importedAt: "2026-07-08",
        status: "confirmado" as const,
        includedInAverage: true,
      },
      {
        month: "2026-06",
        label: "Jun/2026",
        consumptionKwh: Math.round(baseConsumption * 0.965),
        source: "csv_import" as const,
        sourceLabel: "CSV",
        fileName: "ubm-2026-06.csv",
        importedAt: "2026-06-05",
        status: "confirmado" as const,
        includedInAverage: true,
      },
      {
        month: "2026-05",
        label: "Mai/2026",
        consumptionKwh: Math.round(baseConsumption * 1.04),
        source: "manual_entry" as const,
        sourceLabel: "Manual",
        fileName: null,
        importedAt: "2026-05-03",
        status: "confirmado" as const,
        includedInAverage: true,
      },
    ];
    return rows;
  },

  getBeneficiaryMonthlyRecord(beneficiaryUnitId: string, referenceMonth: string) {
    const ub = beneficiaryUnits.find((u) => u.id === beneficiaryUnitId);
    if (!ub) return null;
    return {
      beneficiaryUnitId,
      referenceMonth,
      utilityConsumerUnit: ub.uc,
      consumptionKwh: ub.monthlyConsumption,
      teValue: 320.4,
      tusdValue: 512.75,
      fioB: 88.9,
      flagValue: 12.5,
      cipValue: ub.cip,
      taxesValue: ub.taxes,
      minimumBillableKwh: 30,
      totalBillValue:
        ub.monthlyConsumption * ub.distributorTariff + ub.taxes + ub.cip,
      fileName: "conta-copel-jul-2026.pdf",
      importedAt: "2026-07-08",
      source: "utility_bill_import" as const,
    };
  },

  compareUtilityBillWithExistingRecord(
    _extractionId: string,
    existing: { consumptionKwh: number; teValue: number; tusdValue: number; fioB: number; flagValue: number; cipValue: number; taxesValue: number; totalBillValue: number },
    incoming: { consumptionKwh: number; teValue: number; tusdValue: number; fioB: number; flagValue: number; cipValue: number; taxesValue: number; totalBillValue: number },
  ) {
    const diff = (a: number, b: number) => +(b - a).toFixed(2);
    return {
      fields: [
        { label: "Consumo (kWh)", current: existing.consumptionKwh, incoming: incoming.consumptionKwh, delta: diff(existing.consumptionKwh, incoming.consumptionKwh) },
        { label: "TE", current: existing.teValue, incoming: incoming.teValue, delta: diff(existing.teValue, incoming.teValue) },
        { label: "TUSD", current: existing.tusdValue, incoming: incoming.tusdValue, delta: diff(existing.tusdValue, incoming.tusdValue) },
        { label: "Fio B", current: existing.fioB, incoming: incoming.fioB, delta: diff(existing.fioB, incoming.fioB) },
        { label: "Bandeira", current: existing.flagValue, incoming: incoming.flagValue, delta: diff(existing.flagValue, incoming.flagValue) },
        { label: "CIP", current: existing.cipValue, incoming: incoming.cipValue, delta: diff(existing.cipValue, incoming.cipValue) },
        { label: "Impostos", current: existing.taxesValue, incoming: incoming.taxesValue, delta: diff(existing.taxesValue, incoming.taxesValue) },
        { label: "Valor total", current: existing.totalBillValue, incoming: incoming.totalBillValue, delta: diff(existing.totalBillValue, incoming.totalBillValue) },
      ],
    };
  },

  replaceBeneficiaryMonthlyRecordFromUtilityBill(
    extractionId: string,
    reason: string,
  ) {
    return {
      extractionId,
      status: "replaced" as const,
      reason,
      replacedAt: new Date().toISOString(),
      mock: true,
    };
  },

  getBeneficiaryAverageComposition(beneficiaryUnitId: string) {
    const history = this.getBeneficiaryMonthlyHistory(beneficiaryUnitId);
    const considered = history.filter((h) => h.includedInAverage);
    const bySource = considered.reduce(
      (acc, r) => {
        acc[r.source] = (acc[r.source] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const avg =
      considered.reduce((s, r) => s + r.consumptionKwh, 0) /
      Math.max(1, considered.length);
    return {
      monthsConsidered: considered.length,
      monthlyAverageKwh: Math.round(avg),
      bySource: {
        utility_bill_import: bySource.utility_bill_import ?? 0,
        csv_import: bySource.csv_import ?? 0,
        manual_entry: bySource.manual_entry ?? 0,
      },
    };
  },

  getBeneficiaryMonthlyDataSources(beneficiaryUnitId: string) {
    return this.getBeneficiaryMonthlyHistory(beneficiaryUnitId).map((r) => ({
      month: r.month,
      label: r.label,
      source: r.source,
      file: r.fileName,
      beneficiaryUnitId,
    }));
  },
};



export type {
  Alert,
  GeneratingUnit,
  BeneficiaryUnit,
  SettlementResult,
  AllocationPlan,
  BeneficiaryInvoice,
};
