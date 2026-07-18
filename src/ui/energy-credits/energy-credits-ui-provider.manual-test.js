/**
 * ESA OS — Manual Test: Energy Credits UI Provider
 * node src/ui/energy-credits/energy-credits-ui-provider.manual-test.js
 */

import { UIResult }                  from './energy-credits-ui-result.js';
import { EnergyCreditsUINormalizer } from './energy-credits-ui-normalizer.js';
import { EnergyCreditsUIProvider }   from './energy-credits-ui-provider.js';
import { ENERGY_CREDITS_UI_CAPABILITIES, ENERGY_CREDITS_UI_VERSION } from './energy-credits-ui-contract.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

// ── Helpers de mock ───────────────────────────────────────────────────────────

function qResult(data, meta = {}) {
  return { data, metadata: meta, generatedAt: null };
}

function ecResult(data, errors = null) {
  if (errors) return { ok: false, data: null, errors, warnings: [], metadata: {} };
  return { ok: true, data, errors: [], warnings: [], metadata: {} };
}

function billingResult(snapshot = null, errors = null) {
  if (errors) return { ok: false, snapshot: null, errors, warnings: [], metadata: {} };
  return { ok: true, snapshot, errors: [], warnings: [], metadata: {} };
}

function makeMockEsa(overrides = {}) {
  return {
    version: '2.0.0-alpha',
    getEnergyCreditsExecutiveSummary:           () => qResult({ generatingUnitCount: 3 }),
    getEnergyCreditsGeneratingUnitSummary:      () => qResult({ generatingUnit: { id: 'gu-001', name: 'Usina' } }),
    getEnergyCreditsBeneficiarySummary:         () => qResult({ beneficiaryUnit: { id: 'ub-001' } }),
    getEnergyCreditsFinancialSummary:           () => qResult({ totalEsaRevenue: 5000 }),
    getEnergyCreditsAlertsSummary:              () => qResult({ totalAlerts: 2 }),
    queryEnergyCreditsGeneratingUnit:           (id) => qResult({ id }, { query: 'ec.getGeneratingUnit' }),
    queryEnergyCreditsBeneficiaryUnit:          (id) => qResult({ id }, { query: 'ec.getBeneficiaryUnit' }),
    searchEnergyCreditsGeneratingUnits:         () => qResult([{ id: 'gu-001' }], { count: 1 }),
    searchEnergyCreditsBeneficiaryUnits:        () => qResult([{ id: 'ub-001' }], { count: 1 }),
    getEnergyCreditsMonthlyStatement:           () => qResult({ referenceMonth: '2025-06' }),
    getEnergyCreditsGeneratingUnitHistory:      () => qResult([]),
    getEnergyCreditsBeneficiaryHistory:         () => qResult([]),
    calculateEnergyCreditsConsumptionAverage:   () => ecResult({ average: 300 }),
    calculateEnergyCreditsAllocationPlan:       () => ecResult({ plan: [] }),
    calculateEnergyCreditsBeneficiaryBalance:   () => ecResult({ balance: 100 }),
    getEnergyCreditsBeneficiaryCreditBalance:   () => qResult({ currentBalanceKwh: 100 }),
    getEnergyCreditsBeneficiaryCreditBalanceHistory: () => qResult([]),
    getEnergyCreditsAllocationPlan:             () => qResult({ beneficiaryCount: 2 }),
    getEnergyCreditsBeneficiaryConsumptionAverage: () => qResult({ averageKwh: 250 }),
    calculateEnergyBeneficiaryBilling:          () => billingResult({ totalBilledAmount: 400, calculationMemory: { step1: 'hidden' } }),
    buildEnergyCreditsOwnerMonthlyReport:       () => qResult({ reportType: 'owner' }),
    buildEnergyCreditsBeneficiaryMonthlyReport: () => qResult({ reportType: 'beneficiary' }),
    buildEnergyCreditsEsaInternalMonthlyReport: () => qResult({ reportType: 'esa-internal' }),
    buildEnergyCreditsEsaFinancialMonthlyReport:() => qResult({ reportType: 'esa-financial' }),
    importEnergyCreditsFromCsv:                 () => ecResult({ imported: 1 }),
    importEnergyCreditsFromRows:                () => ecResult({ imported: 2 }),
    getEnergyCreditsCsvTemplate:                (type) => ({ ok: true, data: { importType: type, delimiter: ';', headers: ['id'], exampleRows: [], csvText: 'id\n' }, errors: [], warnings: [], metadata: {} }),
    createEnergyUtilityBillImport:              () => ecResult({ id: 'ubill-001', status: 'pending' }),
    matchEnergyUtilityBillImport:               () => ecResult({ matched: true }),
    linkEnergyUtilityBillToBeneficiary:         () => ecResult({ linked: true }),
    prepareEnergyCreditsBeneficiaryFromUtilityBill: () => ecResult({ prepared: true }),
    reviewEnergyUtilityBillImport:              () => ecResult({ reviewed: true }),
    detectEnergyUtilityBillDuplicate:           () => ecResult({ duplicate: false }),
    confirmEnergyUtilityBillMonthlyRecord:      () => ecResult({ confirmed: true }),
    replaceEnergyUtilityBillMonthlyRecord:      () => ecResult({ replaced: true }),
    discardEnergyUtilityBillImport:             () => ecResult({ discarded: true }),
    getEnergyUtilityBillImport:                 () => ecResult({ id: 'ubill-001' }),
    searchEnergyUtilityBillImports:             () => ecResult([{ id: 'ubill-001' }]),
    getUnlinkedEnergyUtilityBills:              () => ecResult([]),
    getEnergyCreditsBeneficiaryMonthlyDataSources: () => qResult({ monthlyRecords: [], utilityBillImports: [] }),
    buildEnergyBillingInputFromUtilityBillMonthlyRecord: () => ecResult({ referenceMonth: '2025-06' }),
    createEnergyCreditsGeneratingUnit:          (input) => ecResult({ id: input.id || 'gu-new', name: input.name }),
    createEnergyCreditsBeneficiaryUnit:         (input) => ecResult({ id: input.id || 'ub-new', name: input.name }),
    updateEnergyCreditsGeneratingUnit:          (id, input) => ecResult(Object.assign({ id }, input)),
    updateEnergyCreditsBeneficiaryUnit:         (id, input) => ecResult(Object.assign({ id }, input)),
    getEnergyCreditsGeneratingUnitCommercialTerms: (id) => ecResult({ generatingUnitId: id, purchasePricePerKwh: 0.40 }),
    updateEnergyCreditsGeneratingUnitCommercialTerms: (id, input) => ecResult(Object.assign({ id }, input)),
    getEnergyCreditsSettlementRecipient:        (id) => ecResult({ generatingUnitId: id, pixKey: 'pix@esa.com.br' }),
    updateEnergyCreditsSettlementRecipient:     (id, input) => ecResult(Object.assign({ id }, input)),
    confirmEnergyCreditsInvoicePayment:         (invoiceId, pd) => ecResult({ invoiceId, paymentStatus: 'paid', paidAmount: pd.paidAmount }),
    reopenEnergyCreditsInvoicePayment:          (invoiceId, reason) => ecResult({ invoiceId, paymentStatus: 'open', reopenReason: reason }),
    confirmEnergyCreditsOwnerSettlementPayment: (sid, pd) => ecResult({ settlementId: sid, paymentStatus: 'paid', paidAmount: pd.paidAmount }),
    reopenEnergyCreditsOwnerSettlementPayment:  (sid, reason) => ecResult({ settlementId: sid, paymentStatus: 'open', reopenReason: reason }),
    ...overrides,
  };
}

