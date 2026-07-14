/**
 * ESA OS — Manual Test: Balance Records — Repository + Read Model + Query Service
 * node src/repositories/energy-credits/energy-credits-balance-repository.manual-test.js
 */

import { EnergyCreditsMemoryRepository }    from './energy-credits-memory-repository.js';
import { EnergyCreditsReadModel }            from '../../read-models/energy-credits/energy-credits-read-model.js';
import { EnergyCreditsQueryService }         from '../../queries/energy-credits/energy-credits-query-service.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

// ── Dados de suporte ──────────────────────────────────────────────────────────

const BAL_A1 = { id: 'beneficiary-credit-balance-bu-001-2025-05', beneficiaryUnitId: 'bu-001', generatingUnitId: 'gu-001', referenceMonth: '2025-05', currentBalanceKwh: 300, creditsReceivedKwh: 3800, creditsCompensatedKwh: 3500, status: 'ok', allocationPercentage: 70, coverageMonths: 0.08, alerts: [] };
const BAL_A2 = { id: 'beneficiary-credit-balance-bu-001-2025-06', beneficiaryUnitId: 'bu-001', generatingUnitId: 'gu-001', referenceMonth: '2025-06', currentBalanceKwh: 400, creditsReceivedKwh: 4000, creditsCompensatedKwh: 3900, status: 'ok', allocationPercentage: 65.57, coverageMonths: 0.11, alerts: [] };
const BAL_B1 = { id: 'beneficiary-credit-balance-bu-002-2025-06', beneficiaryUnitId: 'bu-002', generatingUnitId: 'gu-001', referenceMonth: '2025-06', currentBalanceKwh: 100, creditsReceivedKwh: 2100, creditsCompensatedKwh: 2000, status: 'ok', allocationPercentage: 34.43, coverageMonths: 0.05, alerts: [] };

// ── 1. Repositório — save / get ───────────────────────────────────────────────
group('1. Repositório — saveBeneficiaryCreditBalanceRecord / get');
const repo = new EnergyCreditsMemoryRepository();
const sr1 = repo.saveBeneficiaryCreditBalanceRecord(BAL_A1);
assert('1.1 save ok=true', sr1.ok === true);
assert('1.2 save retorna registro com id', sr1.data?.id === BAL_A1.id);
const gr1 = repo.getBeneficiaryCreditBalanceRecord(BAL_A1.id);
assert('1.3 get ok=true', gr1.ok === true);
assert('1.4 get retorna o mesmo registro', gr1.data?.id === BAL_A1.id);
assert('1.5 currentBalanceKwh preservado', gr1.data?.currentBalanceKwh === 300);

// ── 2. Repositório — get inexistente ──────────────────────────────────────────
group('2. Repositório — get registro inexistente');
const gr2 = repo.getBeneficiaryCreditBalanceRecord('beneficiary-credit-balance-nao-existe-2025-01');
assert('2.1 ok=true (null)', gr2.ok === true);
assert('2.2 data = null', gr2.data === null);

// ── 3. Repositório — listBeneficiaryCreditBalanceRecords ──────────────────────
group('3. Repositório — listBeneficiaryCreditBalanceRecords');
repo.saveBeneficiaryCreditBalanceRecord(BAL_A2);
repo.saveBeneficiaryCreditBalanceRecord(BAL_B1);
const lr3a = repo.listBeneficiaryCreditBalanceRecords({ beneficiaryUnitId: 'bu-001' });
assert('3.1 ok=true', lr3a.ok === true);
assert('3.2 filtro por beneficiaryUnitId: 2 registros bu-001', lr3a.data?.length === 2);
const lr3b = repo.listBeneficiaryCreditBalanceRecords({ referenceMonth: '2025-06' });
assert('3.3 filtro por referenceMonth: 2 registros', lr3b.data?.length === 2);
const lr3c = repo.listBeneficiaryCreditBalanceRecords({ generatingUnitId: 'gu-001' });
assert('3.4 filtro por generatingUnitId: 3 registros', lr3c.data?.length === 3);

// ── 4. Repositório — getSnapshot inclui nova coleção ─────────────────────────
group('4. Repositório — getSnapshot inclui beneficiaryCreditBalanceRecords');
const snap4 = repo.getSnapshot();
assert('4.1 beneficiaryCreditBalanceRecords presente no snapshot', Array.isArray(snap4.data?.beneficiaryCreditBalanceRecords));
assert('4.2 snapshot tem 3 registros', snap4.data?.beneficiaryCreditBalanceRecords?.length === 3);

