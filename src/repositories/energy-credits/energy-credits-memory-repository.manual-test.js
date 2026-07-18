/**
 * ESA OS — Repositories / Energy Credits
 * Suite de testes — EnergyCreditsMemoryRepository
 * 85 cenários
 *
 * Execução: node src/repositories/energy-credits/energy-credits-memory-repository.manual-test.js
 */

import { EnergyCreditsMemoryRepository } from './energy-credits-memory-repository.js';

// ── Runner ─────────────────────────────────────────────────────────────────

let total  = 0;
let failed = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function section(n, title) {
  console.log(`\n[${n}] ${title}`);
}

// ── 1. Instância vazia ──────────────────────────────────────────────────────

section(1, 'Instância vazia');

const repo = new EnergyCreditsMemoryRepository();
const stats0 = repo.getStats();

assert(stats0.type === 'memory',              '1.1 type = memory');
assert(stats0.generatingUnitCount === 0,      '1.2 generatingUnitCount = 0');
assert(stats0.creditAuditLogCount === 0,      '1.3 creditAuditLogCount = 0');
assert(stats0.hydrateCount === 0,             '1.4 hydrateCount = 0');
assert(stats0.lastHydration === null,         '1.5 lastHydration = null');

// ── 2. save / get / list — Generating Units ─────────────────────────────────

section(2, 'saveGeneratingUnit / getGeneratingUnit / listGeneratingUnits');

const unitA = { id: 'gen-001', name: 'Usina Alpha', utilityCompany: 'ENEL', status: 'active' };
const unitB = { id: 'gen-002', name: 'Usina Beta',  utilityCompany: 'CPFL', status: 'inactive' };

const sr1 = repo.saveGeneratingUnit(unitA);
assert(sr1.ok === true,                                '2.1 save retorna ok');
assert(sr1.data.id === 'gen-001',                      '2.2 data.id correto');
assert(sr1.data.name === 'Usina Alpha',                '2.3 data.name correto');
assert(sr1.errors.length === 0,                        '2.4 zero errors');

repo.saveGeneratingUnit(unitB);

const gr1 = repo.getGeneratingUnit('gen-001');
assert(gr1.ok === true,                                '2.5 get retorna ok');
assert(gr1.data !== null,                              '2.6 data não null');
assert(gr1.data.id === 'gen-001',                      '2.7 id correto');

const gr_missing = repo.getGeneratingUnit('nao-existe');
assert(gr_missing.ok === true,                         '2.8 get missing = ok com data null');
assert(gr_missing.data === null,                       '2.9 data null para inexistente');

const lr1 = repo.listGeneratingUnits({});
assert(lr1.ok === true,                                '2.10 list retorna ok');
assert(lr1.data.length === 2,                          '2.11 2 itens listados');
assert(lr1.metadata.count === 2,                       '2.12 metadata.count = 2');

const lr_filtered = repo.listGeneratingUnits({ status: 'active' });
assert(lr_filtered.data.length === 1,                  '2.13 filtro por status');
assert(lr_filtered.data[0].id === 'gen-001',           '2.14 item filtrado correto');

const lr_util = repo.listGeneratingUnits({ utilityCompany: 'CPFL' });
assert(lr_util.data.length === 1,                      '2.15 filtro utilityCompany');

// ── 3. Erros de validação ───────────────────────────────────────────────────

section(3, 'Erros de validação');

const err_no_entity = repo.saveGeneratingUnit(null);
assert(err_no_entity.ok === false,                     '3.1 null → fail');
assert(err_no_entity.errors.length > 0,                '3.2 errors não vazio');

const err_no_id = repo.saveGeneratingUnit({ name: 'Sem ID' });
assert(err_no_id.ok === false,                         '3.3 sem id → fail');
assert(err_no_id.errors[0].field === 'id',             '3.4 field = id');

const err_get_bad = repo.getGeneratingUnit('');
assert(err_get_bad.ok === false,                       '3.5 get id vazio → fail');

const err_arr = repo.saveGeneratingUnit([{ id: 'x' }]);
assert(err_arr.ok === false,                           '3.6 array → fail');

// ── 4. Normalização ────────────────────────────────────────────────────────

section(4, 'Normalização (undefined→null, NaN→null, Date→ISO, [object Object]→null)');

