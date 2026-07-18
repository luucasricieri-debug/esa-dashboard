/**
 * Manual contract test — CsvImport shape contracts
 *
 * Verifies that getCsvTemplate:
 *  - maps short UI keys ('ug', 'ub', 'rug', 'rub') to Core keys before calling UIProvider
 *  - maps Core { csvText } → UI { example } and adds { filename }
 *  - never returns null (always returns a valid safe contract)
 *  - returns emptyCsvTemplate with example:'' for unknown types or Core errors
 *  - template.example is always a string (no crash on null.example)
 *  - template.filename is always a string (no crash on null.filename)
 *
 * Run: npx tsx preview/provider-adapter.csv-import.manual-test.ts
 */

import { createProviderAdapter } from '../src/lib/esa/provider-adapter.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function assertEq<T>(label: string, actual: T, expected: T) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}: ${JSON.stringify(actual)}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Real Core shapes (from EnergyCreditsCsvTemplateService) ──────────────────

const CORE_TEMPLATES: Record<string, any> = {
  'generating-units': {
    importType: 'generating-units',
    delimiter: ';',
    headers: ['id', 'name', 'ownerName', 'ownerDocument', 'uc', 'utilityCompany', 'status'],
    exampleRows: [['gu-001', 'Usina Solar Norte', 'João Silva', '123.456.789-00', 'UC001', 'COPEL', 'active']],
    csvText: 'id;name;ownerName;ownerDocument;uc;utilityCompany;status\ngu-001;Usina Solar Norte;João Silva;123.456.789-00;UC001;COPEL;active\n',
    aliases: { id: ['id', 'codigo'], name: ['name', 'nome'] },
  },
  'beneficiary-units': {
    importType: 'beneficiary-units',
    delimiter: ';',
    headers: ['id', 'generatingUnitId', 'name', 'document', 'uc', 'utilityCompany', 'status'],
    exampleRows: [['ub-001', 'gu-001', 'Maria Santos', '987.654.321-00', 'UC002', 'COPEL', 'active']],
    csvText: 'id;generatingUnitId;name;document;uc;utilityCompany;status\nub-001;gu-001;Maria Santos;987.654.321-00;UC002;COPEL;active\n',
    aliases: { id: ['id', 'codigo'] },
  },
  'generating-unit-monthly-records': {
    importType: 'generating-unit-monthly-records',
    delimiter: ';',
    headers: ['id', 'generatingUnitId', 'referenceMonth', 'previousBalanceKwh', 'monthlyGenerationKwh', 'purchasePricePerKwh', 'status'],
    exampleRows: [['gum-001-2025-06', 'gu-001', '2025-06', '500', '4500', '0.40', 'active']],
    csvText: 'id;generatingUnitId;referenceMonth;previousBalanceKwh;monthlyGenerationKwh;purchasePricePerKwh;status\ngum-001-2025-06;gu-001;2025-06;500;4500;0.40;active\n',
    aliases: { id: ['id', 'codigo'] },
  },
  'beneficiary-monthly-records': {
    importType: 'beneficiary-monthly-records',
    delimiter: ';',
    headers: ['id', 'beneficiaryUnitId', 'generatingUnitId', 'referenceMonth', 'monthlyConsumptionKwh', 'allocatedKwh', 'compensatedKwh', 'esaPricePerKwh', 'utilityTariffPerKwh', 'paymentStatus', 'status'],
    exampleRows: [['ubm-001-2025-06', 'ub-001', 'gu-001', '2025-06', '350', '350', '320', '0.35', '0.75', 'pending', 'active']],
    csvText: 'id;beneficiaryUnitId;generatingUnitId;referenceMonth;monthlyConsumptionKwh;allocatedKwh;compensatedKwh;esaPricePerKwh;utilityTariffPerKwh;paymentStatus;status\nubm-001-2025-06;ub-001;gu-001;2025-06;350;350;320;0.35;0.75;pending;active\n',
    aliases: { id: ['id', 'codigo'] },
  },
};

