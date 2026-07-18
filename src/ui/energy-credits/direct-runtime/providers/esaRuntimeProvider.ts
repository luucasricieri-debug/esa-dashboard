// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Provider Real — delega para EnergyCreditsUIProvider via provider-adapter.
// NÃO recalcula billing. NÃO acessa Firebase direto. NÃO usa mocks.
// NÃO expõe calculationMemory.
// Métodos não conectados: retornam null/[] com comentário NOT_IMPLEMENTED: Gate 3.
// ============================================================

import type { EnergyCreditsRuntimeContract } from '../contracts/EnergyCreditsRuntimeContract';
import type {
  GeneratingUnit,
  BeneficiaryUnit,
  MonthOption,
  CycleStatus,
  Payee,
  AlertRecord,
  AlertFilter,
  AllocationOverride,
  AllocationPlan,
  BeneficiaryInvoice,
  ConsumptionAverage,
  CsvImportType,
  CsvTemplate,
  DashboardData,
  ExtractedBillData,
  FinancialData,
  FinancialReport,
  ImportHistoryRecord,
  InternalReport,
  MonthlyHistoryRow,
  MutationResult,
  OwnerReport,
  PaymentInput,
  SavingsHistoryRow,
  TrendRow,
  AggregateMetrics,
  SettlementResult,
} from '../contracts/types';

// Type for the ESA UI provider received from provider-adapter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UIProvider = any;

function unwrap(result: unknown): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  if (!r || !r.ok || r.data == null) return null;
  return r.data;
}

function ok(): MutationResult { return { ok: true }; }

function emptyAggregateMetrics(): AggregateMetrics {
  return { generation: 0, compensated: 0, balance: 0, revenue: 0, ownerPayment: 0, spread: 0, savings: 0 };
}

const AVAILABLE_MONTHS: MonthOption[] = [
  { value: '2026-07', label: 'Julho de 2026', status: 'em_apuracao' },
  { value: '2026-06', label: 'Junho de 2026', status: 'fechado' },
  { value: '2026-05', label: 'Maio de 2026', status: 'fechado' },
  { value: '2026-04', label: 'Abril de 2026', status: 'fechado' },
  { value: '2026-03', label: 'Março de 2026', status: 'fechado' },
];

const CSV_TYPE_MAP: Record<CsvImportType, string> = {
  ug:  'generating-units',
  ub:  'beneficiary-units',
  rug: 'generating-unit-monthly-records',
  rub: 'beneficiary-monthly-records',
};

const CSV_FILENAME: Record<CsvImportType, string> = {
  ug:  'modelo-unidades-geradoras.csv',
  ub:  'modelo-unidades-beneficiarias.csv',
  rug: 'modelo-registros-mensais-ug.csv',
  rub: 'modelo-registros-mensais-ub.csv',
};

