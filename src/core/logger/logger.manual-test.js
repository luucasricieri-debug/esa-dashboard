/**
 * ESA OS — Core / Logger
 * Suite de testes manuais — 14 cenários obrigatórios
 *
 * Execução: node src/core/logger/logger.manual-test.js
 * Sem dependências externas. Sem Jest. Sem transpilação.
 * Usa apenas console.assert e ES Modules nativos.
 */

import { LOG_LEVEL, LOG_LEVEL_RANK, isAtLeast } from './log-level.js';
import { LogEntry }                              from './log-entry.js';
import { LogFormatter }                          from './formatter.js';
import { Logger }                                from './logger.js';

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

// ── 1. LOG_LEVEL e isAtLeast ──────────────────────────────────────────────────

section(1, 'LOG_LEVEL e isAtLeast');

assert(LOG_LEVEL.DEBUG    === 'DEBUG',    '1.1 LOG_LEVEL.DEBUG é "DEBUG"');
assert(LOG_LEVEL.CRITICAL === 'CRITICAL', '1.2 LOG_LEVEL.CRITICAL é "CRITICAL"');
assert(LOG_LEVEL_RANK[LOG_LEVEL.DEBUG]    === 0, '1.3 DEBUG rank = 0');
assert(LOG_LEVEL_RANK[LOG_LEVEL.CRITICAL] === 4, '1.4 CRITICAL rank = 4');

assert(isAtLeast(LOG_LEVEL.DEBUG,    LOG_LEVEL.DEBUG)    === true,  '1.5 DEBUG >= DEBUG');
assert(isAtLeast(LOG_LEVEL.ERROR,    LOG_LEVEL.WARN)     === true,  '1.6 ERROR >= WARN');
assert(isAtLeast(LOG_LEVEL.INFO,     LOG_LEVEL.WARN)     === false, '1.7 INFO < WARN retorna false');
assert(isAtLeast(LOG_LEVEL.CRITICAL, LOG_LEVEL.CRITICAL) === true,  '1.8 CRITICAL >= CRITICAL');

{
  let threw = false;
  try { isAtLeast('INVALID', LOG_LEVEL.INFO); } catch { threw = true; }
  assert(threw, '1.9 isAtLeast lança para nível desconhecido');
}
{
  let threw = false;
  try { isAtLeast(LOG_LEVEL.INFO, 'NOPE'); } catch { threw = true; }
  assert(threw, '1.10 isAtLeast lança para threshold desconhecido');
}

// ── 2. LogEntry gera ID único e não vazio ─────────────────────────────────────

section(2, 'LogEntry — ID único e não vazio');

const entry2a = new LogEntry(LOG_LEVEL.INFO, 'msg-a', 'Test');
const entry2b = new LogEntry(LOG_LEVEL.WARN, 'msg-b', 'Test');

assert(typeof entry2a.id === 'string',        '2.1 ID é string');
assert(entry2a.id.length > 0,                '2.2 ID não é vazio');
assert(entry2a.id !== entry2b.id,            '2.3 IDs distintos entre instâncias');
assert(entry2a.level   === LOG_LEVEL.INFO,   '2.4 level armazenado corretamente');
assert(entry2a.message === 'msg-a',          '2.5 message armazenada corretamente');
assert(entry2a.source  === 'Test',           '2.6 source armazenado corretamente');
assert(typeof entry2a.timestamp === 'number', '2.7 timestamp é número');
assert(entry2a.timestamp > 0,               '2.8 timestamp é positivo');

// ── 3. LogEntry toJSON / fromJSON ─────────────────────────────────────────────

section(3, 'LogEntry — toJSON / fromJSON');

const original3 = new LogEntry(LOG_LEVEL.ERROR, 'falha crítica', 'CRMDomain', { dealId: 42 }, { traceId: 'abc' });
const json3 = original3.toJSON();

assert(json3.id        === original3.id,        '3.1 toJSON preserva id');
assert(json3.level     === LOG_LEVEL.ERROR,     '3.2 toJSON preserva level');
assert(json3.message   === 'falha crítica',     '3.3 toJSON preserva message');
assert(json3.source    === 'CRMDomain',         '3.4 toJSON preserva source');
assert(json3.context.dealId === 42,             '3.5 toJSON preserva context');
assert(json3.timestamp === original3.timestamp, '3.6 toJSON preserva timestamp');
assert(json3.metadata.traceId === 'abc',        '3.7 toJSON preserva metadata');

const restored3 = LogEntry.fromJSON(json3);
assert(restored3.id        === original3.id,        '3.8  fromJSON preserva id original');
assert(restored3.timestamp === original3.timestamp, '3.9  fromJSON preserva timestamp original');
assert(restored3.level     === LOG_LEVEL.ERROR,     '3.10 fromJSON restaura level');
assert(restored3.message   === 'falha crítica',     '3.11 fromJSON restaura message');

