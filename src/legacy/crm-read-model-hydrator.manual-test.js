/**
 * ESA OS — Legacy
 * Suite de testes manuais — CRMLegacyReadModelHydrator + CRMReadModel.hydrate()
 * 14 cenários obrigatórios
 *
 * Execução: node src/legacy/crm-read-model-hydrator.manual-test.js
 *
 * Valida:
 * - CRMReadModel.hydrate() aceita Object e Map, aplica replace e merge, filtra entradas inválidas
 * - Timestamps preservados dos dados legados (nunca Date.now())
 * - lastEventType = 'crm:deal:hydrated'
 * - getStats() e clear() refletem estado de hidratação
 * - CRMLegacyReadModelHydrator delega ao readModel, gera INFO/ERROR no Logger e relança erros
 * - Hidratação não gera CoreEvents no EventBus nem AuditEntries no Audit
 * - Após hidratação, evento real de stage-changed continua atualizando o mesmo Deal
 *
 * Usa instâncias reais. Sem mocks. Sem browser. ES Modules nativos.
 */

import { CRMReadModel }              from '../read-models/crm/crm-read-model.js';
import { CRMLegacyReadModelHydrator } from './crm-read-model-hydrator.js';
import { CRMReadModelIntegration }   from '../read-models/crm/crm-read-model-integration.js';
import { CRMAuditIntegration }       from '../integrations/crm-audit-integration.js';
import { EventBus, CoreEvent }       from '../core/events/index.js';
import { Audit }                     from '../core/audit/index.js';
import { Logger }                    from '../core/logger/index.js';

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
  console.log(`\n[${n}/14] ${title}`);
}

// ── Helpers de fixture ────────────────────────────────────────────────────────

