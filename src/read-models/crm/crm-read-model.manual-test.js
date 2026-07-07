/**
 * ESA OS — Read Models / CRM
 * Suite de testes — CRMReadModel, CRMMetrics, CRMReadModelIntegration
 * 16 cenários obrigatórios
 *
 * Execução: node src/read-models/crm/crm-read-model.manual-test.js
 *
 * Sem Jest. Sem mocks. ES Modules nativos.
 */

import { CRMReadModel }            from './crm-read-model.js';
import { CRMReadModelIntegration } from './crm-read-model-integration.js';
import { CRMMetrics }              from './crm-metrics.js';
import { CoreEvent }               from '../../core/events/event.js';
import { EventBus }                from '../../core/events/event-bus.js';
import { Logger }                  from '../../core/logger/logger.js';

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
  console.log(`\n[${n}/16] ${title}`);
}

// ── Utilitário — criar CoreEvent com timestamp fixo ───────────────────────────

function makeEvent(type, payload, ts = Date.now()) {
  const evt = new CoreEvent(type, payload, 'Test');
  evt.createdAt = ts;
  return evt;
}

// ── RM1 — estado compartilhado para cenários 1–8 ─────────────────────────────

const rm = new CRMReadModel();

// ── RM2 — pré-populado para cenários 9–15 ────────────────────────────────────

const rm2 = new CRMReadModel();

// 6 deals com funils, etapas, status e valores variados.
// Timestamps crescentes para testar ordenação e filtros from/to.
rm2.apply(makeEvent('crm:deal:created', {
  id: 'rm2-d01', dealId: 'rm2-d01',
  deal: { funil: 'venda_ufv', etapa: 'Proposta', status: 'Vendido', valor: 50000, kwh: 0 },
}, 1000));

rm2.apply(makeEvent('crm:deal:created', {
  id: 'rm2-d02', dealId: 'rm2-d02',
  deal: { funil: 'venda_ufv', etapa: 'Proposta', status: 'Perdido', valor: 30000, kwh: 0 },
}, 2000));

rm2.apply(makeEvent('crm:deal:created', {
  id: 'rm2-d03', dealId: 'rm2-d03',
  deal: { funil: 'venda_ufv', etapa: 'Negociação', status: 'Em andamento', valor: 80000, kwh: 0 },
}, 3000));

rm2.apply(makeEvent('crm:deal:created', {
  id: 'rm2-d04', dealId: 'rm2-d04',
  deal: { funil: 'assinatura_energia', etapa: 'Qualificação', status: 'Em andamento', valor: 0, kwh: 50000 },
}, 4000));

rm2.apply(makeEvent('crm:deal:created', {
  id: 'rm2-d05', dealId: 'rm2-d05',
  deal: { funil: 'assinatura_energia', etapa: 'Qualificação', status: 'Pausado', valor: 0, kwh: 30000 },
}, 5000));

rm2.apply(makeEvent('crm:deal:created', {
  id: 'rm2-d06', dealId: 'rm2-d06',
  deal: { funil: 'venda_ufv', etapa: 'Proposta', status: 'Vendido', valor: 45000, kwh: 0 },
}, 6000));

// ── 1. deal created entra no Read Model ──────────────────────────────────────

section(1, 'deal created entra no Read Model');

const r1 = rm.apply(makeEvent('crm:deal:created', {
  id: 'deal-a01', dealId: 'deal-a01',
  deal: {
    funil: 'venda_ufv', etapa: 'Prospecção', status: 'Em andamento',
    valor: 35000, kwh: 0, responsavel: 'Ana Lima', responsavelUid: 'u-001',
  },
}, 100));

assert(r1 === true,                      '1.1 apply() retorna true');
assert(rm.getStats().dealCount === 1,    '1.2 dealCount = 1 após created');

const d1 = rm.getDeal('deal-a01');
assert(d1 !== null,                      '1.3 getDeal() não retorna null');
assert(d1.id        === 'deal-a01',      '1.4 id = deal-a01');
assert(d1.funil     === 'venda_ufv',     '1.5 funil = venda_ufv');
assert(d1.etapa     === 'Prospecção',    '1.6 etapa = Prospecção');
assert(d1.status    === 'Em andamento',  '1.7 status = Em andamento');
assert(d1.valor     === 35000,           '1.8 valor = 35000');
assert(d1.responsavel === 'Ana Lima',    '1.9 responsavel = Ana Lima');
assert(d1.lastEventType === 'crm:deal:created', '1.10 lastEventType = crm:deal:created');

// ── 2. getDeal retorna cópia ──────────────────────────────────────────────────