const raw = {
  id:        'norm-001',
  undef:     undefined,
  nan:       NaN,
  date:      new Date('2024-06-01T00:00:00Z'),
  badStr:    '[object Object]',
  nested:    { undef2: undefined, ok: 42 },
};
const nr = repo.saveGeneratingUnit(raw);
assert(nr.data.undef === null,                         '4.1 undefined → null');
assert(nr.data.nan === null,                           '4.2 NaN → null');
assert(nr.data.date === '2024-06-01T00:00:00.000Z',    '4.3 Date → ISO string');
assert(nr.data.badStr === null,                        '4.4 [object Object] → null');
assert(nr.data.nested.undef2 === null,                 '4.5 nested undefined → null');
assert(nr.data.nested.ok === 42,                       '4.6 valores válidos preservados');

// ── 5. Segurança — campos sensíveis removidos ──────────────────────────────

section(5, 'Segurança — campos sensíveis removidos');

const sensitive = {
  id:            'sec-001',
  name:          'Usina Segura',
  password:      'supersecret',
  passHash:      'abc123',
  sessionToken:  'tok-xyz',
  apiKey:        'key-abc',
  downloadUrl:   'https://...',
  fileUrl:       'https://doc.pdf',
};
const secResult = repo.saveGeneratingUnit(sensitive);
assert(secResult.ok === true,                          '5.1 save ok');
assert(!('password'     in secResult.data),            '5.2 password removido');
assert(!('passHash'     in secResult.data),            '5.3 passHash removido');
assert(!('sessionToken' in secResult.data),            '5.4 sessionToken removido');
assert(!('apiKey'       in secResult.data),            '5.5 apiKey removido');
assert(!('downloadUrl'  in secResult.data),            '5.6 downloadUrl removido');
assert(!('fileUrl'      in secResult.data),            '5.7 fileUrl removido em não-document');

// ── 6. creditDocuments — fileUrl permitido ─────────────────────────────────

section(6, 'creditDocuments — fileUrl permitido');

const doc = { id: 'doc-001', fileUrl: 'https://storage/doc.pdf', password: 'nope', downloadUrl: 'dl' };
const docResult = repo.saveCreditDocument(doc);
assert(docResult.ok === true,                          '6.1 saveCreditDocument ok');
assert(docResult.data.fileUrl === 'https://storage/doc.pdf', '6.2 fileUrl mantido');
assert(!('password'    in docResult.data),             '6.3 password removido');
assert(!('downloadUrl' in docResult.data),             '6.4 downloadUrl removido');

// ── 7. Audit Log ────────────────────────────────────────────────────────────

section(7, 'appendCreditAuditLog / listCreditAuditLog');

const audit1 = { id: 'al-001', action: 'save', targetId: 'gen-001', targetType: 'generating', userId: 'u1', referenceDate: '2024-06' };
const ar1 = repo.appendCreditAuditLog(audit1);
assert(ar1.ok === true,                                '7.1 append com id ok');
assert(ar1.data.id === 'al-001',                       '7.2 id preservado');

// ID determinístico via (referenceDate+action+targetId)
const audit2 = { action: 'update', targetId: 'gen-002', targetType: 'generating', userId: 'u2', referenceDate: '2024-06' };
const ar2 = repo.appendCreditAuditLog(audit2);
assert(ar2.ok === true,                                '7.3 append sem id → id determinístico');
assert(ar2.data.id === '2024-06::update::gen-002',     '7.4 id determinístico correto');

// Erro sem base determinística
const ar_fail = repo.appendCreditAuditLog({ action: 'delete' });
assert(ar_fail.ok === false,                           '7.5 sem base determinística → fail');

// Filtros
const auditList = repo.listCreditAuditLog({});
assert(auditList.data.length >= 2,                     '7.6 lista todos os logs');
const byAction = repo.listCreditAuditLog({ action: 'save' });
assert(byAction.data.every(e => e.action === 'save'),  '7.7 filtro por action');
const byUser = repo.listCreditAuditLog({ userId: 'u2' });
assert(byUser.data.length === 1,                       '7.8 filtro por userId');

// ── 8. Outras coleções — smoke test ───────────────────────────────────────

section(8, 'Smoke test outras coleções');