// ── 1. UIResult ───────────────────────────────────────────────────────────────

group('1. UIResult.ok');
{
  const r = UIResult.ok({ x: 1 }, { q: 'test' }, []);
  assert('1.1 ok=true', r.ok === true);
  assert('1.2 data presente', r.data?.x === 1);
  assert('1.3 metadata presente', r.metadata?.q === 'test');
  assert('1.4 errors vazio', r.errors.length === 0);
  assert('1.5 warnings vazio', r.warnings.length === 0);
}

group('2. UIResult.fail');
{
  const r = UIResult.fail([{ code: 'ERR', message: 'falhou' }]);
  assert('2.1 ok=false', r.ok === false);
  assert('2.2 data=null', r.data === null);
  assert('2.3 errors[0].code=ERR', r.errors[0]?.code === 'ERR');
}

group('3. UIResult.fromApplicationResult — EnergyCreditsQueryResult serializado');
{
  const appResult = { data: { x: 42 }, metadata: { q: 'test' }, generatedAt: null };
  const r = UIResult.fromApplicationResult(appResult);
  assert('3.1 ok=true', r.ok === true);
  assert('3.2 data.x=42', r.data?.x === 42);
  assert('3.3 metadata copiada', r.metadata?.q === 'test');
}

group('4. UIResult.fromApplicationResult — EnergyBillingResult');
{
  const appResult = { ok: true, snapshot: { totalBilledAmount: 500 }, errors: [], warnings: [], metadata: {} };
  const r = UIResult.fromApplicationResult(appResult);
  assert('4.1 ok=true', r.ok === true);
  assert('4.2 data=snapshot', r.data?.totalBilledAmount === 500);
}

