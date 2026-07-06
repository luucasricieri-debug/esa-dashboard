/**
 * ESA OS — Core / Events
 * Manual Test Suite — 14 cenários obrigatórios
 *
 * Executar com Node.js (ES Modules):
 *   node src/core/events/events.manual-test.js
 *
 * Saída esperada: nenhuma linha "FAIL" no console.
 * Sem Jest. Sem dependências externas.
 *
 * Cenários:
 *   1.  Subscriber exato
 *   2.  Wildcard global *
 *   3.  Wildcard de domínio   crm:*
 *   4.  Wildcard de entidade  crm:deal:*
 *   5.  subscribeOnce
 *   6.  unsubscribe
 *   7.  unsubscribeAll
 *   8.  Handler assíncrono
 *   9.  Erro em subscriber não interrompe outros
 *   10. historyLimit (ring buffer)
 *   11. getHistory retorna cópia imutável
 *   12. reset
 *   13. Publisher.emit()
 *   14. Publisher.emitMany()
 */

import { CoreEvent, EVENT_TYPES } from './event.js';
import { Subscriber } from './subscriber.js';
import { EventBus } from './event-bus.js';
import { Publisher } from './publisher.js';

(async function runTests() {
  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(condition, label) {
    console.assert(condition, `FAIL — ${label}`);
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`  ✗ ${label}`);
    }
  }

  function startTest(n, name) {
    results.push({ n, name });
    console.log(`\n── Test ${n}: ${name}`);
  }

  console.log('── ESA OS Event Bus — Manual Test Suite (14 cenários) ────────────');

  // ── Test 1: Subscriber exato ───────────────────────────────────────────────
  startTest(1, 'Subscriber exato');
  {
    const bus = new EventBus();
    let hits = 0;
    bus.subscribe('crm:deal:created', () => { hits++; });
    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    await bus.publish(new CoreEvent('crm:deal:won', {}, 'CRM'));     // não deve disparar
    assert(hits === 1, '1a: handler chamado exatamente 1 vez para o tipo exato');

    const sub = new Subscriber('s-exact', 'crm:deal:created', () => {}, 'test');
    assert(sub.handles('crm:deal:created') === true, '1b: Subscriber.handles() true para tipo exato');
    assert(sub.handles('crm:deal:won') === false, '1c: Subscriber.handles() false para tipo diferente');
  }

  // ── Test 2: Wildcard global * ──────────────────────────────────────────────
  startTest(2, 'Wildcard global *');
  {
    const bus = new EventBus();
    let hits = 0;
    bus.subscribe('*', () => { hits++; });
    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    await bus.publish(new CoreEvent('identity:session:started', {}, 'Identity'));
    await bus.publish(new CoreEvent('core:app:initialized', {}, 'Core'));
    assert(hits === 3, '2a: * captura todos os eventos publicados');

    const sub = new Subscriber('s-wild', '*', () => {}, 'test');
    assert(sub.handles('anything:at:all') === true, '2b: Subscriber * aceita qualquer tipo');
  }

  // ── Test 3: Wildcard de domínio crm:* ─────────────────────────────────────
  startTest(3, 'Wildcard de domínio crm:*');
  {
    const bus = new EventBus();
    let crmHits = 0;
    bus.subscribe('crm:*', () => { crmHits++; });
    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    await bus.publish(new CoreEvent('crm:followup:added', {}, 'CRM'));
    await bus.publish(new CoreEvent('identity:session:started', {}, 'Identity')); // não deve disparar
    assert(crmHits === 2, '3a: crm:* captura apenas eventos do domínio CRM');

    const sub = new Subscriber('s-dom', 'crm:*', () => {}, 'test');
    assert(sub.handles('crm:deal:created') === true, '3b: crm:* aceita evento CRM');
    assert(sub.handles('identity:session:started') === false, '3c: crm:* rejeita evento de outro domínio');
  }

  // ── Test 4: Wildcard de entidade crm:deal:* ────────────────────────────────
  startTest(4, 'Wildcard de entidade crm:deal:*');
  {
    const bus = new EventBus();
    let dealHits = 0;
    bus.subscribe('crm:deal:*', () => { dealHits++; });
    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    await bus.publish(new CoreEvent('crm:deal:won', {}, 'CRM'));
    await bus.publish(new CoreEvent('crm:followup:added', {}, 'CRM')); // não deve disparar
    assert(dealHits === 2, '4a: crm:deal:* captura apenas eventos de deal');

    const sub = new Subscriber('s-ent', 'crm:deal:*', () => {}, 'test');
    assert(sub.handles('crm:deal:created') === true, '4b: crm:deal:* aceita deal:created');
    assert(sub.handles('crm:followup:added') === false, '4c: crm:deal:* rejeita followup');
  }

  // ── Test 5: subscribeOnce ──────────────────────────────────────────────────
  startTest(5, 'subscribeOnce');
  {
    const bus = new EventBus();
    let hits = 0;
    bus.subscribeOnce('crm:deal:created', () => { hits++; });
    const ev = new CoreEvent('crm:deal:created', {}, 'CRM');
    await bus.publish(ev);
    await bus.publish(ev);
    await bus.publish(ev);
    assert(hits === 1, '5a: subscribeOnce dispara apenas no primeiro evento');
    assert(bus.listSubscribers('crm:deal:created').length === 0, '5b: subscriber removido após disparo');

    // subscribeOnce via Subscriber.once diretamente
    const sub = new Subscriber('s-once', 'crm:deal:created', () => {}, 'test', true);
    await sub.dispatch(ev);
    assert(sub.isActive() === false, '5c: Subscriber.once desativa após dispatch');
    assert(sub.invokeCount === 1, '5d: invokeCount registra 1 após disparo único');
    await sub.dispatch(ev);
    assert(sub.invokeCount === 1, '5e: segundo dispatch ignorado (inativo)');
  }

  // ── Test 6: unsubscribe ────────────────────────────────────────────────────
  startTest(6, 'unsubscribe');
  {
    const bus = new EventBus();
    let hits = 0;
    const id = bus.subscribe('crm:deal:created', () => { hits++; });
    assert(typeof id === 'string' && id.length > 0, '6a: subscribe() retorna subscriberId não-vazio');
    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    assert(hits === 1, '6b: handler chamado antes de unsubscribe');
    const removed = bus.unsubscribe(id);
    assert(removed === true, '6c: unsubscribe() retorna true para ID encontrado');
    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    assert(hits === 1, '6d: handler não chamado após unsubscribe');
    const notFound = bus.unsubscribe('id-inexistente');
    assert(notFound === false, '6e: unsubscribe() retorna false para ID não encontrado');
  }

  // ── Test 7: unsubscribeAll ─────────────────────────────────────────────────
  startTest(7, 'unsubscribeAll');
  {
    const bus = new EventBus();
    let hits = 0;
    // mesmo subscriber registrado em múltiplos tipos
    bus.subscribe(['crm:deal:created', 'crm:deal:won'], () => { hits++; }, { owner: 'ModuleA' });
    bus.subscribe('crm:followup:added', () => { hits++; }, { owner: 'ModuleA' });
    bus.subscribe('crm:deal:created', () => { hits++; }, { owner: 'ModuleB' });

    const count = bus.unsubscribeAll('ModuleA');
    assert(count === 2, '7a: unsubscribeAll remove 2 Subscribers únicos de ModuleA');
    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    await bus.publish(new CoreEvent('crm:followup:added', {}, 'CRM'));
    assert(hits === 1, '7b: apenas ModuleB ainda recebe eventos após unsubscribeAll(ModuleA)');
    const zero = bus.unsubscribeAll('ModuleInexistente');
    assert(zero === 0, '7c: unsubscribeAll retorna 0 para owner inexistente');
  }

  // ── Test 8: Handler assíncrono ─────────────────────────────────────────────
  startTest(8, 'Handler assíncrono');
  {
    const log = [];
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const bus = new EventBus();
    bus.subscribe('crm:deal:created', async () => {
      await delay(10);
      log.push('async-handler');
    });
    bus.subscribe('crm:deal:created', () => { log.push('sync-handler'); });

    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    assert(log.includes('async-handler'), '8a: handler assíncrono executado');
    assert(log.includes('sync-handler'), '8b: handler síncrono executado');
    assert(log[0] === 'async-handler', '8c: handlers executados em ordem de registro (async await antes do próximo)');

    // Subscriber.dispatch aguarda handler assíncrono antes de incrementar invokeCount
    let invoked = false;
    const sub = new Subscriber('s-async', 'test:event', async () => {
      await delay(5);
      invoked = true;
    }, 'test');
    const ev = new CoreEvent('test:event', {}, 'test');
    await sub.dispatch(ev);
    assert(invoked === true, '8d: Subscriber.dispatch aguarda handler assíncrono');
    assert(sub.invokeCount === 1, '8e: invokeCount incrementado após handler assíncrono concluir');
  }

  // ── Test 9: Erro em subscriber não interrompe outros ──────────────────────
  startTest(9, 'Erro em subscriber não interrompe outros');
  {
    const bus = new EventBus();
    let secondCalled = false;
    let thirdCalled = false;
    bus.subscribe('crm:deal:created', () => { throw new Error('boom'); });
    bus.subscribe('crm:deal:created', () => { secondCalled = true; });
    bus.subscribe('crm:deal:created', async () => { thirdCalled = true; });
    const count = await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    assert(secondCalled === true, '9a: segundo subscriber chamado mesmo com erro no primeiro');
    assert(thirdCalled === true, '9b: terceiro subscriber (async) também chamado');
    assert(count === 2, '9c: successCount conta apenas os bem-sucedidos (2 de 3)');

    // erro em Subscriber propaga (não é silenciado por dispatch)
    const errSub = new Subscriber('s-err', 'err:event', () => { throw new Error('handler error'); }, 'test');
    const errEv = new CoreEvent('err:event', {}, 'test');
    let propagated = false;
    try { await errSub.dispatch(errEv); } catch { propagated = true; }
    assert(propagated === true, '9d: Subscriber.dispatch propaga erro sem engolir');
  }

  // ── Test 10: historyLimit (ring buffer) ───────────────────────────────────
  startTest(10, 'historyLimit — ring buffer');
  {
    const bus = new EventBus(5);
    for (let i = 0; i < 7; i++) {
      await bus.publish(new CoreEvent('core:app:initialized', { i }, 'Core'));
    }
    const hist = bus.getHistory();
    assert(hist.length === 5, '10a: histórico limitado a 5 (historyLimit=5)');
    assert(hist[0].payload.i === 2, '10b: eventos mais antigos descartados (ring buffer)');
    assert(hist[4].payload.i === 6, '10c: eventos mais recentes preservados');
    assert(bus.getStats().publishedCount === 7, '10d: publishedCount registra todos os 7 publicados');
  }

  // ── Test 11: getHistory retorna cópia imutável ────────────────────────────
  startTest(11, 'getHistory retorna cópia imutável');
  {
    const bus = new EventBus();
    const ev1 = new CoreEvent('crm:deal:created', { n: 1 }, 'CRM');
    const ev2 = new CoreEvent('crm:deal:won',     { n: 2 }, 'CRM');
    await bus.publish(ev1);
    await bus.publish(ev2);

    const hist = bus.getHistory();
    assert(hist.length === 2, '11a: getHistory() retorna os 2 eventos publicados');

    hist.push(new CoreEvent('fake:event', {}, 'fake'));
    assert(bus.getHistory().length === 2, '11b: modificar o array retornado não afeta o histórico interno');

    const filtered = bus.getHistory('crm:deal:won');
    assert(filtered.length === 1 && filtered[0].payload.n === 2, '11c: getHistory() filtra por tipo corretamente');
  }

  // ── Test 12: reset ────────────────────────────────────────────────────────
  startTest(12, 'reset');
  {
    const bus = new EventBus();
    let hits = 0;
    bus.subscribe('crm:deal:created', () => { hits++; });
    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    assert(bus.getStats().publishedCount === 1, '12a: publishedCount=1 antes do reset');
    assert(bus.getHistory().length === 1, '12b: histórico tem 1 evento antes do reset');
    assert(bus.listSubscribers().length === 1, '12c: 1 subscriber ativo antes do reset');

    bus.reset();
    assert(bus.getStats().publishedCount === 0, '12d: publishedCount zerado após reset');
    assert(bus.getHistory().length === 0, '12e: histórico vazio após reset');
    assert(bus.listSubscribers().length === 0, '12f: nenhum subscriber após reset');

    await bus.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    assert(hits === 1, '12g: subscriber removido pelo reset não recebe eventos');
  }

  // ── Test 13: Publisher.emit() ─────────────────────────────────────────────
  startTest(13, 'Publisher.emit()');
  {
    const bus = new EventBus();
    let received = null;
    bus.subscribe('crm:deal:won', (ev) => { received = ev; });

    // sem eventBus deve lançar erro
    const unbound = new Publisher('UnboundPub');
    let threw = false;
    try { await unbound.emit('crm:deal:won', {}); } catch { threw = true; }
    assert(threw === true, '13a: emit() lança erro claro quando EventBus não vinculado');

    const pub = new Publisher('CRMDomain', bus);
    assert(pub.isBound() === true, '13b: Publisher está bound ao construir com eventBus');
    assert(pub.publishedCount === 0, '13c: publishedCount inicia em 0');

    const emitted = await pub.emit('crm:deal:won', { dealId: 'D9', value: 75000 });
    assert(emitted instanceof CoreEvent, '13d: emit() retorna CoreEvent');
    assert(emitted.source === 'CRMDomain', '13e: source do evento é o nome do Publisher');
    assert(received !== null && received.payload.value === 75000, '13f: subscriber recebeu payload correto');
    assert(pub.publishedCount === 1, '13g: publishedCount incrementado após emit()');

    // bindTo com objeto inválido deve lançar
    let bindErr = false;
    try { pub.bindTo({ notABus: true }); } catch { bindErr = true; }
    assert(bindErr === true, '13h: bindTo() lança TypeError para objeto sem publish()');

    const info = pub.getInfo();
    assert(info.name === 'CRMDomain' && info.bound === true && info.publishedCount === 1,
      '13i: getInfo() retorna snapshot correto');

    // CoreEvent — id único, fromJSON, getDomain
    const e = new CoreEvent('identity:session:started', { userId: 'u1' }, 'Identity');
    assert(typeof e.id === 'string' && e.id.length > 0, '13j: CoreEvent.id não-vazio');
    const restored = CoreEvent.fromJSON(e.toJSON());
    assert(restored.id === e.id, '13k: fromJSON preserva id original');
    assert(restored.createdAt === e.createdAt, '13l: fromJSON preserva createdAt original');
    assert(e.getDomain() === 'identity' && e.getEntity() === 'session' && e.getVerb() === 'started',
      '13m: getDomain/getEntity/getVerb corretos');
  }

  // ── Test 14: Publisher.emitMany() ─────────────────────────────────────────
  startTest(14, 'Publisher.emitMany()');
  {
    const bus = new EventBus();
    const order = [];
    bus.subscribe('*', (ev) => { order.push(ev.payload.seq); });

    const pub = new Publisher('CRMDomain', bus);
    const events = [
      { type: 'crm:deal:created', payload: { seq: 1 } },
      { type: 'crm:deal:won',     payload: { seq: 2 } },
      { type: 'crm:deal:lost',    payload: { seq: 3 } },
    ];
    const published = await pub.emitMany(events);

    assert(published.length === 3, '14a: emitMany() retorna array com 3 CoreEvents');
    assert(published.every((e) => e instanceof CoreEvent), '14b: todos os itens são CoreEvent');
    assert(order[0] === 1 && order[1] === 2 && order[2] === 3, '14c: eventos publicados em ordem sequencial');
    assert(pub.publishedCount === 3, '14d: publishedCount = 3 após emitMany()');

    // emitMany sem EventBus deve lançar
    const unbound = new Publisher('Unbound');
    let threw = false;
    try { await unbound.emitMany([{ type: 'crm:deal:created', payload: {} }]); } catch { threw = true; }
    assert(threw === true, '14e: emitMany() lança erro se Publisher não vinculado');

    // deduplicação — mesmo subscriber em múltiplos tipos não dispara duas vezes
    const bus2 = new EventBus();
    let dedupHits = 0;
    bus2.subscribe(['crm:deal:created', '*'], () => { dedupHits++; });
    await bus2.publish(new CoreEvent('crm:deal:created', {}, 'CRM'));
    assert(dedupHits === 1, '14f: subscriber deduplicado — dispara apenas 1 vez por evento');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${'─'.repeat(65)}`);
  results.forEach((r) => console.log(`  Test ${String(r.n).padStart(2)}: ${r.name}`));
  console.log(`${'─'.repeat(65)}`);
  console.log(`Resultado: ${passed}/${total} assertions passed${failed > 0 ? `, ${failed} FAILED` : ''}`);
  if (failed === 0) console.log('Todos os 14 testes passaram. ✓');
  else process.exit(1);
})();