const collections = [
  ['saveBeneficiaryUnit',              'getBeneficiaryUnit',              { id: 'ben-001', generatingUnitId: 'gen-001' }],
  ['saveGeneratingUnitMonthlyRecord',  'getGeneratingUnitMonthlyRecord',  { id: 'gmr-001', referenceMonth: '2024-06' }],
  ['saveBeneficiaryMonthlyRecord',     'getBeneficiaryMonthlyRecord',     { id: 'bmr-001', referenceMonth: '2024-06' }],
  ['saveCreditAllocation',             'getCreditAllocation',             { id: 'ca-001' }],
  ['saveOwnerSettlement',              'getOwnerSettlement',              { id: 'st-001' }],
  ['saveEsaInvoice',                   'getEsaInvoice',                   { id: 'inv-001' }],
  ['saveMonthlyReport',                'getMonthlyReport',                { id: 'rep-001' }],
];

for (const [saveFn, getFn, fixture] of collections) {
  const sr = repo[saveFn](fixture);
  assert(sr.ok === true, `8. ${saveFn} ok`);
  const gr = repo[getFn](fixture.id);
  assert(gr.ok === true && gr.data !== null, `8. ${getFn} ok`);
}

// ── 9. Filtros avançados ────────────────────────────────────────────────────

section(9, 'Filtros avançados');

const repo2 = new EnergyCreditsMemoryRepository();
repo2.saveGeneratingUnitMonthlyRecord({ id: 'r1', generatingUnitId: 'gen-001', referenceMonth: '2024-05', paymentStatus: 'paid' });
repo2.saveGeneratingUnitMonthlyRecord({ id: 'r2', generatingUnitId: 'gen-001', referenceMonth: '2024-06', paymentStatus: 'open' });
repo2.saveGeneratingUnitMonthlyRecord({ id: 'r3', generatingUnitId: 'gen-002', referenceMonth: '2024-06', paymentStatus: 'paid' });

const fById = repo2.listGeneratingUnitMonthlyRecords({ id: 'r2' });
assert(fById.data.length === 1 && fById.data[0].id === 'r2', '9.1 filtro por id');

const fByGen = repo2.listGeneratingUnitMonthlyRecords({ generatingUnitId: 'gen-001' });
assert(fByGen.data.length === 2, '9.2 filtro por generatingUnitId');

const fByMonth = repo2.listGeneratingUnitMonthlyRecords({ referenceMonth: '2024-06' });
assert(fByMonth.data.length === 2, '9.3 filtro por referenceMonth');

const fFrom = repo2.listGeneratingUnitMonthlyRecords({ referenceMonthFrom: '2024-06' });
assert(fFrom.data.length === 2, '9.4 filtro referenceMonthFrom');

const fTo = repo2.listGeneratingUnitMonthlyRecords({ referenceMonthTo: '2024-05' });
assert(fTo.data.length === 1, '9.5 filtro referenceMonthTo');

const fPaid = repo2.listGeneratingUnitMonthlyRecords({ paymentStatus: 'paid' });
assert(fPaid.data.length === 2, '9.6 filtro paymentStatus');

// ── 10. getSnapshot ─────────────────────────────────────────────────────────

section(10, 'getSnapshot');

const snapR = repo.getSnapshot();
assert(snapR.ok === true,                                    '10.1 getSnapshot ok');
assert(Array.isArray(snapR.data.generatingUnits),            '10.2 generatingUnits array');
assert(Array.isArray(snapR.data.creditAuditLog),             '10.3 creditAuditLog array');
assert(snapR.data.generatingUnits.some(u => u.id === 'gen-001'), '10.4 gen-001 no snapshot');

// Cópia defensiva — modificar snap não afeta repositório
snapR.data.generatingUnits.push({ id: 'fake' });
const snapR2 = repo.getSnapshot();
assert(!snapR2.data.generatingUnits.some(u => u.id === 'fake'), '10.5 cópia defensiva no snapshot');

// ── 11. hydrateFromSnapshot ─────────────────────────────────────────────────

section(11, 'hydrateFromSnapshot');

