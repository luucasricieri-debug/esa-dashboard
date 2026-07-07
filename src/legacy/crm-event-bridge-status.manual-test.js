/**
 * ESA OS — Legacy Bridge
 * Suite de testes — Eventos de status comercial (won / lost / paused)
 * 12 cenários obrigatórios
 *
 * Execução: node src/legacy/crm-event-bridge-status.manual-test.js
 *
 * Cobre publishDealWon, publishDealLost, publishDealPaused e regressão dos
 * quatro métodos anteriores. Sem mocks. Sem Jest. ES Modules nativos.
 */

import { CRMLegacyEventBridge }  from './crm-event-bridge.js';
import { CoreEvent }              from '../core/events/event.js';
import { EventBus }               from '../core/events/event-bus.js';
import { Audit, AUDIT_ACTION }   from '../core/audit/index.js';
import { Logger }                 from '../core/logger/logger.js';
import { CRMAuditIntegration }   from '../integrations/crm-audit-integration.js';

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

// ── Stack compartilhada (cenários 1–10) ───────────────────────────────────────

const sharedBus    = new EventBus();
const sharedAud    = new Audit();
const sharedLog    = new Logger('status-test', 'DEBUG');
const sharedInt    = new CRMAuditIntegration(sharedBus, sharedAud, sharedLog);
const sharedBridge = new CRMLegacyEventBridge(sharedBus);

sharedInt.start();

const WON_BEFORE   = { nome: 'Solar Residencial', status: 'Em andamento', valor: 25000 };
const WON_AFTER    = { nome: 'Solar Residencial', status: 'Vendido',      valor: 25000 };
const LOST_BEFORE  = { nome: 'Industrial 50kW',   status: 'Em andamento', valor: 80000 };
const LOST_AFTER   = { nome: 'Industrial 50kW',   status: 'Perdido',      valor: 80000 };
const PAUSED_BEFORE = { nome: 'Comercial 30kW',   status: 'Em andamento', valor: 42000 };
const PAUSED_AFTER  = { nome: 'Comercial 30kW',   status: 'Pausado',      valor: 42000 };

const wonEvt = await sharedBridge.publishDealWon({
  dealId: 'deal-won-01',
  before: WON_BEFORE,
  after:  WON_AFTER,
  organizationId: 'esa',
  personId:       'p-001',
  userId:         'u-001',
  userName:       'Ana Lima',
  userLevel:      'executivo',
  funil:          'venda_ufv',
});

const lostEvt = await sharedBridge.publishDealLost({
  dealId: 'deal-lost-01',
  before: LOST_BEFORE,
  after:  LOST_AFTER,
  organizationId: 'esa',
  personId:       'p-002',
  userId:         'u-002',
  userName:       'Carlos Melo',
  userLevel:      'executivo',
  funil:          'venda_ufv',
});

const pausedEvt = await sharedBridge.publishDealPaused({
  dealId: 'deal-paused-01',
  before: PAUSED_BEFORE,
  after:  PAUSED_AFTER,
  organizationId: 'esa',
  personId:       'p-003',
  userId:         'u-003',
  userName:       'Beatriz Santos',
  userLevel:      'executivo',
  funil:          'venda_ufv',
});

// ── 1. publishDealWon retorna CoreEvent com type correto ──────────────────────

section(1, 'publishDealWon retorna CoreEvent com type correto');

assert(wonEvt instanceof CoreEvent,          '1.1 resultado é CoreEvent');
assert(wonEvt.type === 'crm:deal:won',       '1.2 type = crm:deal:won');
assert(wonEvt.source === 'LegacyCRM',        '1.3 source = LegacyCRM');
assert(wonEvt.payload.dealId === 'deal-won-01', '1.4 payload.dealId correto');
assert(wonEvt.payload.id     === 'deal-won-01', '1.5 payload.id = dealId');
assert(wonEvt.payload.before === WON_BEFORE, '1.6 payload.before preservado');
assert(wonEvt.payload.after  === WON_AFTER,  '1.7 payload.after preservado');
assert(wonEvt.payload.deal   === WON_AFTER,  '1.8 payload.deal = after');
assert(wonEvt.metadata.legacy === true,      '1.9 metadata.legacy = true');
assert(wonEvt.metadata.organizationId === 'esa', '1.10 metadata.organizationId = esa');