// ── 4. LogEntry isLevel e isCriticalOrError ───────────────────────────────────

section(4, 'LogEntry — isLevel e isCriticalOrError');

const e4warn     = new LogEntry(LOG_LEVEL.WARN,     'aviso',   'Mod');
const e4error    = new LogEntry(LOG_LEVEL.ERROR,    'erro',    'Mod');
const e4critical = new LogEntry(LOG_LEVEL.CRITICAL, 'crítico', 'Mod');
const e4info     = new LogEntry(LOG_LEVEL.INFO,     'info',    'Mod');

assert(e4warn.isLevel(LOG_LEVEL.WARN)  === true,  '4.1 isLevel retorna true para nível correto');
assert(e4warn.isLevel(LOG_LEVEL.ERROR) === false, '4.2 isLevel retorna false para nível errado');

assert(e4error.isCriticalOrError()    === true,  '4.3 ERROR: isCriticalOrError = true');
assert(e4critical.isCriticalOrError() === true,  '4.4 CRITICAL: isCriticalOrError = true');
assert(e4warn.isCriticalOrError()     === false, '4.5 WARN: isCriticalOrError = false');
assert(e4info.isCriticalOrError()     === false, '4.6 INFO: isCriticalOrError = false');

const age4 = e4info.getAgeMs();
assert(typeof age4 === 'number', '4.7 getAgeMs retorna número');
assert(age4 >= 0,               '4.8 getAgeMs não é negativo');

// ── 5. LogFormatter — formatForConsole ───────────────────────────────────────

section(5, 'LogFormatter — formatForConsole');

const fmt5 = new LogFormatter({ includeTimestamp: true, includeSource: true, includeId: false });
const entry5 = new LogEntry(LOG_LEVEL.WARN, 'Subscriber não encontrado', 'EventBus');
const line5 = fmt5.formatForConsole(entry5);

assert(typeof line5 === 'string',             '5.1 formatForConsole retorna string');
assert(line5.includes('[WARN]'),              '5.2 inclui [WARN]');
assert(line5.includes('[EventBus]'),          '5.3 inclui [source]');
assert(line5.includes('Subscriber não encontrado'), '5.4 inclui message');
assert(line5.includes('T') || line5.includes('-'), '5.5 inclui timestamp (ISO contém T ou -)');

const fmtNoTs = new LogFormatter({ includeTimestamp: false, includeSource: false });
const lineNoTs = fmtNoTs.formatForConsole(entry5);
assert(!lineNoTs.includes('T') || lineNoTs.indexOf('[WARN]') < 3, '5.6 sem timestamp quando includeTimestamp=false');

const fmtId = new LogFormatter({ includeId: true });
const lineId = fmtId.formatForConsole(entry5);
assert(lineId.includes(entry5.id), '5.7 inclui id quando includeId=true');

// ── 6. LogFormatter — formatForFile ──────────────────────────────────────────

section(6, 'LogFormatter — formatForFile');

const fmt6 = new LogFormatter();
const entry6 = new LogEntry(LOG_LEVEL.INFO, 'módulo iniciado', 'BootLoader', { version: '1.0' });
const line6 = fmt6.formatForFile(entry6);

assert(typeof line6 === 'string',          '6.1 formatForFile retorna string');
assert(line6.includes(' | '),              '6.2 usa pipe como separador');
assert(line6.includes('INFO'),             '6.3 inclui level');
assert(line6.includes('BootLoader'),       '6.4 inclui source');
assert(line6.includes('módulo iniciado'), '6.5 inclui message');
assert(line6.split(' | ').length >= 5,    '6.6 tem ao menos 5 segmentos');
assert(!line6.includes('\n'),              '6.7 linha única — sem quebras de linha');

// ── 7. LogFormatter — sanitização de dados sensíveis ─────────────────────────

section(7, 'LogFormatter — sanitiza dados sensíveis');

const fmt7 = new LogFormatter();
const sensitiveCtx = {
  userId:    'u-123',
  password:  'segredo123',
  token:     'Bearer xyz',
  apiKey:    'sk-prod-abc',
  nested:    { secret: 'inner-secret', safe: 'visible' },
  list:      [{ authorization: 'Basic foo' }, { name: 'ok' }],
  pass:      'abc',
  passHash:  '$2b$hash',
};

const serialized7 = JSON.parse(fmt7._serializeContext(sensitiveCtx));