group('5. UIResult.fromApplicationResult — EnergyBillingResult fail');
{
  const appResult = { ok: false, snapshot: null, errors: [{ code: 'BILLING_ERR' }], warnings: [], metadata: {} };
  const r = UIResult.fromApplicationResult(appResult);
  assert('5.1 ok=false', r.ok === false);
  assert('5.2 errors propagados', r.errors[0]?.code === 'BILLING_ERR');
}

group('6. UIResult.fromApplicationResult — EnergyCreditsResult');
{
  const appResult = { ok: true, data: { id: 'gu-001' }, errors: [], warnings: [], metadata: {} };
  const r = UIResult.fromApplicationResult(appResult);
  assert('6.1 ok=true', r.ok === true);
  assert('6.2 data.id correto', r.data?.id === 'gu-001');
}

group('7. UIResult.fromApplicationResult — null');
{
  const r = UIResult.fromApplicationResult(null);
  assert('7.1 ok=false para null', r.ok === false);
  assert('7.2 erro NULL_RESULT', r.errors[0]?.code === 'NULL_RESULT');
}

group('8. UIResult.fromApplicationResult — EnergyCreditsResult fail');
{
  const appResult = { ok: false, data: null, errors: [{ code: 'VALIDATION_ERR' }], warnings: [], metadata: {} };
  const r = UIResult.fromApplicationResult(appResult);
  assert('8.1 ok=false', r.ok === false);
  assert('8.2 errors propagados', r.errors[0]?.code === 'VALIDATION_ERR');
}

// ── 9. EnergyCreditsUINormalizer ──────────────────────────────────────────────

group('9. EnergyCreditsUINormalizer — calculationMemory removido');
{
  const norm = new EnergyCreditsUINormalizer();
  const data = {
    totalBilledAmount: 400,
    calculationMemory: { step1: 'private' },
    tariffs: { te: 0.5, calculationMemory: { nested: true } },
  };
  const result = norm.normalize(data);
  assert('9.1 totalBilledAmount preservado', result.totalBilledAmount === 400);
  assert('9.2 calculationMemory removido (nível 0)', !('calculationMemory' in result));
  assert('9.3 tariffs preservado', result.tariffs?.te === 0.5);
  assert('9.4 calculationMemory removido (aninhado)', !('calculationMemory' in result.tariffs));
}

group('10. EnergyCreditsUINormalizer — campos sensíveis removidos');
{
  const norm = new EnergyCreditsUINormalizer();
  const data = {
    id: 'gu-001',
    password: 'senha123',
    passHash: 'hash',
    sessionToken: 'tok',
    sessionExpiresAt: '2025-01-01',
    serviceAccount: { key: 'val' },
    firebaseConfig: { apiKey: 'key' },
    apiKey: 'secret-key',
    secret: 'shhhh',
    downloadUrl: 'https://storage.example',
    stack: 'Error at line 1',
    stackTrace: '...',
    internalLog: 'debug msg',
    name: 'Usina Solar',
  };
  const result = norm.normalize(data);
  assert('10.1 id preservado', result.id === 'gu-001');
  assert('10.2 name preservado', result.name === 'Usina Solar');
  assert('10.3 password removido', !('password' in result));
  assert('10.4 passHash removido', !('passHash' in result));
  assert('10.5 sessionToken removido', !('sessionToken' in result));
  assert('10.6 serviceAccount removido', !('serviceAccount' in result));
  assert('10.7 firebaseConfig removido', !('firebaseConfig' in result));
  assert('10.8 apiKey removido', !('apiKey' in result));
  assert('10.9 secret removido', !('secret' in result));
  assert('10.10 stack removido', !('stack' in result));
  assert('10.11 internalLog removido', !('internalLog' in result));
}

