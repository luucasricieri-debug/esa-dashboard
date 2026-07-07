/**
 * ESA OS — Core
 * Suite de testes de integração — ESAApplication + Logger ativo no CRM Audit
 * 10 cenários obrigatórios
 *
 * Execução: node src/core/app.integration.manual-test.js
 *
 * Usa os singletons reais da aplicação: ESA, eventBus, audit, logger, integrationRegistry.
 * Sem mocks. Sem Jest. Sem browser. ES Modules nativos.
 */

import { ESA }                              from './app.js';
import { eventBus, CoreEvent }              from './events/index.js';
import { audit, AUDIT_ACTION }             from './audit/index.js';
import { logger }                           from './logger/index.js';
import { integrationRegistry }             from '../integrations/index.js';

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

// ── Isolamento antes dos cenários ─────────────────────────────────────────────

eventBus.reset();
audit.clear();
logger.clear();
integrationRegistry.stopAll();
if (integrationRegistry.get('crmAudit')) {
  integrationRegistry.unregister('crmAudit');
}

ESA.initialize();

// ── 1. ESA.initialize() inicializa FirebaseService ────────────────────────────

section(1, 'ESA.initialize() inicializa FirebaseService');

assert(ESA.firebase.isInitialized() === true, '1.1 firebase.isInitialized() = true após initialize()');
assert(typeof ESA.version === 'string',        '1.2 version é string');
assert(ESA.version.length > 0,                 '1.3 version não é vazia');
assert(ESA.crmLegacyBridge !== null,           '1.4 crmLegacyBridge foi criado');

// ── 2. crmAudit é registrado ──────────────────────────────────────────────────

section(2, 'crmAudit é registrado');

const crmAudit2 = integrationRegistry.get('crmAudit');
assert(crmAudit2 !== null,                               '2.1 crmAudit registrado no registry');
assert(typeof crmAudit2.start     === 'function',        '2.2 expõe start()');
assert(typeof crmAudit2.stop      === 'function',        '2.3 expõe stop()');
assert(typeof crmAudit2.isStarted === 'function',        '2.4 expõe isStarted()');
assert(typeof crmAudit2.getStats  === 'function',        '2.5 expõe getStats()');

// ── 3. crmAudit é iniciado ────────────────────────────────────────────────────

section(3, 'crmAudit é iniciado');

assert(integrationRegistry.get('crmAudit').isStarted() === true, '3.1 crmAudit.isStarted() = true');

const list3 = integrationRegistry.list();
assert(list3.length >= 1,                                           '3.2 registry tem pelo menos 1 integração');
assert(list3.some((i) => i.name === 'crmAudit' && i.started === true),
  '3.3 list() confirma crmAudit iniciado');

// ── 4. crmAudit possui loggerEnabled = true ───────────────────────────────────

section(4, 'crmAudit possui loggerEnabled = true');

const stats4 = integrationRegistry.get('crmAudit').getStats();
assert(stats4.loggerEnabled === true, '4.1 loggerEnabled = true (Logger singleton injetado)');
assert(stats4.started       === true, '4.2 started = true');
assert(stats4.errorCount    === 0,    '4.3 sem erros na inicialização');

// ── 5. ESA.initialize() é idempotente ─────────────────────────────────────────

section(5, 'ESA.initialize() é idempotente');

const countBefore5 = integrationRegistry.list().length;
ESA.initialize();
const countAfter5  = integrationRegistry.list().length;

assert(countAfter5 === countBefore5,
  '5.1 número de integrações registradas não cresce na segunda chamada');
assert(integrationRegistry.get('crmAudit').isStarted() === true,
  '5.2 crmAudit continua iniciado após segunda chamada');
assert(ESA.firebase.isInitialized() === true,
  '5.3 firebase continua inicializado');

// ── 6. evento CRM válido gera AuditEntry ──────────────────────────────────────

section(6, 'evento CRM válido gera AuditEntry');

const entriesBefore6 = audit.getEntries({}, 0).length;

const evt6 = new CoreEvent(
  'crm:deal:stage-changed',
  { id: 'deal-app-test', dealId: 'deal-app-test', fromStage: 'Proposta', toStage: 'Negociação' },
  'AppIntegrationTest',
  { organizationId: 'esa', personId: 'test-person' },
);
await eventBus.publish(evt6);

const entries6 = audit.getEntries({}, 0);
assert(entries6.length > entriesBefore6,          '6.1 AuditEntry criada após evento');