// ── 2. crm:deal:won gera AuditEntry com action APPROVE ───────────────────────

section(2, 'crm:deal:won gera AuditEntry com action APPROVE');

const wonEntry = sharedAud.getEntries({}, 0).find((e) => e.resourceId === 'deal-won-01');

assert(wonEntry !== undefined,                    '2.1 AuditEntry encontrada para deal-won-01');
assert(wonEntry.action   === AUDIT_ACTION.APPROVE, '2.2 action = APPROVE');
assert(wonEntry.resource === 'deal',              '2.3 resource = deal');
assert(wonEntry.organizationId === 'esa',         '2.4 organizationId = esa');
assert(wonEntry.personId       === 'p-001',       '2.5 personId = p-001');

// ── 3. crm:deal:won gera INFO no Logger com eventType e action ────────────────

section(3, 'crm:deal:won gera INFO no Logger com eventType e action');

const wonInfo = sharedLog.getEntries('INFO').find(
  (e) => e.context && e.context.eventType === 'crm:deal:won',
);

assert(wonInfo !== undefined,                         '3.1 INFO entry para crm:deal:won encontrada');
assert(wonInfo.message === 'CRM event audited',       '3.2 mensagem = CRM event audited');
assert(wonInfo.context.action   === AUDIT_ACTION.APPROVE, '3.3 context.action = APPROVE');
assert(wonInfo.context.resource === 'deal',           '3.4 context.resource = deal');
assert(typeof wonInfo.context.auditEntryId === 'string' && wonInfo.context.auditEntryId.length > 0,
  '3.5 context.auditEntryId é string não vazia');

// ── 4. publishDealLost retorna CoreEvent com type correto ─────────────────────

section(4, 'publishDealLost retorna CoreEvent com type correto');

assert(lostEvt instanceof CoreEvent,           '4.1 resultado é CoreEvent');
assert(lostEvt.type === 'crm:deal:lost',       '4.2 type = crm:deal:lost');
assert(lostEvt.source === 'LegacyCRM',         '4.3 source = LegacyCRM');
assert(lostEvt.payload.dealId === 'deal-lost-01', '4.4 payload.dealId correto');
assert(lostEvt.payload.before === LOST_BEFORE, '4.5 payload.before preservado');
assert(lostEvt.payload.after  === LOST_AFTER,  '4.6 payload.after preservado');
assert(lostEvt.payload.deal   === LOST_AFTER,  '4.7 payload.deal = after');
assert(lostEvt.metadata.organizationId === 'esa', '4.8 metadata.organizationId = esa');

// ── 5. crm:deal:lost gera AuditEntry com action REJECT ───────────────────────

section(5, 'crm:deal:lost gera AuditEntry com action REJECT');

const lostEntry = sharedAud.getEntries({}, 0).find((e) => e.resourceId === 'deal-lost-01');

assert(lostEntry !== undefined,                    '5.1 AuditEntry encontrada para deal-lost-01');
assert(lostEntry.action   === AUDIT_ACTION.REJECT, '5.2 action = REJECT');
assert(lostEntry.resource === 'deal',              '5.3 resource = deal');
assert(lostEntry.personId === 'p-002',             '5.4 personId = p-002');

// ── 6. crm:deal:lost gera INFO no Logger com eventType e action ───────────────

section(6, 'crm:deal:lost gera INFO no Logger com eventType e action');

const lostInfo = sharedLog.getEntries('INFO').find(
  (e) => e.context && e.context.eventType === 'crm:deal:lost',
);

assert(lostInfo !== undefined,                        '6.1 INFO entry para crm:deal:lost encontrada');
assert(lostInfo.message === 'CRM event audited',      '6.2 mensagem = CRM event audited');
assert(lostInfo.context.action   === AUDIT_ACTION.REJECT, '6.3 context.action = REJECT');
assert(lostInfo.context.resource === 'deal',          '6.4 context.resource = deal');
assert(lostInfo.context.eventId  === lostEvt.id,      '6.5 context.eventId = lostEvt.id');

