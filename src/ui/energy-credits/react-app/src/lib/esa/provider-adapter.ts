/**
 * ESA OS — Energy Credits React App
 * Provider Adapter
 *
 * Bridges the Lovable UI provider API → EnergyCreditsUIProvider (UIResult).
 * No financial formulas (no scaledResults, aggregate, etc.).
 * Maps method calls and unwraps UIResult<T> → T.
 *
 * Core field name mapping:
 *  searchGeneratingUnits  → returns array directly (not {items:[]})
 *  searchBeneficiaryUnits → returns array directly (not {items:[]})
 *  getExecutiveSummary    → { generatingUnitCount, totalGenerationKwh, totalCompensatedKwh,
 *                             totalCurrentBalanceKwh, totalOwnerReturn, totalEsaRevenue,
 *                             grossSpread, totalMonthlyDiscount, criticalAlertCount, ... }
 *  getFinancialSummary    → { totalEsaRevenue, totalOwnerReturn, grossSpread, ... }
 *  getAlertsSummary       → { alerts: [], totalAlerts, bySeverity, ... }
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

// Maps the Core executive summary shape to the Lovable ExecutiveSummary shape.
// Core: { generatingUnitCount, totalGenerationKwh, totalCompensatedKwh, totalCurrentBalanceKwh,
//         totalEsaRevenue, totalOwnerReturn, grossSpread, totalMonthlyDiscount, criticalAlertCount }
// Lovable: { month, cycleStatus, operational, financial, deltas, results }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoreExecutiveSummary(data: any, month: string): ExecutiveSummary {
  const zeroKpi = flatDelta();
  return {
    month,
    cycleStatus: AVAILABLE_MONTHS.find((m) => m.value === month)?.status ?? 'aberto',
    operational: {
      generatingUnits:  { total: data.generatingUnitCount  ?? 0, active: data.generatingUnitCount  ?? 0 },
      beneficiaryUnits: { total: data.beneficiaryUnitCount ?? 0, active: data.beneficiaryUnitCount ?? 0 },
      generation:  data.totalGenerationKwh     ?? 0,
      compensated: data.totalCompensatedKwh    ?? 0,
      balance:     data.totalCurrentBalanceKwh ?? 0,
    },
    financial: {
      revenue:        data.totalEsaRevenue      ?? 0,
      ownerPayment:   data.totalOwnerReturn     ?? 0,
      spread:         data.grossSpread          ?? 0,
      savings:        data.totalMonthlyDiscount ?? 0,
      criticalAlerts: data.criticalAlertCount   ?? 0,
    },
    deltas: {
      generation: zeroKpi, compensated: zeroKpi, balance: zeroKpi,
      revenue: zeroKpi, ownerPayment: zeroKpi, spread: zeroKpi,
      savings: zeroKpi, criticalAlerts: zeroKpi,
    },
    results: [],
  };
}

// Maps the Core financial summary shape to the Lovable FinancialSummary shape.
// Core: { totalEsaRevenue, totalOwnerReturn, grossSpread, totalInvoices, ... }
// Lovable: { generation, compensated, balance, revenue, ownerPayment, spread, savings }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoreFinancialSummary(data: any): FinancialSummary {
  return {
    generation:   0,
    compensated:  0,
    balance:      0,
    revenue:      data.totalEsaRevenue  ?? 0,
    ownerPayment: data.totalOwnerReturn ?? 0,
    spread:       data.grossSpread      ?? 0,
    savings:      0,
  };
}

// Returns a minimal valid GeneratingUnit with safe zero values.
// Used when Core does not provide the Lovable GeneratingUnit shape (e.g. inside AllocationPlan).
function emptyGeneratingUnit(ugId: string): GeneratingUnit {
  return {
    id: ugId, name: '', owner: '', document: '', uc: '', distributor: '',
    status: 'ativa', purchasePrice: 0, previousBalance: 0, monthlyGeneration: 0,
    beneficiaries: [],
    payee: { name: '', document: '', pixKey: '', pixType: 'cpf' },
  };
}

// Returns a valid AllocationPlan with rows: [] so MonthlySettlement can render an empty state.
// Core's getCreditAllocationPlan returns { generatingUnitId, beneficiaries } — no rows, no ug.
function emptyAllocationPlan(ugId: string): AllocationPlan {
  return {
    ug: emptyGeneratingUnit(ugId),
    generation: 0,
    rows: [],
    totalPct: 0,
    totalProjected: 0,
    totalCompensated: 0,
    totalFinalBalance: 0,
    ownerPayment: 0,
    esaRevenue: 0,
    totalRecommended: 0,
    totalTargetCredit: 0,
    totalConsumption: 0,
  };
}

// Maps Core's _buildGeneratingUnitSummary shape to the fields used by MonthlySettlement.
// Core: { totalGenerationKwh, totalAllocatedKwh, totalCompensatedKwh, currentBalanceKwh, beneficiaryCount }
// Component: { cycleStatus, generationKwh, totalRecommendedKwh, totalPlannedKwh, totalReceivedKwh,
//              totalCompensatedKwh, totalFinalBalanceKwh, beneficiariesCount }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoreCycleSummary(data: any, id: string, month: string) {
  return {
    generatingUnitId:     id,
    referenceMonth:       month,
    cycleStatus:          AVAILABLE_MONTHS.find((m) => m.value === month)?.status ?? 'aberto',
    generationKwh:        data.totalGenerationKwh  ?? 0,
    totalRecommendedKwh:  0,
    totalPlannedKwh:      data.totalAllocatedKwh   ?? 0,
    totalReceivedKwh:     data.totalAllocatedKwh   ?? 0,
    totalCompensatedKwh:  data.totalCompensatedKwh ?? 0,
    totalFinalBalanceKwh: data.currentBalanceKwh   ?? 0,
    beneficiariesCount:   data.beneficiaryCount    ?? 0,
  };
}

// Maps CsvImport.tsx short type keys to the Core's full import type keys.
const CSV_TYPE_MAP: Record<string, string> = {
  'ug':  'generating-units',
  'ub':  'beneficiary-units',
  'rug': 'generating-unit-monthly-records',
  'rub': 'beneficiary-monthly-records',
};

// Download filenames for each short type key.
const CSV_FILENAME: Record<string, string> = {
  'ug':  'modelo-unidades-geradoras.csv',
  'ub':  'modelo-unidades-beneficiarias.csv',
  'rug': 'modelo-registros-mensais-ug.csv',
  'rub': 'modelo-registros-mensais-ub.csv',
};

// Maps Core's getCsvTemplate shape { importType, delimiter, headers, exampleRows, csvText, aliases }
// to the shape expected by CsvImport.tsx: { example, filename, importType, delimiter, headers, exampleRows, aliases }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoreCsvTemplate(data: any, shortType: string) {
  return {
    importType:  data.importType   ?? shortType,
    delimiter:   data.delimiter    ?? ';',
    headers:     data.headers      ?? [],
    exampleRows: data.exampleRows  ?? [],
    aliases:     data.aliases      ?? {},
    example:     data.csvText      ?? '',
    filename:    CSV_FILENAME[shortType] ?? `modelo-${shortType}.csv`,
  };
}

// Safe empty CSV template contract — returned when Core errors or type is unknown.
function emptyCsvTemplate(shortType: string) {
  return {
    importType:  shortType,
    delimiter:   ';',
    headers:     [] as string[],
    exampleRows: [] as string[][],
    aliases:     {} as Record<string, string[]>,
    example:     '',
    filename:    CSV_FILENAME[shortType] ?? `modelo-${shortType}.csv`,
  };
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
      const data = unwrap(uiProvider.searchGeneratingUnits({}));
      return (Array.isArray(data) ? data : data?.items ?? []) as GeneratingUnit[];
    },

    listBeneficiaryUnits(): BeneficiaryUnit[] {
      const data = unwrap(uiProvider.searchBeneficiaryUnits({}));
      return (Array.isArray(data) ? data : data?.items ?? []) as BeneficiaryUnit[];
    },

    computeAll(): SettlementResult[] {
      return [];
    },

    listAlerts(): Alert[] {
      const data = unwrap(uiProvider.getAlertsSummary({}));
      return data?.alerts ?? [];
    },

    getExecutiveSummary(filters: PeriodFilter): ExecutiveSummary {
      const data = unwrap(uiProvider.getExecutiveSummary({ referenceMonth: filters.month, ugId: filters.ugId }));
      if (!data) return emptyExecutiveSummary(filters.month);
      return mapCoreExecutiveSummary(data, filters.month);
    },

    getAlertsSummary(filters: PeriodFilter): Alert[] {
      const data = unwrap(uiProvider.getAlertsSummary({ referenceMonth: filters.month }));
      return data?.alerts ?? [];
    },

    getMonthlyTrend(filters: { ugId?: string }): TrendRow[] {
      return AVAILABLE_MONTHS.slice().reverse().map((m) => {
        const data = unwrap(uiProvider.getFinancialSummary({ referenceMonth: m.value, ugId: filters.ugId }));
        return {
          month:   m.value,
          label:   m.label.split(' ')[0].slice(0, 3),
          Receita: data?.totalEsaRevenue  ?? 0,
          Repasse: data?.totalOwnerReturn ?? 0,
          Spread:  data?.grossSpread      ?? 0,
          Geracao: 0,
          Consumo: 0,
        };
      });
    },

    getFinancialSummary(filters: PeriodFilter): FinancialSummary {
      const data = unwrap(uiProvider.getFinancialSummary({ referenceMonth: filters.month }));
      return data ? mapCoreFinancialSummary(data) : emptyFinancialSummary();
    },

    getGeneratingUnitCycleSummary(id: string, filters: PeriodFilter) {
      if (!id) return null;
      const data = unwrap(uiProvider.getGeneratingUnitSummary(id, { referenceMonth: filters.month }));
      if (!data) return null;
      return mapCoreCycleSummary(data, id, filters.month);
    },

    getCreditAllocationPlan(ugId: string, month: string, overrides?: Record<string, any>): AllocationPlan | null {
      if (!ugId) return null;
      const data = unwrap(uiProvider.getAllocationPlan(ugId, month, { overrides }));
      if (!data) return null;
      // Core shape ({ generatingUnitId, beneficiaries }) has no AllocationPlan fields.
      // Return empty valid plan — rows: [] prevents plan.rows.map(undefined) crash.
      return emptyAllocationPlan(ugId);
    },

    getGeneratingUnitCommercialTerms(id: string) {
      return unwrap(uiProvider.getGeneratingUnitCommercialTerms(id));
    },

    getGeneratingUnitCreditDestinationReport(id: string, month: string) {
      if (!id) return null;
      try {
        return unwrap(uiProvider.getOwnerMonthlyReport(id, month));
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? '';
        // Known: Core throws when generating unit does not exist in the read model.
        if (/\[buildOwnerMonthlyReport\]/.test(msg) && /não encontrada/.test(msg)) return null;
        throw err;
      }
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
      if (!id) return null;
      try {
        return unwrap(uiProvider.getBeneficiaryMonthlyReport(id, month));
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? '';
        // Known: Core throws when beneficiary unit does not exist in the read model.
        if (/\[buildBeneficiaryMonthlyReport\]/.test(msg) && /não encontrada/.test(msg)) return null;
        throw err;
      }
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
      const coreType = CSV_TYPE_MAP[type] ?? type;
      const data = unwrap(uiProvider.getCsvTemplate(coreType));
      if (!data) return emptyCsvTemplate(type);
      return mapCoreCsvTemplate(data, type);
    },

    simulateUtilityBillExtraction(file: any, scenario: 'matched' | 'unmatched' | 'duplicate' = 'matched') {
      return unwrap(uiProvider.createUtilityBillImport({ file, scenario }));
    },

    confirmUtilityBillExtraction(extractionId: string, correctedData: unknown) {
      return unwrap(uiProvider.reviewUtilityBillImport(extractionId, correctedData)) ?? { ok: true };
    },

    matchUtilityBillToBeneficiary(extracted: { utilityConsumerUnit: string; distributor?: string }) {
      const ubs = unwrap(uiProvider.searchBeneficiaryUnits({}));
      const ubList = Array.isArray(ubs) ? ubs : ubs?.items ?? [];
      return unwrap(uiProvider.matchUtilityBillImport(extracted.utilityConsumerUnit, ubList));
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