// ── Mock UIProvider that records which coreType was called ───────────────────

function makeMockProvider(options: { returnNull?: boolean } = {}) {
  const calls: string[] = [];
  const mockProvider = {
    searchGeneratingUnits: () => ({ ok: true, data: [], errors: [], warnings: [], metadata: {} }),
    searchBeneficiaryUnits: () => ({ ok: true, data: [], errors: [], warnings: [], metadata: {} }),
    getExecutiveSummary: () => ({ ok: true, data: { generatingUnitCount: 0, beneficiaryUnitCount: 0, totalGenerationKwh: 0, totalCompensatedKwh: 0, totalCurrentBalanceKwh: 0, totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0, totalMonthlyDiscount: 0, criticalAlertCount: 0 }, errors: [], warnings: [], metadata: {} }),
    getAlertsSummary: () => ({ ok: true, data: { alerts: [], totalAlerts: 0, bySeverity: {}, byCode: {} }, errors: [], warnings: [], metadata: {} }),
    getFinancialSummary: () => ({ ok: true, data: { totalEsaRevenue: 0, totalOwnerReturn: 0, grossSpread: 0 }, errors: [], warnings: [], metadata: {} }),
    getGeneratingUnitSummary: () => ({ ok: true, data: null, errors: [], warnings: [], metadata: {} }),
    getAllocationPlan: () => ({ ok: true, data: null, errors: [], warnings: [], metadata: {} }),
    getGeneratingUnitCommercialTerms: () => ({ ok: true, data: null, errors: [], warnings: [], metadata: {} }),

    getCsvTemplate(coreType: string) {
      calls.push(coreType);
      if (options.returnNull) {
        return { ok: false, data: null, errors: [{ code: 'UNKNOWN_IMPORT_TYPE', message: `Tipo desconhecido: ${coreType}` }], warnings: [], metadata: {} };
      }
      const data = CORE_TEMPLATES[coreType];
      if (!data) {
        return { ok: false, data: null, errors: [{ code: 'UNKNOWN_IMPORT_TYPE', message: `Tipo desconhecido: ${coreType}` }], warnings: [], metadata: {} };
      }
      return { ok: true, data, errors: [], warnings: [], metadata: { importType: coreType, delimiter: ';', headerCount: data.headers.length } };
    },
  };
  return { mockProvider, calls };
}

// ── Suite 1: Type key mapping ─────────────────────────────────────────────────

console.log('\n=== Suite 1: Type key mapping (UI short → Core full) ===');
{
  const { mockProvider, calls } = makeMockProvider();
  const adapter = createProviderAdapter(mockProvider);

  adapter.getCsvTemplate('ug');
  adapter.getCsvTemplate('ub');
  adapter.getCsvTemplate('rug');
  adapter.getCsvTemplate('rub');

  assertEq('ug → generating-units', calls[0], 'generating-units');
  assertEq('ub → beneficiary-units', calls[1], 'beneficiary-units');
  assertEq('rug → generating-unit-monthly-records', calls[2], 'generating-unit-monthly-records');
  assertEq('rub → beneficiary-monthly-records', calls[3], 'beneficiary-monthly-records');
}

// ── Suite 2: Field mapping (csvText → example, filename derived) ──────────────

console.log('\n=== Suite 2: Field mapping for all four types ===');
const UG_CSV = 'id;name;ownerName;ownerDocument;uc;utilityCompany;status\ngu-001;Usina Solar Norte;João Silva;123.456.789-00;UC001;COPEL;active\n';

const TYPE_CASES: Array<['ug' | 'ub' | 'rug' | 'rub', string, string, number]> = [
  ['ug',  'modelo-unidades-geradoras.csv',      'generating-units',                    7],
  ['ub',  'modelo-unidades-beneficiarias.csv',  'beneficiary-units',                   7],
  ['rug', 'modelo-registros-mensais-ug.csv',    'generating-unit-monthly-records',      7],
  ['rub', 'modelo-registros-mensais-ub.csv',    'beneficiary-monthly-records',         11],
];

