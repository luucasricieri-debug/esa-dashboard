/**
 * ESA OS — Legacy Bridge
 * Suite de testes manuais — 10 cenários obrigatórios
 *
 * Execução: node src/legacy/crm-event-bridge.manual-test.js
 *
 * Usa EventBus, Audit, CRMAuditIntegration e CRMLegacyEventBridge reais — sem mocks.
 * Sem Jest. Sem dependências externas. ES Modules nativos.
 */

import { EventBus, CoreEvent }                   from '../core/events/index.js';
import { Audit, AUDIT_ACTION }                   from '../core/audit/index.js';
import { CRMAuditIntegration }                   from '../integrations/index.js';
import { CRMLegacyEventBridge }                  from './crm-event-bridge.js';

// ── Runner ────────────────────────────────────────────────────────────────────

let total = 0;
let failed = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function section(n, title) {
  console.log(`\n[${n}/10] ${title}`);
}

// ── Shared setup para cenários 1–7 ───────────────────────────────────────────

const bus = new EventBus();
const aud = new Audit();
const integration = new CRMAuditIntegration(bus, aud);
integration.start();
const bridge = new CRMLegacyEventBridge(bus);

const publishedEvent = await bridge.publishStageChanged({
  dealId:         'd-42',
  fromStage:      'Proposta',
  toStage:        'Negociação',
  deal:           { id: 'd-42', nome: 'Cliente X', valor: 80000 },
  organizationId: 'org-esa',
  personId:       'p-lucas',
  userId:         'uid-001',
  sessionId:      'sess-abc',
  userName:       'Lucas Vizentin',
  userLevel:      'gestor',
  funil:          'venda_ufv',
});

const auditEntry = aud._entries[0];

// ── 1. bridge publica CoreEvent ───────────────────────────────────────────────

section(1, 'bridge publica CoreEvent');

assert(publishedEvent !== null,               '1.1 publishStageChanged retorna evento (não null)');
assert(publishedEvent instanceof CoreEvent,   '1.2 retorno é instância de CoreEvent');
assert(typeof publishedEvent.id === 'string', '1.3 evento possui id string');
assert(publishedEvent.id.length > 0,          '1.4 id não é vazio');
assert(auditEntry !== undefined,              '1.5 AuditEntry foi criada no Audit');

// ── 2. tipo crm:deal:stage-changed correto ────────────────────────────────────

section(2, 'tipo crm:deal:stage-changed e source corretos');

assert(publishedEvent.type   === 'crm:deal:stage-changed', '2.1 type = crm:deal:stage-changed');
assert(publishedEvent.source === 'LegacyCRM',              '2.2 source = LegacyCRM');
assert(publishedEvent.payload.dealId    === 'd-42',        '2.3 payload.dealId correto');
assert(publishedEvent.payload.fromStage === 'Proposta',    '2.4 payload.fromStage correto');
assert(publishedEvent.payload.toStage   === 'Negociação',  '2.5 payload.toStage correto');
assert(publishedEvent.payload.funil     === 'venda_ufv',   '2.6 payload.funil correto');

// ── 3. payload before/after de stage correto via integration ─────────────────

section(3, 'AuditEntry before/after via CRMEventMapper (stage-changed)');

assert(auditEntry !== undefined,                '3.1 AuditEntry existe');
assert(auditEntry.before !== null,              '3.2 before não é null');
assert(auditEntry.before.stage === 'Proposta',  '3.3 before.stage = fromStage');
assert(auditEntry.after  !== null,              '3.4 after não é null');
assert(auditEntry.after.stage  === 'Negociação','3.5 after.stage = toStage');

// ── 4. metadata legacy = true ────────────────────────────────────────────────

section(4, 'metadata legacy = true no evento e na AuditEntry');

assert(publishedEvent.metadata.legacy === true,               '4.1 event.metadata.legacy = true');
assert(auditEntry.metadata.legacy     === true,               '4.2 AuditEntry.metadata.legacy = true');
assert(auditEntry.metadata.eventType  === 'crm:deal:stage-changed', '4.3 eventType no metadata');
assert(auditEntry.metadata.eventSource === 'LegacyCRM',       '4.4 eventSource no metadata');
assert(auditEntry.metadata.userName   === 'Lucas Vizentin',   '4.5 userName propagado no metadata');
assert(auditEntry.metadata.userLevel  === 'gestor',           '4.6 userLevel propagado no metadata');

// ── 5. organizationId e personId chegam ao AuditContext ───────────────────────

section(5, 'organizationId e personId chegam ao AuditContext → AuditEntry');

