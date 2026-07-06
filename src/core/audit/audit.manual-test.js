/**
 * ESA OS — Core / Audit
 * Suite de testes manuais — 14 cenários obrigatórios
 *
 * Execução: node src/core/audit/audit.manual-test.js
 * Sem dependências externas. Sem Jest. ES Modules nativos.
 */

import {
  AUDIT_ACTION,
  AUDIT_ACTION_CATEGORY,
  isValidAuditAction,
  getAuditActionCategory,
} from './audit-action.js';

import { AuditContext } from './audit-context.js';
import { AuditEntry }   from './audit-entry.js';
import { Audit }        from './audit.js';

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

/** Cria um AuditContext válido para uso nos testes. */
function makeContext(overrides = {}) {
  return new AuditContext(
    overrides.organizationId ?? 'org-esa',
    overrides.personId       ?? 'person-001',
    overrides.sessionId      ?? 'sess-abc',
    overrides.source         ?? 'TestModule',
    overrides.ip             ?? '10.0.0.1',
    overrides.userAgent      ?? 'Mozilla/5.0',
    overrides.correlationId  ?? 'corr-xyz',
  );
}

// ── 1. AUDIT_ACTION e categorias ─────────────────────────────────────────────

section(1, 'AUDIT_ACTION e categorias');

assert(AUDIT_ACTION.CREATE === 'CREATE',   '1.1 CREATE está definido');
assert(AUDIT_ACTION.DELETE === 'DELETE',   '1.2 DELETE está definido');
assert(AUDIT_ACTION.MOVE   === 'MOVE',     '1.3 MOVE está definido');
assert(AUDIT_ACTION.EXECUTE === 'EXECUTE', '1.4 EXECUTE está definido');

assert(isValidAuditAction('CREATE')  === true,  '1.5 CREATE é ação válida');
assert(isValidAuditAction('DELETE')  === true,  '1.6 DELETE é ação válida');
assert(isValidAuditAction('NOPE')    === false, '1.7 NOPE não é ação válida');
assert(isValidAuditAction('')        === false, '1.8 string vazia não é válida');
assert(isValidAuditAction(undefined) === false, '1.9 undefined não é válido');

assert(getAuditActionCategory('CREATE')  === 'data',       '1.10 CREATE → data');
assert(getAuditActionCategory('LOGIN')   === 'session',    '1.11 LOGIN → session');
assert(getAuditActionCategory('ACCESS')  === 'access',     '1.12 ACCESS → access');
assert(getAuditActionCategory('EXPORT')  === 'transfer',   '1.13 EXPORT → transfer');
assert(getAuditActionCategory('MOVE')    === 'flow',       '1.14 MOVE → flow');
assert(getAuditActionCategory('EXECUTE') === 'automation', '1.15 EXECUTE → automation');

{
  let threw = false;
  try { getAuditActionCategory('UNKNOWN'); } catch { threw = true; }
  assert(threw, '1.16 getAuditActionCategory lança para ação desconhecida');
}

// ── 2. AuditContext isValid ───────────────────────────────────────────────────

section(2, 'AuditContext isValid');

const ctx2valid = new AuditContext('org-1', 'person-1', 'sess-1', 'Mod', '1.2.3.4', 'UA', 'corr-1');
assert(ctx2valid.isValid() === true,  '2.1 context completo é válido');

const ctx2noOrg = new AuditContext('', 'person-1');
assert(ctx2noOrg.isValid() === false, '2.2 sem organizationId é inválido');

const ctx2noPerson = new AuditContext('org-1', '');
assert(ctx2noPerson.isValid() === false, '2.3 sem personId é inválido');

const ctx2noSess = new AuditContext('org-1', 'person-1', '');
assert(ctx2noSess.isValid() === true, '2.4 sessionId vazio ainda é válido');

const ctx2noSource = new AuditContext('org-1', 'person-1', 'sess', '');
assert(ctx2noSource.isValid() === true, '2.5 source vazio ainda é válido');

const ctx2empty = new AuditContext();
assert(ctx2empty.isValid() === false, '2.6 context sem parâmetros é inválido');

// ── 3. AuditContext toJSON / fromJSON ─────────────────────────────────────────

section(3, 'AuditContext toJSON / fromJSON');

const ctx3 = new AuditContext('org-esa', 'p-99', 's-42', 'CRMDomain', '192.168.1.1', 'Firefox/120', 'corr-999');
const json3 = ctx3.toJSON();

