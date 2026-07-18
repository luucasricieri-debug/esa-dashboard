/**
 * ESA OS — UI / Energy Credits / Preview
 * Fixtures completos para o harness de preview local.
 *
 * Cenário: UG Solar Assaí · mês 2026-07 · 4 beneficiárias
 *
 * Reconciliação de geração:
 *   Total gerado:     13.000 kWh  (100%)
 *   Mercado Central:   4.199 kWh  (32,3%)
 *   Panificadora Sol:  2.340 kWh  (18,0%)
 *   Academia Movimento:2.977 kWh  (22,9%)
 *   Clínica Vida:      3.406 kWh  (26,2%)
 *   Total rateado:    12.922 kWh  (99,4%)
 *   Não rateado:          78 kWh   (0,6%)
 *
 * billingSnapshot (fixture regressivo — sem calculationMemory):
 *   Mercado Central: contaConcessionaria=453,09 / contaEsa=438,81 / economia=14,28
 */

export const PREVIEW_MONTH = '2026-07';

// ─── Unidade Geradora ──────────────────────────────────────────────────────────

export const GENERATING_UNITS = [
  {
    id: 'ug-assai',
    name: 'UG Solar Assaí',
    uc: '4567890',
    city: 'Assaí',
    state: 'PR',
    document: '12.345.678/0001-95',
    ownerName: 'João Pereira',
    installedCapacityKwp: 52.8,
    type: 'solar-gd',
    monthlyGenerationKwh: 13000,
    purchasePricePerKwh: 0.35,
    status: 'active',
    createdAt: '2025-01-15T08:00:00Z',
  },
];

// ─── Unidades Beneficiárias ────────────────────────────────────────────────────

export const BENEFICIARY_UNITS = [
  {
    id: 'ub-mercado',
    generatingUnitId: 'ug-assai',
    name: 'Mercado Central',
    document: '98.765.432/0001-87',
    uc: '7891234',
    email: 'financeiro@mercadocentral.com.br',
    phone: '(43) 99111-2222',
    esaPricePerKwh: 0.30,
    averageConsumptionKwh: 3800,
    allocationPercentage: 32.3,
    status: 'active',
    createdAt: '2025-01-20T09:00:00Z',
  },
  {
    id: 'ub-panificadora',
    generatingUnitId: 'ug-assai',
    name: 'Panificadora Sol',
    document: '11.223.344/0001-55',
    uc: '7891235',
    email: 'contato@panificadorasol.com.br',
    phone: '(43) 98222-3333',
    esaPricePerKwh: 0.28,
    averageConsumptionKwh: 2200,
    allocationPercentage: 18.0,
    status: 'active',
    createdAt: '2025-01-20T09:10:00Z',
  },
  {
    id: 'ub-academia',
    generatingUnitId: 'ug-assai',
    name: 'Academia Movimento',
    document: '55.667.788/0001-22',
    uc: '7891236',
    email: 'adm@academiamovimento.com.br',
    phone: '(43) 97333-4444',
    esaPricePerKwh: 0.29,
    averageConsumptionKwh: 2800,
    allocationPercentage: 22.9,
    status: 'active',
    createdAt: '2025-01-21T10:00:00Z',
  },
  {
    id: 'ub-clinica',
    generatingUnitId: 'ug-assai',
    name: 'Clínica Vida',
    document: '99.887.766/0001-33',
    uc: '7891237',
    email: 'admin@clinicavida.med.br',
    phone: '(43) 96444-5555',
    esaPricePerKwh: 0.31,
    averageConsumptionKwh: 3200,
    allocationPercentage: 26.2,
    status: 'active',
    createdAt: '2025-01-21T10:15:00Z',
  },
];

// ─── Saldo de créditos por beneficiária (mês 2026-07) ─────────────────────────
// coverageMonths = saldoAtual / mediaConsumoMensal
// Mercado Central: (50+4199-3950)/3800 = 299/3800 = 0,08