section(2, 'getDeal retorna cópia rasa — não expõe objeto interno');

const copy1 = rm.getDeal('deal-a01');
const copy2 = rm.getDeal('deal-a01');

assert(copy1 !== null,             '2.1 getDeal retorna objeto');
assert(copy1 !== copy2,            '2.2 chamadas diferentes retornam objetos distintos');
copy1.funil = 'MUTADO';
const copy3 = rm.getDeal('deal-a01');
assert(copy3.funil === 'venda_ufv', '2.3 mutação da cópia não afeta o estado interno');
assert(rm.getDeal('inexistente') === null, '2.4 getDeal("inexistente") = null');

// ── 3. deal updated faz merge raso ───────────────────────────────────────────

section(3, 'deal updated faz merge raso preservando campos não alterados');

const r3 = rm.apply(makeEvent('crm:deal:updated', {
  id: 'deal-a01', dealId: 'deal-a01',
  after: { etapa: 'Proposta', valor: 40000 },
}, 200));

assert(r3 === true,                     '3.1 apply() retorna true');

const d3 = rm.getDeal('deal-a01');
assert(d3.etapa  === 'Proposta',        '3.2 etapa atualizada para Proposta');
assert(d3.valor  === 40000,             '3.3 valor atualizado para 40000');
assert(d3.funil  === 'venda_ufv',       '3.4 funil preservado');
assert(d3.status === 'Em andamento',    '3.5 status preservado');
assert(d3.responsavel === 'Ana Lima',   '3.6 responsavel preservado');
assert(d3.updatedAt === 200,            '3.7 updatedAt = 200 (event.createdAt)');
assert(d3.lastEventType === 'crm:deal:updated', '3.8 lastEventType = crm:deal:updated');

// ── 4. stage changed altera somente etapa ────────────────────────────────────

section(4, 'stage changed altera somente etapa — status não muda');

const r4 = rm.apply(makeEvent('crm:deal:stage-changed', {
  id: 'deal-a01', dealId: 'deal-a01',
  fromStage: 'Proposta', toStage: 'Negociação',
}, 300));

assert(r4 === true,                       '4.1 apply() retorna true');

const d4 = rm.getDeal('deal-a01');
assert(d4.etapa  === 'Negociação',        '4.2 etapa = Negociação');
assert(d4.status === 'Em andamento',      '4.3 status preservado — não alterado por stage-changed');
assert(d4.valor  === 40000,               '4.4 valor preservado');
assert(d4.funil  === 'venda_ufv',         '4.5 funil preservado');
assert(d4.lastEventType === 'crm:deal:stage-changed', '4.6 lastEventType = crm:deal:stage-changed');

// ── 5. won força status Vendido ───────────────────────────────────────────────

section(5, 'crm:deal:won força status = "Vendido"');

const r5 = rm.apply(makeEvent('crm:deal:won', {
  id: 'deal-a01', dealId: 'deal-a01',
  before: { status: 'Em andamento' },
  after:  { status: 'Vendido', valor: 40000 },
}, 400));

assert(r5 === true,                  '5.1 apply() retorna true');

const d5 = rm.getDeal('deal-a01');
assert(d5.status === 'Vendido',      '5.2 status = Vendido');
assert(d5.funil  === 'venda_ufv',    '5.3 funil preservado');
assert(d5.etapa  === 'Negociação',   '5.4 etapa preservada');
assert(d5.lastEventType === 'crm:deal:won', '5.5 lastEventType = crm:deal:won');

// ── 6. lost força status Perdido ──────────────────────────────────────────────

section(6, 'crm:deal:lost força status = "Perdido"');

rm.apply(makeEvent('crm:deal:created', {
  id: 'deal-b01', dealId: 'deal-b01',
  deal: { funil: 'venda_ufv', status: 'Em andamento', valor: 15000 },
}, 110));

const r6 = rm.apply(makeEvent('crm:deal:lost', {
  id: 'deal-b01', dealId: 'deal-b01',
  after: { status: 'Perdido', valor: 15000 },
}, 500));

assert(r6 === true,                  '6.1 apply() retorna true');
const d6 = rm.getDeal('deal-b01');
assert(d6.status === 'Perdido',      '6.2 status = Perdido');
assert(d6.valor  === 15000,          '6.3 valor preservado');
assert(d6.lastEventType === 'crm:deal:lost', '6.4 lastEventType = crm:deal:lost');

// ── 7. paused força status Pausado ────────────────────────────────────────────

section(7, 'crm:deal:paused força status = "Pausado"');

