/**
 * ESA OS — Manual Test: Energy Credits Import Service
 * node src/importers/energy-credits/energy-credits-import-service.manual-test.js
 */

import { EnergyCreditsImportService } from './energy-credits-import-service.js';
import { ENERGY_CREDITS_IMPORT_TYPE } from './import-types.js';
import { EnergyCreditsMemoryRepository } from '../../repositories/energy-credits/energy-credits-memory-repository.js';

const T = ENERGY_CREDITS_IMPORT_TYPE;
const service = new EnergyCreditsImportService();

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

// ── Fixtures ──────────────────────────────────────────────────────────────────
const GU_CSV   = 'id,name,uc,utilityCompany\ngu-001,Solar Norte,UC001,CEMIG\ngu-002,Eólica Sul,UC002,COELBA';
const GU_ROWS  = [{ id: 'gu-001', name: 'Solar Norte', uc: 'UC001' }, { id: 'gu-002', name: 'Eólica Sul', uc: 'UC002' }];
const BU_CSV   = 'id,name,uc,generatingUnitId\nbu-001,Cliente A,UC100,gu-001';
const GUM_CSV  = 'generatingUnitId,referenceMonth,previousBalanceKwh,monthlyGenerationKwh,purchasePricePerKwh\ngu-001,2025-06,1000,5000,0.45';
const BM_CSV   = 'beneficiaryUnitId,generatingUnitId,referenceMonth,monthlyConsumptionKwh,allocatedKwh,compensatedKwh,esaPricePerKwh,utilityTariffPerKwh\nbu-001,gu-001,2025-06,800,700,700,0.40,0.85';

// ── 1. importFromCsv — basic ──────────────────────────────────────────────────
group('1. importFromCsv — basic');
const r1 = service.importFromCsv(T.GENERATING_UNITS, GU_CSV);
assert('1.1 ok=true', r1.ok === true);
assert('1.2 data.length=2', r1.data.length === 2);
assert('1.3 first entity id=gu-001', r1.data[0].id === 'gu-001');
assert('1.4 metadata.importType', r1.metadata.importType === T.GENERATING_UNITS);
assert('1.5 metadata.totalEntities=2', r1.metadata.totalEntities === 2);

// ── 2. importFromCsv — all 4 types ───────────────────────────────────────────
group('2. importFromCsv — all 4 types');
const r2a = service.importFromCsv(T.GENERATING_UNITS, GU_CSV);
assert('2.1 GENERATING_UNITS ok', r2a.ok === true);
const r2b = service.importFromCsv(T.BENEFICIARY_UNITS, BU_CSV);
assert('2.2 BENEFICIARY_UNITS ok', r2b.ok === true);
const r2c = service.importFromCsv(T.GENERATING_UNIT_MONTHLY_RECORDS, GUM_CSV);
assert('2.3 GENERATING_UNIT_MONTHLY_RECORDS ok', r2c.ok === true);
const r2d = service.importFromCsv(T.BENEFICIARY_MONTHLY_RECORDS, BM_CSV);
assert('2.4 BENEFICIARY_MONTHLY_RECORDS ok', r2d.ok === true);

// ── 3. importFromRows — basic ─────────────────────────────────────────────────
group('3. importFromRows — basic');
const r3 = service.importFromRows(T.GENERATING_UNITS, GU_ROWS);
assert('3.1 ok=true', r3.ok === true);
assert('3.2 data.length=2', r3.data.length === 2);
assert('3.3 first id=gu-001', r3.data[0].id === 'gu-001');

// ── 4. importFromRows — invalid inputs ───────────────────────────────────────
group('4. importFromRows — invalid inputs');
const r4a = service.importFromRows(T.GENERATING_UNITS, null);
assert('4.1 null rows → ok=false', r4a.ok === false);
assert('4.2 INVALID_ROWS error', r4a.errors[0]?.code === 'INVALID_ROWS');
const r4b = service.importFromRows('unknown-type', []);
assert('4.3 unknown type → ok=false', r4b.ok === false);
assert('4.4 UNKNOWN_TYPE error', r4b.errors[0]?.code === 'UNKNOWN_TYPE');

// ── 5. importFromCsv — invalid CSV ───────────────────────────────────────────
group('5. importFromCsv — invalid CSV');
const r5 = service.importFromCsv(T.GENERATING_UNITS, null);
assert('5.1 null CSV → ok=false', r5.ok === false);
assert('5.2 stage=parse', r5.metadata?.stage === 'parse');

// ── 6. persist=false (default) ────────────────────────────────────────────────
group('6. persist=false (default)');
const repo6 = new EnergyCreditsMemoryRepository();
const r6 = service.importFromCsv(T.GENERATING_UNITS, GU_CSV, { repository: repo6 });
assert('6.1 ok=true', r6.ok === true);
const listAfter = repo6.listGeneratingUnits();
assert('6.2 nothing persisted (persist=false)', listAfter.data?.length === 0 || listAfter.data == null);