export const CREDIT_BALANCES = {
  'ub-mercado': {
    beneficiaryUnitId: 'ub-mercado',
    referenceMonth: '2026-07',
    previousBalanceKwh: 50,
    creditsReceivedKwh: 4199,
    creditsCompensatedKwh: 3950,
    balanceKwh: 299,
    coverageMonths: 0.08,
  },
  'ub-panificadora': {
    beneficiaryUnitId: 'ub-panificadora',
    referenceMonth: '2026-07',
    previousBalanceKwh: 20,
    creditsReceivedKwh: 2340,
    creditsCompensatedKwh: 2100,
    balanceKwh: 260,
    coverageMonths: 0.12,
  },
  'ub-academia': {
    beneficiaryUnitId: 'ub-academia',
    referenceMonth: '2026-07',
    previousBalanceKwh: 10,
    creditsReceivedKwh: 2977,
    creditsCompensatedKwh: 2650,
    balanceKwh: 337,
    coverageMonths: 0.12,
  },
  'ub-clinica': {
    beneficiaryUnitId: 'ub-clinica',
    referenceMonth: '2026-07',
    previousBalanceKwh: 30,
    creditsReceivedKwh: 3406,
    creditsCompensatedKwh: 3000,
    balanceKwh: 436,
    coverageMonths: 0.14,
  },
};

// ─── billing snapshots (sem calculationMemory) ────────────────────────────────
// Valores do fixture regressivo da missão anterior.
// invoiceAmount = cobrança ESA separada da conta da distribuidora.

const SETTLEMENT_RECIPIENT = {
  recipientName: 'João Pereira',
  recipientDocument: '123.456.789-01',
  pixKeyType: 'cpf',
  pixKey: '123.456.789-01',
};

export const BILLING_SNAPSHOTS = {
  'ub-mercado': {
    snapshotVersion: '2.0',
    calculationSource: 'legacy-copel-calculator',
    referenceMonth: '2026-07',
    generatingUnitId: 'ug-assai',
    beneficiaryUnitId: 'ub-mercado',
    inputs: {
      monthlyConsumptionKwh: 3950,
      creditsReceivedKwh: 3940,
      purchasePricePerKwh: 0.35,
      esaPricePerKwh: 0.30,
    },
    contaConcessionaria: 453.09,
    contaEsa: 438.81,
    economiaMensal: 14.28,
    economiaPercentual: 3.15,
    economiaAnual: 171.36,
    invoiceAmount: 1185.00,
    componentesTarifarios: { tusd: 218.40, te: 182.90, icms: 46.92, cofins: 4.87 },
    creditos: {
      creditsReceivedKwh: 3940,
      creditsCompensatedKwh: 3950,
      creditBalanceCarriedForwardKwh: 299,
    },
    settlementRecipient: SETTLEMENT_RECIPIENT,
    metadata: { computedAt: '2026-07-31T23:59:59Z', version: '2.0' },
  },
  'ub-panificadora': {
    snapshotVersion: '2.0',
    calculationSource: 'legacy-copel-calculator',
    referenceMonth: '2026-07',
    generatingUnitId: 'ug-assai',
    beneficiaryUnitId: 'ub-panificadora',
    inputs: {
      monthlyConsumptionKwh: 2100,
      creditsReceivedKwh: 2340,
      purchasePricePerKwh: 0.35,
      esaPricePerKwh: 0.28,
    },
    contaConcessionaria: 268.50,
    contaEsa: 256.80,
    economiaMensal: 11.70,
    economiaPercentual: 4.36,
    economiaAnual: 140.40,
    invoiceAmount: 588.00,
    componentesTarifarios: { tusd: 128.00, te: 108.00, icms: 27.60, cofins: 4.90 },
    creditos: {
      creditsReceivedKwh: 2340,
      creditsCompensatedKwh: 2100,
      creditBalanceCarriedForwardKwh: 260,
    },
    settlementRecipient: SETTLEMENT_RECIPIENT,
    metadata: { computedAt: '2026-07-31T23:59:59Z', version: '2.0' },
  },
  'ub-academia': {
    snapshotVersion: '2.0',
    calculationSource: 'legacy-copel-calculator',
    referenceMonth: '2026-07',
    generatingUnitId: 'ug-assai',
    beneficiaryUnitId: 'ub-academia',
    inputs: {
      monthlyConsumptionKwh: 2650,
      creditsReceivedKwh: 2977,
      purchasePricePerKwh: 0.35,
      esaPricePerKwh: 0.29,
    },
    contaConcessionaria: 342.80,
    contaEsa: 328.30,
    economiaMensal: 14.50,
    economiaPercentual: 4.23,
    economiaAnual: 174.00,
    invoiceAmount: 768.50,
    componentesTarifarios: { tusd: 164.00, te: 138.00, icms: 35.30, cofins: 5.50 },
    creditos: {
      creditsReceivedKwh: 2977,
      creditsCompensatedKwh: 2650,
      creditBalanceCarriedForwardKwh: 337,
    },
    settlementRecipient: SETTLEMENT_RECIPIENT,
    metadata: { computedAt: '2026-07-31T23:59:59Z', version: '2.0' },
  },
  'ub-clinica': {
    snapshotVersion: '2.0',
    calculationSource: 'legacy-copel-calculator',
    referenceMonth: '2026-07',
    generatingUnitId: 'ug-assai',
    beneficiaryUnitId: 'ub-clinica',
    inputs: {
      monthlyConsumptionKwh: 3000,
      creditsReceivedKwh: 3406,
      purchasePricePerKwh: 0.35,
      esaPricePerKwh: 0.31,
    },
    contaConcessionaria: 391.20,
    contaEsa: 374.50,
    economiaMensal: 16.70,
    economiaPercentual: 4.27,
    economiaAnual: 200.40,
    invoiceAmount: 930.00,
    componentesTarifarios: { tusd: 188.00, te: 157.00, icms: 40.20, cofins: 6.00 },
    creditos: {
      creditsReceivedKwh: 3406,
      creditsCompensatedKwh: 3000,
      creditBalanceCarriedForwardKwh: 436,
    },
    settlementRecipient: SETTLEMENT_RECIPIENT,
    metadata: { computedAt: '2026-07-31T23:59:59Z', version: '2.0' },
  },
};

