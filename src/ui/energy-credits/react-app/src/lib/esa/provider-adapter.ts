/**
 * ESA OS — Energy Credits React App
 * Provider Adapter
 *
 * Bridges the Lovable UI provider API → EnergyCreditsUIProvider (UIResult).
 * No financial formulas (no scaledResults, aggregate, etc.).
 * Maps method calls and unwraps UIResult<T> → T.
 */
import type { EsaProvider } from './EsaProviderContext';
import type {
  GeneratingUnit,
  BeneficiaryUnit,
  Alert,
  SettlementResult,
  AllocationPlan,
  ExecutiveSummary,
  FinancialSummary,
  TrendRow,
  PeriodFilter,
  MonthOption,
  CycleStatus,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(result: any): any {
  if (!result || !result.ok || result.data == null) return null;
  return result.data;
}

const AVAILABLE_MONTHS: MonthOption[] = [
  { value: '2026-07', label: 'Julho de 2026', status: 'em_apuracao' },
  { value: '2026-06', label: 'Junho de 2026', status: 'fechado' },
  { value: '2026-05', label: 'Maio de 2026', status: 'fechado' },
  { value: '2026-04', label: 'Abril de 2026', status: 'fechado' },
  { value: '2026-03', label: 'Março de 2026', status: 'fechado' },
];

function flatDelta() {
  return { value: 0, pct: 0, direction: 'flat' as const };
}

function emptyExecutiveSummary(month: string): ExecutiveSummary {
  const zeroKpi = flatDelta();
  return {
    month,
    cycleStatus: 'aberto',
    operational: { generatingUnits: { total: 0, active: 0 }, beneficiaryUnits: { total: 0, active: 0 }, generation: 0, compensated: 0, balance: 0 },
    financial: { revenue: 0, ownerPayment: 0, spread: 0, savings: 0, criticalAlerts: 0 },
    deltas: { generation: zeroKpi, compensated: zeroKpi, balance: zeroKpi, revenue: zeroKpi, ownerPayment: zeroKpi, spread: zeroKpi, savings: zeroKpi, criticalAlerts: zeroKpi },
    results: [],
  };
}

function emptyFinancialSummary(): FinancialSummary {
  return { generation: 0, compensated: 0, balance: 0, revenue: 0, ownerPayment: 0, spread: 0, savings: 0 };
}

export function createProviderAdapter(uiProvider: any): EsaProvider {
  return {
    listMonths(): MonthOption[] {
      return AVAILABLE_MONTHS;
    },

    getCycleStatus(month: string): CycleStatus {
      return AVAILABLE_MONTHS.find((m) => m.value === month)?.status ?? 'aberto';
    },

    listGeneratingUnits(): GeneratingUnit[] {
      return unwrap(uiProvider.searchGeneratingUnits({}))?.items ?? [];
    },

    listBeneficiaryUnits(): BeneficiaryUnit[] {
      return unwrap(uiProvider.searchBeneficiaryUnits({}))?.items ?? [];
    },

    computeAll(): SettlementResult[] {
      const data = unwrap(uiProvider.getExecutiveSummary({ referenceMonth: AVAILABLE_MONTHS[0].value }));
      return data?.results ?? [];
    },

    listAlerts(): Alert[] {
      const data = unwrap(uiProvider.getAlertsSummary({}));
      return data?.alerts ?? [];
    },

    getExecutiveSummary(filters: PeriodFilter): ExecutiveSummary {
      const data = unwrap(uiProvider.getExecutiveSummary({ referenceMonth: filters.month, ugId: filters.ugId }));
      return data ?? emptyExecutiveSummary(filters.month);
    },

    getAlertsSummary(filters: PeriodFilter): Alert[] {
      const data = unwrap(uiProvider.getAlertsSummary({ referenceMonth: filters.month }));
      return data?.alerts ?? [];
    },

    getMonthlyTrend(filters: { ugId?: string }): TrendRow[] {
      return AVAILABLE_MONTHS.slice().reverse().map((m) => {
        const data = unwrap(uiProvider.getFinancialSummary({ referenceMonth: m.value, ugId: filters.ugId }));
        return {
          month: m.value,
          label: m.label.split(' ')[0].slice(0, 3),
          Receita: data?.revenue ?? 0,
          Repasse: data?.ownerPayment ?? 0,
          Spread: data?.spread ?? 0,
          Geracao: data?.generation ?? 0,
          Consumo: data?.compensated ?? 0,
        };
      });
    },

    getFinancialSummary(filters: PeriodFilter): FinancialSummary {
      return unwrap(uiProvider.getFinancialSummary({ referenceMonth: filters.month })) ?? emptyFinancialSummary();
    },

    getGeneratingUnitCycleSummary(id: string, filters: PeriodFilter) {
      return unwrap(uiProvider.getGeneratingUnitSummary(id, { referenceMonth: filters.month }));
    },

    getCreditAllocationPlan(ugId: string, month: string, overrides?: Record<string, any>): AllocationPlan | null {
      return unwrap(uiProvider.getAllocationPlan(ugId, month, { overrides }));
    },

    getGeneratingUnitCommercialTerms(id: string) {
      return unwrap(uiProvider.getGeneratingUnitCommercialTerms(id));
    },

    getGeneratingUnitCreditDestinationReport(id: string, month: string) {
      return unwrap(uiProvider.getOwnerMonthlyReport(id, month));
    },

    createGeneratingUnit(input: Record<string, unknown>) {
      return unwrap(uiProvider.createGeneratingUnit(input)) ?? { ok: true };
    },

    updateGeneratingUnit(id: string, input: Record<string, unknown>) {
      return unwrap(uiProvider.updateGeneratingUnit(id, input)) ?? { ok: true };
    },

    getBeneficiaryConsumptionAverage(id: string) {
      return unwrap(uiProvider.getBeneficiaryConsumptionAverage(id, {}));
    },

    getBeneficiaryCreditBalance(id: string, month: string) {
      return unwrap(uiProvider.getBeneficiaryCreditBalance(id, month));
    },

    getBeneficiaryMonthlyHistory(id: string): any[] {
      return unwrap(uiProvider.getBeneficiaryHistory(id, {}))?.months ?? [];
    },

    getBeneficiaryAverageComposition(id: string) {
      return unwrap(uiProvider.getBeneficiaryConsumptionAverage(id, {}));
    },

    getBeneficiaryMonthlyRecord(id: string, month: string) {
      return unwrap(uiProvider.getBeneficiaryMonthlyDataSources(id, month));
    },

    getBeneficiarySavingsHistory(id: string, upToMonth = '2026-07'): any[] {
      return unwrap(uiProvider.getBeneficiaryHistory(id, { upToMonth }))?.months ?? [];
    },

    createBeneficiaryUnit(input: Record<string, unknown>) {
      return unwrap(uiProvider.createBeneficiaryUnit(input)) ?? { ok: true };
    },

    updateBeneficiaryUnit(id: string, input: Record<string, unknown>) {
      return unwrap(uiProvider.updateBeneficiaryUnit(id, input)) ?? { ok: true };
    },

    getBeneficiaryInvoice(id: string, month: string) {
      return unwrap(uiProvider.getBeneficiaryMonthlyReport(id, month));
    },

    getSettlementRecipient(ugId: string) {
      return unwrap(uiProvider.getSettlementRecipient(ugId));
    },

    confirmInvoicePayment(id: string, payment: { paidAt: string; amount: number; note?: string }) {
      return unwrap(uiProvider.confirmInvoicePayment(id, payment)) ?? { ok: true };
    },

    reopenInvoicePayment(id: string) {
      return unwrap(uiProvider.reopenInvoicePayment(id, '')) ?? { ok: true };
    },

    confirmOwnerSettlementPayment(id: string, payment: { paidAt: string; amount: number; note?: string }) {
      return unwrap(uiProvider.confirmOwnerSettlementPayment(id, payment)) ?? { ok: true };
    },

    getCsvTemplate(type: 'ug' | 'ub' | 'rug' | 'rub') {
      return unwrap(uiProvider.getCsvTemplate(type));
    },

    simulateUtilityBillExtraction(file: any, scenario: 'matched' | 'unmatched' | 'duplicate' = 'matched') {
      return unwrap(uiProvider.createUtilityBillImport({ file, scenario }));
    },

    confirmUtilityBillExtraction(extractionId: string, correctedData: unknown) {
      return unwrap(uiProvider.reviewUtilityBillImport(extractionId, correctedData)) ?? { ok: true };
    },

    matchUtilityBillToBeneficiary(extracted: { utilityConsumerUnit: string; distributor?: string }) {
      const ubs = unwrap(uiProvider.searchBeneficiaryUnits({}))?.items ?? [];
      return unwrap(uiProvider.matchUtilityBillImport(extracted.utilityConsumerUnit, ubs));
    },

    linkUtilityBillToBeneficiary(extractionId: string, ubId: string) {
      return unwrap(uiProvider.linkUtilityBillToBeneficiary(extractionId, ubId)) ?? { ok: true };
    },

    prepareBeneficiaryFromUtilityBill(extractionId: string) {
      return unwrap(uiProvider.prepareBeneficiaryFromUtilityBill(extractionId));
    },

    confirmBeneficiaryMonthlyRecordFromUtilityBill(extractionId: string, data: any) {
      return unwrap(uiProvider.confirmUtilityBillMonthlyRecord(extractionId, { correctedData: data })) ?? { ok: true };
    },

    replaceBeneficiaryMonthlyRecordFromUtilityBill(extractionId: string, reason: string) {
      return unwrap(uiProvider.replaceUtilityBillMonthlyRecord(extractionId, reason)) ?? { ok: true };
    },

    compareUtilityBillWithExistingRecord(_extractionId: string, existing: any, incoming: any) {
      const fields = Object.keys(existing ?? {}).map((key) => ({
        label: key,
        current: existing[key],
        incoming: incoming?.[key] ?? 0,
        delta: +((incoming?.[key] ?? 0) - existing[key]).toFixed(2),
      }));
      return { fields };
    },

    getUnlinkedUtilityBills(): any[] {
      return unwrap(uiProvider.getUnlinkedUtilityBills({})) ?? [];
    },

    shouldEmitLowBalanceAlert(input: {
      currentBalanceKwh: number;
      plannedCreditsReceivedKwh: number;
      targetCreditKwh: number;
    }): boolean {
      return input.currentBalanceKwh + input.plannedCreditsReceivedKwh < input.targetCreditKwh;
    },
  };
}