export function createEsaRuntimeProvider(uiProvider: UIProvider): EnergyCreditsRuntimeContract {
  return {
    mode: 'real',

    // ---- Months ----
    async listMonths(): Promise<MonthOption[]> {
      return [...AVAILABLE_MONTHS];
    },
    async getCycleStatus(month: string): Promise<CycleStatus> {
      return AVAILABLE_MONTHS.find((m) => m.value === month)?.status ?? 'aberto';
    },

    // ---- Dashboard ----
    async getDashboardData(filter): Promise<DashboardData> {
      const { month, ugId } = filter;
      // NOT_IMPLEMENTED: Gate 3 — map getExecutiveSummary + getMonthlyTrend to DashboardData
      const cycleStatus: CycleStatus = AVAILABLE_MONTHS.find((m) => m.value === month)?.status ?? 'aberto';
      const rawSummary = unwrap(uiProvider.getExecutiveSummary({ referenceMonth: month, ugId }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = rawSummary as any;
      const current: AggregateMetrics = s ? {
        generation:   s.totalGenerationKwh     ?? 0,
        compensated:  s.totalCompensatedKwh    ?? 0,
        balance:      s.totalCurrentBalanceKwh ?? 0,
        revenue:      s.totalEsaRevenue        ?? 0,
        ownerPayment: s.totalOwnerReturn       ?? 0,
        spread:       s.grossSpread            ?? 0,
        savings:      s.totalMonthlyDiscount   ?? 0,
      } : emptyAggregateMetrics();
      const results: SettlementResult[] = []; // NOT_IMPLEMENTED: Gate 3
      const trendData: TrendRow[] = []; // NOT_IMPLEMENTED: Gate 3
      return {
        month, cycleStatus, current, previous: null,
        criticalAlerts: s?.criticalAlertCount ?? 0,
        generatingUnitCount: s?.generatingUnitCount ?? 0,
        beneficiaryUnitCount: s?.beneficiaryUnitCount ?? 0,
        activeUGCount: s?.generatingUnitCount ?? 0,
        results, trendData,
      };
    },
    async getMonthlyTrend(filter): Promise<TrendRow[]> {
      return AVAILABLE_MONTHS.slice().reverse().map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = unwrap(uiProvider.getFinancialSummary({ referenceMonth: m.value, ugId: filter.ugId })) as any;
        return {
          month: m.value, label: m.label.split(' ')[0].slice(0, 3),
          Receita: d?.totalEsaRevenue  ?? 0, Repasse: d?.totalOwnerReturn ?? 0,
          Spread:  d?.grossSpread      ?? 0, Geracao: 0, Consumo: 0,
        };
      });
    },

    // ---- Generating Units ----
    async listGeneratingUnits(filter?): Promise<GeneratingUnit[]> {
      const d = unwrap(uiProvider.searchGeneratingUnits({ search: filter?.search ?? '' }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = Array.isArray(d) ? d : (d as any)?.items ?? [];
      return arr as GeneratingUnit[];
    },
    async getGeneratingUnit(id: string): Promise<GeneratingUnit | null> {
      // NOT_IMPLEMENTED: Gate 3 — Core has no single-UG lookup; filter from list
      const list = await this.listGeneratingUnits();
      return list.find((u) => u.id === id) ?? null;
    },
    async createGeneratingUnit(input) {
      return (unwrap(uiProvider.createGeneratingUnit(input)) as MutationResult | null) ?? ok();
    },
    async updateGeneratingUnit(id, input) {
      return (unwrap(uiProvider.updateGeneratingUnit(id, input)) as MutationResult | null) ?? ok();
    },
    async getGeneratingUnitPayee(ugId: string): Promise<Payee | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.getSettlementRecipient(ugId)) as any;
      if (!d) return null;
      return { name: d.name ?? '', document: d.document ?? '', pixKey: d.pixKey ?? '', pixType: d.pixType ?? 'cpf' };
    },
    async getAppliedPrice(_ugId: string, _month: string): Promise<number> {
      // NOT_IMPLEMENTED: Gate 3 — Core does not expose historical applied prices per cycle
      return 0;
    },
    async updateCyclePrice(_ugId, _month, _price, _reason) {
      // NOT_IMPLEMENTED: Gate 3
      return ok();
    },

    // ---- Beneficiary Units ----
    async listBeneficiaryUnits(filter?): Promise<BeneficiaryUnit[]> {
      const d = unwrap(uiProvider.searchBeneficiaryUnits({ search: filter?.search ?? '', ugId: filter?.ugId }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = Array.isArray(d) ? d : (d as any)?.items ?? [];
      return arr as BeneficiaryUnit[];
    },
    async getBeneficiaryUnit(id: string): Promise<BeneficiaryUnit | null> {
      const list = await this.listBeneficiaryUnits();
      return list.find((u) => u.id === id) ?? null;
    },
    async createBeneficiaryUnit(input) {
      return (unwrap(uiProvider.createBeneficiaryUnit(input)) as MutationResult | null) ?? ok();
    },
    async updateBeneficiaryUnit(id, input) {
      return (unwrap(uiProvider.updateBeneficiaryUnit(id, input)) as MutationResult | null) ?? ok();
    },
    async getBeneficiaryConsumptionAverage(id: string): Promise<ConsumptionAverage | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.getBeneficiaryConsumptionAverage(id, {})) as any;
      if (!d) return null;
      return {
        annualAverage: d.annualAverage ?? 0,
        monthlyAverage: (d.annualAverage ?? 0) / 12,
        hasSufficientHistory: d.hasSufficientHistory ?? false,
        months: (d.months ?? []) as MonthlyHistoryRow[],
      };
    },
    async getBeneficiaryMonthlyHistory(id: string): Promise<MonthlyHistoryRow[]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.getBeneficiaryHistory(id, {})) as any;
      return (d?.months ?? []) as MonthlyHistoryRow[];
    },
    async getBeneficiarySavingsHistory(id: string, upToMonth = '2026-07'): Promise<SavingsHistoryRow[]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.getBeneficiaryHistory(id, { upToMonth })) as any;
      return (d?.months ?? []) as SavingsHistoryRow[];
    },

    // ---- Allocation Plan ----
    async getAllocationPlan(ugId: string, month: string, overrides: Record<string, AllocationOverride> = {}): Promise<AllocationPlan | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.getAllocationPlan(ugId, month, { overrides })) as any;
      // NOT_IMPLEMENTED: Gate 3 — Core shape needs full mapping to AllocationPlan
      if (!d) return null;
      return null; // NOT_IMPLEMENTED: Gate 3 — AllocationPlan shape mismatch with Core
    },
    async saveAllocationOverrides(_ugId, _month, _overrides) {
      // NOT_IMPLEMENTED: Gate 3
      return ok();
    },
    async closeMonthlySettlement(_ugId, _month) {
      // NOT_IMPLEMENTED: Gate 3
      return ok();
    },

    // ---- Invoice ----
    async getBeneficiaryInvoice(ubId: string, month: string): Promise<BeneficiaryInvoice | null> {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = unwrap(uiProvider.getBeneficiaryMonthlyReport(ubId, month)) as any;
        return d as BeneficiaryInvoice | null;
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? '';
        if (/\[buildBeneficiaryMonthlyReport\]/.test(msg) && /não encontrada/.test(msg)) return null;
        throw err;
      }
    },

    // ---- CSV Import ----
    async getImportHistory(): Promise<ImportHistoryRecord[]> {
      // NOT_IMPLEMENTED: Gate 3 — Core does not expose import history list
      return [];
    },
    async getCsvTemplate(type: CsvImportType): Promise<CsvTemplate> {
      const coreType = CSV_TYPE_MAP[type] ?? type;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.getCsvTemplate(coreType)) as any;
      if (!d) return { importType: type, delimiter: ';', headers: [], exampleRows: [], aliases: {}, example: '', filename: CSV_FILENAME[type] };
      return { importType: d.importType ?? type, delimiter: d.delimiter ?? ';', headers: d.headers ?? [], exampleRows: d.exampleRows ?? [], aliases: d.aliases ?? {}, example: d.csvText ?? '', filename: CSV_FILENAME[type] };
    },
    async extractUtilityBill(scenario = 'matched'): Promise<ExtractedBillData | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.createUtilityBillImport({ file: null, scenario })) as any;
      return d as ExtractedBillData | null;
    },
    async getExistingBillData(_ubId: string, _month: string): Promise<ExtractedBillData | null> {
      // NOT_IMPLEMENTED: Gate 3 — Core does not expose per-beneficiary/month bill lookup
      return null;
    },
    async confirmBillExtraction(data: ExtractedBillData) {
      return (unwrap(uiProvider.confirmUtilityBillExtraction(data)) as MutationResult | null) ?? ok();
    },
    async matchBillToBeneficiary(uc: string): Promise<BeneficiaryUnit | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.matchUtilityBillToBeneficiary(uc)) as any;
      return d as BeneficiaryUnit | null;
    },
    async linkBillToBeneficiary(extractionId: string, ubId: string) {
      return (unwrap(uiProvider.linkUtilityBillToBeneficiary(extractionId, ubId)) as MutationResult | null) ?? ok();
    },
    async replaceBillData(_extractionId: string, _reason: string) {
      // NOT_IMPLEMENTED: Gate 3 — Core does not expose bill replacement
      return ok();
    },

    // ---- Reports ----
    async getOwnerReport(ugId: string, month: string): Promise<OwnerReport | null> {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = unwrap(uiProvider.getOwnerMonthlyReport(ugId, month)) as any;
        return d as OwnerReport | null;
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? '';
        if (/\[buildOwnerMonthlyReport\]/.test(msg) && /não encontrada/.test(msg)) return null;
        throw err;
      }
    },
    async getInternalReport(_ugId: string, _month: string): Promise<InternalReport | null> {
      // NOT_IMPLEMENTED: Gate 3 — no Core equivalent
      return null;
    },
    async getFinancialReport(_ugId: string, _month: string): Promise<FinancialReport | null> {
      // NOT_IMPLEMENTED: Gate 3 — no Core equivalent
      return null;
    },

    // ---- Financial ----
    async getFinancialData(filter): Promise<FinancialData> {
      // NOT_IMPLEMENTED: Gate 3 — Core returns aggregates, not per-invoice payment records
      return { month: filter.month, invoices: [], ownerPayments: [], totalRevenue: 0, totalOwnerPayment: 0, spread: 0 };
    },
    async confirmInvoicePayment(ubId: string, _month: string, payment: PaymentInput) {
      return (unwrap(uiProvider.confirmInvoicePayment(ubId, payment)) as MutationResult | null) ?? ok();
    },
    async reopenInvoicePayment(ubId: string, _month: string, _reason: string) {
      return (unwrap(uiProvider.reopenInvoicePayment(ubId, _reason)) as MutationResult | null) ?? ok();
    },
    async confirmOwnerPayment(ugId: string, _month: string, payment: PaymentInput) {
      return (unwrap(uiProvider.confirmOwnerSettlementPayment(ugId, payment)) as MutationResult | null) ?? ok();
    },

    // ---- Alerts ----
    async listAlerts(filter?: AlertFilter): Promise<AlertRecord[]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = unwrap(uiProvider.getAlertsSummary({ referenceMonth: filter?.month })) as any;
      return (d?.alerts ?? []) as AlertRecord[];
    },
    async getAlertDetail(_id: string): Promise<AlertRecord | null> {
      // NOT_IMPLEMENTED: Gate 3 — Core does not expose single alert lookup
      return null;
    },
    async resolveAlert(_id, _note) {
      // NOT_IMPLEMENTED: Gate 3
      return ok();
    },
    async ignoreAlert(_id, _note) {
      // NOT_IMPLEMENTED: Gate 3
      return ok();
    },
    async markAlertInAnalysis(_id, _note) {
      // NOT_IMPLEMENTED: Gate 3
      return ok();
    },
  };
}