rm.apply(makeEvent('crm:deal:created', {
  id: 'deal-c01', dealId: 'deal-c01',
  deal: { funil: 'pre_vendas', status: 'Em andamento', valor: 22000 },
}, 120));

const r7 = rm.apply(makeEvent('crm:deal:paused', {
  id: 'deal-c01', dealId: 'deal-c01',
  after: { status: 'Pausado', valor: 22000 },
}, 600));

assert(r7 === true,                  '7.1 apply() retorna true');
const d7 = rm.getDeal('deal-c01');
assert(d7.status === 'Pausado',      '7.2 status = Pausado');
assert(d7.valor  === 22000,          '7.3 valor preservado');
assert(d7.lastEventType === 'crm:deal:paused', '7.4 lastEventType = crm:deal:paused');

// ── 8. evento não suportado retorna false ─────────────────────────────────────

section(8, 'evento não suportado retorna false sem lançar erro');

const r8a = rm.apply(makeEvent('crm:followup:added', { followupId: 'fu-01', dealId: 'deal-a01' }));
const r8b = rm.apply(makeEvent('crm:proposal:sent',  { id: 'deal-a01' }));
const r8c = rm.apply(makeEvent('identity:session:started', {}));

assert(r8a === false,               '8.1 crm:followup:added retorna false');
assert(r8b === false,               '8.2 crm:proposal:sent retorna false');
assert(r8c === false,               '8.3 identity:session:started retorna false');
assert(rm.getDeal('deal-a01') !== null, '8.4 estado interno preservado após eventos ignorados');

// ── 9. getDeals filtra e ordena ───────────────────────────────────────────────

section(9, 'getDeals filtra por funil, status e from/to — ordena updatedAt DESC');

const all9 = rm2.getDeals();
assert(all9.length === 6,              '9.1 sem filtros: 6 deals');
assert(all9[0].id  === 'rm2-d06',     '9.2 primeiro = rm2-d06 (updatedAt=6000, mais recente)');
assert(all9[5].id  === 'rm2-d01',     '9.3 último = rm2-d01 (updatedAt=1000, mais antigo)');

const byFunil9 = rm2.getDeals({ funil: 'venda_ufv' });
assert(byFunil9.length === 4,          '9.4 funil=venda_ufv: 4 deals');
assert(byFunil9[0].id  === 'rm2-d06', '9.5 primeiro = rm2-d06 (6000)');
assert(byFunil9[3].id  === 'rm2-d01', '9.6 último = rm2-d01 (1000)');

const byStatus9 = rm2.getDeals({ status: 'Vendido' });
assert(byStatus9.length === 2,         '9.7 status=Vendido: 2 deals');
assert(byStatus9[0].id  === 'rm2-d06', '9.8 primeiro Vendido = rm2-d06 (6000)');
assert(byStatus9[1].id  === 'rm2-d01', '9.9 segundo Vendido = rm2-d01 (1000)');

const byRange9 = rm2.getDeals({ from: 2000, to: 4000 });
assert(byRange9.length === 3,          '9.10 from=2000, to=4000: 3 deals');
assert(byRange9[0].id  === 'rm2-d04', '9.11 primeiro do range = rm2-d04 (4000)');
assert(byRange9[2].id  === 'rm2-d02', '9.12 último do range = rm2-d02 (2000)');

// ── 10. getPipeline agrupa funil e etapa ─────────────────────────────────────

section(10, 'getPipeline agrupa por funil → etapa com count, totalValue, totalKwh');

const pipe10 = rm2.getPipeline();

assert(typeof pipe10 === 'object',                       '10.1 retorna objeto');
assert('venda_ufv'        in pipe10,                     '10.2 chave venda_ufv presente');
assert('assinatura_energia' in pipe10,                   '10.3 chave assinatura_energia presente');
assert('Proposta'  in pipe10.venda_ufv,                  '10.4 etapa Proposta em venda_ufv');
assert('Negociação' in pipe10.venda_ufv,                 '10.5 etapa Negociação em venda_ufv');
assert('Qualificação' in pipe10.assinatura_energia,      '10.6 etapa Qualificação em assinatura_energia');

// venda_ufv / Proposta: deal1(50000) + deal2(30000) + deal6(45000) = 3 deals, 125000
assert(pipe10.venda_ufv.Proposta.count      === 3,       '10.7 Proposta count = 3');
assert(pipe10.venda_ufv.Proposta.totalValue === 125000,  '10.8 Proposta totalValue = 125000');
assert(pipe10.venda_ufv.Proposta.totalKwh   === 0,       '10.9 Proposta totalKwh = 0');

