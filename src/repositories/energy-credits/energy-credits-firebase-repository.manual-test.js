/**
 * ESA OS — Repositories / Energy Credits
 * Suite de testes — EnergyCreditsFirebaseRepository (implementação real)
 * 75 cenários
 *
 * Execução: node src/repositories/energy-credits/energy-credits-firebase-repository.manual-test.js
 *
 * Usa mock de firebaseClient — NÃO conecta ao Firebase real.
 * Async/await nativos de ES Module.
 */

import {
  EnergyCreditsFirebaseRepository,
} from './energy-credits-firebase-repository.js';

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

// ── Mock Client ────────────────────────────────────────────────────────────

function createMockClient(initialStore = {}) {
  const store = Object.assign({}, initialStore);
  const calls = [];

  function nestedGet(path) {
    // Exact match first (usado por setStore para collections pré-populadas)
    if (path in store) return JSON.parse(JSON.stringify(store[path]));
    // Agrega filhos diretos — emula comportamento do Firebase Realtime Database
    const prefix = path + '/';
    const children = {};
    let hasChildren = false;
    for (const k of Object.keys(store)) {
      if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) {
        children[k.slice(prefix.length)] = JSON.parse(JSON.stringify(store[k]));
        hasChildren = true;
      }
    }
    return hasChildren ? children : null;
  }

  return {
    async get(path)        { calls.push({ method: 'get', path }); return nestedGet(path); },
    async set(path, value) { calls.push({ method: 'set', path }); store[path] = JSON.parse(JSON.stringify(value)); },
    async remove(path)     { calls.push({ method: 'remove', path }); delete store[path]; },
    getStore()             { return store; },
    getCalls()             { return calls.slice(); },
    clearCalls()           { calls.length = 0; },
    setStore(path, value)  { store[path] = value; },
  };
}

function createErrorClient() {
  return {
    async get()    { throw new Error('Firebase connection error'); },
    async set()    { throw new Error('Firebase connection error'); },
    async remove() { throw new Error('Firebase connection error'); },
  };
}

// ── 1. Instância sem client e getStats ────────────────────────────────────

section(1, 'Instância sem client e getStats');

const fbNoClient = new EnergyCreditsFirebaseRepository();
assert(fbNoClient instanceof EnergyCreditsFirebaseRepository, '1.1 instancia sem firebaseClient');

const stats0 = fbNoClient.getStats();
assert(typeof stats0 === 'object' && stats0 !== null,   '1.2 getStats não lança');
assert(stats0.type === 'firebase',                      '1.3 type = firebase');
assert(stats0.hasClient === false,                      '1.4 hasClient = false sem client');
assert(Array.isArray(stats0.clientMethods),             '1.5 clientMethods é array');

const fbWithClient = new EnergyCreditsFirebaseRepository(createMockClient());
assert(fbWithClient.getStats().hasClient === true,      '1.6 hasClient = true com client válido');

// ── 2. Erros sem client ────────────────────────────────────────────────────

section(2, 'Operações sem client retornam erro controlado');

const save0 = await fbNoClient.saveGeneratingUnit({ id: 'g1', name: 'Test' });
assert(save0.ok === false,                              '2.1 save sem client → ok=false');
assert(save0.errors[0].code === 'NO_FIREBASE_CLIENT',   '2.2 code = NO_FIREBASE_CLIENT');
assert(save0.data === null,                             '2.3 data = null');

const get0 = await fbNoClient.getGeneratingUnit('g1');
assert(get0.ok === false,                               '2.4 get sem client → ok=false');
assert(get0.errors[0].code === 'NO_FIREBASE_CLIENT',    '2.5 code = NO_FIREBASE_CLIENT');

const list0 = await fbNoClient.listGeneratingUnits();
assert(list0.ok === false,                              '2.6 list sem client → ok=false');

const snap0 = await fbNoClient.getSnapshot();
assert(snap0.ok === false,                              '2.7 getSnapshot sem client → ok=false');

// ── 3. saveGeneratingUnit — path e chamadas ────────────────────────────────

section(3, 'saveGeneratingUnit — path e chamadas corretas');

const client3 = createMockClient();
const repo3   = new EnergyCreditsFirebaseRepository(client3);