// ── 5. Repositório — hydrateFromSnapshot backward compat ─────────────────────
group('5. Repositório — hydrateFromSnapshot sem coleção (snapshot legado)');
const repo5 = new EnergyCreditsMemoryRepository();
const snapLegacy = { generatingUnits: [], beneficiaryUnits: [], generatingUnitMonthlyRecords: [], beneficiaryMonthlyRecords: [], creditAllocations: [], ownerSettlements: [], esaInvoices: [], monthlyReports: [], creditDocuments: [], creditAuditLog: [] };
let threw5 = false;
try { repo5.hydrateFromSnapshot(snapLegacy); } catch (e) { threw5 = true; }
assert('5.1 não lança exceção com snapshot sem beneficiaryCreditBalanceRecords', threw5 === false);
const stats5 = repo5.getStats();
assert('5.2 beneficiaryCreditBalanceRecordCount = 0 após snapshot legado', stats5.beneficiaryCreditBalanceRecordCount === 0);

// ── 6. Read Model — upsert / get ──────────────────────────────────────────────
group('6. Read Model — upsertBeneficiaryCreditBalanceRecord / get');
const rm6 = new EnergyCreditsReadModel();
rm6.upsertBeneficiaryCreditBalanceRecord(BAL_A1);
rm6.upsertBeneficiaryCreditBalanceRecord(BAL_A2);
rm6.upsertBeneficiaryCreditBalanceRecord(BAL_B1);
const got6 = rm6.getBeneficiaryCreditBalanceRecord(BAL_A2.id);
assert('6.1 get por id retorna registro correto', got6?.id === BAL_A2.id);
assert('6.2 currentBalanceKwh = 400', got6?.currentBalanceKwh === 400);
assert('6.3 allocationPercentage = 65.57', got6?.allocationPercentage === 65.57);

// ── 7. Read Model — listBeneficiaryCreditBalanceRecords com filtros ───────────
group('7. Read Model — listBeneficiaryCreditBalanceRecords filtros');
const list7a = rm6.listBeneficiaryCreditBalanceRecords({ beneficiaryUnitId: 'bu-001' });
assert('7.1 filtro beneficiaryUnitId: 2', list7a.length === 2);
const list7b = rm6.listBeneficiaryCreditBalanceRecords({ referenceMonth: '2025-06' });
assert('7.2 filtro referenceMonth: 2', list7b.length === 2);
const list7c = rm6.listBeneficiaryCreditBalanceRecords({ referenceMonthFrom: '2025-06' });
assert('7.3 filtro referenceMonthFrom=2025-06: 2', list7c.length === 2);
const list7d = rm6.listBeneficiaryCreditBalanceRecords({ referenceMonthTo: '2025-05' });
assert('7.4 filtro referenceMonthTo=2025-05: 1', list7d.length === 1);
const list7e = rm6.listBeneficiaryCreditBalanceRecords({ generatingUnitId: 'gu-001' });
assert('7.5 filtro generatingUnitId: 3', list7e.length === 3);
const list7f = rm6.listBeneficiaryCreditBalanceRecords({ status: 'ok' });
assert('7.6 filtro status=ok: 3', list7f.length === 3);

// ── 8. Read Model — ordenação por referenceMonth ascending ────────────────────
group('8. Read Model — listagem ordenada por referenceMonth');
const list8 = rm6.listBeneficiaryCreditBalanceRecords({ beneficiaryUnitId: 'bu-001' });
assert('8.1 2025-05 antes de 2025-06', list8[0].referenceMonth === '2025-05');
assert('8.2 2025-06 é o segundo', list8[1].referenceMonth === '2025-06');

// ── 9. Read Model — hydrate com snapshot sem coleção ─────────────────────────
group('9. Read Model — hydrate de snapshot legado (sem beneficiaryCreditBalanceRecords)');
const rm9 = new EnergyCreditsReadModel();
let threw9 = false;
try { rm9.hydrate({ generatingUnits: [], beneficiaryUnits: [] }); } catch (e) { threw9 = true; }
assert('9.1 não lança exceção', threw9 === false);
const stats9 = rm9.getStats();
assert('9.2 beneficiaryCreditBalanceRecordCount = 0', stats9.beneficiaryCreditBalanceRecordCount === 0);