const repo3 = new EnergyCreditsMemoryRepository();
const snap = {
  generatingUnits: [{ id: 'g1', name: 'Usina G1' }, { id: 'g2', name: 'Usina G2' }],
  beneficiaryUnits: [{ id: 'b1', generatingUnitId: 'g1' }],
  esaInvoices: [{ id: 'inv-1' }],
};
const hResult = repo3.hydrateFromSnapshot(snap, { replace: true, referenceDate: '2024-06' });
assert(hResult.ok === true,                          '11.1 hydrateFromSnapshot ok');
assert(hResult.data.received === 4,                  '11.2 received = 4');
assert(hResult.data.hydrated === 4,                  '11.3 hydrated = 4');
assert(hResult.data.skipped === 0,                   '11.4 skipped = 0');
assert(hResult.data.replaced === true,               '11.5 replaced = true');

const gList = repo3.listGeneratingUnits({});
assert(gList.data.length === 2,                      '11.6 2 generating units');

// replace=false preserva dados anteriores
repo3.saveGeneratingUnit({ id: 'g3', name: 'Usina G3' });
repo3.hydrateFromSnapshot({ generatingUnits: [{ id: 'g4', name: 'G4' }] }, { replace: false });
const gList2 = repo3.listGeneratingUnits({});
assert(gList2.data.length === 4,                     '11.7 replace=false preserva dados');

// replace=true limpa tudo
repo3.hydrateFromSnapshot({ generatingUnits: [{ id: 'g99' }] }, { replace: true });
const gList3 = repo3.listGeneratingUnits({});
assert(gList3.data.length === 1,                     '11.8 replace=true limpa e reabre');

// ── 12. clear ───────────────────────────────────────────────────────────────

section(12, 'clear');

repo3.clear();
const statsAfterClear = repo3.getStats();
assert(statsAfterClear.generatingUnitCount === 0,    '12.1 clear zera generatingUnits');
assert(statsAfterClear.hydrateCount === 0,            '12.2 clear zera hydrateCount');
assert(statsAfterClear.lastHydration === null,         '12.3 clear zera lastHydration');

// ── 13. Cópias defensivas ───────────────────────────────────────────────────

section(13, 'Cópias defensivas');

const repo4 = new EnergyCreditsMemoryRepository();
const orig  = { id: 'copy-001', name: 'Original' };
repo4.saveGeneratingUnit(orig);

const got = repo4.getGeneratingUnit('copy-001');
got.data.name = 'MUTADO';

const got2 = repo4.getGeneratingUnit('copy-001');
assert(got2.data.name === 'Original',                '13.1 mutação externa não afeta repositório');

// ── 14. Ordenação determinística ────────────────────────────────────────────

section(14, 'Ordenação determinística por id (localeCompare)');

const repo5 = new EnergyCreditsMemoryRepository();
repo5.saveGeneratingUnit({ id: 'c-003' });
repo5.saveGeneratingUnit({ id: 'a-001' });
repo5.saveGeneratingUnit({ id: 'b-002' });

const listOrdered = repo5.listGeneratingUnits({});
assert(listOrdered.data[0].id === 'a-001',           '14.1 primeiro id = a-001');
assert(listOrdered.data[1].id === 'b-002',           '14.2 segundo id = b-002');
assert(listOrdered.data[2].id === 'c-003',           '14.3 terceiro id = c-003');

// ── 15. getStats após hidratação ────────────────────────────────────────────

section(15, 'getStats após hidratação');

const repo6 = new EnergyCreditsMemoryRepository();
repo6.hydrateFromSnapshot({ generatingUnits: [{ id: 'g1' }, { id: 'g2' }] });
repo6.saveBeneficiaryUnit({ id: 'b1' });
repo6.appendCreditAuditLog({ id: 'al-1', action: 'save', targetId: 't1', referenceDate: '2024-06' });

const stats6 = repo6.getStats();
assert(stats6.generatingUnitCount  === 2,   '15.1 generatingUnitCount = 2');
assert(stats6.beneficiaryUnitCount === 1,   '15.2 beneficiaryUnitCount = 1');
assert(stats6.creditAuditLogCount  === 1,   '15.3 creditAuditLogCount = 1');
assert(stats6.hydrateCount         === 1,   '15.4 hydrateCount = 1');
assert(stats6.lastHydration !== null,        '15.5 lastHydration preenchido');
assert(typeof stats6.lastHydration === 'object', '15.6 lastHydration é objeto');

// ── Resultado ──────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