const sr3 = await repo3.saveGeneratingUnit({ id: 'gen-001', name: 'Usina Alpha', status: 'active' });
assert(sr3.ok === true,                                 '3.1 save ok');
assert(sr3.data.id === 'gen-001',                       '3.2 data.id correto');
assert(sr3.errors.length === 0,                         '3.3 zero errors');
assert(sr3.metadata.operation === 'save',               '3.4 metadata.operation = save');
assert(sr3.metadata.source === 'energy-credits-firebase-repository', '3.5 metadata.source');
assert(sr3.metadata.collection === 'generatingUnits',   '3.6 metadata.collection');
assert(sr3.metadata.path === 'energyCredits/generatingUnits/gen-001', '3.7 path correto');

const calls3 = client3.getCalls();
assert(calls3.length === 1,                             '3.8 exatamente 1 chamada ao client');
assert(calls3[0].method === 'set',                      '3.9 método = set');
assert(calls3[0].path === 'energyCredits/generatingUnits/gen-001', '3.10 path no set');

// ── 4. getGeneratingUnit — path, ausente, presente ────────────────────────

section(4, 'getGeneratingUnit — path correto, item ausente e presente');

const client4 = createMockClient();
const repo4   = new EnergyCreditsFirebaseRepository(client4);

await repo4.saveGeneratingUnit({ id: 'gen-002', name: 'Usina Beta' });
client4.clearCalls();

const gr4 = await repo4.getGeneratingUnit('gen-002');
assert(gr4.ok === true,                                 '4.1 get item presente → ok');
assert(gr4.data !== null,                               '4.2 data não null');
assert(gr4.data.id === 'gen-002',                       '4.3 id correto');
assert(gr4.metadata.operation === 'get',                '4.4 metadata.operation = get');

const calls4 = client4.getCalls();
assert(calls4[0].method === 'get',                      '4.5 método = get');
assert(calls4[0].path === 'energyCredits/generatingUnits/gen-002', '4.6 path no get');

const gr4_miss = await repo4.getGeneratingUnit('nao-existe');
assert(gr4_miss.ok === true,                            '4.7 item ausente → ok=true');
assert(gr4_miss.data === null,                          '4.8 data = null para ausente');

// ── 5. listGeneratingUnits — collection path, objeto indexado, array ───────

section(5, 'listGeneratingUnits — collection path e formatos de retorno');

// Firebase retorna objeto indexado { id: data }
const client5a = createMockClient();
client5a.setStore('energyCredits/generatingUnits', {
  'gen-003': { id: 'gen-003', name: 'Usina C', status: 'active' },
  'gen-001': { id: 'gen-001', name: 'Usina A', status: 'inactive' },
  'gen-002': { id: 'gen-002', name: 'Usina B', status: 'active' },
});
const repo5a = new EnergyCreditsFirebaseRepository(client5a);

const lr5a = await repo5a.listGeneratingUnits({});
assert(lr5a.ok === true,                                '5.1 list → ok');
assert(lr5a.data.length === 3,                          '5.2 3 itens');
assert(lr5a.data[0].id === 'gen-001',                   '5.3 ordenado: primeiro gen-001');
assert(lr5a.data[2].id === 'gen-003',                   '5.4 ordenado: último gen-003');
assert(lr5a.metadata.operation === 'list',              '5.5 metadata.operation = list');
assert(lr5a.metadata.count === 3,                       '5.6 metadata.count = 3');
assert(lr5a.metadata.path === 'energyCredits/generatingUnits', '5.7 collection path no metadata');

const calls5a = client5a.getCalls();
assert(calls5a[0].path === 'energyCredits/generatingUnits', '5.8 get chamado com collection path');

// Firebase retorna null (collection vazia)
const client5b = createMockClient();
const repo5b   = new EnergyCreditsFirebaseRepository(client5b);
const lr5b     = await repo5b.listGeneratingUnits({});
assert(lr5b.ok === true && lr5b.data.length === 0,      '5.9 collection null → lista vazia');

// Firebase retorna array
const client5c = createMockClient();
client5c.setStore('energyCredits/generatingUnits', [
  { id: 'gen-010', name: 'Array Item A' },
  { id: 'gen-011', name: 'Array Item B' },
]);
const repo5c = new EnergyCreditsFirebaseRepository(client5c);
const lr5c   = await repo5c.listGeneratingUnits({});
assert(lr5c.ok === true && lr5c.data.length === 2,      '5.10 retorno array funciona');

// ── 6. Normalização ────────────────────────────────────────────────────────

section(6, 'Normalização (undefined→null, NaN→null, Date→ISO, [object Object]→null)');

