/**
 * ESA OS — Tests / Energy Utility Bills
 * utility-bill-query-service.manual-test.js
 */

import { UtilityBillImportService } from '../../importers/energy-utility-bills/utility-bill-import-service.js';
import { UtilityBillQueryService }  from './utility-bill-query-service.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function makeExtraction(overrides = {}) {
  return {
    uc: 'UC001',
    referenceMonth: '2025-06',
    utilityCompany: 'COPEL',
    monthlyConsumptionKwh: 250,
    ...overrides,
  };
}

const units = [
  { id: 'ben-001', uc: 'UC001', generatingUnitId: 'gen-001' },
  { id: 'ben-002', uc: 'UC002', generatingUnitId: 'gen-001' },
];

// ── Setup compartilhado ───────────────────────────────────────────────────────

function makeServices() {
  const importSvc = new UtilityBillImportService();
  const querySvc  = new UtilityBillQueryService(importSvc);
  return { importSvc, querySvc };
}

// ── Suite 1: getUtilityBillImport ─────────────────────────────────────────────

console.log('\n[1] getUtilityBillImport');

{
  const { importSvc, querySvc } = makeServices();
  const created = importSvc.createImport(makeExtraction());
  const result  = querySvc.getUtilityBillImport(created.data.id);
  assert('ok=true', result.ok);
  assert('retorna o import correto', result.data.id === created.data.id);
}

{
  const { querySvc } = makeServices();
  const result = querySvc.getUtilityBillImport('nao-existe');
  assert('ok=false para id inexistente', !result.ok);
}

// ── Suite 2: searchUtilityBillImports ────────────────────────────────────────

console.log('\n[2] searchUtilityBillImports');

{
  const { importSvc, querySvc } = makeServices();
  importSvc.createImport(makeExtraction({ uc: 'UC001', referenceMonth: '2025-06' }));
  importSvc.createImport(makeExtraction({ uc: 'UC002', referenceMonth: '2025-07' }));
  importSvc.createImport(makeExtraction({ uc: 'UC003', referenceMonth: '2025-06' }));

  const all = querySvc.searchUtilityBillImports();
  assert('retorna todos os imports', all.data.length === 3);

  const filtered = querySvc.searchUtilityBillImports({ referenceMonth: '2025-06' });
  assert('filtro por referenceMonth=2025-06 retorna 2', filtered.data.length === 2);

  const byUc = querySvc.searchUtilityBillImports({ uc: 'UC002' });
  assert('filtro por uc=UC002 retorna 1', byUc.data.length === 1);
}

// ── Suite 3: getUnlinkedUtilityBills ─────────────────────────────────────────

console.log('\n[3] getUnlinkedUtilityBills — status=unmatched');

{
  const { importSvc, querySvc } = makeServices();
  const c1 = importSvc.createImport(makeExtraction({ uc: 'UC001' }));
  const c2 = importSvc.createImport(makeExtraction({ uc: 'UCNENHUMA' }));

  importSvc.matchImport(c1.data.id, units);
  importSvc.matchImport(c2.data.id, units);

  const result = querySvc.getUnlinkedUtilityBills();
  assert('retorna apenas unmatched', result.ok && result.data.every(r => r.status === 'unmatched'));
  assert('c2 está na lista (unmatched)', result.data.some(r => r.id === c2.data.id));
  assert('c1 não está na lista (matched)', !result.data.some(r => r.id === c1.data.id));
}

// ── Suite 4: getBeneficiaryMonthlyDataSources ──────────────────────────────────

console.log('\n[4] getBeneficiaryMonthlyDataSources');

{
  const { importSvc, querySvc } = makeServices();
  const c1 = importSvc.createImport(makeExtraction({ uc: 'UC001', referenceMonth: '2025-06' }));
  const c2 = importSvc.createImport(makeExtraction({ uc: 'UC001', referenceMonth: '2025-07' }));
  importSvc.matchImport(c1.data.id, units);
  importSvc.matchImport(c2.data.id, units);

  const result = querySvc.getBeneficiaryMonthlyDataSources('ben-001');
  assert('ok=true', result.ok);
  assert('metadata.beneficiaryUnitId preservado', result.metadata?.beneficiaryUnitId === 'ben-001');
  assert('retorna entries com importId', result.data.every(e => typeof e.importId === 'string'));
  assert('entries têm status', result.data.every(e => typeof e.status === 'string'));
  assert('entries têm matched', result.data.every(e => typeof e.matched === 'boolean'));
}

// ── Suite 5: query service sem importService → TypeError ─────────────────────

console.log('\n[5] Query service sem importService → TypeError');

{
  const svc = new UtilityBillQueryService(null);
  let threw = false;
  try { svc.searchUtilityBillImports(); } catch { threw = true; }
  assert('lança TypeError quando importService é null', threw);
}

// ── Suite 6: metadata count ───────────────────────────────────────────────────

console.log('\n[6] Metadata count no resultado');

{
  const { importSvc, querySvc } = makeServices();
  importSvc.createImport(makeExtraction({ uc: 'UC001' }));
  importSvc.createImport(makeExtraction({ uc: 'UC002' }));
  const result = querySvc.searchUtilityBillImports();
  assert('metadata.count = 2', result.metadata?.count === 2);
}

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`utility-bill-query-service: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
