/**
 * ESA OS — Integrations
 * Suite de testes manuais — 14 cenários obrigatórios
 *
 * Execução: node src/integrations/integrations.manual-test.js
 *
 * Usa EventBus, Audit e CoreEvent reais — sem mocks.
 * Sem Jest. Sem dependências externas. ES Modules nativos.
 */

import { EventBus, CoreEvent }                       from '../core/events/index.js';
import { Audit, AuditContext, AUDIT_ACTION }         from '../core/audit/index.js';
import { CRMEventMapper, CRMAuditIntegration, IntegrationRegistry } from './index.js';

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
  console.log(`\n[${n}/14] ${title}`);
}

const mapper = new CRMEventMapper();

/** Cria um CoreEvent CRM com campos pré-preenchidos para os testes. */
function makeCRMEvent(type, payload = {}, meta = {}) {
  return new CoreEvent(type, payload, 'CRMDomain', meta);
}

// ── 1. CRMEventMapper mapeia deal created ─────────────────────────────────────

section(1, 'CRMEventMapper — crm:deal:created');

{
  const ev  = makeCRMEvent('crm:deal:created', { id: 'd-1', deal: { stage: 'Prospecção', value: 50 } });
  const m   = mapper.map(ev);

  assert(m !== null,                        '1.1 retorna objeto (não null)');
  assert(m.action     === AUDIT_ACTION.CREATE, '1.2 action = CREATE');
  assert(m.resource   === 'deal',              '1.3 resource = deal');
  assert(m.resourceId === 'd-1',               '1.4 resourceId extraído de payload.id');
  assert(m.before     === null,                '1.5 before = null para CREATE');
  assert(m.after.stage === 'Prospecção',       '1.6 after = payload.deal quando presente');

  // resourceId via dealId quando id ausente
  const ev2 = makeCRMEvent('crm:deal:created', { dealId: 'd-2', deal: { stage: 'Início' } });
  const m2  = mapper.map(ev2);
  assert(m2.resourceId === 'd-2',              '1.7 resourceId extraído de payload.dealId');

  // metadata canônico gerado
  assert(m.metadata.eventType   === 'crm:deal:created', '1.8 metadata.eventType correto');
  assert(m.metadata.eventSource === 'CRMDomain',        '1.9 metadata.eventSource correto');
  assert(typeof m.metadata.eventId === 'string' && m.metadata.eventId.length > 0,
    '1.10 metadata.eventId é string não vazia');
}

// ── 2. CRMEventMapper mapeia deal updated ─────────────────────────────────────

section(2, 'CRMEventMapper — crm:deal:updated');

{
  const before = { stage: 'Proposta', value: 100 };
  const after  = { stage: 'Negociação', value: 120 };
  const ev = makeCRMEvent('crm:deal:updated', { id: 'd-10', before, after });
  const m  = mapper.map(ev);

  assert(m !== null,                       '2.1 retorna objeto');
  assert(m.action === AUDIT_ACTION.UPDATE, '2.2 action = UPDATE');
  assert(m.before.stage === 'Proposta',    '2.3 before extraído de payload.before');
  assert(m.after.stage  === 'Negociação', '2.4 after extraído de payload.after');

  // sem before/after explícito — fallback para payload.deal
  const ev2 = makeCRMEvent('crm:deal:updated', { id: 'd-11', deal: { stage: 'Fechamento' } });
  const m2  = mapper.map(ev2);
  assert(m2.before === null,             '2.5 before = null quando payload.before ausente');
  assert(m2.after.stage === 'Fechamento','2.6 after = payload.deal quando payload.after ausente');
}

// ── 3. CRMEventMapper mapeia stage changed ────────────────────────────────────

section(3, 'CRMEventMapper — crm:deal:stage-changed');

{
  const ev = makeCRMEvent('crm:deal:stage-changed', {
    id: 'd-20', fromStage: 'Proposta', toStage: 'Negociação',
  });
  const m = mapper.map(ev);

  assert(m !== null,                     '3.1 retorna objeto');
  assert(m.action === AUDIT_ACTION.MOVE, '3.2 action = MOVE');
  assert(m.resource === 'deal',          '3.3 resource = deal');
  assert(m.before.stage === 'Proposta',  '3.4 before.stage = fromStage');
  assert(m.after.stage  === 'Negociação','3.5 after.stage = toStage');
}

// ── 4. CRMEventMapper mapeia won / lost / paused ──────────────────────────────

section(4, 'CRMEventMapper — crm:deal:won / lost / paused');

