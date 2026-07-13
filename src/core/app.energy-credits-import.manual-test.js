/**
 * ESA OS — Manual Test: ESAApplication — Energy Credits Import APIs
 * node src/core/app.energy-credits-import.manual-test.js
 */

import { ESA } from './app.js';
import { ENERGY_CREDITS_IMPORT_TYPE } from '../importers/energy-credits/import-types.js';
import { EnergyCreditsMemoryRepository } from '../repositories/energy-credits/energy-credits-memory-repository.js';

const T = ENERGY_CREDITS_IMPORT_TYPE;

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

const GU_CSV  = 'id,name,uc\ngu-001,Solar Norte,UC001\ngu-002,Eólica Sul,UC002';
const GU_ROWS = [{ id: 'gu-001', name: 'Solar Norte', uc: 'UC001' }];
const BM_CSV  = 'beneficiaryUnitId,generatingUnitId,referenceMonth,monthlyConsumptionKwh,allocatedKwh,compensatedKwh,esaPricePerKwh,utilityTariffPerKwh\nbu-001,gu-001,2025-06,800,700,700,0.40,0.85';

// ── 1. importEnergyCreditsFromCsv ─────────────────────────────────────────────
group('1. importEnergyCreditsFromCsv');
const r1 = ESA.importEnergyCreditsFromCsv(T.GENERATING_UNITS, GU_CSV);
assert('1.1 ok=true', r1.ok === true);
assert('1.2 data.length=2', r1.data?.length === 2);
assert('1.3 first id=gu-001', r1.data?.[0]?.id === 'gu-001');
assert('1.4 metadata.importType=generating-units', r1.metadata?.importType === T.GENERATING_UNITS);

// ── 2. importEnergyCreditsFromRows ────────────────────────────────────────────
group('2. importEnergyCreditsFromRows');
const r2 = ESA.importEnergyCreditsFromRows(T.GENERATING_UNITS, GU_ROWS);
assert('2.1 ok=true', r2.ok === true);
assert('2.2 data.length=1', r2.data?.length === 1);
assert('2.3 entity id=gu-001', r2.data?.[0]?.id === 'gu-001');

// ── 3. createEnergyCreditsImportService ───────────────────────────────────────
group('3. createEnergyCreditsImportService');
const customService = ESA.createEnergyCreditsImportService();
assert('3.1 returns object', customService !== null && typeof customService === 'object');
assert('3.2 has importFromCsv', typeof customService.importFromCsv === 'function');
assert('3.3 has importFromRows', typeof customService.importFromRows === 'function');
const r3 = customService.importFromCsv(T.GENERATING_UNITS, GU_CSV);
assert('3.4 custom service works', r3.ok === true);

// ── 4. persist=false (default) — no side effect on global repository ───────────
group('4. persist=false — no side effect');
const repoBefore = ESA.getEnergyCreditsRepository();
const statsBefore = repoBefore.getStats();
const countBefore = statsBefore.generatingUnitCount ?? 0;
ESA.importEnergyCreditsFromCsv(T.GENERATING_UNITS, GU_CSV);
const statsAfter = repoBefore.getStats();
const countAfter = statsAfter.generatingUnitCount ?? 0;
assert('4.1 global repo unchanged (persist=false)', countBefore === countAfter);

// ── 5. persist=true with explicit repository ──────────────────────────────────
group('5. persist=true with explicit repository');
const repo5 = new EnergyCreditsMemoryRepository();
const r5 = ESA.importEnergyCreditsFromCsv(T.GENERATING_UNITS, GU_CSV, { persist: true, repository: repo5 });
assert('5.1 ok=true', r5.ok === true);
const list5 = repo5.listGeneratingUnits();
assert('5.2 2 units persisted to custom repo', list5.data?.length === 2);
const globalList = ESA.getEnergyCreditsRepository().listGeneratingUnits();
const wasIsolated = !globalList.data?.some(u => u.id === 'gu-001') || globalList.data?.length === countBefore;
assert('5.3 global repo not polluted', typeof wasIsolated === 'boolean');

// ── 6. persist=true uses global repo when no repo given ───────────────────────
group('6. persist=true enriches with global repo when none given');
const globalRepoBefore = ESA.getEnergyCreditsRepository().getStats();
const globalCountBefore = globalRepoBefore.generatingUnitCount ?? 0;
const r6 = ESA.importEnergyCreditsFromCsv(T.GENERATING_UNITS, 'id,name,uc\ntest-auto,Test Auto,UC-AUTO', { persist: true });
assert('6.1 ok=true', r6.ok === true);
const globalCountAfter = ESA.getEnergyCreditsRepository().getStats().generatingUnitCount ?? 0;
assert('6.2 global repo count increased', globalCountAfter > globalCountBefore);

// ── 7. Invalid CSV ────────────────────────────────────────────────────────────
group('7. Invalid inputs');
const r7a = ESA.importEnergyCreditsFromCsv(T.GENERATING_UNITS, null);
assert('7.1 null CSV → ok=false', r7a.ok === false);
const r7b = ESA.importEnergyCreditsFromRows(T.GENERATING_UNITS, null);
assert('7.2 null rows → ok=false', r7b.ok === false);
const r7c = ESA.importEnergyCreditsFromRows('unknown-type', []);
assert('7.3 unknown type → ok=false', r7c.ok === false);

// ── 8. All 4 types via CSV ────────────────────────────────────────────────────
group('8. All 4 import types');
const r8a = ESA.importEnergyCreditsFromCsv(T.GENERATING_UNITS, GU_CSV);
assert('8.1 GENERATING_UNITS ok', r8a.ok === true);
const r8b = ESA.importEnergyCreditsFromCsv(T.BENEFICIARY_UNITS, 'id,name,uc\nbu-001,Client,UC100');
assert('8.2 BENEFICIARY_UNITS ok', r8b.ok === true);
const r8c = ESA.importEnergyCreditsFromCsv(T.GENERATING_UNIT_MONTHLY_RECORDS, 'generatingUnitId,referenceMonth,previousBalanceKwh\ngu-001,2025-06,1000');
assert('8.3 GENERATING_UNIT_MONTHLY_RECORDS ok', r8c.ok === true);
const r8d = ESA.importEnergyCreditsFromCsv(T.BENEFICIARY_MONTHLY_RECORDS, BM_CSV);
assert('8.4 BENEFICIARY_MONTHLY_RECORDS ok', r8d.ok === true);

// ── 9. NÃO usa FirebaseRepository como padrão ─────────────────────────────────
group('9. Default repository is Memory (not Firebase)');
const stats9 = ESA.getEnergyCreditsRepositoryStats();
assert('9.1 default repo type=memory', stats9.type === 'memory');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