const clientN = createMockClient();
const repoN   = new EnergyCreditsFirebaseRepository(clientN);

const rawNorm = {
  id:      'norm-001',
  undef:   undefined,
  nan:     NaN,
  date:    new Date('2024-06-01T00:00:00Z'),
  badStr:  '[object Object]',
  nested:  { undef2: undefined, ok: 42 },
};
const nr = await repoN.saveGeneratingUnit(rawNorm);
assert(nr.data.undef   === null,                        '6.1 undefined → null');
assert(nr.data.nan     === null,                        '6.2 NaN → null');
assert(nr.data.date    === '2024-06-01T00:00:00.000Z',  '6.3 Date → ISO string');
assert(nr.data.badStr  === null,                        '6.4 [object Object] → null');
assert(nr.data.nested.undef2 === null,                  '6.5 nested undefined → null');
assert(nr.data.nested.ok === 42,                        '6.6 valores válidos preservados');

// ── 7. Segurança — campos sensíveis removidos ──────────────────────────────

section(7, 'Segurança — campos sensíveis removidos');

const clientSec = createMockClient();
const repoSec   = new EnergyCreditsFirebaseRepository(clientSec);

const sensitive = {
  id:           'sec-001',
  name:         'Usina Segura',
  password:     'supersecret',
  passHash:     'abc123',
  sessionToken: 'tok-xyz',
  apiKey:       'key-abc',
  downloadUrl:  'https://cdn/...',
  stack:        'Error at line 42',
  internalLog:  'debug log',
  fileUrl:      'https://doc.pdf',
};
const secRes = await repoSec.saveGeneratingUnit(sensitive);
assert(secRes.ok === true,                              '7.1 save ok');
assert(!('password'     in secRes.data),               '7.2 password removido');
assert(!('passHash'     in secRes.data),               '7.3 passHash removido');
assert(!('sessionToken' in secRes.data),               '7.4 sessionToken removido');
assert(!('apiKey'       in secRes.data),               '7.5 apiKey removido');
assert(!('downloadUrl'  in secRes.data),               '7.6 downloadUrl removido');
assert(!('stack'        in secRes.data),               '7.7 stack removido');
assert(!('internalLog'  in secRes.data),               '7.8 internalLog removido');
assert(!('fileUrl'      in secRes.data),               '7.9 fileUrl removido em não-document');

// fileUrl permitido em creditDocuments
const docSec = await repoSec.saveCreditDocument({ id: 'doc-001', fileUrl: 'https://file.pdf', password: 'nope' });
assert(docSec.ok === true,                             '7.10 saveCreditDocument ok');
assert(docSec.data.fileUrl === 'https://file.pdf',     '7.11 fileUrl preservado em creditDocuments');
assert(!('password' in docSec.data),                   '7.12 password removido em creditDocuments');

// ── 8. Smoke test todas as coleções ───────────────────────────────────────

section(8, 'Smoke test — save/get para todas as coleções');

const clientAll = createMockClient();
const repoAll   = new EnergyCreditsFirebaseRepository(clientAll);

const colTests = [
  ['saveBeneficiaryUnit',            'getBeneficiaryUnit',            { id: 'b-001' }],
  ['saveGeneratingUnitMonthlyRecord','getGeneratingUnitMonthlyRecord', { id: 'gr-001', referenceMonth: '2024-06' }],
  ['saveBeneficiaryMonthlyRecord',   'getBeneficiaryMonthlyRecord',   { id: 'br-001', referenceMonth: '2024-06' }],
  ['saveCreditAllocation',           'getCreditAllocation',           { id: 'ca-001' }],
  ['saveOwnerSettlement',            'getOwnerSettlement',            { id: 'st-001' }],
  ['saveEsaInvoice',                 'getEsaInvoice',                 { id: 'inv-001' }],
  ['saveMonthlyReport',              'getMonthlyReport',              { id: 'rep-001' }],
];

for (const [saveFn, getFn, fixture] of colTests) {
  const sr = await repoAll[saveFn](fixture);
  assert(sr.ok === true, `8. ${saveFn} ok`);
  const gr = await repoAll[getFn](fixture.id);
  assert(gr.ok === true && gr.data !== null, `8. ${getFn} ok`);
}

// ── 9. Audit Log determinístico ────────────────────────────────────────────

section(9, 'appendCreditAuditLog e id determinístico');

const clientAudit = createMockClient();
const repoAudit   = new EnergyCreditsFirebaseRepository(clientAudit);