group('11. EnergyCreditsUINormalizer — campos permitidos mantidos');
{
  const norm = new EnergyCreditsUINormalizer();
  const data = {
    calculationSource:   'billing-engine-v2',
    contaConcessionaria: 150.00,
    contaEsa:            120.00,
    economiaMensal:      30.00,
    economiaPercentual:  20,
    economiaAnual:       360.00,
    componentesTarifarios: { te: 0.5, tusd: 0.3 },
    creditos:            300,
    settlementRecipient: { pixKey: 'pix@dono.com' },
    pixKey:              'pix@dono.com',
    pixKeyType:          'email',
  };
  const result = norm.normalize(data);
  assert('11.1 calculationSource mantido', result.calculationSource === 'billing-engine-v2');
  assert('11.2 contaConcessionaria mantida', result.contaConcessionaria === 150.00);
  assert('11.3 economiaMensal mantida', result.economiaMensal === 30.00);
  assert('11.4 componentesTarifarios mantidos', result.componentesTarifarios?.te === 0.5);
  assert('11.5 creditos mantido', result.creditos === 300);
  assert('11.6 settlementRecipient mantido', result.settlementRecipient?.pixKey === 'pix@dono.com');
  assert('11.7 pixKey mantido', result.pixKey === 'pix@dono.com');
  assert('11.8 pixKeyType mantido', result.pixKeyType === 'email');
}

group('12. EnergyCreditsUINormalizer — recursão em arrays');
{
  const norm = new EnergyCreditsUINormalizer();
  const data = [
    { id: 'a', calculationMemory: { x: 1 }, name: 'A' },
    { id: 'b', secret: 'shh', name: 'B' },
  ];
  const result = norm.normalize(data);
  assert('12.1 array preservado', Array.isArray(result));
  assert('12.2 calculationMemory removido em array[0]', !('calculationMemory' in result[0]));
  assert('12.3 name preservado em array[0]', result[0].name === 'A');
  assert('12.4 secret removido em array[1]', !('secret' in result[1]));
  assert('12.5 name preservado em array[1]', result[1].name === 'B');
}

// ── 13. EnergyCreditsUIProvider — construtor ──────────────────────────────────

group('13. EnergyCreditsUIProvider — construtor');
{
  let threw = false;
  try { new EnergyCreditsUIProvider(null); } catch (e) { threw = true; }
  assert('13.1 lança TypeError sem esaApplication', threw);

  const p = new EnergyCreditsUIProvider(makeMockEsa());
  assert('13.2 instância criada com esa válido', p instanceof EnergyCreditsUIProvider);
}

// ── 14. Dashboard ─────────────────────────────────────────────────────────────

group('14. Dashboard');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r1 = p.getExecutiveSummary();
  assert('14.1 getExecutiveSummary ok=true', r1.ok === true);
  assert('14.2 generatingUnitCount presente', r1.data?.generatingUnitCount === 3);

  const r2 = p.getGeneratingUnitSummary('gu-001');
  assert('14.3 getGeneratingUnitSummary ok=true', r2.ok === true);

  const r3 = p.getFinancialSummary();
  assert('14.4 getFinancialSummary ok=true', r3.ok === true);
  assert('14.5 totalEsaRevenue presente', r3.data?.totalEsaRevenue === 5000);

  const r4 = p.getAlertsSummary();
  assert('14.6 getAlertsSummary ok=true', r4.ok === true);
}

// ── 15. Billing — calculationMemory removido ──────────────────────────────────