// ─── Faturas ESA (estado mutable no provider) ─────────────────────────────────
// 'open' → aguardando pagamento
// 'paid' → pago
// 'overdue' → vencida

export const INITIAL_INVOICES = [
  {
    id: 'inv-001',
    beneficiaryUnitId: 'ub-mercado',
    beneficiaryName: 'Mercado Central',
    referenceMonth: '2026-07',
    amount: 1185.00,
    dueDate: '2026-08-10',
    paymentStatus: 'open',
    paidAt: null,
  },
  {
    id: 'inv-002',
    beneficiaryUnitId: 'ub-panificadora',
    beneficiaryName: 'Panificadora Sol',
    referenceMonth: '2026-07',
    amount: 588.00,
    dueDate: '2026-08-10',
    paymentStatus: 'paid',
    paidAt: '2026-08-08T14:32:00Z',
  },
  {
    id: 'inv-003',
    beneficiaryUnitId: 'ub-academia',
    beneficiaryName: 'Academia Movimento',
    referenceMonth: '2026-07',
    amount: 768.50,
    dueDate: '2026-08-10',
    paymentStatus: 'open',
    paidAt: null,
  },
  {
    id: 'inv-004',
    beneficiaryUnitId: 'ub-clinica',
    beneficiaryName: 'Clínica Vida',
    referenceMonth: '2026-07',
    amount: 930.00,
    dueDate: '2026-08-10',
    paymentStatus: 'overdue',
    paidAt: null,
  },
];

// ─── Importações de faturas da concessionária ──────────────────────────────────
// matched: vinculada com sucesso a uma UB
// pending (uc desconhecido): sem correspondência
// pending (duplicada): mesma UC + mês já importada
// confirmed: processada e confirmada

export const UTILITY_BILL_IMPORTS = [
  {
    id: 'ubi-001',
    uc: '7891234',
    beneficiaryUnitId: 'ub-mercado',
    beneficiaryName: 'Mercado Central',
    referenceMonth: '2026-07',
    status: 'matched',
    kwhConsumed: 3950,
    totalBill: 453.09,
    isDuplicate: false,
    importedAt: '2026-07-12T10:30:00Z',
  },
  {
    id: 'ubi-002',
    uc: '9999999',
    beneficiaryUnitId: null,
    beneficiaryName: null,
    referenceMonth: '2026-07',
    status: 'pending',
    kwhConsumed: 1200,
    totalBill: 198.40,
    isDuplicate: false,
    importedAt: '2026-07-13T14:00:00Z',
    warnings: ['UC 9999999 não encontrada no cadastro de beneficiárias.'],
  },
  {
    id: 'ubi-003',
    uc: '7891234',
    beneficiaryUnitId: 'ub-mercado',
    beneficiaryName: 'Mercado Central',
    referenceMonth: '2026-07',
    status: 'pending',
    kwhConsumed: 3950,
    totalBill: 453.09,
    isDuplicate: true,
    duplicateOf: 'ubi-001',
    importedAt: '2026-07-14T09:00:00Z',
    warnings: ['Importação duplicada detectada: UC 7891234 já importada para 2026-07.'],
  },
  {
    id: 'ubi-004',
    uc: '7891235',
    beneficiaryUnitId: 'ub-panificadora',
    beneficiaryName: 'Panificadora Sol',
    referenceMonth: '2026-07',
    status: 'confirmed',
    kwhConsumed: 2100,
    totalBill: 268.50,
    isDuplicate: false,
    importedAt: '2026-07-12T11:00:00Z',
  },
];

