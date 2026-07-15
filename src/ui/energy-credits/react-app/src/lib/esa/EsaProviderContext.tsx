import { createContext, useContext } from 'react';
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

export interface EsaProvider {
  // Month / filter helpers
  listMonths(): MonthOption[];
  getCycleStatus(month: string): CycleStatus;

  // Direct entity listing
  listGeneratingUnits(): GeneratingUnit[];
  listBeneficiaryUnits(): BeneficiaryUnit[];
  computeAll(): SettlementResult[];
  listAlerts(): Alert[];

  // Dashboard
  getExecutiveSummary(filters: PeriodFilter): ExecutiveSummary;
  getAlertsSummary(filters: PeriodFilter): Alert[];
  getMonthlyTrend(filters: { ugId?: string }): TrendRow[];
  getFinancialSummary(filters: PeriodFilter): FinancialSummary;

  // Generating units
  getGeneratingUnitCycleSummary(id: string, filters: PeriodFilter): any;
  getCreditAllocationPlan(
    ugId: string,
    month: string,
    overrides?: Record<string, { allocationPct?: number; preventiveMargin?: number }>,
  ): AllocationPlan | null;
  getGeneratingUnitCommercialTerms(id: string): any;
  getGeneratingUnitCreditDestinationReport(id: string, month: string): any;
  createGeneratingUnit(input: Record<string, unknown>): any;
  updateGeneratingUnit(id: string, input: Record<string, unknown>): any;

  // Beneficiary units
  getBeneficiaryConsumptionAverage(id: string): any;
  getBeneficiaryCreditBalance(id: string, month: string): any;
  getBeneficiaryMonthlyHistory(id: string): any[];
  getBeneficiaryAverageComposition(id: string): any;
  getBeneficiaryMonthlyRecord(id: string, month: string): any;
  getBeneficiarySavingsHistory(id: string, upToMonth?: string): any[];
  createBeneficiaryUnit(input: Record<string, unknown>): any;
  updateBeneficiaryUnit(id: string, input: Record<string, unknown>): any;

  // Reports / Invoice
  getBeneficiaryInvoice(id: string, month: string): any;
  getSettlementRecipient(ugId: string): any;

  // Financial
  confirmInvoicePayment(id: string, payment: { paidAt: string; amount: number; note?: string }): any;
  reopenInvoicePayment(id: string): any;
  confirmOwnerSettlementPayment(id: string, payment: { paidAt: string; amount: number; note?: string }): any;

  // CSV import
  getCsvTemplate(type: 'ug' | 'ub' | 'rug' | 'rub'): any;
  simulateUtilityBillExtraction(file: any, scenario?: 'matched' | 'unmatched' | 'duplicate'): any;
  confirmUtilityBillExtraction(extractionId: string, correctedData: unknown): any;
  matchUtilityBillToBeneficiary(extracted: { utilityConsumerUnit: string; distributor?: string }): any;
  linkUtilityBillToBeneficiary(extractionId: string, ubId: string): any;
  prepareBeneficiaryFromUtilityBill(extractionId: string): any;
  confirmBeneficiaryMonthlyRecordFromUtilityBill(
    extractionId: string,
    data: { beneficiaryUnitId: string; referenceMonth: string; consumptionKwh: number },
  ): any;
  replaceBeneficiaryMonthlyRecordFromUtilityBill(extractionId: string, reason: string): any;
  compareUtilityBillWithExistingRecord(extractionId: string, existing: any, incoming: any): any;
  getUnlinkedUtilityBills(): any[];
  shouldEmitLowBalanceAlert(input: {
    currentBalanceKwh: number;
    plannedCreditsReceivedKwh: number;
    targetCreditKwh: number;
  }): boolean;
}

export const EsaProviderContext = createContext<EsaProvider | null>(null);

export function useEsaProvider(): EsaProvider {
  const ctx = useContext(EsaProviderContext);
  if (!ctx) throw new Error('[useEsaProvider] Provider not found. Wrap with EsaProviderContext.Provider.');
  return ctx;
}