group('15. Billing — calculationMemory removido pelo provider');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r = p.calculateBeneficiaryBilling({ beneficiaryUnitId: 'ub-001' });
  assert('15.1 ok=true', r.ok === true);
  assert('15.2 totalBilledAmount presente', r.data?.totalBilledAmount === 400);
  assert('15.3 calculationMemory ausente', !('calculationMemory' in (r.data || {})));
}

// ── 16. Allocation ────────────────────────────────────────────────────────────

group('16. Allocation');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r1 = p.calculateConsumptionAverage({ beneficiaryUnitId: 'ub-001' });
  assert('16.1 calculateConsumptionAverage ok=true', r1.ok === true);

  const r2 = p.getBeneficiaryCreditBalance('ub-001', '2025-06');
  assert('16.2 getBeneficiaryCreditBalance ok=true', r2.ok === true);
  assert('16.3 currentBalanceKwh presente', r2.data?.currentBalanceKwh === 100);

  const r3 = p.getBeneficiaryConsumptionAverage('ub-001');
  assert('16.4 getBeneficiaryConsumptionAverage ok=true', r3.ok === true);
  assert('16.5 averageKwh presente', r3.data?.averageKwh === 250);
}

// ── 17. Relatórios ────────────────────────────────────────────────────────────

group('17. Relatórios');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r1 = p.getOwnerMonthlyReport('gu-001', '2025-06');
  assert('17.1 getOwnerMonthlyReport ok=true', r1.ok === true);
  assert('17.2 reportType=owner', r1.data?.reportType === 'owner');

  const r2 = p.getBeneficiaryMonthlyReport('ub-001', '2025-06');
  assert('17.3 getBeneficiaryMonthlyReport ok=true', r2.ok === true);

  const r3 = p.getEsaInternalMonthlyReport('2025-06');
  assert('17.4 getEsaInternalMonthlyReport ok=true', r3.ok === true);

  const r4 = p.getEsaFinancialMonthlyReport('2025-06');
  assert('17.5 getEsaFinancialMonthlyReport ok=true', r4.ok === true);
}

// ── 18. CSV Template ──────────────────────────────────────────────────────────

group('18. CSV Template');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r = p.getCsvTemplate('generating-units');
  assert('18.1 ok=true', r.ok === true);
  assert('18.2 importType presente', r.data?.importType === 'generating-units');
  assert('18.3 delimiter presente', r.data?.delimiter === ';');
}

// ── 19. CSV Import ────────────────────────────────────────────────────────────

group('19. CSV Import');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r1 = p.importFromCsv('generating-units', 'id;name\ngu-001;Usina');
  assert('19.1 importFromCsv ok=true', r1.ok === true);

  const r2 = p.importFromRows('beneficiary-units', [{ id: 'ub-001', name: 'Maria' }]);
  assert('19.2 importFromRows ok=true', r2.ok === true);
}

// ── 20. Utility Bill Import ───────────────────────────────────────────────────

group('20. Utility Bill Import');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());

  const r1 = p.createUtilityBillImport({ uc: 'UC001', referenceMonth: '2025-06' });
  assert('20.1 createUtilityBillImport ok=true', r1.ok === true);

  const r2 = p.matchUtilityBillImport('ubill-001', [{ id: 'ub-001', uc: 'UC001' }]);
  assert('20.2 matchUtilityBillImport ok=true', r2.ok === true);

  const r3 = p.confirmUtilityBillMonthlyRecord('ubill-001');
  assert('20.3 confirmUtilityBillMonthlyRecord ok=true', r3.ok === true);

  const r4 = p.discardUtilityBillImport('ubill-001');
  assert('20.4 discardUtilityBillImport ok=true', r4.ok === true);

  const r5 = p.getUtilityBillImport('ubill-001');
  assert('20.5 getUtilityBillImport ok=true', r5.ok === true);

  const r6 = p.searchUtilityBillImports({});
  assert('20.6 searchUtilityBillImports ok=true', r6.ok === true);
  assert('20.7 retorna array', Array.isArray(r6.data));

  const r7 = p.getBeneficiaryMonthlyDataSources('ub-001', '2025-06');
  assert('20.8 getBeneficiaryMonthlyDataSources ok=true', r7.ok === true);
}

// ── 21. Cadastros UG ──────────────────────────────────────────────────────────