// venda_ufv / Negociação: deal3(80000)
assert(pipe10.venda_ufv.Negociação.count      === 1,     '10.10 Negociação count = 1');
assert(pipe10.venda_ufv.Negociação.totalValue === 80000, '10.11 Negociação totalValue = 80000');

// assinatura_energia / Qualificação: deal4(kwh=50000) + deal5(kwh=30000) = 2 deals, kwh=80000
assert(pipe10.assinatura_energia.Qualificação.count    === 2,    '10.12 Qualificação count = 2');
assert(pipe10.assinatura_energia.Qualificação.totalKwh === 80000, '10.13 Qualificação totalKwh = 80000');
assert(pipe10.assinatura_energia.Qualificação.totalValue === 0,  '10.14 Qualificação totalValue = 0');

// ── 11. getStatusSummary agrupa status ────────────────────────────────────────

section(11, 'getStatusSummary agrupa por status com total e byStatus');

const summary11 = rm2.getStatusSummary();

assert(summary11.total === 6,                       '11.1 total = 6');
assert(summary11.byStatus['Vendido']      === 2,    '11.2 Vendido = 2');
assert(summary11.byStatus['Perdido']      === 1,    '11.3 Perdido = 1');
assert(summary11.byStatus['Em andamento'] === 2,    '11.4 Em andamento = 2');
assert(summary11.byStatus['Pausado']      === 1,    '11.5 Pausado = 1');

// Status inexistente não deve aparecer
assert(!('Sem status' in summary11.byStatus),       '11.6 Sem status ausente (todos têm status)');

// Filtrado
const summaryVufv = rm2.getStatusSummary({ funil: 'venda_ufv' });
assert(summaryVufv.total === 4,                     '11.7 filtrado venda_ufv: total = 4');
assert(summaryVufv.byStatus['Vendido'] === 2,       '11.8 filtrado: Vendido = 2');

// ── 12. getConversionRate ─────────────────────────────────────────────────────

section(12, 'getConversionRate: Vendido / total');

const metrics2 = new CRMMetrics(rm2);
const cr12     = metrics2.getConversionRate();

assert(cr12.total     === 6,       '12.1 total = 6');
assert(cr12.converted === 2,       '12.2 converted = 2');
// rate = 2/6 * 100 = 33.333...
assert(cr12.rate > 33 && cr12.rate < 34, '12.3 rate ≈ 33.33%');

// Rate = 0 quando total = 0
const emptyRm = new CRMReadModel();
const cr12e   = new CRMMetrics(emptyRm).getConversionRate();
assert(cr12e.rate === 0,           '12.4 rate = 0 quando não há deals');

// ── 13. getWinRate e getLossRate ──────────────────────────────────────────────

section(13, 'getWinRate e getLossRate — denominator = Vendido + Perdido');

const wr13 = metrics2.getWinRate();
const lr13 = metrics2.getLossRate();

// decided = Vendido(2) + Perdido(1) = 3
assert(wr13.decided === 3,          '13.1 winRate.decided = 3');
assert(wr13.won     === 2,          '13.2 winRate.won = 2');
// 2/3 * 100 ≈ 66.67
assert(wr13.rate > 66 && wr13.rate < 67, '13.3 winRate.rate ≈ 66.67%');

assert(lr13.decided === 3,          '13.4 lossRate.decided = 3');
assert(lr13.lost    === 1,          '13.5 lossRate.lost = 1');
// 1/3 * 100 ≈ 33.33
assert(lr13.rate > 33 && lr13.rate < 34, '13.6 lossRate.rate ≈ 33.33%');

// Win + Loss rates somam 100% quando decided > 0
assert(Math.abs((wr13.rate + lr13.rate) - 100) < 0.001, '13.7 winRate + lossRate = 100%');

// ── 14. getPausedRate ─────────────────────────────────────────────────────────

section(14, 'getPausedRate: Pausado / total');

const pr14 = metrics2.getPausedRate();

assert(pr14.total  === 6,          '14.1 total = 6');
assert(pr14.paused === 1,          '14.2 paused = 1');
// 1/6 * 100 ≈ 16.67
assert(pr14.rate > 16 && pr14.rate < 17, '14.3 rate ≈ 16.67%');

// ── 15. getForecast aplica pesos corretos ─────────────────────────────────────

section(15, 'getForecast aplica pesos por status e retorna byStatus');

const fc15 = metrics2.getForecast();

// totalValue = 50000 + 30000 + 80000 + 0 + 0 + 45000 = 205000
assert(fc15.totalValue    === 205000, '15.1 totalValue = 205000');
// weightedValue:
//   Vendido(1.00): 50000 + 45000 = 95000
//   Perdido(0.00): 0
//   Em andamento(0.50): 80000*0.5 + 0*0.5 = 40000
//   Pausado(0.20): 0*0.20 = 0
//   Total = 95000 + 40000 = 135000
assert(fc15.weightedValue === 135000, '15.2 weightedValue = 135000');
assert(fc15.dealCount     === 6,      '15.3 dealCount = 6');