{
  const wonPayload = { id: 'd-30', before: { stage: 'Proposta' }, after: { stage: 'Fechado' } };
  const mWon = mapper.map(makeCRMEvent('crm:deal:won', wonPayload));
  assert(mWon !== null,                        '4.1 won retorna objeto');
  assert(mWon.action === AUDIT_ACTION.APPROVE, '4.2 won → action = APPROVE');
  assert(mWon.before.stage === 'Proposta',     '4.3 won: before de payload.before');
  assert(mWon.after.stage  === 'Fechado',      '4.4 won: after de payload.after');

  const mLost = mapper.map(makeCRMEvent('crm:deal:lost', { id: 'd-31', deal: { stage: 'Perdido' } }));
  assert(mLost !== null,                       '4.5 lost retorna objeto');
  assert(mLost.action === AUDIT_ACTION.REJECT, '4.6 lost → action = REJECT');
  assert(mLost.after.stage === 'Perdido',      '4.7 lost: after de payload.deal quando before/after ausentes');

  const mPaused = mapper.map(makeCRMEvent('crm:deal:paused', { id: 'd-32' }));
  assert(mPaused.action === AUDIT_ACTION.UPDATE, '4.8 paused → action = UPDATE');
}

// ── 5. CRMEventMapper mapeia followup / activity / proposal ──────────────────

section(5, 'CRMEventMapper — followup / activity / proposal');

{
  const fEv = makeCRMEvent('crm:followup:added', { followupId: 'f-1', note: 'Ligar amanhã' });
  const fM  = mapper.map(fEv);
  assert(fM !== null,                       '5.1 followup retorna objeto');
  assert(fM.action   === AUDIT_ACTION.CREATE, '5.2 followup → CREATE');
  assert(fM.resource === 'followup',          '5.3 resource = followup');
  assert(fM.resourceId === 'f-1',             '5.4 resourceId de payload.followupId');
  assert(fM.before === null,                  '5.5 followup: before = null');

  const aM = mapper.map(makeCRMEvent('crm:activity:completed', { activityId: 'a-1', type: 'call' }));
  assert(aM.action   === AUDIT_ACTION.EXECUTE, '5.6 activity → EXECUTE');
  assert(aM.resource === 'activity',           '5.7 resource = activity');

  const pEv = makeCRMEvent('crm:proposal:sent',     { proposalId: 'p-1', value: 80000 });
  const pA  = makeCRMEvent('crm:proposal:accepted', { proposalId: 'p-2' });
  const mPS = mapper.map(pEv);
  const mPA = mapper.map(pA);
  assert(mPS.action   === AUDIT_ACTION.EXECUTE, '5.8 proposal:sent → EXECUTE');
  assert(mPS.resource === 'proposal',           '5.9 resource = proposal');
  assert(mPA.action   === AUDIT_ACTION.APPROVE, '5.10 proposal:accepted → APPROVE');
}

// ── 6. CRMEventMapper retorna null ────────────────────────────────────────────

section(6, 'CRMEventMapper — null para desconhecido ou sem resourceId');

{
  // Evento não mapeado
  const mUnknown = mapper.map(makeCRMEvent('crm:contact:deleted', { id: 'c-1' }));
  assert(mUnknown === null, '6.1 tipo desconhecido retorna null');

  // Evento totalmente fora do domínio
  const mOther = mapper.map(makeCRMEvent('identity:session:started', { id: 's-1' }));
  assert(mOther === null, '6.2 evento de outro domínio retorna null');

  // Tipo mapeado mas sem nenhum campo de ID no payload
  const mNoId = mapper.map(makeCRMEvent('crm:deal:created', { stage: 'Prosp' }));
  assert(mNoId === null, '6.3 sem resourceId no payload retorna null');

  // Tipo mapeado mas payload vazio
  const mEmpty = mapper.map(makeCRMEvent('crm:deal:updated', {}));
  assert(mEmpty === null, '6.4 payload vazio retorna null');

  // Garante que mapeamentos válidos não são afetados
  const mValid = mapper.map(makeCRMEvent('crm:deal:won', { id: 'd-ok', deal: {} }));
  assert(mValid !== null, '6.5 evento válido com resourceId não retorna null');
}

// ── Shared state para cenários 7–10 ──────────────────────────────────────────

const bus7  = new EventBus();
const aud7  = new Audit();
const int7  = new CRMAuditIntegration(bus7, aud7);

const CRM_EVENT_7 = makeCRMEvent(
  'crm:deal:created',
  { id: 'd-42', deal: { stage: 'Prospecção', value: 9000 } },
  { organizationId: 'org-test', personId: 'p-vendor', correlationId: 'corr-42' },
);

// ── 7. CRMAuditIntegration start registra subscriber ─────────────────────────

section(7, 'CRMAuditIntegration — start registra subscriber');

int7.start();