assert(json3.organizationId === 'org-esa',      '3.1 toJSON.organizationId correto');
assert(json3.personId       === 'p-99',         '3.2 toJSON.personId correto');
assert(json3.sessionId      === 's-42',         '3.3 toJSON.sessionId correto');
assert(json3.source         === 'CRMDomain',    '3.4 toJSON.source correto');
assert(json3.ip             === '192.168.1.1',  '3.5 toJSON.ip correto');
assert(json3.userAgent      === 'Firefox/120',  '3.6 toJSON.userAgent correto');
assert(json3.correlationId  === 'corr-999',     '3.7 toJSON.correlationId correto');
assert(typeof json3.createdAt === 'number',      '3.8 toJSON.createdAt é número');

const restored3 = AuditContext.fromJSON(json3);
assert(restored3.organizationId === 'org-esa',    '3.9  fromJSON restaura organizationId');
assert(restored3.personId       === 'p-99',       '3.10 fromJSON restaura personId');
assert(restored3.correlationId  === 'corr-999',   '3.11 fromJSON restaura correlationId');
assert(restored3.createdAt      === ctx3.createdAt, '3.12 fromJSON preserva createdAt original');
assert(restored3.isValid()      === true,          '3.13 contexto restaurado é válido');

// ── 4. AuditEntry gera ID único e não vazio ───────────────────────────────────

section(4, 'AuditEntry — ID único e não vazio');

const e4a = new AuditEntry(AUDIT_ACTION.CREATE, 'deal', 'd-1');
const e4b = new AuditEntry(AUDIT_ACTION.UPDATE, 'deal', 'd-2');

assert(typeof e4a.id === 'string', '4.1 id é string');
assert(e4a.id.length > 0,         '4.2 id não é vazio');
assert(e4a.id !== e4b.id,         '4.3 IDs distintos entre instâncias');
assert(typeof e4a.timestamp === 'number', '4.4 timestamp é número');
assert(e4a.timestamp > 0,                '4.5 timestamp é positivo');

// ── 5. AuditEntry toJSON / fromJSON preserva dados ───────────────────────────

section(5, 'AuditEntry — toJSON / fromJSON preserva dados');

const e5 = new AuditEntry(
  AUDIT_ACTION.UPDATE,
  'deal',
  'd-42',
  'org-esa',
  'person-007',
  'CRMDomain',
  { stage: 'Proposta', value: 100 },
  { stage: 'Negociação', value: 120 },
  { correlationId: 'corr-5' },
);
const json5 = e5.toJSON();

assert(json5.id             === e5.id,               '5.1 toJSON preserva id');
assert(json5.action         === AUDIT_ACTION.UPDATE,  '5.2 toJSON preserva action');
assert(json5.resource       === 'deal',               '5.3 toJSON preserva resource');
assert(json5.resourceId     === 'd-42',               '5.4 toJSON preserva resourceId');
assert(json5.organizationId === 'org-esa',            '5.5 toJSON preserva organizationId');
assert(json5.personId       === 'person-007',         '5.6 toJSON preserva personId');
assert(json5.source         === 'CRMDomain',          '5.7 toJSON preserva source');
assert(json5.timestamp      === e5.timestamp,         '5.8 toJSON preserva timestamp');
assert(json5.before.stage   === 'Proposta',           '5.9 toJSON preserva before');
assert(json5.after.value    === 120,                  '5.10 toJSON preserva after');
assert(json5.metadata.correlationId === 'corr-5',     '5.11 toJSON preserva metadata');

const restored5 = AuditEntry.fromJSON(json5);
assert(restored5.id        === e5.id,        '5.12 fromJSON preserva id original');
assert(restored5.timestamp === e5.timestamp, '5.13 fromJSON preserva timestamp original');
assert(restored5.action    === AUDIT_ACTION.UPDATE, '5.14 fromJSON restaura action');
assert(restored5.before.stage === 'Proposta',       '5.15 fromJSON restaura before');

// ── 6. AuditEntry isModification / isDeletion ─────────────────────────────────

section(6, 'AuditEntry — isModification / isDeletion');

const isModTrue  = [AUDIT_ACTION.UPDATE, AUDIT_ACTION.MOVE, AUDIT_ACTION.APPROVE, AUDIT_ACTION.REJECT];
const isModFalse = [AUDIT_ACTION.CREATE, AUDIT_ACTION.DELETE, AUDIT_ACTION.READ, AUDIT_ACTION.LOGIN];