// ── 7. persist=true ───────────────────────────────────────────────────────────
group('7. persist=true');
const repo7 = new EnergyCreditsMemoryRepository();
const r7 = service.importFromCsv(T.GENERATING_UNITS, GU_CSV, { persist: true, repository: repo7 });
assert('7.1 ok=true', r7.ok === true);
const list7 = repo7.listGeneratingUnits();
assert('7.2 2 entities persisted', list7.data?.length === 2);
assert('7.3 first id=gu-001', list7.data?.[0]?.id === 'gu-001');

// ── 8. persist=true — beneficiary units ──────────────────────────────────────
group('8. persist=true — beneficiary units');
const repo8 = new EnergyCreditsMemoryRepository();
const r8 = service.importFromCsv(T.BENEFICIARY_UNITS, BU_CSV, { persist: true, repository: repo8 });
assert('8.1 ok=true', r8.ok === true);
const list8 = repo8.listBeneficiaryUnits();
assert('8.2 1 beneficiary persisted', list8.data?.length === 1);

// ── 9. persist=true — monthly records ────────────────────────────────────────
group('9. persist=true — monthly records');
const repo9 = new EnergyCreditsMemoryRepository();
const r9 = service.importFromCsv(T.GENERATING_UNIT_MONTHLY_RECORDS, GUM_CSV, { persist: true, repository: repo9 });
assert('9.1 ok=true', r9.ok === true);
const list9 = repo9.listGeneratingUnitMonthlyRecords();
assert('9.2 1 record persisted', list9.data?.length === 1);

// ── 10. Validation errors — skip row ─────────────────────────────────────────
group('10. Validation errors skip row');
const badCsv = 'id,name\n,has-no-id-but-uc-required\n\ngu-002,Good Row';
const r10 = service.importFromRows(T.GENERATING_UNITS, [
  { name: 'No ID No UC' },
  { id: 'gu-good', name: 'Good', uc: 'UC001' },
]);
assert('10.1 ok=false (has validation errors)', r10.ok === false);
assert('10.2 good row not in data', r10.data === null);
assert('10.3 has MISSING_IDENTIFIER error', r10.errors.some(e => e.code === 'MISSING_IDENTIFIER'));

// ── 11. Warnings — partial entity with warnings ───────────────────────────────
group('11. Warnings propagated');
const r11 = service.importFromRows(T.GENERATING_UNITS, [{ id: 'gu-001' }]);
assert('11.1 ok=true (warnings only)', r11.ok === true);
assert('11.2 has MISSING_NAME warning', r11.warnings.some(w => w.code === 'MISSING_NAME'));

// ── 12. Metadata ──────────────────────────────────────────────────────────────
group('12. Metadata fields');
const r12 = service.importFromCsv(T.GENERATING_UNITS, GU_CSV);
assert('12.1 totalEntities=2', r12.metadata.totalEntities === 2);
assert('12.2 totalErrors=0', r12.metadata.totalErrors === 0);
assert('12.3 importType set', r12.metadata.importType === T.GENERATING_UNITS);

// ── 13. importFromRows — beneficiary monthly ──────────────────────────────────
group('13. importFromRows — beneficiary monthly');
const bm = { beneficiaryUnitId: 'bu-01', generatingUnitId: 'gu-001', referenceMonth: '2025-06', monthlyConsumptionKwh: 800, allocatedKwh: 700, compensatedKwh: 700, esaPricePerKwh: 0.40, utilityTariffPerKwh: 0.85 };
const r13 = service.importFromRows(T.BENEFICIARY_MONTHLY_RECORDS, [bm]);
assert('13.1 ok=true', r13.ok === true);
assert('13.2 entity id ubm-bu-01-2025-06', r13.data[0].id === 'ubm-bu-01-2025-06');

// ── 14. Empty rows ────────────────────────────────────────────────────────────
group('14. Empty rows array');
const r14 = service.importFromRows(T.GENERATING_UNITS, []);
assert('14.1 ok=true', r14.ok === true);
assert('14.2 data=[]', Array.isArray(r14.data) && r14.data.length === 0);

// ── 15. No repository when persist=true ──────────────────────────────────────
group('15. persist=true without repository');
const r15 = service.importFromRows(T.GENERATING_UNITS, GU_ROWS, { persist: true, repository: null });
assert('15.1 ok=false (NO_REPOSITORY)', r15.ok === false);
assert('15.2 NO_REPOSITORY error', r15.errors.some(e => e.code === 'NO_REPOSITORY'));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