// ─── Alertas ──────────────────────────────────────────────────────────────────

export const ALERTS = [
  {
    id: 'alert-001',
    type: 'LOW_BENEFICIARY_CREDIT_BALANCE',
    severity: 'high',
    entityType: 'beneficiary',
    entityId: 'ub-mercado',
    entityName: 'Mercado Central',
    referenceMonth: '2026-07',
    message: 'Saldo de créditos insuficiente — cobertura de apenas 0,08 meses.',
    suggestion: 'Aumentar o percentual de rateio ou revisar o consumo médio.',
    createdAt: '2026-08-01T06:00:00Z',
  },
  {
    id: 'alert-002',
    type: 'CONSUMPTION_ABOVE_AVERAGE',
    severity: 'medium',
    entityType: 'beneficiary',
    entityId: 'ub-mercado',
    entityName: 'Mercado Central',
    referenceMonth: '2026-07',
    message: 'Consumo mensal (3.950 kWh) acima da média histórica (3.800 kWh) em 3,9%.',
    suggestion: 'Verificar equipamentos com alto consumo ou período de temperatura elevada.',
    createdAt: '2026-08-01T06:00:00Z',
  },
  {
    id: 'alert-003',
    type: 'ALLOCATION_PERCENTAGE_TOTAL_INVALID',
    severity: 'medium',
    entityType: 'generatingUnit',
    entityId: 'ug-assai',
    entityName: 'UG Solar Assaí',
    referenceMonth: '2026-07',
    message: 'Percentual total de rateio é 99,4% — 78 kWh (0,6%) sem beneficiária alocada.',
    suggestion: 'Revisar os percentuais de rateio ou adicionar uma nova beneficiária.',
    createdAt: '2026-08-01T06:00:00Z',
  },
  {
    id: 'alert-004',
    type: 'HIGH_BENEFICIARY_CREDIT_BALANCE',
    severity: 'low',
    entityType: 'beneficiary',
    entityId: 'ub-clinica',
    entityName: 'Clínica Vida',
    referenceMonth: '2026-06',
    message: 'Saldo de créditos acumulado elevado — 1.890 kWh no histórico de jun/2026.',
    suggestion: 'Monitorar acúmulo para evitar perda por vencimento de créditos.',
    createdAt: '2026-07-01T06:00:00Z',
  },
];

// ─── Termos comerciais da UG ──────────────────────────────────────────────────

export const COMMERCIAL_TERMS = {
  'ug-assai': {
    generatingUnitId: 'ug-assai',
    contractStartDate: '2025-01-15',
    contractEndDate: '2030-01-14',
    contractDurationMonths: 60,
    purchasePricePerKwh: 0.35,
    minimumMonthlyGeneration: 10000,
    penaltyPercentageOnShortfall: 5.0,
    paymentTermDays: 10,
    notes: 'Contrato inicial com reajuste anual pelo IPCA.',
  },
};

// ─── Histórico de créditos por beneficiária ───────────────────────────────────

const _buildHistory = (benId, avg) =>
  ['2026-04', '2026-05', '2026-06', '2026-07'].map((month, i) => ({
    referenceMonth: month,
    creditsReceivedKwh: Math.round(avg * (0.95 + i * 0.02)),
    creditsCompensatedKwh: Math.round(avg * (0.93 + i * 0.015)),
    balanceKwh: Math.round(50 + i * 80),
    coverageMonths: parseFloat((0.05 + i * 0.02).toFixed(2)),
  }));

export const BENEFICIARY_HISTORY = {
  'ub-mercado':      _buildHistory('ub-mercado', 3800),
  'ub-panificadora': _buildHistory('ub-panificadora', 2200),
  'ub-academia':     _buildHistory('ub-academia', 2800),
  'ub-clinica':      _buildHistory('ub-clinica', 3200),
};

// ─── Relatórios ───────────────────────────────────────────────────────────────