assert(auditEntry.organizationId === 'org-esa', '5.1 organizationId = org-esa');
assert(auditEntry.personId       === 'p-lucas', '5.2 personId = p-lucas');
assert(auditEntry.source         === 'LegacyCRM','5.3 source = LegacyCRM (event.source)');

// ── 6. AuditEntry action = MOVE ───────────────────────────────────────────────

section(6, 'AuditEntry action = MOVE');

assert(auditEntry.action === AUDIT_ACTION.MOVE, '6.1 action = MOVE');
assert(auditEntry.isModification() === true,    '6.2 isModification() = true');
assert(auditEntry.isDeletion()     === false,   '6.3 isDeletion() = false');

// ── 7. AuditEntry resource = deal ────────────────────────────────────────────

section(7, 'AuditEntry resource = deal e resourceId = dealId');

assert(auditEntry.resource   === 'deal', '7.1 resource = deal');
assert(auditEntry.resourceId === 'd-42', '7.2 resourceId = d-42 (dealId)');

// Verificar getDiff
const diff7 = auditEntry.getDiff();
assert('stage' in diff7,                  '7.3 getDiff detecta mudança de stage');
assert(diff7.stage.from === 'Proposta',   '7.4 diff.stage.from = Proposta');
assert(diff7.stage.to   === 'Negociação', '7.5 diff.stage.to = Negociação');

// ── 8. mesmo estágio retorna null e não audita ────────────────────────────────

section(8, 'mesmo estágio retorna null e não audita');

{
  const bus8  = new EventBus();
  const aud8  = new Audit();
  const int8  = new CRMAuditIntegration(bus8, aud8);
  int8.start();
  const bridge8 = new CRMLegacyEventBridge(bus8);

  const r8 = await bridge8.publishStageChanged({
    dealId:    'd-same',
    fromStage: 'Proposta',
    toStage:   'Proposta',
    organizationId: 'org-x',
    personId:  'p-x',
  });

  assert(r8 === null,              '8.1 mesmo estágio retorna null');
  assert(aud8._entries.length === 0,'8.2 nenhuma AuditEntry criada para mesmo estágio');
  assert(int8.getStats().receivedCount === 0, '8.3 evento não chega ao EventBus');
}

// ── 9. dealId vazio lança erro ────────────────────────────────────────────────

section(9, 'dealId vazio lança Error');

{
  const bridge9 = new CRMLegacyEventBridge(new EventBus());

  const cases = ['', '   ', null, undefined];
  for (const badId of cases) {
    let threw = false;
    try {
      await bridge9.publishStageChanged({ dealId: badId, fromStage: 'A', toStage: 'B' });
    } catch {
      threw = true;
    }
    assert(threw, `9. dealId="${badId}" deve lançar Error`);
  }

  // dealId válido não lança
  let notThrew = true;
  try {
    await bridge9.publishStageChanged({ dealId: 'd-ok', fromStage: 'A', toStage: 'A' });
  } catch {
    notThrew = false;
  }
  assert(notThrew, '9.5 dealId válido com mesmo estágio não lança (retorna null)');
}

// ── 10. falha de subscriber não impede bridge de publicar para outros ─────────

section(10, 'falha de subscriber não impede outros subscribers');

{
  const bus10 = new EventBus();

  // Subscriber que sempre lança
  bus10.subscribe('crm:*', async () => {
    throw new Error('subscriber propositalmente quebrado');
  });

  // Subscriber funcional — conta chamadas
  let received10 = 0;
  bus10.subscribe('crm:*', async () => { received10++; });

  const bridge10 = new CRMLegacyEventBridge(bus10);

  // publishStageChanged não deve lançar mesmo com subscriber quebrado
  let bridgeThrew = false;
  try {
    await bridge10.publishStageChanged({
      dealId:         'd-10',
      fromStage:      'Etapa A',
      toStage:        'Etapa B',
      organizationId: '',
      personId:       '',
    });
  } catch {
    bridgeThrew = true;
  }

  assert(!bridgeThrew,     '10.1 bridge não lança mesmo com subscriber quebrado');
  assert(received10 === 1, '10.2 subscriber funcional foi chamado uma vez');

  // Publicar segundo evento — ambos os subscribers continuam vivos
  await bridge10.publishStageChanged({
    dealId: 'd-11', fromStage: 'X', toStage: 'Y',
    organizationId: '', personId: '',
  });
  assert(received10 === 2, '10.3 subscriber funcional acumulou 2 chamadas após 2 eventos');
}

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 10 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