for (const action of isModTrue) {
  const e = new AuditEntry(action, 'x', 'x-1');
  assert(e.isModification() === true, `6. ${action} é modificação`);
}
for (const action of isModFalse) {
  const e = new AuditEntry(action, 'x', 'x-1');
  assert(e.isModification() === false, `6. ${action} não é modificação`);
}

const eDel    = new AuditEntry(AUDIT_ACTION.DELETE, 'deal', 'd-1');
const eCreate = new AuditEntry(AUDIT_ACTION.CREATE, 'deal', 'd-1');
assert(eDel.isDeletion()    === true,  '6. DELETE → isDeletion = true');
assert(eCreate.isDeletion() === false, '6. CREATE → isDeletion = false');

// ── 7. AuditEntry getDiff ─────────────────────────────────────────────────────

section(7, 'AuditEntry — getDiff');

const e7 = new AuditEntry(
  AUDIT_ACTION.UPDATE,
  'deal', 'd-1', '', '', '',
  { name: 'Cliente A', stage: 'Proposta',   value: 100, createdAt: 1000 },
  { name: 'Cliente A', stage: 'Negociação', value: 120, updatedAt: 2000 },
);
const diff7 = e7.getDiff();

assert('stage' in diff7,                     '7.1 diff detecta alteração em stage');
assert(diff7.stage.from === 'Proposta',      '7.2 diff.stage.from correto');
assert(diff7.stage.to   === 'Negociação',    '7.3 diff.stage.to correto');
assert('value' in diff7,                     '7.4 diff detecta alteração em value');
assert(diff7.value.from === 100,             '7.5 diff.value.from correto');
assert(diff7.value.to   === 120,             '7.6 diff.value.to correto');
assert(!('name' in diff7),                   '7.7 campo sem alteração não aparece no diff');
assert(!('createdAt' in diff7),              '7.8 createdAt ignorado no diff');
assert(!('updatedAt' in diff7),              '7.9 updatedAt ignorado no diff');

// Campo novo (só existe em after)
const e7b = new AuditEntry(AUDIT_ACTION.UPDATE, 'deal', 'd-2', '', '', '',
  { name: 'x' },
  { name: 'x', tags: ['solar'] },
);
const diff7b = e7b.getDiff();
assert('tags' in diff7b,                     '7.10 campo novo em after aparece no diff');
assert(diff7b.tags.from === undefined,        '7.11 diff.tags.from é undefined (campo novo)');

// before null
const e7c = new AuditEntry(AUDIT_ACTION.CREATE, 'user', 'u-1', '', '', '', null, { email: 'a@b.com' });
const diff7c = e7c.getDiff();
assert('email' in diff7c,                    '7.12 before null: campos de after aparecem no diff');
assert(diff7c.email.from === undefined,      '7.13 from é undefined quando before é null');
assert(diff7c.email.to   === 'a@b.com',      '7.14 to está correto quando before é null');

// after null
const e7d = new AuditEntry(AUDIT_ACTION.DELETE, 'user', 'u-2', '', '', '', { email: 'b@c.com' }, null);
const diff7d = e7d.getDiff();
assert('email' in diff7d,                    '7.15 after null: campos de before aparecem no diff');
assert(diff7d.email.to === undefined,        '7.16 to é undefined quando after é null');

// before e after null
const e7e = new AuditEntry(AUDIT_ACTION.LOGIN, 'session', 's-1', '', '', '', null, null);
assert(Object.keys(e7e.getDiff()).length === 0, '7.17 before e after null → diff vazio');

// Garantir que before/after originais não foram mutados
assert(e7.before.createdAt === 1000, '7.18 before original não foi mutado');
assert(e7.after.updatedAt  === 2000, '7.19 after original não foi mutado');

// ── 8. Audit.createEntry não adiciona ao histórico ────────────────────────────

section(8, 'Audit.createEntry não adiciona ao histórico');

const audit8 = new Audit();
const ctx8   = makeContext();

const created8 = audit8.createEntry(ctx8, AUDIT_ACTION.CREATE, 'deal', 'd-new',
  null, { stage: 'Prospecção' });

