/**
 * ESA OS — Legacy Bridge
 * Suite de testes manuais — CRMLegacyEventBridge expandido (3 novos eventos)
 * 12 cenários obrigatórios
 *
 * Execução: node src/legacy/crm-event-bridge-expanded.manual-test.js
 *
 * Usa EventBus, Audit, Logger, CRMAuditIntegration e CRMLegacyEventBridge reais — sem mocks.
 * Sem Jest. Sem dependências externas. ES Modules nativos.
 */

import { EventBus, CoreEvent }             from '../core/events/index.js';
import { Audit, AUDIT_ACTION }             from '../core/audit/index.js';
import { Logger }                          from '../core/logger/logger.js';
import { CRMAuditIntegration }             from '../integrations/crm-audit-integration.js';
import { CRMLegacyEventBridge }            from './crm-event-bridge.js';

// ── Runner ────────────────────────────────────────────────────────────────────

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
  console.log(`\n[${n}/12] ${title}`);
}

// ── Stack compartilhada (cenários 2–10) ───────────────────────────────────────

const sharedBus = new EventBus();
const sharedAud = new Audit();
const sharedLog = new Logger('bridge-expanded');
const sharedInt = new CRMAuditIntegration(sharedBus, sharedAud, sharedLog);
sharedInt.start();
const sharedBridge = new CRMLegacyEventBridge(sharedBus);

// Pré-publicar eventos para cenários 2–10
const createdEvt = await sharedBridge.publishDealCreated({
  dealId:         'deal-create-01',
  deal:           { nome: 'Cliente Criação', valor: 50000 },
  organizationId: 'esa',
  personId:       'p-001',
  funil:          'venda_ufv',
});

const updatedEvt = await sharedBridge.publishDealUpdated({
  dealId:         'deal-update-01',
  before:         { nome: 'Antes', valor: 10000, etapa: 'Prospecção' },
  after:          { nome: 'Depois', valor: 20000, etapa: 'Proposta' },
  organizationId: 'esa',
  personId:       'p-001',
  funil:          'venda_ufv',
});

const followupEvt = await sharedBridge.publishFollowUpAdded({
  followupId:     'fu-test-001',
  dealId:         'deal-create-01',
  followup:       { texto: 'Cliente confirmou interesse', resultado: 'Em andamento' },
  organizationId: 'esa',
  personId:       'p-001',
  funil:          'venda_ufv',
});

// ── 1. publishDealCreated retorna CoreEvent ───────────────────────────────────

section(1, 'publishDealCreated retorna CoreEvent');

{
  const bus1    = new EventBus();
  const bridge1 = new CRMLegacyEventBridge(bus1);
  const result1 = await bridge1.publishDealCreated({
    dealId: 'deal-solo-01',
    deal:   { nome: 'Solo', valor: 5000 },
    organizationId: 'esa', personId: 'p-x',
    funil: 'assinatura_energia',
  });

  assert(result1 !== null,                              '1.1 retorna não-null');
  assert(result1 instanceof CoreEvent,                  '1.2 retorna CoreEvent');
  assert(result1.type === 'crm:deal:created',           '1.3 type = crm:deal:created');
  assert(result1.source === 'LegacyCRM',                '1.4 source = LegacyCRM');
  assert(result1.payload.id       === 'deal-solo-01',   '1.5 payload.id = dealId');
  assert(result1.payload.dealId   === 'deal-solo-01',   '1.6 payload.dealId correto');
  assert(result1.payload.funil    === 'assinatura_energia', '1.7 payload.funil correto');
  assert(result1.metadata.legacy  === true,             '1.8 metadata.legacy = true');
}

// ── 2. deal created gera AuditEntry CREATE ────────────────────────────────────

section(2, 'deal created gera AuditEntry CREATE');

const createEntries2 = sharedAud.getEntries({ action: AUDIT_ACTION.CREATE, resource: 'deal' }, 0);
assert(createEntries2.length >= 1,                      '2.1 AuditEntry CREATE deal criada');

const createEntry2 = createEntries2.find((e) => e.resourceId === 'deal-create-01');
assert(createEntry2 !== undefined,                      '2.2 AuditEntry com resourceId correto');
assert(createEntry2.action     === AUDIT_ACTION.CREATE, '2.3 action = CREATE');
assert(createEntry2.resource   === 'deal',              '2.4 resource = deal');
assert(createEntry2.organizationId === 'esa',           '2.5 organizationId = esa');
assert(createEntry2.personId   === 'p-001',             '2.6 personId correto');

// ── 3. deal created gera INFO no Logger ──────────────────────────────────────

section(3, 'deal created gera INFO no Logger');

const createdInfoEntry3 = sharedLog.getEntries('INFO').find(
  (e) => e.message === 'CRM event audited' && e.context.eventType === 'crm:deal:created',
);
assert(createdInfoEntry3 !== undefined,                                 '3.1 INFO "CRM event audited" para crm:deal:created');
assert(createdInfoEntry3.source === 'CRMAuditIntegration',             '3.2 source = CRMAuditIntegration');
assert(createdInfoEntry3.context.eventId === createdEvt.id,            '3.3 context.eventId correto');
assert(typeof createdInfoEntry3.context.auditEntryId === 'string',     '3.4 auditEntryId presente');
assert(createdInfoEntry3.context.action === AUDIT_ACTION.CREATE,       '3.5 context.action = CREATE');