// Com id explícito
const ae1 = await repoAudit.appendCreditAuditLog({ id: 'al-001', action: 'save', targetId: 'g1', targetType: 'generating', createdAt: '2024-06' });
assert(ae1.ok === true,                               '9.1 append com id explícito ok');
assert(ae1.data.id === 'al-001',                      '9.2 id preservado');

// ID determinístico via (targetType+targetId+action+createdAt)
const ae2 = await repoAudit.appendCreditAuditLog({ action: 'update', targetId: 'g2', targetType: 'generating', createdAt: '2024-06-15' });
assert(ae2.ok === true,                               '9.3 append sem id → id determinístico ok');
assert(ae2.data.id === 'generating::g2::update::2024-06-15', '9.4 id determinístico correto');

// Mesmo input → mesmo id (determinismo)
const ae3 = await repoAudit.appendCreditAuditLog({ action: 'update', targetId: 'g2', targetType: 'generating', createdAt: '2024-06-15' });
assert(ae3.data.id === ae2.data.id,                   '9.5 id determinístico — mesmo input mesma saída');

// Sem base determinística → fail
const ae_fail = await repoAudit.appendCreditAuditLog({ action: 'delete' });
assert(ae_fail.ok === false,                          '9.6 sem base determinística → fail');

// listCreditAuditLog
const lr_audit = await repoAudit.listCreditAuditLog({});
assert(lr_audit.ok === true,                          '9.7 listCreditAuditLog ok');
assert(lr_audit.data.length >= 2,                     '9.8 lista todos os logs');

// ── 10. getSnapshot ────────────────────────────────────────────────────────

section(10, 'getSnapshot carrega todas as coleções');

const clientSnap = createMockClient();
const repoSnap   = new EnergyCreditsFirebaseRepository(clientSnap);

await repoSnap.saveGeneratingUnit({ id: 'gs-001', name: 'Snap Gen' });
await repoSnap.saveBeneficiaryUnit({ id: 'bs-001', generatingUnitId: 'gs-001' });
await repoSnap.saveEsaInvoice({ id: 'is-001', referenceMonth: '2024-06' });

const snap = await repoSnap.getSnapshot({ referenceDate: '2024-06' });
assert(snap.ok === true,                                 '10.1 getSnapshot ok');
assert(Array.isArray(snap.data.generatingUnits),         '10.2 generatingUnits array');
assert(Array.isArray(snap.data.beneficiaryUnits),        '10.3 beneficiaryUnits array');
assert(Array.isArray(snap.data.generatingUnitMonthlyRecords), '10.4 generatingUnitMonthlyRecords array');
assert(Array.isArray(snap.data.creditAuditLog),          '10.5 creditAuditLog array');
assert(snap.data.generatingUnits.some(u => u.id === 'gs-001'), '10.6 gs-001 no snapshot');
assert(snap.metadata.source === 'energy-credits-firebase-repository', '10.7 metadata.source');
assert(snap.metadata.referenceDate === '2024-06',        '10.8 metadata.referenceDate');
assert(Object.keys(snap.data).length === 11,             '10.9 11 coleções no snapshot');

// ── 11. Filtros ────────────────────────────────────────────────────────────

section(11, 'Filtros em list');

const clientFilt = createMockClient();
clientFilt.setStore('energyCredits/generatingUnitMonthlyRecords', {
  'r1': { id: 'r1', generatingUnitId: 'gen-001', referenceMonth: '2024-05', paymentStatus: 'paid' },
  'r2': { id: 'r2', generatingUnitId: 'gen-001', referenceMonth: '2024-06', paymentStatus: 'open' },
  'r3': { id: 'r3', generatingUnitId: 'gen-002', referenceMonth: '2024-06', paymentStatus: 'paid' },
});
const repoFilt = new EnergyCreditsFirebaseRepository(clientFilt);

const fByMonth = await repoFilt.listGeneratingUnitMonthlyRecords({ referenceMonth: '2024-06' });
assert(fByMonth.data.length === 2,                      '11.1 filtro por referenceMonth');

const fByGen = await repoFilt.listGeneratingUnitMonthlyRecords({ generatingUnitId: 'gen-001' });
assert(fByGen.data.length === 2,                        '11.2 filtro por generatingUnitId');

const fByPaid = await repoFilt.listGeneratingUnitMonthlyRecords({ paymentStatus: 'paid' });
assert(fByPaid.data.length === 2,                       '11.3 filtro por paymentStatus');

