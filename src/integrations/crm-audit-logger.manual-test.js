/**
 * ESA OS — Integrations
 * Suite de testes manuais — CRMAuditIntegration + Logger
 * 10 cenários obrigatórios
 *
 * Execução: node src/integrations/crm-audit-logger.manual-test.js
 *
 * Usa EventBus, Audit, Logger, CoreEvent e CRMAuditIntegration reais — sem mocks.
 * Sem Jest. Sem dependências externas. ES Modules nativos.
 */

import { EventBus, CoreEvent } from '../core/events/index.js';
import { Audit }               from '../core/audit/index.js';
import { Logger }              from '../core/logger/logger.js';
import { CRMAuditIntegration } from './crm-audit-integration.js';

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
  console.log(`\n[${n}/10] ${title}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cria um CoreEvent CRM mapeável com contexto válido por padrão. */
function makeMappedEvent({
  type           = 'crm:deal:created',
  organizationId = 'org-esa',
  personId       = 'user-001',
} = {}) {
  return new CoreEvent(
    type,
    { id: 'deal-test-001' },
    'test-source',
    { organizationId, personId },
  );
}

/** Cria um Logger com console desabilitado (padrão). */
function makeLogger(source = 'test-logger') {
  return new Logger(source);   // _consoleEnabled = false por padrão
}

// ── 1. Integração funciona sem Logger ─────────────────────────────────────────

section(1, 'integração funciona sem Logger');

{
  const bus1 = new EventBus();
  const aud1 = new Audit();
  const int1 = new CRMAuditIntegration(bus1, aud1);
  int1.start();

  await bus1.publish(makeMappedEvent());

  const s1 = int1.getStats();
  assert(s1.auditedCount === 1,        '1.1 auditedCount = 1 sem Logger');
  assert(s1.loggerEnabled === false,   '1.2 loggerEnabled = false');
  assert(s1.errorCount === 0,          '1.3 sem erros');
  assert(s1.skippedUnmapped === 0,     '1.4 sem eventos não mapeados');
  assert(s1.skippedInvalidContext === 0, '1.5 sem contextos inválidos');
}

// ── 2. Integração aceita Logger ───────────────────────────────────────────────

section(2, 'integração aceita Logger');

{
  const bus2 = new EventBus();
  const aud2 = new Audit();
  const log2 = makeLogger('test-2');
  const int2 = new CRMAuditIntegration(bus2, aud2, log2);
  int2.start();

  await bus2.publish(makeMappedEvent());

  const s2 = int2.getStats();
  assert(s2.loggerEnabled === true,  '2.1 loggerEnabled = true com Logger');
  assert(s2.auditedCount === 1,      '2.2 auditedCount = 1 com Logger');
  assert(s2.errorCount === 0,        '2.3 sem erros com Logger');
}

// ── 3. loggerEnabled correto ──────────────────────────────────────────────────

section(3, 'loggerEnabled correto');

{
  // Sem logger
  const int3a = new CRMAuditIntegration(new EventBus(), new Audit());
  assert(int3a.getStats().loggerEnabled === false, '3.1 sem logger → loggerEnabled = false');

  // Com logger
  const int3b = new CRMAuditIntegration(new EventBus(), new Audit(), makeLogger('3b'));
  assert(int3b.getStats().loggerEnabled === true,  '3.2 com logger → loggerEnabled = true');

  // Logger null explícito
  const int3c = new CRMAuditIntegration(new EventBus(), new Audit(), null);
  assert(int3c.getStats().loggerEnabled === false, '3.3 null explícito → loggerEnabled = false');
}

// ── 4. Evento auditado gera INFO ──────────────────────────────────────────────

section(4, 'evento auditado gera INFO');

{
  const bus4 = new EventBus();
  const aud4 = new Audit();
  const log4 = makeLogger('test-4');
  const int4 = new CRMAuditIntegration(bus4, aud4, log4);
  int4.start();

  await bus4.publish(makeMappedEvent());

  const infoEntries4 = log4.getEntries('INFO');
  assert(infoEntries4.length >= 1,
    '4.1 pelo menos 1 entrada INFO no logger');
  assert(
    infoEntries4.some((e) => e.message === 'CRM event audited'),
    '4.2 mensagem INFO = "CRM event audited"',
  );
}

// ── 5. INFO contém eventId / eventType / auditEntryId ─────────────────────────

section(5, 'INFO contém eventId/eventType/auditEntryId');

{
  const bus5 = new EventBus();
  const aud5 = new Audit();
  const log5 = makeLogger('test-5');
  const int5 = new CRMAuditIntegration(bus5, aud5, log5);
  int5.start();

  const evt5 = makeMappedEvent({ type: 'crm:deal:created' });
  await bus5.publish(evt5);

  const infoEntry5 = log5.getEntries('INFO').find((e) => e.message === 'CRM event audited');
  assert(infoEntry5 !== undefined,                          '5.1 INFO entry encontrado');
  assert(infoEntry5.context.eventId === evt5.id,           '5.2 context.eventId correto');
  assert(infoEntry5.context.eventType === 'crm:deal:created', '5.3 context.eventType correto');
  assert(typeof infoEntry5.context.auditEntryId === 'string', '5.4 context.auditEntryId é string');
  assert(infoEntry5.context.auditEntryId.length > 0,        '5.5 context.auditEntryId não é vazio');
  assert('action'    in infoEntry5.context,                  '5.6 context.action presente');
  assert('resource'  in infoEntry5.context,                  '5.7 context.resource presente');
  assert('resourceId' in infoEntry5.context,                 '5.8 context.resourceId presente');
}

// ── 6. Contexto inválido gera WARN ────────────────────────────────────────────

section(6, 'contexto inválido gera WARN');

{
  const bus6 = new EventBus();
  const aud6 = new Audit();
  const log6 = makeLogger('test-6');
  const int6 = new CRMAuditIntegration(bus6, aud6, log6);
  int6.start();

  // Evento mapeado, mas sem organizationId nem personId → contexto inválido
  const evt6 = new CoreEvent('crm:deal:created', { id: 'deal-no-ctx' }, 'test', {});
  await bus6.publish(evt6);

  assert(int6.getStats().skippedInvalidContext === 1, '6.1 skippedInvalidContext = 1');
  assert(int6.getStats().auditedCount === 0,          '6.2 auditedCount = 0');

  const warnEntries6 = log6.getEntries('WARN');
  assert(warnEntries6.length >= 1,                    '6.3 pelo menos 1 entrada WARN');

  const warnEntry6 = warnEntries6.find((e) => e.message === 'CRM audit skipped: invalid context');
  assert(warnEntry6 !== undefined,                    '6.4 mensagem WARN correta');
  assert('eventId'        in warnEntry6.context,      '6.5 WARN context.eventId presente');
  assert('eventType'      in warnEntry6.context,      '6.6 WARN context.eventType presente');
  assert('organizationId' in warnEntry6.context,      '6.7 WARN context.organizationId presente');
  assert('personId'       in warnEntry6.context,      '6.8 WARN context.personId presente');
}

// ── 7. Evento não mapeado gera DEBUG ─────────────────────────────────────────

section(7, 'evento não mapeado gera DEBUG');

{
  const bus7 = new EventBus();
  const aud7 = new Audit();
  const log7 = makeLogger('test-7');
  const int7 = new CRMAuditIntegration(bus7, aud7, log7);
  int7.start();

  // Tipo crm:* sem mapeamento em CRMEventMapper
  const evt7 = new CoreEvent(
    'crm:unknown:action',
    { id: 'deal-999' },
    'test',
    { organizationId: 'org-x', personId: 'user-x' },
  );
  await bus7.publish(evt7);

  assert(int7.getStats().skippedUnmapped === 1, '7.1 skippedUnmapped = 1');
  assert(int7.getStats().auditedCount === 0,    '7.2 auditedCount = 0');

  const debugEntries7 = log7.getEntries('DEBUG');
  assert(debugEntries7.length >= 1,             '7.3 pelo menos 1 entrada DEBUG');

  const debugEntry7 = debugEntries7.find((e) => e.message === 'CRM audit skipped: unmapped event');
  assert(debugEntry7 !== undefined,             '7.4 mensagem DEBUG correta');
  assert('eventId'   in debugEntry7.context,    '7.5 DEBUG context.eventId presente');
  assert('eventType' in debugEntry7.context,    '7.6 DEBUG context.eventType presente');
}

// ── 8. Erro interno gera ERROR ────────────────────────────────────────────────

section(8, 'erro interno gera ERROR');

{
  const bus8 = new EventBus();
  const log8 = makeLogger('test-8');

  // Objeto audit que lança intencionalmente (não é um mock da classe Audit)
  const failingAudit = {
    record: () => { throw new Error('Simulated audit failure'); },
  };

  const int8 = new CRMAuditIntegration(bus8, failingAudit, log8);
  int8.start();

  // Publicar evento válido e mapeável → audit.record() vai lançar
  await bus8.publish(makeMappedEvent());

  const s8 = int8.getStats();
  assert(s8.errorCount === 1,          '8.1 errorCount = 1');
  assert(s8.lastError !== null,        '8.2 lastError registrado');
  assert(s8.auditedCount === 0,        '8.3 auditedCount = 0 após erro');

  const errorEntries8 = log8.getEntries('ERROR');
  assert(errorEntries8.length >= 1,    '8.4 pelo menos 1 entrada ERROR');

  const errEntry8 = errorEntries8.find((e) => e.message === 'CRM audit integration failed');
  assert(errEntry8 !== undefined,      '8.5 mensagem ERROR correta');
  assert('eventId'   in errEntry8.context, '8.6 ERROR context.eventId presente');
  assert('eventType' in errEntry8.context, '8.7 ERROR context.eventType presente');
  // error() injeta errorMessage, errorName, errorStack no context quando error é Error
  assert('errorMessage' in errEntry8.context, '8.8 errorMessage injetado no context');
}

// ── 9. child Logger usa source CRMAuditIntegration ────────────────────────────

section(9, 'child Logger usa source CRMAuditIntegration');

{
  const bus9 = new EventBus();
  const aud9 = new Audit();
  const log9 = makeLogger('parent-9');
  const int9 = new CRMAuditIntegration(bus9, aud9, log9);
  int9.start();

  await bus9.publish(makeMappedEvent());

  // O child logger compartilha _entries com o pai — entradas ficam visíveis em log9
  const allEntries9 = log9.getEntries();
  const fromChild9  = allEntries9.filter((e) => e.source === 'CRMAuditIntegration');

  assert(fromChild9.length >= 1,
    '9.1 child gerou pelo menos 1 entrada com source CRMAuditIntegration');
  assert(
    fromChild9.every((e) => e.source === 'CRMAuditIntegration'),
    '9.2 todas as entradas do filho têm source = "CRMAuditIntegration"',
  );
  // O pai (source 'parent-9') não gerou entradas próprias — só o filho
  const fromParent9 = allEntries9.filter((e) => e.source === 'parent-9');
  assert(fromParent9.length === 0,
    '9.3 parent-9 não gerou entradas diretas neste cenário',
  );
}

// ── 10. Logs da integração aparecem no histórico do Logger pai ────────────────

section(10, 'logs da integração aparecem no histórico do Logger pai');

{
  const bus10    = new EventBus();
  const aud10    = new Audit();
  const logPai10 = makeLogger('pai-10');
  const int10    = new CRMAuditIntegration(bus10, aud10, logPai10);
  int10.start();

  const countAntes = logPai10.getEntries().length;

  await bus10.publish(makeMappedEvent({ type: 'crm:deal:stage-changed' }));

  const countDepois = logPai10.getEntries().length;

  assert(countDepois > countAntes,
    '10.1 histórico do pai cresceu após o evento');
  assert(
    logPai10.getEntries().some((e) => e.message === 'CRM event audited'),
    '10.2 INFO do filho ("CRM event audited") visível em logPai10.getEntries()',
  );
  assert(
    logPai10.getEntries().some((e) => e.source === 'CRMAuditIntegration'),
    '10.3 source "CRMAuditIntegration" visível no pai',
  );

  // Limpeza do pai afeta o filho (array compartilhado)
  logPai10.clear();
  assert(logPai10.getEntries().length === 0,
    '10.4 clear() do pai esvazia histórico compartilhado',
  );
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