export const REPORT_OWNER = {
  generatingUnitId: 'ug-assai',
  generatingUnitName: 'UG Solar Assaí',
  referenceMonth: '2026-07',
  totalGenerationKwh: 13000,
  totalAllocatedKwh: 12922,
  totalUnallocatedKwh: 78,
  purchasePricePerKwh: 0.35,
  ownerRevenue: 4522.70,
  settlementRecipient: SETTLEMENT_RECIPIENT,
  creditDestinations: [
    { beneficiaryUnitId: 'ub-mercado',      beneficiaryName: 'Mercado Central',     allocatedKwh: 4199, percentage: 32.3 },
    { beneficiaryUnitId: 'ub-panificadora', beneficiaryName: 'Panificadora Sol',     allocatedKwh: 2340, percentage: 18.0 },
    { beneficiaryUnitId: 'ub-academia',     beneficiaryName: 'Academia Movimento',   allocatedKwh: 2977, percentage: 22.9 },
    { beneficiaryUnitId: 'ub-clinica',      beneficiaryName: 'Clínica Vida',         allocatedKwh: 3406, percentage: 26.2 },
  ],
  generatedAt: '2026-08-01T00:00:00Z',
};

export const REPORT_BENEFICIARY = {
  beneficiaryUnitId: 'ub-mercado',
  beneficiaryName: 'Mercado Central',
  referenceMonth: '2026-07',
  billingSnapshot: BILLING_SNAPSHOTS['ub-mercado'],
  creditBalance: CREDIT_BALANCES['ub-mercado'],
  invoiceAmount: 1185.00,
  settlementRecipient: SETTLEMENT_RECIPIENT,
  savingsHistory: [
    { referenceMonth: '2026-04', economiaMensal: 11.20 },
    { referenceMonth: '2026-05', economiaMensal: 12.50 },
    { referenceMonth: '2026-06', economiaMensal: 13.50 },
    { referenceMonth: '2026-07', economiaMensal: 14.28 },
  ],
  generatedAt: '2026-08-01T00:00:00Z',
};

export const REPORT_ESA_INTERNAL = {
  referenceMonth: '2026-07',
  totalGeneratingUnits: 1,
  totalBeneficiaryUnits: 4,
  totalGenerationKwh: 13000,
  totalAllocatedKwh: 12922,
  totalUnallocatedKwh: 78,
  allocationPercentageTotal: 99.4,
  totalEconomy: 57.18,
  totalInvoiceAmount: 3471.50,
  totalOwnerRevenue: 4522.70,
  allocationDetails: [
    { beneficiaryUnitId: 'ub-mercado',      name: 'Mercado Central',   allocatedKwh: 4199, pct: 32.3, economy: 14.28, invoiceAmount: 1185.00 },
    { beneficiaryUnitId: 'ub-panificadora', name: 'Panificadora Sol',   allocatedKwh: 2340, pct: 18.0, economy: 11.70, invoiceAmount:  588.00 },
    { beneficiaryUnitId: 'ub-academia',     name: 'Academia Movimento', allocatedKwh: 2977, pct: 22.9, economy: 14.50, invoiceAmount:  768.50 },
    { beneficiaryUnitId: 'ub-clinica',      name: 'Clínica Vida',       allocatedKwh: 3406, pct: 26.2, economy: 16.70, invoiceAmount:  930.00 },
  ],
  generatedAt: '2026-08-01T00:00:00Z',
};

export const REPORT_ESA_FINANCIAL = {
  referenceMonth: '2026-07',
  totalRevenue: 3471.50,
  totalOwnerPayout: 4522.70,
  invoicesSummary: {
    total: 4,
    paid: 1,
    open: 2,
    overdue: 1,
    totalAmount: 3471.50,
    paidAmount: 588.00,
    openAmount: 1953.50,
    overdueAmount: 930.00,
  },
  generatedAt: '2026-08-01T00:00:00Z',
};

// ─── Executive summary (calculado a partir dos fixtures) ─────────────────────

export const EXECUTIVE_SUMMARY = {
  referenceMonth: '2026-07',
  totalGeneratingUnits: 1,
  totalBeneficiaryUnits: 4,
  totalGenerationKwh: 13000,
  totalAllocatedKwh: 12922,
  totalUnallocatedKwh: 78,
  allocationPercentageTotal: 99.4,
  totalEconomyBRL: 57.18,
  totalAlertsCount: ALERTS.length,
  alertsByHighSeverity: ALERTS.filter((a) => a.severity === 'high').length,
};
