/**
 * ESA OS — Core
 * Suite de testes de integração — CRM Read Model ativo no ESAApplication
 * 12 cenários obrigatórios
 *
 * Execução: node src/core/app.crm-read-model.manual-test.js
 *
 * Valida que ESA.initialize() registra e inicia CRMReadModelIntegration,
 * que os eventos CRM reais fluem para o singleton crmReadModel e que
 * os métodos getCRMPipeline, getCRMStatusSummary, getCRMMetrics e
 * getCRMReadModelStats retornam snapshots corretos.
 *
 * Usa singletons reais. Sem mocks. Sem browser. ES Modules nativos.
 */

import { ESA }                from './app.js';
import { eventBus, CoreEvent } from './events/index.js';
import { audit }              from './audit/index.js';
import { logger }             from './logger/index.js';
import { integrationRegistry } from '../integrations/index.js';
import { crmReadModel, crmMetrics } from '../read-models/crm/index.js';

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

// ── Isolamento antes dos cenários ─────────────────────────────────────────────

eventBus.reset();
audit.clear();
logger.clear();
crmReadModel.clear();
integrationRegistry.stopAll();

if (integrationRegistry.get('crmAudit'))     integrationRegistry.unregister('crmAudit');
if (integrationRegistry.get('crmReadModel')) integrationRegistry.unregister('crmReadModel');

ESA.initialize();

// ── 1. ESA.initialize registra crmReadModel ───────────────────────────────────

section(1, 'ESA.initialize registra crmReadModel no IntegrationRegistry');

const rm1 = integrationRegistry.get('crmReadModel');
assert(rm1 !== null,                         '1.1 crmReadModel registrado');
assert(typeof rm1.start     === 'function',  '1.2 expõe start()');
assert(typeof rm1.stop      === 'function',  '1.3 expõe stop()');
assert(typeof rm1.isStarted === 'function',  '1.4 expõe isStarted()');
assert(typeof rm1.getStats  === 'function',  '1.5 expõe getStats()');

// ── 2. crmReadModel integration é iniciada ────────────────────────────────────

section(2, 'CRMReadModelIntegration é iniciada após ESA.initialize');

assert(integrationRegistry.get('crmReadModel').isStarted() === true, '2.1 isStarted() = true');

const list2 = integrationRegistry.list();
assert(list2.some((i) => i.name === 'crmReadModel' && i.started === true),
  '2.2 list() confirma crmReadModel iniciada');
assert(list2.some((i) => i.name === 'crmAudit' && i.started === true),
  '2.3 crmAudit também iniciada');

// ── 3. crmReadModel integration possui loggerEnabled true ─────────────────────

section(3, 'CRMReadModelIntegration possui loggerEnabled = true');

const stats3 = integrationRegistry.get('crmReadModel').getStats();
assert(stats3.loggerEnabled === true, '3.1 loggerEnabled = true (Logger singleton injetado)');
assert(stats3.started       === true, '3.2 started = true');
assert(stats3.errorCount    === 0,    '3.3 sem erros na inicialização');
assert(stats3.receivedCount === 0,    '3.4 receivedCount = 0 (nenhum evento ainda)');

// ── 4. ESA.initialize continua idempotente com duas integrações ───────────────

section(4, 'ESA.initialize é idempotente — não duplica integrações');

const countBefore4 = integrationRegistry.list().length;
ESA.initialize();
const countAfter4  = integrationRegistry.list().length;

assert(countAfter4 === countBefore4,
  '4.1 número de integrações não cresce na segunda chamada');
assert(integrationRegistry.get('crmAudit').isStarted()    === true,
  '4.2 crmAudit continua iniciada');
assert(integrationRegistry.get('crmReadModel').isStarted() === true,
  '4.3 crmReadModel continua iniciada');
assert(ESA.firebase.isInitialized() === true,
  '4.4 firebase continua inicializado');

// ── Publicar eventos sequencialmente ─────────────────────────────────────────

const META = { organizationId: 'esa', personId: 'test-person' };

const evtCreated = new CoreEvent(
  'crm:deal:created',
  {
    id: 'deal-rm-app', dealId: 'deal-rm-app',
    deal: {
      funil: 'venda_ufv', etapa: 'Proposta',
      status: 'Em andamento', valor: 100000, responsavel: 'Lucas',
    },
  },
  'AppCRMReadModelTest',
  META,
);
await eventBus.publish(evtCreated);

// ── 5. deal created entra no singleton crmReadModel via Event Bus ──────────────