assert(created8 instanceof AuditEntry,     '8.1 createEntry retorna AuditEntry');
assert(audit8._entries.length === 0,       '8.2 histórico permanece vazio após createEntry');
assert(created8.action       === AUDIT_ACTION.CREATE, '8.3 action correto');
assert(created8.resource     === 'deal',              '8.4 resource correto');
assert(created8.resourceId   === 'd-new',             '8.5 resourceId correto');
assert(created8.organizationId === 'org-esa',         '8.6 organizationId vem do context');
assert(created8.personId     === 'person-001',        '8.7 personId vem do context');
assert(created8.source       === 'TestModule',        '8.8 source vem do context');
assert(created8.metadata.sessionId === 'sess-abc',    '8.9 sessionId mesclado no metadata');
assert(created8.metadata.ip        === '10.0.0.1',   '8.10 ip mesclado no metadata');

// ── 9. Audit.record adiciona entrada completa ─────────────────────────────────

section(9, 'Audit.record adiciona entrada completa');

const audit9  = new Audit();
const ctx9    = makeContext({ correlationId: 'corr-9' });
const before9 = { stage: 'Proposta', value: 50 };
const after9  = { stage: 'Fechado',  value: 80 };

const entry9 = audit9.record(
  ctx9,
  AUDIT_ACTION.UPDATE,
  'deal',
  'd-100',
  before9,
  after9,
  { extraInfo: 'sprint-9' },
);

assert(entry9 instanceof AuditEntry,              '9.1 record retorna AuditEntry');
assert(audit9._entries.length === 1,              '9.2 entrada adicionada ao histórico');
assert(audit9._entries[0] === entry9,             '9.3 mesma referência na trilha');
assert(entry9.action       === AUDIT_ACTION.UPDATE, '9.4 action correto');
assert(entry9.resource     === 'deal',              '9.5 resource correto');
assert(entry9.resourceId   === 'd-100',             '9.6 resourceId correto');
assert(entry9.organizationId === 'org-esa',         '9.7 organizationId do context');
assert(entry9.metadata.sessionId    === 'sess-abc', '9.8 sessionId mesclado no metadata');
assert(entry9.metadata.correlationId === 'corr-9',  '9.9 correlationId do context mesclado');
assert(entry9.metadata.extraInfo    === 'sprint-9', '9.10 metadata do chamador mesclado');
assert(entry9.before.stage === 'Proposta',          '9.11 before preservado');
assert(entry9.after.stage  === 'Fechado',           '9.12 after preservado');

// metadata do chamador prevalece sobre context em chave duplicada
const audit9b  = new Audit();
const ctx9b    = makeContext({ correlationId: 'corr-original' });
const entry9b  = audit9b.record(ctx9b, AUDIT_ACTION.CREATE, 'user', 'u-1', null, null,
  { correlationId: 'corr-override' });
assert(entry9b.metadata.correlationId === 'corr-override', '9.13 metadata do chamador prevalece em duplicata');

// ── 10. Audit valida context/action/resource/resourceId ───────────────────────

section(10, 'Audit — validações de record e createEntry');

const audit10 = new Audit();
const ctxValid = makeContext();
const ctxInvalid = new AuditContext('', ''); // isValid() === false

function mustThrow(fn, label) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, label);
}

mustThrow(() => audit10.record('not-a-context', AUDIT_ACTION.CREATE, 'r', 'r1'),
  '10.1 context não-AuditContext lança TypeError');

mustThrow(() => audit10.record(ctxInvalid, AUDIT_ACTION.CREATE, 'r', 'r1'),
  '10.2 context.isValid()=false lança Error');

mustThrow(() => audit10.record(ctxValid, 'INVENTED', 'r', 'r1'),
  '10.3 action desconhecido lança Error');

mustThrow(() => audit10.record(ctxValid, AUDIT_ACTION.CREATE, '', 'r1'),
  '10.4 resource vazio lança Error');

mustThrow(() => audit10.record(ctxValid, AUDIT_ACTION.CREATE, 'deal', ''),
  '10.5 resourceId vazio lança Error');

mustThrow(() => audit10.createEntry(ctxInvalid, AUDIT_ACTION.CREATE, 'deal', 'd-1'),
  '10.6 createEntry também valida context');

mustThrow(() => audit10.createEntry(ctxValid, 'BAD', 'deal', 'd-1'),
  '10.7 createEntry também valida action');

// ── 11. historyLimit funciona como ring buffer ────────────────────────────────