assert(serialized7.userId        === 'u-123',      '7.1 campo não-sensível preservado');
assert(serialized7.password      === '[REDACTED]', '7.2 password redactado');
assert(serialized7.token         === '[REDACTED]', '7.3 token redactado');
assert(serialized7.apiKey        === '[REDACTED]', '7.4 apiKey redactado');
assert(serialized7.pass          === '[REDACTED]', '7.5 pass redactado');
assert(serialized7.passHash      === '[REDACTED]', '7.6 passHash redactado');
assert(serialized7.nested.secret === '[REDACTED]', '7.7 nested.secret redactado');
assert(serialized7.nested.safe   === 'visible',    '7.8 nested.safe preservado');
assert(serialized7.list[0].authorization === '[REDACTED]', '7.9 array[0].authorization redactado');
assert(serialized7.list[1].name === 'ok',          '7.10 array[1].name preservado');
assert(sensitiveCtx.password === 'segredo123',     '7.11 objeto original não foi mutado');

// ── 8. Logger respeita minLevel ───────────────────────────────────────────────

section(8, 'Logger — respeita minLevel');

const log8 = new Logger('LoggerTest8', LOG_LEVEL.WARN);

const r8debug = log8.debug('deve ser filtrado');
const r8info  = log8.info('também filtrado');
const r8warn  = log8.warn('deve passar');
const r8error = log8.error('erro passa');

assert(r8debug === null,         '8.1 DEBUG abaixo de WARN retorna null');
assert(r8info  === null,         '8.2 INFO abaixo de WARN retorna null');
assert(r8warn  !== null,         '8.3 WARN >= WARN retorna LogEntry');
assert(r8error !== null,         '8.4 ERROR >= WARN retorna LogEntry');
assert(log8._entries.length === 2, '8.5 histórico tem somente 2 entradas');

// ── 9. Logger métodos debug / info / warn ─────────────────────────────────────

section(9, 'Logger — métodos debug / info / warn');

const log9 = new Logger('Logger9', LOG_LEVEL.DEBUG);
const r9d = log9.debug('diagnóstico', { step: 1 });
const r9i = log9.info('inicializado', { version: '2' });
const r9w = log9.warn('fallback aplicado');

assert(r9d instanceof LogEntry,       '9.1 debug retorna LogEntry');
assert(r9d.level  === LOG_LEVEL.DEBUG, '9.2 debug registra nível DEBUG');
assert(r9d.source === 'Logger9',      '9.3 debug herda source do Logger');
assert(r9i.level  === LOG_LEVEL.INFO, '9.4 info registra nível INFO');
assert(r9w.level  === LOG_LEVEL.WARN, '9.5 warn registra nível WARN');
assert(log9._entries.length === 3,    '9.6 3 entradas no histórico');
assert(r9d.context.step === 1,        '9.7 context transportado corretamente');

// ── 10. Logger error / critical incluem Error no context ──────────────────────

section(10, 'Logger — error / critical com Error');

const log10   = new Logger('Logger10', LOG_LEVEL.DEBUG);
const ctxOrig = { userId: 'u-1' };
const err10   = new Error('falha ao salvar deal');
err10.name    = 'DatabaseError';

const r10e = log10.error('Erro no CRM', err10, ctxOrig);
assert(r10e !== null,                              '10.1 error retorna LogEntry');
assert(r10e.level === LOG_LEVEL.ERROR,             '10.2 nível é ERROR');
assert(r10e.context.errorMessage === err10.message,'10.3 errorMessage incluído');
assert(r10e.context.errorName    === 'DatabaseError','10.4 errorName incluído');
assert(typeof r10e.context.errorStack === 'string', '10.5 errorStack incluído');
assert(r10e.context.userId === 'u-1',              '10.6 context original mesclado');
assert(ctxOrig.errorMessage === undefined,         '10.7 contexto original não mutado');

const r10c = log10.critical('Sistema instável', err10);
assert(r10c.level === LOG_LEVEL.CRITICAL,          '10.8 nível é CRITICAL');
assert(r10c.context.errorName === 'DatabaseError', '10.9 critical também inclui errorName');

// ── 11. historyLimit funciona como ring buffer ────────────────────────────────

section(11, 'Logger — historyLimit ring buffer');

const log11 = new Logger('Logger11', LOG_LEVEL.DEBUG, 3);

log11.info('msg-1');
log11.info('msg-2');
log11.info('msg-3');
assert(log11._entries.length === 3, '11.1 3 entradas dentro do limite');

log11.info('msg-4');
assert(log11._entries.length === 3, '11.2 4ª entrada não excede limite');
assert(log11._entries[0].message === 'msg-2', '11.3 entrada mais antiga descartada (msg-1)');
assert(log11._entries[2].message === 'msg-4', '11.4 entrada mais recente está no fim do buffer');

log11.info('msg-5');
assert(log11._entries[0].message === 'msg-3', '11.5 descarte contínuo correto (msg-3 é agora o mais antigo)');

// ── 12. getEntries / getErrors — cópia e filtros ──────────────────────────────