assert('Vendido'      in fc15.byStatus, '15.4 byStatus contém Vendido');
assert('Perdido'      in fc15.byStatus, '15.5 byStatus contém Perdido');
assert('Em andamento' in fc15.byStatus, '15.6 byStatus contém Em andamento');
assert('Pausado'      in fc15.byStatus, '15.7 byStatus contém Pausado');

assert(fc15.byStatus['Vendido'].count         === 2,     '15.8 Vendido count = 2');
assert(fc15.byStatus['Vendido'].totalValue    === 95000,  '15.9 Vendido totalValue = 95000');
assert(fc15.byStatus['Vendido'].weight        === 1.00,   '15.10 Vendido weight = 1.00');
assert(fc15.byStatus['Vendido'].weightedValue === 95000,  '15.11 Vendido weightedValue = 95000');

assert(fc15.byStatus['Perdido'].weight        === 0.00,   '15.12 Perdido weight = 0.00');
assert(fc15.byStatus['Perdido'].weightedValue === 0,      '15.13 Perdido weightedValue = 0');

assert(fc15.byStatus['Em andamento'].weight        === 0.50,  '15.14 Em andamento weight = 0.50');
assert(fc15.byStatus['Em andamento'].weightedValue === 40000, '15.15 Em andamento weightedValue = 40000');

assert(fc15.byStatus['Pausado'].weight        === 0.20, '15.16 Pausado weight = 0.20');
assert(fc15.byStatus['Pausado'].weightedValue === 0,    '15.17 Pausado weightedValue = 0 (valor=0)');

// ── 16. CRMReadModelIntegration consome EventBus e gera logs ─────────────────

section(16, 'CRMReadModelIntegration consome CoreEvents do EventBus e loga');

const bus16  = new EventBus();
const rm16   = new CRMReadModel();
const log16  = new Logger('test-rm-integration', 'DEBUG');
const int16  = new CRMReadModelIntegration(bus16, rm16, log16);

int16.start();

assert(int16.isStarted() === true,    '16.1 isStarted() = true após start()');
assert(int16.getStats().loggerEnabled === true, '16.2 loggerEnabled = true');

// Publicar crm:deal:created
const evt16a = new CoreEvent('crm:deal:created', {
  id: 'deal-int-01', dealId: 'deal-int-01',
  deal: { funil: 'venda_ufv', status: 'Em andamento', valor: 60000 },
  organizationId: 'esa', personId: 'p-int',
}, 'Test');
await bus16.publish(evt16a);

assert(rm16.getDeal('deal-int-01') !== null,       '16.3 deal criado no RM após evento');
assert(rm16.getDeal('deal-int-01').valor === 60000, '16.4 valor = 60000');

// Publicar crm:deal:won
const evt16b = new CoreEvent('crm:deal:won', {
  id: 'deal-int-01', dealId: 'deal-int-01',
  after: { status: 'Vendido', valor: 60000 },
}, 'Test');
await bus16.publish(evt16b);

assert(rm16.getDeal('deal-int-01').status === 'Vendido', '16.5 status = Vendido após deal:won');

// Contadores
const stats16 = int16.getStats();
assert(stats16.receivedCount === 2,  '16.6 receivedCount = 2');
assert(stats16.appliedCount  === 2,  '16.7 appliedCount = 2');
assert(stats16.skippedCount  === 0,  '16.8 skippedCount = 0');
assert(stats16.errorCount    === 0,  '16.9 errorCount = 0');

// Logs INFO gerados para eventos aplicados
const infoEntries16 = log16.getEntries('INFO');
assert(infoEntries16.length >= 2,    '16.10 pelo menos 2 INFO no Logger');
assert(
  infoEntries16.some((e) => e.context && e.context.eventType === 'crm:deal:created'),
  '16.11 INFO para crm:deal:created',
);
assert(
  infoEntries16.some((e) => e.context && e.context.eventType === 'crm:deal:won'),
  '16.12 INFO para crm:deal:won',
);

// Source do child logger = CRMReadModelIntegration
assert(
  infoEntries16.every((e) => e.source === 'CRMReadModelIntegration'),
  '16.13 source = CRMReadModelIntegration',
);

// stop() funciona
int16.stop();
assert(int16.isStarted() === false, '16.14 isStarted() = false após stop()');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 16 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