function makeDeal(overrides = {}) {
  return Object.assign(
    {
      funil:          'venda_ufv',
      etapa:          'Proposta',
      status:         'Em andamento',
      valor:          100000,
      kwh:            500,
      responsavel:    'Lucas',
      responsavelUid: 'uid-lucas',
      captador:       '',
      captadorUid:    '',
      createdAt:      1700000000000,
      updatedAt:      1700100000000,
    },
    overrides,
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 1 — CRMReadModel.hydrate()
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. hydrate aceita Object de Deals ─────────────────────────────────────────

section(1, 'hydrate() aceita Object de Deals');

const rm1 = new CRMReadModel();
const result1 = rm1.hydrate({
  'd-001': makeDeal({ funil: 'venda_ufv', valor: 50000, createdAt: 1700000000000, updatedAt: 1700100000000 }),
  'd-002': makeDeal({ funil: 'assinatura_energia', valor: 0, createdAt: 1700200000000, updatedAt: 1700300000000 }),
});

assert(result1.received === 2,          '1.1 received = 2');
assert(result1.hydrated === 2,          '1.2 hydrated = 2');
assert(result1.skipped  === 0,          '1.3 skipped = 0');
assert(result1.replaced === true,       '1.4 replaced = true (default)');
assert(rm1.getDeal('d-001') !== null,   '1.5 d-001 presente no readModel');
assert(rm1.getDeal('d-002') !== null,   '1.6 d-002 presente no readModel');
assert(rm1.getDeal('d-001').funil === 'venda_ufv',         '1.7 funil d-001 correto');
assert(rm1.getDeal('d-002').funil === 'assinatura_energia', '1.8 funil d-002 correto');

// ── 2. hydrate aceita Map ─────────────────────────────────────────────────────

section(2, 'hydrate() aceita Map');

const rm2 = new CRMReadModel();
const map2 = new Map([
  ['m-001', makeDeal({ funil: 'eletromobilidade', kwh: 10000, createdAt: 1710000000000, updatedAt: 1710100000000 })],
  ['m-002', makeDeal({ funil: 'venda_ufv', valor: 75000, createdAt: 1711000000000, updatedAt: 1711100000000 })],
]);
const result2 = rm2.hydrate(map2);

assert(result2.received === 2,        '2.1 received = 2');
assert(result2.hydrated === 2,        '2.2 hydrated = 2');
assert(rm2.getDeal('m-001') !== null, '2.3 m-001 presente');
assert(rm2.getDeal('m-002') !== null, '2.4 m-002 presente');
assert(rm2.getDeal('m-001').funil === 'eletromobilidade', '2.5 funil m-001 correto');

// ── 3. hydrate replace=true limpa estado anterior ─────────────────────────────

section(3, 'hydrate() replace=true limpa estado anterior');

const rm3 = new CRMReadModel();
rm3.hydrate({ 'old-deal': makeDeal({ funil: 'venda_ufv' }) });
assert(rm3.getDeal('old-deal') !== null, '3.1 old-deal presente antes do replace');

rm3.hydrate({ 'new-deal': makeDeal({ funil: 'assinatura_energia' }) }, { replace: true });
assert(rm3.getDeal('old-deal') === null,  '3.2 old-deal removido após replace=true');
assert(rm3.getDeal('new-deal') !== null,  '3.3 new-deal presente após replace=true');
assert(rm3.getStats().dealCount === 1,    '3.4 dealCount = 1 após replace');

// ── 4. hydrate replace=false mescla sem apagar estado anterior ─────────────────

section(4, 'hydrate() replace=false mescla sem apagar estado anterior');

const rm4 = new CRMReadModel();
rm4.hydrate({ 'base-deal': makeDeal({ funil: 'venda_ufv', valor: 10000 }) });
rm4.hydrate({ 'extra-deal': makeDeal({ funil: 'eletromobilidade', valor: 20000 }) }, { replace: false });

assert(rm4.getDeal('base-deal')  !== null, '4.1 base-deal preservado');
assert(rm4.getDeal('extra-deal') !== null, '4.2 extra-deal adicionado');
assert(rm4.getStats().dealCount  === 2,    '4.3 dealCount = 2 após merge');

// ── 5. Entradas inválidas são ignoradas ───────────────────────────────────────

section(5, 'hydrate() ignora entradas inválidas');

const rm5 = new CRMReadModel();
const result5 = rm5.hydrate({
  '':          makeDeal(),                      // dealId vazio → ignorar
  'valid-001': makeDeal({ funil: 'venda_ufv' }), // válido
  'null-deal': null,                             // deal null → ignorar
  'arr-deal':  [1, 2, 3],                        // deal Array → ignorar
});

assert(result5.received === 4,              '5.1 received = 4');
assert(result5.hydrated === 1,              '5.2 hydrated = 1 (apenas valid-001)');
assert(result5.skipped  === 3,              '5.3 skipped = 3 (3 entradas inválidas)');
assert(rm5.getDeal('valid-001') !== null,   '5.4 valid-001 presente');
assert(rm5.getDeal('') === null,            '5.5 dealId vazio não entrou no Map');
assert(rm5.getDeal('null-deal') === null,   '5.6 null deal não entrou no Map');
assert(rm5.getDeal('arr-deal')  === null,   '5.7 array deal não entrou no Map');

// ── 6. Timestamps usam dados legados — nunca Date.now() ───────────────────────

section(6, 'hydrate() preserva timestamps dos dados legados');

const rm6 = new CRMReadModel();

// Caso 1: createdAt e updatedAt explícitos
rm6.hydrate({ 'ts-001': { funil: 'venda_ufv', createdAt: 1000000, updatedAt: 9000000 } });
const d6a = rm6.getDeal('ts-001');
assert(d6a.createdAt === 1000000, '6.1 createdAt preservado de deal.createdAt');
assert(d6a.updatedAt === 9000000, '6.2 updatedAt preservado de deal.updatedAt');

// Caso 2: fallback para deal.ts e deal.etapaTs
rm6.hydrate({ 'ts-002': { funil: 'assinatura_energia', ts: 2000000, etapaTs: 7000000 } }, { replace: false });
const d6b = rm6.getDeal('ts-002');
assert(d6b.createdAt === 2000000, '6.3 createdAt usa deal.ts como fallback');
assert(d6b.updatedAt === 7000000, '6.4 updatedAt usa deal.etapaTs como fallback');

// Caso 3: sem timestamps → 0
rm6.hydrate({ 'ts-003': { funil: 'venda_ufv' } }, { replace: false });
const d6c = rm6.getDeal('ts-003');
assert(d6c.createdAt === 0, '6.5 createdAt = 0 quando ausente');
assert(d6c.updatedAt === 0, '6.6 updatedAt = 0 quando ausente');

// ── 7. Deal hidratado possui lastEventType = 'crm:deal:hydrated' ──────────────

section(7, "Deal hidratado possui lastEventType = 'crm:deal:hydrated' e lastEventId = ''");

const rm7 = new CRMReadModel();
rm7.hydrate({ 'hydrated-deal': makeDeal() });
const d7 = rm7.getDeal('hydrated-deal');

assert(d7.lastEventType === 'crm:deal:hydrated', "7.1 lastEventType = 'crm:deal:hydrated'");
assert(d7.lastEventId   === '',                  "7.2 lastEventId = '' (sem CoreEvent)");

// ── 8. getStats() reflete hydrationCount e lastHydration ─────────────────────

section(8, 'getStats() registra hydrationCount e lastHydration após hidratação');

const rm8 = new CRMReadModel();
assert(rm8.getStats().hydrationCount === 0,   '8.1 hydrationCount inicial = 0');
assert(rm8.getStats().lastHydration  === null, '8.2 lastHydration inicial = null');

rm8.hydrate({ 'a': makeDeal(), 'b': makeDeal() });
const s8a = rm8.getStats();
assert(s8a.hydrationCount     === 1,  '8.3 hydrationCount = 1 após primeira hidratação');
assert(s8a.lastHydration      !== null, '8.4 lastHydration não nulo após hidratação');
assert(s8a.lastHydration.received === 2, '8.5 lastHydration.received = 2');
assert(s8a.lastHydration.hydrated === 2, '8.6 lastHydration.hydrated = 2');
assert(s8a.lastHydration.replaced === true, '8.7 lastHydration.replaced = true');

rm8.hydrate({});
assert(rm8.getStats().hydrationCount === 2, '8.8 hydrationCount = 2 após segunda hidratação');

// ── 9. clear() reseta hydrationCount e lastHydration ─────────────────────────

section(9, 'clear() reseta hydrationCount e lastHydration');

const rm9 = new CRMReadModel();
rm9.hydrate({ 'deal-to-clear': makeDeal() });
assert(rm9.getStats().hydrationCount === 1, '9.1 hydrationCount = 1 antes do clear');

rm9.clear();

assert(rm9.getStats().dealCount      === 0,    '9.2 dealCount = 0 após clear');
assert(rm9.getStats().hydrationCount === 0,    '9.3 hydrationCount = 0 após clear');
assert(rm9.getStats().lastHydration  === null, '9.4 lastHydration = null após clear');
assert(rm9.getDeal('deal-to-clear')  === null, '9.5 deal removido do Map após clear');

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 2 — CRMLegacyReadModelHydrator
// ═════════════════════════════════════════════════════════════════════════════

// ── 10. Hydrator gera INFO no Logger após hidratação bem-sucedida ─────────────

section(10, 'Hydrator gera entrada INFO no Logger após hidratação bem-sucedida');

const rm10     = new CRMReadModel();
const logger10 = new Logger('Test-10');
const hydrator10 = new CRMLegacyReadModelHydrator(rm10, logger10);

await hydrator10.hydrate({ 'h-001': makeDeal({ funil: 'venda_ufv' }) });

const infoEntries10 = logger10.getEntries('INFO');
assert(infoEntries10.length >= 1, '10.1 pelo menos 1 entrada INFO registrada');
assert(
  infoEntries10.some((e) => e.message === 'CRM read model hydrated'),
  "10.2 mensagem INFO = 'CRM read model hydrated'",
);
assert(
  infoEntries10.some((e) => e.context && e.context.hydrated === 1),
  '10.3 context.hydrated = 1 na entrada INFO',
);

// ── 11. Hydrator getStats() retorna snapshot sem expor internals ──────────────

section(11, 'Hydrator getStats() retorna snapshot sem expor internals');

const rm11     = new CRMReadModel();
const logger11 = new Logger('Test-11');
const hydrator11 = new CRMLegacyReadModelHydrator(rm11, logger11);
await hydrator11.hydrate({ 'snap-001': makeDeal(), 'snap-002': makeDeal() });

const stats11 = hydrator11.getStats();
assert(typeof stats11 === 'object',            '11.1 getStats() retorna objeto');
assert(stats11.loggerEnabled === true,          '11.2 loggerEnabled = true quando logger injetado');
assert('readModel' in stats11,                  '11.3 campo readModel presente');
assert(stats11.readModel.dealCount === 2,       '11.4 readModel.dealCount = 2');
assert(stats11.readModel.hydrationCount === 1,  '11.5 readModel.hydrationCount = 1');
assert(stats11.readModel._deals === undefined,  '11.6 _deals não exposto');

// Sem logger
const hydrator11b = new CRMLegacyReadModelHydrator(new CRMReadModel(), null);
assert(hydrator11b.getStats().loggerEnabled === false, '11.7 loggerEnabled = false sem logger');

// ── 12. Erro em hydrate() gera ERROR no Logger e é relançado ─────────────────

section(12, 'hydrate() com input inválido gera ERROR no Logger e relança o erro');

const rm12     = new CRMReadModel();
const logger12 = new Logger('Test-12');
const hydrator12 = new CRMLegacyReadModelHydrator(rm12, logger12);

let threw12 = false;
let caughtError12 = null;

try {
  await hydrator12.hydrate(null);
} catch (err) {
  threw12       = true;
  caughtError12 = err;
}

assert(threw12 === true,                    '12.1 erro foi relançado');
assert(caughtError12 instanceof TypeError,  '12.2 erro relançado é TypeError');

const errEntries12 = logger12.getEntries('ERROR');
assert(errEntries12.length >= 1,            '12.3 pelo menos 1 entrada ERROR registrada');
assert(
  errEntries12.some((e) => e.message === 'CRM read model hydration failed'),
  "12.4 mensagem ERROR = 'CRM read model hydration failed'",
);

// ── 13. Hidratação não gera CoreEvents no EventBus nem AuditEntries no Audit ──

section(13, 'Hidratação não gera CoreEvents no EventBus nem AuditEntries no Audit');

const bus13   = new EventBus();
const audit13 = new Audit();

// Iniciar CRMAuditIntegration no bus isolado para capturar qualquer evento CRM
const crmAudit13 = new CRMAuditIntegration(bus13, audit13, null);
crmAudit13.start();

// Read Model + hydrator isolados — sem conexão ao bus
const rm13     = new CRMReadModel();
const hydrator13 = new CRMLegacyReadModelHydrator(rm13, null);

await hydrator13.hydrate({
  'iso-001': makeDeal({ funil: 'venda_ufv', valor: 200000 }),
  'iso-002': makeDeal({ funil: 'assinatura_energia', kwh: 50000 }),
});

// Dar uma microtask de folga para garantir que handlers assíncronos do bus rodem (se publicados)
await new Promise((r) => setTimeout(r, 0));

assert(bus13.getHistory().length === 0,          '13.1 EventBus permanece vazio após hidratação');
assert(audit13.getEntries({}, 0).length === 0,   '13.2 Audit permanece vazio após hidratação');
assert(crmAudit13.getStats().receivedCount === 0, '13.3 CRMAuditIntegration não recebeu nenhum evento');
assert(rm13.getDeal('iso-001') !== null,          '13.4 Deal hidratado existe no readModel');
assert(rm13.getStats().dealCount === 2,           '13.5 dealCount = 2 no readModel');

// ── 14. Após hidratação, evento real stage-changed atualiza o mesmo Deal ──────

section(14, 'Após hidratação, crm:deal:stage-changed continua atualizando o mesmo Deal');

const bus14 = new EventBus();
const rm14  = new CRMReadModel();

// Hidratar deal inicial
await new CRMLegacyReadModelHydrator(rm14, null).hydrate({
  'after-hydration': makeDeal({
    funil:    'venda_ufv',
    etapa:    'Proposta',
    status:   'Em andamento',
    valor:    150000,
    createdAt: 1700000000000,
    updatedAt: 1700100000000,
  }),
});

assert(rm14.getDeal('after-hydration').etapa === 'Proposta',      '14.1 etapa inicial = Proposta');
assert(rm14.getDeal('after-hydration').lastEventType === 'crm:deal:hydrated', '14.2 lastEventType = crm:deal:hydrated');

// Ligar CRMReadModelIntegration ao bus
const integration14 = new CRMReadModelIntegration(bus14, rm14, null);
integration14.start();

// Publicar evento real de stage-changed
const stageEvt = new CoreEvent(
  'crm:deal:stage-changed',
  { id: 'after-hydration', dealId: 'after-hydration', fromStage: 'Proposta', toStage: 'Negociação' },
  'ManualTest',
  { organizationId: 'esa', personId: 'test' },
);
await bus14.publish(stageEvt);

const d14 = rm14.getDeal('after-hydration');
assert(d14.etapa          === 'Negociação',            '14.3 etapa atualizada para Negociação pelo evento');
assert(d14.status         === 'Em andamento',          '14.4 status preservado');
assert(d14.funil          === 'venda_ufv',             '14.5 funil preservado');
assert(d14.valor          === 150000,                  '14.6 valor preservado');
assert(d14.lastEventType  === 'crm:deal:stage-changed', '14.7 lastEventType atualizado pelo evento real');
assert(integration14.getStats().appliedCount === 1,    '14.8 integration.appliedCount = 1');

// ═════════════════════════════════════════════════════════════════════════════
// Resultado final
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 14 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