assert(int7.isStarted() === true,                         '7.1 isStarted() = true após start()');
assert(typeof int7.getStats().subscriberId === 'string',  '7.2 subscriberId é string');
assert(int7.getStats().subscriberId.length > 0,           '7.3 subscriberId não é vazio');
assert(int7.getStats().receivedCount   === 0,             '7.4 receivedCount = 0 antes de publicar');
assert(int7.getStats().auditedCount    === 0,             '7.5 auditedCount = 0 antes de publicar');

// Idempotência — segunda chamada a start() não cria subscriber adicional
const sidBefore = int7.getStats().subscriberId;
int7.start();
assert(int7.getStats().subscriberId === sidBefore, '7.6 start() idempotente — mesmo subscriberId');

// ── 8. Evento CRM válido gera AuditEntry ──────────────────────────────────────

section(8, 'Evento CRM válido gera AuditEntry');

await bus7.publish(CRM_EVENT_7);

assert(aud7._entries.length === 1,                '8.1 AuditEntry criada no histórico do Audit');
assert(int7.getStats().receivedCount   === 1,     '8.2 receivedCount = 1');
assert(int7.getStats().auditedCount    === 1,     '8.3 auditedCount = 1');
assert(int7.getStats().skippedUnmapped === 0,     '8.4 skippedUnmapped = 0');

// ── 9. AuditEntry possui action / resource / resourceId corretos ──────────────

section(9, 'AuditEntry — action / resource / resourceId');

{
  const entry = aud7._entries[0];

  assert(entry.action         === AUDIT_ACTION.CREATE, '9.1 action = CREATE');
  assert(entry.resource       === 'deal',              '9.2 resource = deal');
  assert(entry.resourceId     === 'd-42',              '9.3 resourceId = d-42');
  assert(entry.organizationId === 'org-test',          '9.4 organizationId do context (event.metadata)');
  assert(entry.personId       === 'p-vendor',          '9.5 personId do context (event.metadata)');
  assert(entry.source         === 'CRMDomain',         '9.6 source = event.source');
}

// ── 10. AuditEntry before / after e metadata corretos ────────────────────────

section(10, 'AuditEntry — before / after / metadata');

{
  const entry = aud7._entries[0];

  assert(entry.before === null,                          '10.1 before = null para CREATE');
  assert(entry.after.stage === 'Prospecção',             '10.2 after.stage correto');
  assert(entry.after.value === 9000,                     '10.3 after.value correto');

  assert(entry.metadata.eventType   === 'crm:deal:created', '10.4 metadata.eventType correto');
  assert(entry.metadata.eventSource === 'CRMDomain',        '10.5 metadata.eventSource correto');
  assert(entry.metadata.correlationId === 'corr-42',        '10.6 correlationId do event.metadata preservado');
  assert(typeof entry.metadata.eventCreatedAt === 'number', '10.7 metadata.eventCreatedAt é número');
  assert(entry.metadata.eventId === CRM_EVENT_7.id,         '10.8 metadata.eventId = event.id');
}

// ── 11. contexto inválido incrementa skippedInvalidContext ───────────────────

section(11, 'Contexto inválido — skippedInvalidContext');

{
  const bus11  = new EventBus();
  const aud11  = new Audit();
  const int11  = new CRMAuditIntegration(bus11, aud11);
  int11.start();

  // Evento sem organizationId e personId nos metadata/payload
  const evInvalid = makeCRMEvent('crm:deal:created', { id: 'd-99' }, {});
  await bus11.publish(evInvalid);

  assert(int11.getStats().skippedInvalidContext === 1, '11.1 skippedInvalidContext = 1');
  assert(int11.getStats().auditedCount          === 0, '11.2 auditedCount = 0');
  assert(aud11._entries.length                  === 0, '11.3 nenhuma AuditEntry criada');
  assert(int11.getStats().receivedCount         === 1, '11.4 receivedCount = 1 (evento foi recebido)');

  // personId no payload também resolve o contexto
  const evValidViaPayload = makeCRMEvent('crm:deal:created',
    { id: 'd-100', organizationId: 'org-x', personId: 'p-x' }, {});
  await bus11.publish(evValidViaPayload);
  assert(aud11._entries.length === 1, '11.5 personId/organizationId no payload também valida o context');
}

// ── 12. evento não mapeado incrementa skippedUnmapped ────────────────────────

section(12, 'Evento não mapeado — skippedUnmapped');

{
  const bus12 = new EventBus();
  const aud12 = new Audit();
  const int12 = new CRMAuditIntegration(bus12, aud12);
  int12.start();

  // crm:* wildcard pega este evento, mas mapper retorna null
  const evUnknown = makeCRMEvent('crm:contact:merged', { id: 'c-5' },
    { organizationId: 'org-1', personId: 'p-1' });
  await bus12.publish(evUnknown);

  assert(int12.getStats().skippedUnmapped === 1,    '12.1 skippedUnmapped = 1');
  assert(int12.getStats().auditedCount    === 0,    '12.2 auditedCount = 0');
  assert(aud12._entries.length            === 0,    '12.3 nenhuma AuditEntry criada');
  assert(int12.getStats().receivedCount   === 1,    '12.4 receivedCount = 1');
}