group('21. Cadastros — createGeneratingUnit');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r = p.createGeneratingUnit({ id: 'gu-new', name: 'Nova Usina' });
  assert('21.1 ok=true', r.ok === true);
  assert('21.2 id presente', r.data?.id === 'gu-new');
  assert('21.3 name presente', r.data?.name === 'Nova Usina');
}

group('22. Cadastros — createBeneficiaryUnit');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r = p.createBeneficiaryUnit({ id: 'ub-new', name: 'Maria' });
  assert('22.1 ok=true', r.ok === true);
  assert('22.2 id presente', r.data?.id === 'ub-new');
}

group('23. Cadastros — updateGeneratingUnit');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r = p.updateGeneratingUnit('gu-001', { name: 'Usina Renomeada' });
  assert('23.1 ok=true', r.ok === true);
  assert('23.2 id=gu-001', r.data?.id === 'gu-001');
  assert('23.3 name atualizado', r.data?.name === 'Usina Renomeada');
}

group('24. Cadastros — updateBeneficiaryUnit');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r = p.updateBeneficiaryUnit('ub-001', { subscriptionStatus: 'inactive' });
  assert('24.1 ok=true', r.ok === true);
}

// ── 25. Commercial Terms ──────────────────────────────────────────────────────

group('25. Commercial Terms');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r1 = p.getGeneratingUnitCommercialTerms('gu-001');
  assert('25.1 getGeneratingUnitCommercialTerms ok=true', r1.ok === true);
  assert('25.2 purchasePricePerKwh presente', r1.data?.purchasePricePerKwh === 0.40);

  const r2 = p.updateGeneratingUnitCommercialTerms('gu-001', { purchasePricePerKwh: 0.45, effectiveFrom: '2025-07-01' });
  assert('25.3 updateGeneratingUnitCommercialTerms ok=true', r2.ok === true);
}

// ── 26. Settlement Recipient ──────────────────────────────────────────────────

group('26. Settlement Recipient');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r1 = p.getSettlementRecipient('gu-001');
  assert('26.1 getSettlementRecipient ok=true', r1.ok === true);
  assert('26.2 pixKey presente', r1.data?.pixKey === 'pix@esa.com.br');
  assert('26.3 secret ausente', !('secret' in (r1.data || {})));

  const r2 = p.updateSettlementRecipient('gu-001', { pixKey: 'novo@pix.com', pixKeyType: 'email' });
  assert('26.4 updateSettlementRecipient ok=true', r2.ok === true);
}

// ── 27. Invoice Payment ───────────────────────────────────────────────────────

group('27. Invoice Payment');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r1 = p.confirmInvoicePayment('inv-001', { paidAmount: 350, paidAt: '2025-06-10' });
  assert('27.1 confirmInvoicePayment ok=true', r1.ok === true);
  assert('27.2 paymentStatus=paid', r1.data?.paymentStatus === 'paid');
  assert('27.3 paidAmount correto', r1.data?.paidAmount === 350);

  const r2 = p.reopenInvoicePayment('inv-001', 'Pagamento duplicado');
  assert('27.4 reopenInvoicePayment ok=true', r2.ok === true);
  assert('27.5 paymentStatus=open', r2.data?.paymentStatus === 'open');
  assert('27.6 reopenReason presente', r2.data?.reopenReason === 'Pagamento duplicado');
}

// ── 28. Owner Settlement Payment ──────────────────────────────────────────────

group('28. Owner Settlement Payment');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r1 = p.confirmOwnerSettlementPayment('settle-001', { paidAmount: 2000, paidAt: '2025-06-15' });
  assert('28.1 confirmOwnerSettlementPayment ok=true', r1.ok === true);
  assert('28.2 paymentStatus=paid', r1.data?.paymentStatus === 'paid');
  assert('28.3 paidAmount correto', r1.data?.paidAmount === 2000);

  const r2 = p.reopenOwnerSettlementPayment('settle-001', 'Valor incorreto');
  assert('28.4 reopenOwnerSettlementPayment ok=true', r2.ok === true);
  assert('28.5 paymentStatus=open', r2.data?.paymentStatus === 'open');
  assert('28.6 reopenReason presente', r2.data?.reopenReason === 'Valor incorreto');
}