// ── 10. Query — getBeneficiaryCreditBalance ───────────────────────────────────
group('10. Query — getBeneficiaryCreditBalance');
const qs10 = new EnergyCreditsQueryService(rm6);
const qr10 = qs10.getBeneficiaryCreditBalance('bu-001', '2025-06');
assert('10.1 data não é nulo', qr10.data !== null && qr10.data !== undefined);
assert('10.2 data não nulo', qr10.data !== null);
assert('10.3 currentBalanceKwh = 400', qr10.data?.currentBalanceKwh === 400);
const qr10b = qs10.getBeneficiaryCreditBalance('bu-001', '2025-01');
assert('10.4 mês sem registro retorna null', qr10b.data === null);

// ── 11. Query — getBeneficiaryCreditBalanceHistory ───────────────────────────
group('11. Query — getBeneficiaryCreditBalanceHistory');
const qr11 = qs10.getBeneficiaryCreditBalanceHistory('bu-001');
assert('11.1 data é array', Array.isArray(qr11.data));
assert('11.2 data é array de 2', Array.isArray(qr11.data) && qr11.data.length === 2);
assert('11.3 metadata.count = 2', qr11.metadata?.count === 2);
const qr11b = qs10.getBeneficiaryCreditBalanceHistory('bu-001', { referenceMonthFrom: '2025-06' });
assert('11.4 filtro referenceMonthFrom: 1 registro', qr11b.data?.length === 1);

// ── 12. Query — getCreditAllocationPlan ──────────────────────────────────────
group('12. Query — getCreditAllocationPlan');
const qr12 = qs10.getCreditAllocationPlan('gu-001', '2025-06');
assert('12.1 data não é nulo', qr12.data !== null && qr12.data !== undefined);
assert('12.2 generatingUnitId correto', qr12.data?.generatingUnitId === 'gu-001');
assert('12.3 referenceMonth correto', qr12.data?.referenceMonth === '2025-06');
assert('12.4 beneficiaryCount = 2', qr12.data?.beneficiaryCount === 2);
const total12 = (BAL_A2.creditsReceivedKwh || 0) + (BAL_B1.creditsReceivedKwh || 0);
assert('12.5 totalPlannedCreditsKwh = 6100', qr12.data?.totalPlannedCreditsKwh === total12);
assert('12.6 beneficiaries ordenados: bu-001 antes de bu-002', qr12.data?.beneficiaries?.[0]?.beneficiaryUnitId === 'bu-001');

// ── 13. Query — getCreditAllocationPlan com read model sem método ─────────────
group('13. Query — getCreditAllocationPlan gracioso sem listBeneficiaryCreditBalanceRecords');
const rmBare = { listGeneratingUnits: () => [], listBeneficiaryUnits: () => [], listBeneficiaryMonthlyRecords: () => [] };
const qsBare = new EnergyCreditsQueryService(rmBare);
const qr13 = qsBare.getCreditAllocationPlan('gu-001', '2025-06');
assert('13.1 data não é nulo (gracioso)', qr13.data !== null && qr13.data !== undefined);
assert('13.2 beneficiaryCount = 0', qr13.data?.beneficiaryCount === 0);
assert('13.3 totalPlannedCreditsKwh = 0', qr13.data?.totalPlannedCreditsKwh === 0);

// ── 14. Repositório — stats ───────────────────────────────────────────────────
group('14. Repositório — getStats inclui beneficiaryCreditBalanceRecordCount');
const stats14 = repo.getStats();
assert('14.1 beneficiaryCreditBalanceRecordCount = 3', stats14.beneficiaryCreditBalanceRecordCount === 3);

// ── 15. Read Model — clear limpa a coleção ────────────────────────────────────
group('15. Read Model — clear limpa beneficiaryCreditBalanceRecords');
const rm15 = new EnergyCreditsReadModel();
rm15.upsertBeneficiaryCreditBalanceRecord(BAL_A1);
rm15.clear();
const stats15 = rm15.getStats();
assert('15.1 beneficiaryCreditBalanceRecordCount = 0 após clear', stats15.beneficiaryCreditBalanceRecordCount === 0);
assert('15.2 getBeneficiaryCreditBalanceRecord → undefined/null após clear', !rm15.getBeneficiaryCreditBalanceRecord(BAL_A1.id));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