// ── 4. publishDealUpdated retorna CoreEvent ───────────────────────────────────

section(4, 'publishDealUpdated retorna CoreEvent');

assert(updatedEvt instanceof CoreEvent,                          '4.1 retorna CoreEvent');
assert(updatedEvt.type === 'crm:deal:updated',                   '4.2 type = crm:deal:updated');
assert(updatedEvt.source === 'LegacyCRM',                        '4.3 source = LegacyCRM');
assert(updatedEvt.payload.id     === 'deal-update-01',           '4.4 payload.id = dealId');
assert(updatedEvt.payload.dealId === 'deal-update-01',           '4.5 payload.dealId correto');
assert(updatedEvt.payload.before !== null,                       '4.6 payload.before presente');
assert(updatedEvt.payload.after  !== null,                       '4.7 payload.after presente');
assert(updatedEvt.payload.before.etapa === 'Prospecção',         '4.8 payload.before.etapa correto');
assert(updatedEvt.payload.after.etapa  === 'Proposta',           '4.9 payload.after.etapa correto');
assert(updatedEvt.metadata.legacy === true,                      '4.10 metadata.legacy = true');

// ── 5. deal updated gera AuditEntry UPDATE ────────────────────────────────────

section(5, 'deal updated gera AuditEntry UPDATE');

const updateEntries5 = sharedAud.getEntries({ action: AUDIT_ACTION.UPDATE, resource: 'deal' }, 0);
assert(updateEntries5.length >= 1,                               '5.1 AuditEntry UPDATE deal criada');

const updateEntry5 = updateEntries5.find((e) => e.resourceId === 'deal-update-01');
assert(updateEntry5 !== undefined,                               '5.2 AuditEntry com resourceId correto');
assert(updateEntry5.action   === AUDIT_ACTION.UPDATE,            '5.3 action = UPDATE');
assert(updateEntry5.resource === 'deal',                         '5.4 resource = deal');

// ── 6. AuditEntry updated possui before e after ───────────────────────────────

section(6, 'AuditEntry updated possui before e after');

assert(updateEntry5.before !== null,                             '6.1 before não é null');
assert(updateEntry5.after  !== null,                             '6.2 after não é null');
assert(updateEntry5.before.nome  === 'Antes',                   '6.3 before.nome correto');
assert(updateEntry5.after.nome   === 'Depois',                  '6.4 after.nome correto');
assert(updateEntry5.before.valor === 10000,                     '6.5 before.valor correto');
assert(updateEntry5.after.valor  === 20000,                     '6.6 after.valor correto');
assert(updateEntry5.before.etapa === 'Prospecção',              '6.7 before.etapa correto');
assert(updateEntry5.after.etapa  === 'Proposta',                '6.8 after.etapa correto');

// ── 7. AuditEntry.getDiff() detecta alterações do Deal ───────────────────────

section(7, 'AuditEntry.getDiff() detecta alterações do Deal');

const diff7 = updateEntry5.getDiff();
assert('valor' in diff7,                                         '7.1 getDiff detecta mudança de valor');
assert(diff7.valor.from === 10000,                               '7.2 diff.valor.from = 10000');
assert(diff7.valor.to   === 20000,                               '7.3 diff.valor.to = 20000');
assert('nome' in diff7,                                          '7.4 getDiff detecta mudança de nome');
assert(diff7.nome.from === 'Antes',                              '7.5 diff.nome.from = Antes');
assert(diff7.nome.to   === 'Depois',                             '7.6 diff.nome.to = Depois');
assert('etapa' in diff7,                                         '7.7 getDiff detecta mudança de etapa');
assert(diff7.etapa.from === 'Prospecção',                        '7.8 diff.etapa.from = Prospecção');
assert(diff7.etapa.to   === 'Proposta',                          '7.9 diff.etapa.to = Proposta');

// ── 8. publishFollowUpAdded retorna CoreEvent ─────────────────────────────────

section(8, 'publishFollowUpAdded retorna CoreEvent');

assert(followupEvt instanceof CoreEvent,                         '8.1 retorna CoreEvent');
assert(followupEvt.type === 'crm:followup:added',                '8.2 type = crm:followup:added');
assert(followupEvt.source === 'LegacyCRM',                       '8.3 source = LegacyCRM');
assert(followupEvt.payload.id         === 'fu-test-001',         '8.4 payload.id = followupId');
assert(followupEvt.payload.followupId === 'fu-test-001',         '8.5 payload.followupId correto');
assert(followupEvt.payload.dealId     === 'deal-create-01',      '8.6 payload.dealId correto');
assert(followupEvt.payload.followup   !== null,                  '8.7 payload.followup presente');
assert(followupEvt.metadata.legacy    === true,                  '8.8 metadata.legacy = true');

// ── 9. followup gera AuditEntry CREATE resource followup ─────────────────────

section(9, 'followup gera AuditEntry CREATE resource followup');