// ── 29. Propagação de erro da aplicação ───────────────────────────────────────

group('29. Erro da aplicação propagado corretamente');
{
  const failEsa = makeMockEsa({
    getEnergyCreditsExecutiveSummary: () => ({ ok: false, data: null, errors: [{ code: 'SUMMARY_ERR', message: 'falhou' }], warnings: [], metadata: {} }),
  });
  const p = new EnergyCreditsUIProvider(failEsa);
  const r = p.getExecutiveSummary();
  assert('29.1 ok=false quando app retorna fail', r.ok === false);
  assert('29.2 errors propagados', r.errors[0]?.code === 'SUMMARY_ERR');
  assert('29.3 data=null', r.data === null);
}

// ── 30. getCapabilities ───────────────────────────────────────────────────────

group('30. getCapabilities');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r = p.getCapabilities();
  assert('30.1 ok=true', r.ok === true);
  assert('30.2 version presente', r.data?.version === ENERGY_CREDITS_UI_VERSION);
  assert('30.3 esaVersion presente', r.data?.esaVersion === '2.0.0-alpha');
  assert('30.4 capabilities presente', typeof r.data?.capabilities === 'object');
  assert('30.5 DASHBOARD em capabilities', Array.isArray(r.data?.capabilities?.DASHBOARD));
  assert('30.6 BILLING em capabilities', Array.isArray(r.data?.capabilities?.BILLING));
}

// ── 31. getStats ──────────────────────────────────────────────────────────────

group('31. getStats');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa());
  const r = p.getStats();
  assert('31.1 ok=true', r.ok === true);
  assert('31.2 version presente', r.data?.version === ENERGY_CREDITS_UI_VERSION);
  assert('31.3 capabilityGroups > 0', r.data?.capabilityGroups > 0);
  assert('31.4 totalCapabilities > 0', r.data?.totalCapabilities > 0);
}

// ── 32. UIResult.fromApplicationResult — com .toJSON() ────────────────────────

group('32. UIResult.fromApplicationResult — objeto com .toJSON()');
{
  const objWithToJSON = {
    data: { count: 5 },
    metadata: { query: 'test' },
    generatedAt: '2025-06-01',
    toJSON() { return { data: this.data, metadata: this.metadata, generatedAt: this.generatedAt }; },
  };
  const r = UIResult.fromApplicationResult(objWithToJSON);
  assert('32.1 ok=true', r.ok === true);
  assert('32.2 data.count=5', r.data?.count === 5);
  assert('32.3 generatedAt em metadata', r.metadata?.generatedAt === '2025-06-01');
}

// ── 33. ESA Application — createEnergyCreditsGeneratingUnit ───────────────────

group('33. ESA Application — createEnergyCreditsGeneratingUnit (via provider mock)');
{
  let savedUnit = null;
  const esa = makeMockEsa({
    createEnergyCreditsGeneratingUnit: (input, opts) => {
      if (opts.persist) savedUnit = input;
      return ecResult({ id: input.id, name: input.name });
    },
  });
  const p = new EnergyCreditsUIProvider(esa);

  const r1 = p.createGeneratingUnit({ id: 'gu-persist', name: 'Usina' }, { persist: false });
  assert('33.1 persist=false: ok=true', r1.ok === true);
  assert('33.2 persist=false: não salva', savedUnit === null);

  const r2 = p.createGeneratingUnit({ id: 'gu-persist', name: 'Usina' }, { persist: true });
  assert('33.3 persist=true: ok=true', r2.ok === true);
  assert('33.4 persist=true: salvo', savedUnit?.id === 'gu-persist');
}

// ── 34. ESA Application — updateEnergyCreditsGeneratingUnit — not found ───────

group('34. ESA Application — update not-found');
{
  const esa = makeMockEsa({
    updateEnergyCreditsGeneratingUnit: (id, input, opts) => ({
      ok: false, data: null,
      errors: [{ code: 'GU_NOT_FOUND', message: `UG ${id} não encontrada`, field: 'id', metadata: {} }],
      warnings: [], metadata: {},
    }),
  });
  const p = new EnergyCreditsUIProvider(esa);
  const r = p.updateGeneratingUnit('gu-inexistente', { name: 'X' });
  assert('34.1 ok=false para GU não encontrada', r.ok === false);
  assert('34.2 código GU_NOT_FOUND', r.errors[0]?.code === 'GU_NOT_FOUND');
}