section(5, 'crm:deal:created entra no singleton crmReadModel via Event Bus');

const d5 = crmReadModel.getDeal('deal-rm-app');
assert(d5 !== null,                    '5.1 getDeal retorna objeto');
assert(d5.funil  === 'venda_ufv',      '5.2 funil = venda_ufv');
assert(d5.etapa  === 'Proposta',       '5.3 etapa = Proposta');
assert(d5.status === 'Em andamento',   '5.4 status = Em andamento');
assert(d5.valor  === 100000,           '5.5 valor = 100000');
assert(d5.responsavel === 'Lucas',     '5.6 responsavel = Lucas');

const stats5 = integrationRegistry.get('crmReadModel').getStats();
assert(stats5.receivedCount >= 1,      '5.7 receivedCount >= 1');
assert(stats5.appliedCount  >= 1,      '5.8 appliedCount >= 1');

// ── 6. stage changed atualiza etapa no singleton ──────────────────────────────

const evtStage = new CoreEvent(
  'crm:deal:stage-changed',
  { id: 'deal-rm-app', dealId: 'deal-rm-app', fromStage: 'Proposta', toStage: 'Negociação' },
  'AppCRMReadModelTest',
  META,
);
await eventBus.publish(evtStage);

section(6, 'crm:deal:stage-changed atualiza etapa — preserva outros campos');

const d6 = crmReadModel.getDeal('deal-rm-app');
assert(d6.etapa  === 'Negociação',     '6.1 etapa = Negociação');
assert(d6.status === 'Em andamento',   '6.2 status preservado');
assert(d6.funil  === 'venda_ufv',      '6.3 funil preservado');
assert(d6.valor  === 100000,           '6.4 valor preservado');

// ── 7. deal won força status Vendido ──────────────────────────────────────────

const evtWon = new CoreEvent(
  'crm:deal:won',
  {
    id: 'deal-rm-app', dealId: 'deal-rm-app',
    before: { status: 'Em andamento' },
    after:  { status: 'Vendido' },
    deal:   { status: 'Vendido' },
  },
  'AppCRMReadModelTest',
  META,
);
await eventBus.publish(evtWon);

section(7, 'crm:deal:won força status = "Vendido" — preserva funil, etapa, valor');

const d7 = crmReadModel.getDeal('deal-rm-app');
assert(d7.status === 'Vendido',        '7.1 status = Vendido');
assert(d7.funil  === 'venda_ufv',      '7.2 funil preservado pelo merge raso');
assert(d7.etapa  === 'Negociação',     '7.3 etapa preservada pelo merge raso');
assert(d7.valor  === 100000,           '7.4 valor preservado pelo merge raso');

// ── 8. getCRMPipeline retorna pipeline derivado ───────────────────────────────

section(8, 'getCRMPipeline retorna estrutura funil → etapa com count e totalValue');

const pipe8 = ESA.getCRMPipeline();
assert(typeof pipe8 === 'object',                              '8.1 retorna objeto');
assert('venda_ufv' in pipe8,                                  '8.2 funil venda_ufv presente');
assert('Negociação' in pipe8.venda_ufv,                       '8.3 etapa Negociação presente');
assert(pipe8.venda_ufv.Negociação.count      === 1,           '8.4 count = 1');
assert(pipe8.venda_ufv.Negociação.totalValue === 100000,      '8.5 totalValue = 100000');
assert(pipe8.venda_ufv.Negociação.totalKwh   === 0,           '8.6 totalKwh = 0');

// ── 9. getCRMStatusSummary retorna resumo derivado ────────────────────────────

section(9, 'getCRMStatusSummary retorna total e byStatus corretos');

const summary9 = ESA.getCRMStatusSummary();
assert(summary9.total === 1,                '9.1 total = 1');
assert(summary9.byStatus['Vendido'] === 1,  '9.2 byStatus.Vendido = 1');
assert(!('Em andamento' in summary9.byStatus),
  '9.3 Em andamento ausente após status ter mudado para Vendido');

// ── 10. getCRMMetrics retorna conversion/winRate/lossRate/pausedRate/forecast ─

section(10, 'getCRMMetrics retorna todas as métricas com valores corretos');

const metrics10 = ESA.getCRMMetrics();

assert('conversion' in metrics10,     '10.1 campo conversion presente');
assert('winRate'    in metrics10,     '10.2 campo winRate presente');
assert('lossRate'   in metrics10,     '10.3 campo lossRate presente');
assert('pausedRate' in metrics10,     '10.4 campo pausedRate presente');
assert('forecast'   in metrics10,     '10.5 campo forecast presente');