// ── 7. publishDealPaused retorna CoreEvent com type correto ───────────────────

section(7, 'publishDealPaused retorna CoreEvent com type correto');

assert(pausedEvt instanceof CoreEvent,               '7.1 resultado é CoreEvent');
assert(pausedEvt.type === 'crm:deal:paused',         '7.2 type = crm:deal:paused');
assert(pausedEvt.source === 'LegacyCRM',             '7.3 source = LegacyCRM');
assert(pausedEvt.payload.dealId === 'deal-paused-01', '7.4 payload.dealId correto');
assert(pausedEvt.payload.before === PAUSED_BEFORE,   '7.5 payload.before preservado');
assert(pausedEvt.payload.after  === PAUSED_AFTER,    '7.6 payload.after preservado');
assert(pausedEvt.payload.deal   === PAUSED_AFTER,    '7.7 payload.deal = after');
assert(pausedEvt.payload.funil  === 'venda_ufv',     '7.8 payload.funil preservado');

// ── 8. crm:deal:paused gera AuditEntry com action UPDATE ─────────────────────

section(8, 'crm:deal:paused gera AuditEntry com action UPDATE');

const pausedEntry = sharedAud.getEntries({}, 0).find((e) => e.resourceId === 'deal-paused-01');

assert(pausedEntry !== undefined,                    '8.1 AuditEntry encontrada para deal-paused-01');
assert(pausedEntry.action   === AUDIT_ACTION.UPDATE, '8.2 action = UPDATE (paused → UPDATE no CRMEventMapper)');
assert(pausedEntry.resource === 'deal',              '8.3 resource = deal');
assert(pausedEntry.personId === 'p-003',             '8.4 personId = p-003');

// ── 9. crm:deal:paused gera INFO no Logger com eventType e action ─────────────

section(9, 'crm:deal:paused gera INFO no Logger com eventType e action');

const pausedInfo = sharedLog.getEntries('INFO').find(
  (e) => e.context && e.context.eventType === 'crm:deal:paused',
);

assert(pausedInfo !== undefined,                       '9.1 INFO entry para crm:deal:paused encontrada');
assert(pausedInfo.message === 'CRM event audited',     '9.2 mensagem = CRM event audited');
assert(pausedInfo.context.action   === AUDIT_ACTION.UPDATE, '9.3 context.action = UPDATE');
assert(pausedInfo.context.resource === 'deal',         '9.4 context.resource = deal');
assert(pausedInfo.context.eventId  === pausedEvt.id,   '9.5 context.eventId = pausedEvt.id');

// ── 10. before/after preservados nas três AuditEntries ────────────────────────

section(10, 'before/after preservados nas três AuditEntries (won, lost, paused)');

const allEntries = sharedAud.getEntries({}, 0);

const e10won    = allEntries.find((e) => e.resourceId === 'deal-won-01');
const e10lost   = allEntries.find((e) => e.resourceId === 'deal-lost-01');
const e10paused = allEntries.find((e) => e.resourceId === 'deal-paused-01');

assert(e10won   !== undefined, '10.1 AuditEntry won existe');
assert(e10lost  !== undefined, '10.2 AuditEntry lost existe');
assert(e10paused !== undefined, '10.3 AuditEntry paused existe');

assert(e10won.before   !== null && e10won.before.status   === 'Em andamento', '10.4 won.before.status = Em andamento');
assert(e10won.after    !== null && e10won.after.status    === 'Vendido',      '10.5 won.after.status = Vendido');
assert(e10lost.before  !== null && e10lost.before.status  === 'Em andamento', '10.6 lost.before.status = Em andamento');
assert(e10lost.after   !== null && e10lost.after.status   === 'Perdido',      '10.7 lost.after.status = Perdido');
assert(e10paused.before !== null && e10paused.before.status === 'Em andamento', '10.8 paused.before.status = Em andamento');
assert(e10paused.after  !== null && e10paused.after.status  === 'Pausado',    '10.9 paused.after.status = Pausado');