// ── 35. ESA Application — confirmInvoicePayment — reason obrigatório no reopen

group('35. reopen — reason vazio retorna erro');
{
  const esa = makeMockEsa({
    reopenEnergyCreditsInvoicePayment: (invoiceId, reason) => {
      if (!reason || !reason.trim()) {
        return { ok: false, data: null, errors: [{ code: 'REOPEN_REASON_REQUIRED', message: 'Motivo obrigatório', field: 'reason', metadata: {} }], warnings: [], metadata: {} };
      }
      return ecResult({ invoiceId, paymentStatus: 'open', reopenReason: reason });
    },
  });
  const p = new EnergyCreditsUIProvider(esa);
  const r = p.reopenInvoicePayment('inv-001', '');
  assert('35.1 ok=false sem reason', r.ok === false);
  assert('35.2 código REOPEN_REASON_REQUIRED', r.errors[0]?.code === 'REOPEN_REASON_REQUIRED');
}

// ── 36. ENERGY_CREDITS_UI_CAPABILITIES integridade ───────────────────────────

group('36. ENERGY_CREDITS_UI_CAPABILITIES integridade');
{
  assert('36.1 DASHBOARD array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.DASHBOARD));
  assert('36.2 BILLING array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.BILLING));
  assert('36.3 UTILITY_BILL_IMPORT array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.UTILITY_BILL_IMPORT));
  assert('36.4 CADASTROS array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.CADASTROS));
  assert('36.5 COMMERCIAL_TERMS array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.COMMERCIAL_TERMS));
  assert('36.6 SETTLEMENT_RECIPIENT array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.SETTLEMENT_RECIPIENT));
  assert('36.7 INVOICE_PAYMENT array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.INVOICE_PAYMENT));
  assert('36.8 OWNER_SETTLEMENT_PAYMENT array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.OWNER_SETTLEMENT_PAYMENT));
  assert('36.9 CSV_TEMPLATE array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.CSV_TEMPLATE));
  assert('36.10 PROVIDER array', Array.isArray(ENERGY_CREDITS_UI_CAPABILITIES.PROVIDER));
}

// ── 37. Normalização profunda em relatório com snapshot aninhado ──────────────

group('37. Normalização de billing snapshot aninhado');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa({
    calculateEnergyBeneficiaryBilling: () => ({
      ok: true,
      snapshot: {
        totalBilledAmount: 300,
        calculationMemory: { step1: 'private', allocations: [{ secret: 'val' }] },
        breakdown: {
          esa: 100,
          calculationMemory: { detail: 'private' },
        },
      },
      errors: [], warnings: [], metadata: {},
    }),
  }));
  const r = p.calculateBeneficiaryBilling({});
  assert('37.1 ok=true', r.ok === true);
  assert('37.2 totalBilledAmount presente', r.data?.totalBilledAmount === 300);
  assert('37.3 calculationMemory removido (top-level)', !('calculationMemory' in (r.data || {})));
  assert('37.4 breakdown.esa presente', r.data?.breakdown?.esa === 100);
  assert('37.5 breakdown.calculationMemory removido', !('calculationMemory' in (r.data?.breakdown || {})));
}

// ── 38. CSV Template — tipo inválido ─────────────────────────────────────────

group('38. CSV Template — tipo inválido');
{
  const p = new EnergyCreditsUIProvider(makeMockEsa({
    getEnergyCreditsCsvTemplate: (type) => ({
      ok: false, data: null,
      errors: [{ code: 'UNKNOWN_IMPORT_TYPE', message: `Tipo desconhecido: ${type}`, field: 'importType', metadata: {} }],
      warnings: [], metadata: {},
    }),
  }));
  const r = p.getCsvTemplate('tipo-invalido');
  assert('38.1 ok=false para tipo inválido', r.ok === false);
  assert('38.2 código UNKNOWN_IMPORT_TYPE', r.errors[0]?.code === 'UNKNOWN_IMPORT_TYPE');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