{
  const { mockProvider } = makeMockProvider();
  const adapter = createProviderAdapter(mockProvider);

  for (const [shortType, expectedFilename, expectedImportType, expectedHeaderCount] of TYPE_CASES) {
    const t = adapter.getCsvTemplate(shortType);

    assert(`${shortType}: template is non-null`, t !== null && t !== undefined);
    assert(`${shortType}: example is string`, typeof t.example === 'string');
    assert(`${shortType}: filename is string`, typeof t.filename === 'string');
    assertEq(`${shortType}: filename`, t.filename, expectedFilename);
    assertEq(`${shortType}: delimiter`, t.delimiter, ';');
    assert(`${shortType}: headers is Array`, Array.isArray(t.headers));
    assertEq(`${shortType}: headers.length`, t.headers.length, expectedHeaderCount);
    assert(`${shortType}: exampleRows is Array`, Array.isArray(t.exampleRows));
    assert(`${shortType}: example contains headers`, t.example.includes(t.headers[0]));
    assert(`${shortType}: new Blob([t.example]) does not throw`, (() => { try { new Blob([t.example]); return true; } catch { return false; } })());
    assert(`${shortType}: t.filename is valid download name`, t.filename.endsWith('.csv'));
    assertEq(`${shortType}: importType`, t.importType, expectedImportType);
  }
}

// ── Suite 3: null / Core error → safe empty contract ─────────────────────────

console.log('\n=== Suite 3: Core returns error → safe empty contract ===');
{
  const { mockProvider } = makeMockProvider({ returnNull: true });
  const adapter = createProviderAdapter(mockProvider);

  for (const shortType of ['ug', 'ub', 'rug', 'rub'] as const) {
    const t = adapter.getCsvTemplate(shortType);
    assert(`${shortType} (error): template is not null`, t !== null && t !== undefined);
    assert(`${shortType} (error): example is string`, typeof t.example === 'string');
    assertEq(`${shortType} (error): example is empty string`, t.example, '');
    assert(`${shortType} (error): filename is string`, typeof t.filename === 'string');
    assert(`${shortType} (error): headers is array`, Array.isArray(t.headers));
    assertEq(`${shortType} (error): headers.length`, t.headers.length, 0);
    assert(`${shortType} (error): new Blob([t.example]) does not throw`, (() => { try { new Blob([t.example]); return true; } catch { return false; } })());
  }
}

// ── Suite 4: Download uses csvText (template.example) ────────────────────────

console.log('\n=== Suite 4: Download content equals Core csvText ===');
{
  const { mockProvider } = makeMockProvider();
  const adapter = createProviderAdapter(mockProvider);

  const t = adapter.getCsvTemplate('ug');
  const coreData = CORE_TEMPLATES['generating-units'];
  assertEq('ug: example equals Core csvText', t.example, coreData.csvText);
}

// ── Suite 5: No null access on .example (the original crash) ─────────────────

console.log('\n=== Suite 5: No crash on template.example in all cases ===');
{
  const { mockProvider: normalProvider } = makeMockProvider();
  const { mockProvider: errorProvider } = makeMockProvider({ returnNull: true });
  const normalAdapter = createProviderAdapter(normalProvider);
  const errorAdapter = createProviderAdapter(errorProvider);

  for (const shortType of ['ug', 'ub', 'rug', 'rub'] as const) {
    let crashed = false;
    try {
      const t1 = normalAdapter.getCsvTemplate(shortType);
      void t1.example;
      void t1.filename;
      new Blob([t1.example]);
      void t1.filename.endsWith('.csv');

      const t2 = errorAdapter.getCsvTemplate(shortType);
      void t2.example;
      void t2.filename;
      new Blob([t2.example]);
    } catch {
      crashed = true;
    }
    assert(`${shortType}: no crash on .example access (normal + error paths)`, !crashed);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('SOME ASSERTIONS FAILED');
  process.exit(1);
} else {
  console.log('ALL ASSERTIONS PASSED');
}