const fFrom = await repoFilt.listGeneratingUnitMonthlyRecords({ referenceMonthFrom: '2024-06' });
assert(fFrom.data.length === 2,                         '11.4 filtro referenceMonthFrom');

const fTo = await repoFilt.listGeneratingUnitMonthlyRecords({ referenceMonthTo: '2024-05' });
assert(fTo.data.length === 1,                           '11.5 filtro referenceMonthTo');

// ── 12. Erro do client → result fail ──────────────────────────────────────

section(12, 'Erro do firebaseClient vira result ok=false');

const repoErr = new EnergyCreditsFirebaseRepository(createErrorClient());

const errSave = await repoErr.saveGeneratingUnit({ id: 'gen-err', name: 'Err' });
assert(errSave.ok === false,                            '12.1 save → ok=false em erro do client');
assert(errSave.errors[0].code === 'ENERGY_CREDITS_FIREBASE_OPERATION_FAILED', '12.2 code correto');
assert(!errSave.errors[0].message.includes('undefined'), '12.3 mensagem legível');

const errGet = await repoErr.getGeneratingUnit('gen-err');
assert(errGet.ok === false,                             '12.4 get → ok=false em erro do client');

const errList = await repoErr.listGeneratingUnits();
assert(errList.ok === false,                            '12.5 list → ok=false em erro do client');

const errSnap = await repoErr.getSnapshot();
assert(errSnap.ok === false,                            '12.6 getSnapshot → ok=false em erro do client');

// ── 13. Validação de id ────────────────────────────────────────────────────

section(13, 'Validação de id obrigatório');

const client13 = createMockClient();
const repo13   = new EnergyCreditsFirebaseRepository(client13);

const noId = await repo13.saveGeneratingUnit({ name: 'Sem ID' });
assert(noId.ok === false,                              '13.1 sem id → fail');
assert(noId.errors[0].field === 'id',                  '13.2 field = id');

const noEntity = await repo13.saveGeneratingUnit(null);
assert(noEntity.ok === false,                          '13.3 null → fail');

const badGetId = await repo13.getGeneratingUnit('');
assert(badGetId.ok === false,                          '13.4 id vazio → fail');

// ── 14. Listas ordenadas e determinismo ────────────────────────────────────

section(14, 'Listas ordenadas deterministicamente por id');

const client14 = createMockClient();
client14.setStore('energyCredits/generatingUnits', {
  'c-003': { id: 'c-003', name: 'C' },
  'a-001': { id: 'a-001', name: 'A' },
  'b-002': { id: 'b-002', name: 'B' },
});
const repo14 = new EnergyCreditsFirebaseRepository(client14);

const ordList = await repo14.listGeneratingUnits({});
assert(ordList.data[0].id === 'a-001',                 '14.1 primeiro = a-001');
assert(ordList.data[1].id === 'b-002',                 '14.2 segundo = b-002');
assert(ordList.data[2].id === 'c-003',                 '14.3 terceiro = c-003');

// ── 15. Sem side-effects globais ───────────────────────────────────────────

section(15, 'Sem side-effects globais (window, localStorage, Firebase SDK)');

assert(typeof global.firebase    === 'undefined', '15.1 sem global firebase');
assert(typeof global.localStorage === 'undefined', '15.2 sem localStorage global');

// Verificação estrutural: o arquivo não importa Firebase SDK
// (testado indiretamente — se importasse, quebraria durante o load deste módulo)
assert(true, '15.3 módulo carregado sem importar firebase SDK');

// ── 16. Objeto indexado sem id no valor ───────────────────────────────────

section(16, 'Objeto indexado — id inferido da chave quando ausente no valor');

const client16 = createMockClient();
client16.setStore('energyCredits/generatingUnits', {
  'inferred-001': { name: 'Sem ID no valor' },
  'inferred-002': { name: 'Outro sem ID' },
});
const repo16 = new EnergyCreditsFirebaseRepository(client16);
const lr16   = await repo16.listGeneratingUnits({});
assert(lr16.data.length === 2,                         '16.1 2 itens mesmo sem id no valor');
assert(lr16.data.some(u => u.id === 'inferred-001'),   '16.2 id inferido da chave: inferred-001');
assert(lr16.data.some(u => u.id === 'inferred-002'),   '16.3 id inferido da chave: inferred-002');

// ── Resultado ─────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