const fuEntries9 = sharedAud.getEntries({ resource: 'followup' }, 0);
assert(fuEntries9.length >= 1,                                   '9.1 AuditEntry followup criada');

const fuEntry9 = fuEntries9.find((e) => e.resourceId === 'fu-test-001');
assert(fuEntry9 !== undefined,                                   '9.2 AuditEntry com resourceId correto');
assert(fuEntry9.action   === AUDIT_ACTION.CREATE,                '9.3 action = CREATE');
assert(fuEntry9.resource === 'followup',                         '9.4 resource = followup');
assert(fuEntry9.organizationId === 'esa',                        '9.5 organizationId = esa');

// ── 10. followup gera INFO no Logger ─────────────────────────────────────────

section(10, 'followup gera INFO no Logger');

const fuInfoEntry10 = sharedLog.getEntries('INFO').find(
  (e) => e.message === 'CRM event audited' && e.context.eventType === 'crm:followup:added',
);
assert(fuInfoEntry10 !== undefined,                              '10.1 INFO para crm:followup:added');
assert(fuInfoEntry10.source === 'CRMAuditIntegration',           '10.2 source = CRMAuditIntegration');
assert(fuInfoEntry10.context.eventId === followupEvt.id,         '10.3 context.eventId correto');
assert(fuInfoEntry10.context.resource === 'followup',            '10.4 context.resource = followup');
assert(fuInfoEntry10.context.action   === AUDIT_ACTION.CREATE,   '10.5 context.action = CREATE');

// ── 11. IDs vazios geram erro nos três métodos ────────────────────────────────

section(11, 'IDs vazios geram erro nos três métodos');

{
  const bridge11 = new CRMLegacyEventBridge(new EventBus());

  const invalidIds = ['', '   ', null, undefined];

  // publishDealCreated — dealId inválido
  for (const bad of invalidIds) {
    let threw = false;
    try { await bridge11.publishDealCreated({ dealId: bad }); } catch { threw = true; }
    assert(threw, `11. publishDealCreated dealId="${bad}" deve lançar`);
  }

  // publishDealUpdated — dealId inválido
  for (const bad of invalidIds) {
    let threw = false;
    try { await bridge11.publishDealUpdated({ dealId: bad }); } catch { threw = true; }
    assert(threw, `11. publishDealUpdated dealId="${bad}" deve lançar`);
  }

  // publishFollowUpAdded — followupId inválido
  for (const bad of invalidIds) {
    let threw = false;
    try { await bridge11.publishFollowUpAdded({ followupId: bad }); } catch { threw = true; }
    assert(threw, `11. publishFollowUpAdded followupId="${bad}" deve lançar`);
  }

  // IDs válidos não lançam
  let noThrow11a = true;
  try {
    await bridge11.publishDealCreated({ dealId: 'd-valid', organizationId: 'x', personId: 'x' });
  } catch { noThrow11a = false; }
  assert(noThrow11a, '11. publishDealCreated com dealId válido não lança');

  let noThrow11b = true;
  try {
    await bridge11.publishFollowUpAdded({ followupId: 'fu-valid', organizationId: 'x', personId: 'x' });
  } catch { noThrow11b = false; }
  assert(noThrow11b, '11. publishFollowUpAdded com followupId válido não lança');
}

// ── 12. stage-changed atual continua funcionando sem regressão ────────────────

section(12, 'stage-changed atual continua funcionando sem regressão');

{
  const bus12    = new EventBus();
  const aud12    = new Audit();
  const int12    = new CRMAuditIntegration(bus12, aud12);
  int12.start();
  const bridge12 = new CRMLegacyEventBridge(bus12);

  // Stage diferente → publica e audita
  const r12a = await bridge12.publishStageChanged({
    dealId: 'd-reg', fromStage: 'Prospecção', toStage: 'Proposta',
    organizationId: 'esa', personId: 'p-reg',
  });
  assert(r12a instanceof CoreEvent,                                '12.1 retorna CoreEvent');
  assert(r12a.type === 'crm:deal:stage-changed',                   '12.2 type = crm:deal:stage-changed');
  assert(int12.getStats().auditedCount === 1,                      '12.3 AuditEntry gerada (auditedCount = 1)');
  assert(aud12.getEntries({ action: AUDIT_ACTION.MOVE }, 0).length === 1, '12.4 action = MOVE no Audit');

  // Mesmo estágio → retorna null, NÃO publica
  const r12b = await bridge12.publishStageChanged({
    dealId: 'd-reg', fromStage: 'Proposta', toStage: 'Proposta',
    organizationId: 'esa', personId: 'p-reg',
  });
  assert(r12b === null,                                            '12.5 mesmo estágio retorna null');
  assert(int12.getStats().receivedCount === 1,                     '12.6 receivedCount = 1 (evento com mesmo stage não publicado)');

  // dealId inválido → lança Error
  let threw12 = false;
  try { await bridge12.publishStageChanged({ dealId: '', fromStage: 'A', toStage: 'B' }); } catch { threw12 = true; }
  assert(threw12,                                                  '12.7 dealId inválido lança Error');
}

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 12 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