section(11, 'historyLimit — ring buffer');

const audit11 = new Audit();
audit11._historyLimit = 3;
const ctx11 = makeContext();

audit11.record(ctx11, AUDIT_ACTION.CREATE, 'deal', 'd-1');
audit11.record(ctx11, AUDIT_ACTION.CREATE, 'deal', 'd-2');
audit11.record(ctx11, AUDIT_ACTION.CREATE, 'deal', 'd-3');
assert(audit11._entries.length === 3, '11.1 3 entradas dentro do limite');

audit11.record(ctx11, AUDIT_ACTION.CREATE, 'deal', 'd-4');
assert(audit11._entries.length === 3,              '11.2 limite mantido após 4ª entrada');
assert(audit11._entries[0].resourceId === 'd-2',   '11.3 d-1 descartada (mais antiga)');
assert(audit11._entries[2].resourceId === 'd-4',   '11.4 d-4 está no fim do buffer');

audit11.record(ctx11, AUDIT_ACTION.CREATE, 'deal', 'd-5');
assert(audit11._entries[0].resourceId === 'd-3',   '11.5 descarte contínuo correto');

// ── 12. getEntries filtros, período, ordem e cópia ───────────────────────────

section(12, 'getEntries — filtros, período, ordem e cópia');

const audit12 = new Audit();
const ctx12   = makeContext({ organizationId: 'org-a', personId: 'p-1' });
const ctx12b  = makeContext({ organizationId: 'org-b', personId: 'p-2' });

const e12_1 = audit12.record(ctx12,  AUDIT_ACTION.CREATE, 'deal', 'd-1');
const e12_2 = audit12.record(ctx12,  AUDIT_ACTION.UPDATE, 'deal', 'd-1');
const e12_3 = audit12.record(ctx12b, AUDIT_ACTION.CREATE, 'user', 'u-1');
const e12_4 = audit12.record(ctx12,  AUDIT_ACTION.DELETE, 'deal', 'd-2');

// Ordem DESC
const all12 = audit12.getEntries({}, 0);
assert(all12.length === 4, '12.1 getEntries sem filtro retorna todas');
assert(all12[0].resourceId === 'd-2', '12.2 primeira entrada é a mais recente (DESC)');

// Filtro por action
const creates12 = audit12.getEntries({ action: AUDIT_ACTION.CREATE }, 0);
assert(creates12.length === 2, '12.3 filtro por action=CREATE retorna 2');

// Filtro por resource
const deals12 = audit12.getEntries({ resource: 'deal' }, 0);
assert(deals12.length === 3,  '12.4 filtro por resource=deal retorna 3');

// Filtro por personId
const p1entries = audit12.getEntries({ personId: 'p-1' }, 0);
assert(p1entries.length === 3, '12.5 filtro por personId=p-1 retorna 3');

// Filtro por organizationId
const orgB = audit12.getEntries({ organizationId: 'org-b' }, 0);
assert(orgB.length === 1, '12.6 filtro por organizationId=org-b retorna 1');

// Filtro por período
const tsA = e12_1.timestamp;
const tsC = e12_3.timestamp;
const period12 = audit12.getEntries({ from: tsA, to: tsC }, 0);
assert(period12.length >= 2, '12.7 filtro from/to retorna entradas no período');

// Limit
const limited12 = audit12.getEntries({}, 2);
assert(limited12.length === 2, '12.8 limit=2 retorna ao máximo 2');

// Cópia — push na cópia não afeta _entries
const copy12 = audit12.getEntries({}, 0);
const before12Len = audit12._entries.length;
copy12.push(new AuditEntry(AUDIT_ACTION.READ, 'x', 'x-1'));
assert(audit12._entries.length === before12Len, '12.9 push na cópia não afeta _entries interno');

// limit <= 0 significa sem limite
const noLimit12 = audit12.getEntries({}, 0);
assert(noLimit12.length === 4, '12.10 limit=0 retorna todas as entradas');

// ── 13. findByPerson / findByResource / findByAction ─────────────────────────

section(13, 'findByPerson / findByResource / findByAction');

const audit13 = new Audit();
const ctxP1   = makeContext({ personId: 'p-alice' });
const ctxP2   = makeContext({ personId: 'p-bob' });