section(12, 'Logger — getEntries / getErrors — cópia e filtros');

const log12 = new Logger('Logger12', LOG_LEVEL.DEBUG);
log12.debug('d1');
log12.info('i1');
log12.warn('w1');
log12.error('e1', null, {});
log12.critical('c1', null, {});

const all12 = log12.getEntries();
assert(all12.length === 5, '12.1 getEntries retorna todas as entradas');
assert(all12[0].level === LOG_LEVEL.CRITICAL, '12.2 primeira entrada é a mais recente (DESC)');

const copy12 = log12.getEntries();
const beforeLen = log12._entries.length;
copy12.push(new LogEntry(LOG_LEVEL.INFO, 'intruso'));
assert(log12._entries.length === beforeLen, '12.3 push na cópia não afeta _entries interno');

const warns12 = log12.getEntries(LOG_LEVEL.WARN);
assert(warns12.length === 1 && warns12[0].message === 'w1', '12.4 filtro por WARN correto');

const limited12 = log12.getEntries('', 2);
assert(limited12.length === 2, '12.5 limit=2 retorna no máximo 2 entradas');

const errors12 = log12.getErrors();
assert(errors12.length === 2, '12.6 getErrors retorna ERROR + CRITICAL');
assert(errors12.every((e) => e.isCriticalOrError()), '12.7 todas as entradas são error/critical');

// ── 13. child compartilha histórico com pai ───────────────────────────────────

section(13, 'Logger — child compartilha histórico');

const parent13 = new Logger('Parent13', LOG_LEVEL.DEBUG);
const child13  = parent13.child('Child13');

parent13.info('log do pai');
child13.warn('log do filho');

assert(parent13._entries.length === 2,                '13.1 pai vê entradas do filho');
assert(child13._entries.length  === 2,                '13.2 filho vê entradas do pai');
assert(parent13._entries === child13._entries,        '13.3 mesmo array compartilhado');
assert(parent13.getEntries()[0].source === 'Child13', '13.4 entry do filho aparece em parent.getEntries()');
assert(child13.getEntries()[1].source  === 'Parent13','13.5 entry do pai aparece em child.getEntries()');
assert(child13.source === 'Child13',                  '13.6 source do filho é diferente do pai');

// clear no pai deve limpar para ambos (mesmo array)
parent13.clear();
assert(parent13._entries.length === 0, '13.7 clear do pai esvazia o histórico compartilhado');
assert(child13._entries.length  === 0, '13.8 child vê histórico vazio após clear do pai');

// ── 14. clear, setMinLevel e getStats ────────────────────────────────────────

section(14, 'Logger — clear / setMinLevel / getStats');

const log14 = new Logger('Logger14', LOG_LEVEL.DEBUG, 100);
log14.debug('d1');
log14.info('i1');
log14.error('e1', null, {});
log14.critical('c1', null, {});

const stats14a = log14.getStats();
assert(stats14a.source          === 'Logger14',      '14.1 stats.source correto');
assert(stats14a.minLevel        === LOG_LEVEL.DEBUG, '14.2 stats.minLevel correto');
assert(stats14a.entryCount      === 4,               '14.3 stats.entryCount = 4');
assert(stats14a.historyLimit    === 100,             '14.4 stats.historyLimit correto');
assert(stats14a.consoleEnabled  === false,           '14.5 stats.consoleEnabled = false');
assert(stats14a.errorCount      === 1,               '14.6 stats.errorCount = 1');
assert(stats14a.criticalCount   === 1,               '14.7 stats.criticalCount = 1');

log14.setMinLevel(LOG_LEVEL.ERROR);
assert(log14.minLevel === LOG_LEVEL.ERROR, '14.8 setMinLevel atualiza minLevel');
const r14info = log14.info('agora filtrado');
assert(r14info === null, '14.9 INFO filtrado após setMinLevel(ERROR)');

{
  let threw = false;
  try { log14.setMinLevel('UNKNOWN'); } catch { threw = true; }
  assert(threw, '14.10 setMinLevel lança para nível inválido');
}

log14.clear();
assert(log14._entries.length === 0, '14.11 clear esvazia o histórico');
const stats14b = log14.getStats();
assert(stats14b.entryCount   === 0, '14.12 stats.entryCount = 0 após clear');
assert(stats14b.errorCount   === 0, '14.13 stats.errorCount = 0 após clear');
assert(stats14b.criticalCount === 0,'14.14 stats.criticalCount = 0 após clear');

log14.setConsoleEnabled(true);
assert(log14._consoleEnabled === true, '14.15 setConsoleEnabled ativa saída no console');
log14.setConsoleEnabled(false);
assert(log14._consoleEnabled === false,'14.16 setConsoleEnabled desativa saída no console');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 14 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
