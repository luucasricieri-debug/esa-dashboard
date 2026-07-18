// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Contrato único e estável do runtime de energy-credits-v2.html
// Implementado por: demoRuntimeProvider | esaRuntimeProvider
// ============================================================

import type {
  MonthOption,
  CycleStatus,
  GeneratingUnit,
  CreateGeneratingUnitInput,
  UpdateGeneratingUnitInput,
  BeneficiaryUnit,
  CreateBeneficiaryUnitInput,
  UpdateBeneficiaryUnitInput,
  ConsumptionAverage,
  MonthlyHistoryRow,
  SavingsHistoryRow,
  DashboardData,
  TrendRow,
  AllocationPlan,
  AllocationOverride,
  BeneficiaryInvoice,
  OwnerReport,
  InternalReport,
  FinancialReport,
  FinancialData,
  PaymentInput,
  AlertRecord,
  AlertFilter,
  CsvTemplate,
  CsvImportType,
  ExtractedBillData,
  ImportHistoryRecord,
  MutationResult,
  Payee,
  RuntimeMode,
} from './types';

export interface EnergyCreditsRuntimeContract {
  // ----------------------------------------------------------------
  // Identificação
  // ----------------------------------------------------------------
  readonly mode: RuntimeMode;

  // ----------------------------------------------------------------
  // Ciclos / Meses
  // ----------------------------------------------------------------
  listMonths(): Promise<MonthOption[]>;
  getCycleStatus(month: string): Promise<CycleStatus>;

  // ----------------------------------------------------------------
  // Dashboard
  // ----------------------------------------------------------------
  getDashboardData(filter: { month: string; ugId?: string }): Promise<DashboardData>;
  getMonthlyTrend(filter: { ugId?: string }): Promise<TrendRow[]>;

  // ----------------------------------------------------------------
  // Unidades Geradoras
  // ----------------------------------------------------------------
  listGeneratingUnits(filter?: { search?: string }): Promise<GeneratingUnit[]>;
  getGeneratingUnit(id: string): Promise<GeneratingUnit | null>;
  createGeneratingUnit(input: CreateGeneratingUnitInput): Promise<MutationResult>;
  updateGeneratingUnit(id: string, input: UpdateGeneratingUnitInput): Promise<MutationResult>;
  getGeneratingUnitPayee(ugId: string): Promise<Payee | null>;
  getAppliedPrice(ugId: string, month: string): Promise<number>;
  updateCyclePrice(ugId: string, month: string, price: number, reason: string): Promise<MutationResult>;

  // ----------------------------------------------------------------
  // Unidades Beneficiárias
  // ----------------------------------------------------------------
  listBeneficiaryUnits(filter?: { search?: string; ugId?: string }): Promise<BeneficiaryUnit[]>;
  getBeneficiaryUnit(id: string): Promise<BeneficiaryUnit | null>;
  createBeneficiaryUnit(input: CreateBeneficiaryUnitInput): Promise<MutationResult>;
  updateBeneficiaryUnit(id: string, input: UpdateBeneficiaryUnitInput): Promise<MutationResult>;
  getBeneficiaryConsumptionAverage(id: string): Promise<ConsumptionAverage | null>;
  getBeneficiaryMonthlyHistory(id: string): Promise<MonthlyHistoryRow[]>;
  getBeneficiarySavingsHistory(id: string, upToMonth?: string): Promise<SavingsHistoryRow[]>;

  // ----------------------------------------------------------------
  // Apuração Mensal
  // ----------------------------------------------------------------
  getAllocationPlan(
    ugId: string,
    month: string,
    overrides?: Record<string, AllocationOverride>,
  ): Promise<AllocationPlan | null>;
  saveAllocationOverrides(
    ugId: string,
    month: string,
    overrides: Record<string, AllocationOverride>,
  ): Promise<MutationResult>;
  closeMonthlySettlement(ugId: string, month: string): Promise<MutationResult>;

  // ----------------------------------------------------------------
  // Fatura ESA — Beneficiário
  // ----------------------------------------------------------------
  getBeneficiaryInvoice(ubId: string, month: string): Promise<BeneficiaryInvoice | null>;

  // ----------------------------------------------------------------
  // Importação CSV / Fatura da Distribuidora
  // ----------------------------------------------------------------
  getImportHistory(): Promise<ImportHistoryRecord[]>;
  getCsvTemplate(type: CsvImportType): Promise<CsvTemplate>;
  extractUtilityBill(scenario?: 'matched' | 'unmatched' | 'duplicate'): Promise<ExtractedBillData | null>;
  getExistingBillData(ubId: string, month: string): Promise<ExtractedBillData | null>;
  confirmBillExtraction(data: ExtractedBillData): Promise<MutationResult>;
  matchBillToBeneficiary(uc: string): Promise<BeneficiaryUnit | null>;
  linkBillToBeneficiary(extractionId: string, ubId: string): Promise<MutationResult>;
  replaceBillData(extractionId: string, reason: string): Promise<MutationResult>;

  // ----------------------------------------------------------------
  // Relatórios
  // ----------------------------------------------------------------
  getOwnerReport(ugId: string, month: string): Promise<OwnerReport | null>;
  getInternalReport(ugId: string, month: string): Promise<InternalReport | null>;
  getFinancialReport(ugId: string, month: string): Promise<FinancialReport | null>;

  // ----------------------------------------------------------------
  // Financeiro
  // ----------------------------------------------------------------
  getFinancialData(filter: { month: string }): Promise<FinancialData>;
  confirmInvoicePayment(ubId: string, month: string, payment: PaymentInput): Promise<MutationResult>;
  reopenInvoicePayment(ubId: string, month: string, reason: string): Promise<MutationResult>;
  confirmOwnerPayment(ugId: string, month: string, payment: PaymentInput): Promise<MutationResult>;

  // ----------------------------------------------------------------
  // Alertas
  // ----------------------------------------------------------------
  listAlerts(filter?: AlertFilter): Promise<AlertRecord[]>;
  getAlertDetail(id: string): Promise<AlertRecord | null>;
  resolveAlert(id: string, note: string): Promise<MutationResult>;
  ignoreAlert(id: string, note: string): Promise<MutationResult>;
  markAlertInAnalysis(id: string, note: string): Promise<MutationResult>;
}