// ── 11. dealId vazio lança Error nos três novos métodos ───────────────────────

section(11, 'dealId vazio lança Error em publishDealWon, publishDealLost, publishDealPaused');

const bus11    = new EventBus();
const bridge11 = new CRMLegacyEventBridge(bus11);

let err11won = null;
let err11lost = null;
let err11paused = null;

try { await bridge11.publishDealWon({ dealId: '' }); }
catch (e) { err11won = e; }

try { await bridge11.publishDealLost({ dealId: '  ' }); }
catch (e) { err11lost = e; }

try { await bridge11.publishDealPaused({ dealId: null }); }
catch (e) { err11paused = e; }

assert(err11won    instanceof Error, '11.1 publishDealWon("")   lança Error');
assert(err11lost   instanceof Error, '11.2 publishDealLost("  ") lança Error');
assert(err11paused instanceof Error, '11.3 publishDealPaused(null) lança Error');
assert(err11won.message.includes('[CRMLegacyEventBridge]'),    '11.4 mensagem won identifica o bridge');
assert(err11lost.message.includes('[CRMLegacyEventBridge]'),   '11.5 mensagem lost identifica o bridge');
assert(err11paused.message.includes('[CRMLegacyEventBridge]'), '11.6 mensagem paused identifica o bridge');

// ── 12. Regressão — métodos anteriores continuam funcionando ──────────────────

section(12, 'Regressão: publishDealCreated, publishDealUpdated, publishStageChanged, publishFollowUpAdded');

const bus12    = new EventBus();
const aud12    = new Audit();
const int12    = new CRMAuditIntegration(bus12, aud12);
const bridge12 = new CRMLegacyEventBridge(bus12);
int12.start();

const r12created = await bridge12.publishDealCreated({
  dealId: 'reg-c01',
  deal:   { nome: 'Regressão Criação' },
  organizationId: 'esa',
  personId: 'p-reg',
});

const r12updated = await bridge12.publishDealUpdated({
  dealId: 'reg-u01',
  before: { status: 'Em andamento' },
  after:  { status: 'Em andamento', nome: 'Regressão Update' },
  organizationId: 'esa',
  personId: 'p-reg',
});

const r12stage = await bridge12.publishStageChanged({
  dealId:    'reg-s01',
  fromStage: 'Proposta',
  toStage:   'Negociação',
  organizationId: 'esa',
  personId: 'p-reg',
});

const r12followup = await bridge12.publishFollowUpAdded({
  followupId: 'fu-reg-01',
  dealId:     'reg-fu01',
  organizationId: 'esa',
  personId: 'p-reg',
});

assert(r12created  instanceof CoreEvent,              '12.1 publishDealCreated retorna CoreEvent');
assert(r12created.type  === 'crm:deal:created',       '12.2 type = crm:deal:created');
assert(r12updated  instanceof CoreEvent,              '12.3 publishDealUpdated retorna CoreEvent');
assert(r12updated.type  === 'crm:deal:updated',       '12.4 type = crm:deal:updated');
assert(r12stage    instanceof CoreEvent,              '12.5 publishStageChanged retorna CoreEvent');
assert(r12stage.type    === 'crm:deal:stage-changed', '12.6 type = crm:deal:stage-changed');
assert(r12followup instanceof CoreEvent,              '12.7 publishFollowUpAdded retorna CoreEvent');
assert(r12followup.type === 'crm:followup:added',     '12.8 type = crm:followup:added');

const entries12 = aud12.getEntries({}, 0);
assert(entries12.some((e) => e.resourceId === 'reg-c01'),  '12.9 AuditEntry para crm:deal:created');
assert(entries12.some((e) => e.resourceId === 'reg-u01'),  '12.10 AuditEntry para crm:deal:updated');
assert(entries12.some((e) => e.resourceId === 'reg-s01'),  '12.11 AuditEntry para crm:deal:stage-changed');
assert(entries12.some((e) => e.resourceId === 'fu-reg-01'), '12.12 AuditEntry para crm:followup:added');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 12 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