// conversion
assert(metrics10.conversion.total     === 1,   '10.6 conversion.total = 1');
assert(metrics10.conversion.converted === 1,   '10.7 conversion.converted = 1');
assert(metrics10.conversion.rate      === 100, '10.8 conversion.rate = 100');

// winRate
assert(metrics10.winRate.decided === 1,   '10.9 winRate.decided = 1');
assert(metrics10.winRate.won     === 1,   '10.10 winRate.won = 1');
assert(metrics10.winRate.rate    === 100, '10.11 winRate.rate = 100');

// lossRate
assert(metrics10.lossRate.decided === 1,  '10.12 lossRate.decided = 1');
assert(metrics10.lossRate.lost    === 0,  '10.13 lossRate.lost = 0');
assert(metrics10.lossRate.rate    === 0,  '10.14 lossRate.rate = 0');

// pausedRate
assert(metrics10.pausedRate.total  === 1, '10.15 pausedRate.total = 1');
assert(metrics10.pausedRate.paused === 0, '10.16 pausedRate.paused = 0');
assert(metrics10.pausedRate.rate   === 0, '10.17 pausedRate.rate = 0');

// forecast — deal Vendido (peso 1.00), valor 100000
assert(metrics10.forecast.totalValue    === 100000, '10.18 forecast.totalValue = 100000');
assert(metrics10.forecast.weightedValue === 100000, '10.19 forecast.weightedValue = 100000');
assert(metrics10.forecast.dealCount     === 1,      '10.20 forecast.dealCount = 1');

// ── 11. getCRMReadModelStats retorna snapshots sem expor integração ou Map ────

section(11, 'getCRMReadModelStats retorna snapshots — sem expor integração ou Map interno');

const rmStats11 = ESA.getCRMReadModelStats();

assert(typeof rmStats11 === 'object',                          '11.1 retorna objeto');
assert('integration' in rmStats11,                            '11.2 campo integration presente');
assert('readModel'   in rmStats11,                            '11.3 campo readModel presente');

// integration é snapshot
assert(typeof rmStats11.integration.started       === 'boolean', '11.4 integration.started é boolean');
assert(typeof rmStats11.integration.receivedCount === 'number',  '11.5 integration.receivedCount é number');
assert(typeof rmStats11.integration.appliedCount  === 'number',  '11.6 integration.appliedCount é number');
assert(rmStats11.integration.loggerEnabled === true,             '11.7 integration.loggerEnabled = true');

// readModel é snapshot — não expõe Map interno nem a instância
assert(typeof rmStats11.readModel.dealCount === 'number',        '11.8 readModel.dealCount é number');
assert(rmStats11.readModel.dealCount >= 1,                       '11.9 readModel.dealCount >= 1');
assert(rmStats11.readModel._deals === undefined,                  '11.10 _deals não exposto');

// Não retorna a instância CRMReadModelIntegration
assert(typeof rmStats11.integration.subscribe === 'undefined',   '11.11 subscribe não exposto');
assert(typeof rmStats11.integration.start === 'undefined',       '11.12 start() não exposto no snapshot');

// ── 12. getCoreStats inclui crmAudit e crmReadModel em integrations ───────────

section(12, 'getCoreStats inclui crmAudit e crmReadModel em integrations');

const core12 = ESA.getCoreStats();

assert('version'             in core12,      '12.1 version presente');
assert('firebaseInitialized' in core12,      '12.2 firebaseInitialized presente');
assert('integrations'        in core12,      '12.3 integrations presente');
assert('logger'              in core12,      '12.4 logger presente');

assert('crmAudit'     in core12.integrations,  '12.5 integrations.crmAudit presente');
assert('crmReadModel' in core12.integrations,  '12.6 integrations.crmReadModel presente');

assert(core12.integrations.crmAudit.started     === true,  '12.7 crmAudit.started = true');
assert(core12.integrations.crmReadModel.started  === true,  '12.8 crmReadModel.started = true');
assert(core12.integrations.crmReadModel.loggerEnabled === true,
  '12.9 crmReadModel.loggerEnabled = true');

assert(core12.integrations.crmReadModel.appliedCount >= 3,
  '12.10 crmReadModel.appliedCount >= 3 (3 eventos publicados)');

// getCoreStats não deve expor referências internas
assert(core12.eventBus === undefined, '12.11 eventBus não exposto');
assert(core12.audit    === undefined, '12.12 audit não exposto');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 12 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