// ── 13. stop impede novas auditorias ─────────────────────────────────────────

section(13, 'stop() impede novas auditorias');

{
  const bus13 = new EventBus();
  const aud13 = new Audit();
  const int13 = new CRMAuditIntegration(bus13, aud13);
  int13.start();

  const evOk = makeCRMEvent('crm:deal:created', { id: 'd-s1', deal: {} },
    { organizationId: 'org-1', personId: 'p-1' });
  await bus13.publish(evOk);
  assert(aud13._entries.length === 1,         '13.1 AuditEntry criada antes do stop');

  const stopResult = int13.stop();
  assert(stopResult === true,                 '13.2 stop() retorna true');
  assert(int13.isStarted() === false,         '13.3 isStarted() = false após stop');
  assert(int13.getStats().subscriberId === null, '13.4 subscriberId limpo após stop');

  // Publicar após stop — integração não recebe mais
  const evAfterStop = makeCRMEvent('crm:deal:created', { id: 'd-s2', deal: {} },
    { organizationId: 'org-1', personId: 'p-1' });
  await bus13.publish(evAfterStop);

  assert(aud13._entries.length === 1,         '13.5 AuditEntry NÃO criada após stop');
  assert(int13.getStats().receivedCount === 1,'13.6 receivedCount não incrementa após stop');

  // stop() em integração já parada retorna false
  const stopAgain = int13.stop();
  assert(stopAgain === false,                 '13.7 stop() quando já parado retorna false');
}

// ── 14. IntegrationRegistry ───────────────────────────────────────────────────

section(14, 'IntegrationRegistry — register / start / stop / list / stats');

{
  const registry = new IntegrationRegistry();
  const busR = new EventBus();
  const audR = new Audit();
  const intR = new CRMAuditIntegration(busR, audR);

  // register
  const returned = registry.register('crmAudit', intR);
  assert(returned === intR,                '14.1 register retorna a integração');
  assert(registry.get('crmAudit') === intR,'14.2 get retorna a integração registrada');

  // duplicata
  let threw = false;
  try { registry.register('crmAudit', intR); } catch { threw = true; }
  assert(threw, '14.3 registro duplicado lança erro');

  // start por nome
  registry.start('crmAudit');
  assert(intR.isStarted() === true, '14.4 start() por nome inicia a integração');

  // stop por nome
  registry.stop('crmAudit');
  assert(intR.isStarted() === false, '14.5 stop() por nome para a integração');

  // nome desconhecido lança erro
  let threwUnknown = false;
  try { registry.start('naoExiste'); } catch { threwUnknown = true; }
  assert(threwUnknown, '14.6 start() com nome desconhecido lança erro');

  // startAll / stopAll
  const busR2 = new EventBus();
  const audR2 = new Audit();
  const intR2 = new CRMAuditIntegration(busR2, audR2);
  registry.register('crmAudit2', intR2);

  const startResult = registry.startAll();
  assert(startResult.started.includes('crmAudit'),  '14.7 startAll inclui crmAudit em started');
  assert(startResult.started.includes('crmAudit2'), '14.8 startAll inclui crmAudit2 em started');
  assert(startResult.failed.length === 0,            '14.9 startAll sem falhas');

  const stopResult = registry.stopAll();
  assert(stopResult.stopped.includes('crmAudit'),   '14.10 stopAll inclui crmAudit em stopped');
  assert(stopResult.failed.length === 0,             '14.11 stopAll sem falhas');

  // list
  registry.startAll();
  const listing = registry.list();
  assert(Array.isArray(listing),            '14.12 list retorna array');
  assert(listing.length === 2,             '14.13 list tem 2 entradas');
  assert(listing.every((e) => 'name' in e && 'started' in e), '14.14 cada item tem name e started');

  // getStats
  const stats = registry.getStats();
  assert(typeof stats.crmAudit  === 'object', '14.15 stats.crmAudit é objeto');
  assert(typeof stats.crmAudit2 === 'object', '14.16 stats.crmAudit2 é objeto');
  assert('started' in stats.crmAudit,         '14.17 stats.crmAudit.started presente');

  // unregister
  registry.stopAll();
  const wasRemoved = registry.unregister('crmAudit');
  assert(wasRemoved === true,                '14.18 unregister retorna true');
  assert(registry.get('crmAudit') === null,  '14.19 get após unregister retorna null');
  assert(registry.list().length === 1,       '14.20 list após unregister tem 1 entrada');
}

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 14 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