audit13.record(ctxP1, AUDIT_ACTION.CREATE, 'deal', 'd-1');
audit13.record(ctxP1, AUDIT_ACTION.UPDATE, 'deal', 'd-1');
audit13.record(ctxP2, AUDIT_ACTION.CREATE, 'deal', 'd-2');
audit13.record(ctxP1, AUDIT_ACTION.DELETE, 'deal', 'd-1');

// findByPerson
const alice13 = audit13.findByPerson('p-alice');
assert(alice13.length === 3, '13.1 findByPerson retorna 3 entradas para alice');
assert(alice13.every((e) => e.personId === 'p-alice'), '13.2 todas as entradas são de alice');
assert(alice13[0].action === AUDIT_ACTION.DELETE, '13.3 findByPerson ordena DESC (mais recente primeiro)');

// findByAction
const deletes13 = audit13.findByAction(AUDIT_ACTION.DELETE);
assert(deletes13.length === 1,                        '13.4 findByAction(DELETE) retorna 1');
assert(deletes13[0].action === AUDIT_ACTION.DELETE,   '13.5 ação da entrada é DELETE');

// findByResource — ordem ASC (histórico cronológico)
const deal1history = audit13.findByResource('deal', 'd-1');
assert(deal1history.length === 3, '13.6 findByResource(deal, d-1) retorna 3 entradas');
assert(deal1history[0].action === AUDIT_ACTION.CREATE, '13.7 primeira entrada é CREATE (ASC)');
assert(deal1history[2].action === AUDIT_ACTION.DELETE, '13.8 última entrada é DELETE (ASC)');

// findByResource com limit
const limited13 = audit13.findByResource('deal', 'd-1', 1);
assert(limited13.length === 1, '13.9 findByResource com limit=1 retorna 1 entrada');

// findByPerson com personId inexistente
const nobody13 = audit13.findByPerson('p-nobody');
assert(nobody13.length === 0, '13.10 findByPerson sem resultados retorna array vazio');

// ── 14. clear e getStats ─────────────────────────────────────────────────────

section(14, 'clear e getStats');

const audit14 = new Audit();
const ctx14   = makeContext({ organizationId: 'esa' });

audit14.record(ctx14, AUDIT_ACTION.CREATE, 'deal',    'd-1');
audit14.record(ctx14, AUDIT_ACTION.UPDATE, 'deal',    'd-1');
audit14.record(ctx14, AUDIT_ACTION.DELETE, 'deal',    'd-1');
audit14.record(ctx14, AUDIT_ACTION.CREATE, 'user',    'u-1');
audit14.record(ctx14, AUDIT_ACTION.LOGIN,  'session', 's-1');

const stats14 = audit14.getStats();

assert(stats14.totalEntries     === 5,                  '14.1 totalEntries = 5');
assert(stats14.historyLimit     === 5000,               '14.2 historyLimit = 5000 (padrão)');
assert(typeof stats14.byAction  === 'object',           '14.3 byAction é objeto');
assert(stats14.byAction[AUDIT_ACTION.CREATE] === 2,    '14.4 byAction.CREATE = 2');
assert(stats14.byAction[AUDIT_ACTION.UPDATE] === 1,    '14.5 byAction.UPDATE = 1');
assert(stats14.byAction[AUDIT_ACTION.DELETE] === 1,    '14.6 byAction.DELETE = 1');
assert(stats14.byResource['deal']    === 3,            '14.7 byResource.deal = 3');
assert(stats14.byResource['user']    === 1,            '14.8 byResource.user = 1');
assert(stats14.byResource['session'] === 1,            '14.9 byResource.session = 1');
assert(stats14.byOrganization['esa'] === 5,            '14.10 byOrganization.esa = 5');

audit14.clear();
assert(audit14._entries.length === 0, '14.11 clear esvazia o histórico');

const stats14b = audit14.getStats();
assert(stats14b.totalEntries === 0,             '14.12 totalEntries = 0 após clear');
assert(Object.keys(stats14b.byAction).length === 0,       '14.13 byAction vazio após clear');
assert(Object.keys(stats14b.byResource).length === 0,     '14.14 byResource vazio após clear');
assert(Object.keys(stats14b.byOrganization).length === 0, '14.15 byOrganization vazio após clear');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${total - failed}/${total} assertions passaram`);

if (failed === 0) {
  console.log('✓ TODOS OS 14 CENÁRIOS PASSARAM\n');
} else {
  console.error(`✗ ${failed} assertion(s) falharam\n`);
  process.exit(1);
}