const entry6 = entries6[0];
assert(entry6.action     === AUDIT_ACTION.MOVE,   '6.2 action = MOVE');
assert(entry6.resource   === 'deal',              '6.3 resource = deal');
assert(entry6.resourceId === 'deal-app-test',     '6.4 resourceId = deal-app-test');
assert(entry6.before !== null,                    '6.5 before não é null');
assert(entry6.before.stage === 'Proposta',        '6.6 before.stage = Proposta');
assert(entry6.after  !== null,                    '6.7 after não é null');
assert(entry6.after.stage  === 'Negociação',      '6.8 after.stage = Negociação');
assert(entry6.organizationId === 'esa',           '6.9 organizationId = esa');
assert(entry6.personId       === 'test-person',   '6.10 personId = test-person');

// ── 7. evento CRM válido gera INFO no Logger ──────────────────────────────────

section(7, 'evento CRM válido gera INFO no Logger');

const infoEntries7 = logger.getEntries('INFO');
assert(infoEntries7.length >= 1,
  '7.1 pelo menos 1 entrada INFO no logger singleton');
assert(
  infoEntries7.some((e) => e.message === 'CRM event audited'),
  '7.2 mensagem "CRM event audited" presente',
);

// ── 8. INFO usa source CRMAuditIntegration ────────────────────────────────────

section(8, 'INFO usa source CRMAuditIntegration');

const infoEntry8 = logger.getEntries('INFO').find((e) => e.message === 'CRM event audited');
assert(infoEntry8 !== undefined,                                    '8.1 INFO entry encontrado');
assert(infoEntry8.source === 'CRMAuditIntegration',                 '8.2 source = CRMAuditIntegration');
assert(infoEntry8.context.eventType === 'crm:deal:stage-changed',   '8.3 context.eventType correto');
assert(infoEntry8.context.eventId   === evt6.id,                    '8.4 context.eventId = evt6.id');
assert(typeof infoEntry8.context.auditEntryId === 'string',         '8.5 context.auditEntryId é string');
assert(infoEntry8.context.auditEntryId.length > 0,                  '8.6 context.auditEntryId não é vazio');
assert(infoEntry8.context.action   === AUDIT_ACTION.MOVE,           '8.7 context.action = MOVE');
assert(infoEntry8.context.resource === 'deal',                      '8.8 context.resource = deal');

// ── 9. getCRMAuditStats() retorna snapshot correto ────────────────────────────

section(9, 'getCRMAuditStats() retorna snapshot correto');

const stats9 = ESA.getCRMAuditStats();
assert(stats9 !== null,            '9.1 getCRMAuditStats() não retorna null');
assert(stats9.started === true,    '9.2 stats.started = true');
assert(stats9.loggerEnabled === true, '9.3 stats.loggerEnabled = true');
assert(stats9.receivedCount >= 1,  '9.4 stats.receivedCount >= 1');
assert(stats9.auditedCount  >= 1,  '9.5 stats.auditedCount >= 1');
assert(stats9.errorCount    === 0, '9.6 stats.errorCount = 0');
assert(stats9.lastError     === null, '9.7 stats.lastError = null');
// getCRMAuditStats() retorna apenas snapshot, não a integração
assert(typeof stats9.start === 'undefined', '9.8 start() não exposto pelo snapshot');
assert(typeof stats9.stop  === 'undefined', '9.9 stop() não exposto pelo snapshot');

// ── 10. getCoreStats() retorna version, firebaseInitialized, integrations, logger ──

section(10, 'getCoreStats() retorna version, firebaseInitialized, integrations e logger');

const core10 = ESA.getCoreStats();
assert('version'             in core10,   '10.1 version presente');
assert(core10.version        === ESA.version, '10.2 version = ESA.version');
assert('firebaseInitialized' in core10,   '10.3 firebaseInitialized presente');
assert(core10.firebaseInitialized === true, '10.4 firebaseInitialized = true');
assert('integrations'        in core10,   '10.5 integrations presente');
assert('crmAudit'            in core10.integrations, '10.6 integrations.crmAudit presente');
assert(core10.integrations.crmAudit.loggerEnabled === true, '10.7 crmAudit.loggerEnabled = true');
assert('logger'              in core10,   '10.8 logger presente');
assert(core10.logger.source  === 'ESA OS', '10.9 logger.source = ESA OS');
assert(core10.logger.entryCount >= 1,     '10.10 logger.entryCount >= 1 (eventos registrados)');
// Garantir que referências internas não são expostas
assert(core10.eventBus === undefined, '10.11 eventBus não exposto');
assert(core10.audit    === undefined, '10.12 audit não exposto');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 10 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
