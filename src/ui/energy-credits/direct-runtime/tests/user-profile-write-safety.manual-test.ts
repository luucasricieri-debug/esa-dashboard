'use strict';
/**
 * ESA OS — Perda de membership no login: escrita destrutiva em users/{uid}
 *
 * Incidente: dual-path do membership (users/lucas_vizentin/memberships/{orgId}) era
 * restaurado manualmente e desaparecia de novo após "logout/login e nova abertura da
 * aplicação". organization-context confirmava rawMembershipCount: 0 mesmo com o
 * membership organizacional (organizations/{orgId}/members/{uid}) intacto.
 *
 * Causa raiz confirmada por leitura de código: index.html`s boot() — que roda em TODA
 * abertura do app, antes até do login — chamava:
 *
 *   await fbSet('users/'+dirKey, { uid, name, login, passHash, level, gestor,
 *                                   createdAt, createdBy });
 *
 * fbSet() faz um HTTP PUT no REST API do Firebase RTDB, que SUBSTITUI o node inteiro em
 * users/{uid} pelo objeto enviado. Como esse objeto não inclui `memberships` nem
 * `energyCredits`, cada boot() apagava esses subtrees de users/lucas_vizentin —
 * exatamente o comportamento relatado (restaurado manualmente, some de novo no próximo
 * login/abertura).
 *
 * Este arquivo prova, com execução real do código de produção (não apenas leitura):
 *   - o boot() da revisão anterior (git show 708cbe9:index.html) REALMENTE apaga
 *     memberships/energyCredits quando executado contra um fixture com dados existentes;
 *   - o boot() atual (working tree) usa safeUpdateUserProfile()/PATCH e PRESERVA os
 *     mesmos subtrees no mesmo fixture;
 *   - safeUpdateUserProfile() rejeita campos protegidos (memberships, energyCredits,
 *     organizationId, permissions, sessionToken) e nunca chega a disparar fetch;
 *   - login repetido / duas abas / session-init repetido não perdem dados (idempotência);
 *   - session-init.js nunca escreveu em users/{uid} (não era ele o culpado).
 *
 * Rodar: npx tsx tests/user-profile-write-safety.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const NF = path.join(ROOT, 'netlify/functions');

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const currentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const oldHtml = execFileSync('git', ['show', '708cbe9:index.html'], { cwd: ROOT, encoding: 'utf8' });
const sessionInitSrc = fs.readFileSync(path.join(NF, 'session-init.js'), 'utf8');
const orgMembersSrc = fs.readFileSync(path.join(NF, 'organization-members.js'), 'utf8');

// ═══════════════════════════════════════════════════════════════════════════
// Extração de funções reais do index.html (brace-balanced) — testa o código
// de produção de verdade, não uma réplica escrita à mão.
// ═══════════════════════════════════════════════════════════════════════════

function extractFunction(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`função não encontrada: ${startPattern}`);
  const start = m.index;
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// Extrai uma declaração `var NOME = [...];` até o `;` que fecha a statement
// (arquivo usa CRLF — não depender de '\n' literal para achar o fim do bloco).
function extractStatement(src: string, startPattern: RegExp): string {
  const m = startPattern.exec(src);
  if (!m) throw new Error(`statement não encontrada: ${startPattern}`);
  const semi = src.indexOf(';', m.index);
  if (semi === -1) throw new Error(`';' de fechamento não encontrado para: ${startPattern}`);
  return src.slice(m.index, semi + 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Fake RTDB — modela semântica real do Firebase REST: PUT substitui o subtree
// inteiro no path; PATCH faz merge raso só nas chaves enviadas (irmãos preservados).
// ═══════════════════════════════════════════════════════════════════════════

function getAtPath(root: any, p: string) {
  const parts = p.split('/').filter(Boolean);
  let cur = root;
  for (const part of parts) { if (cur == null) return null; cur = cur[part]; }
  return cur === undefined ? null : cur;
}
function putAtPath(root: any, p: string, value: any) {
  const parts = p.split('/').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof cur[part] !== 'object' || cur[part] === null) cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}
function patchAtPath(root: any, p: string, patchObj: Record<string, unknown>) {
  const parts = p.split('/').filter(Boolean);
  let cur = root;
  for (const part of parts) {
    if (typeof cur[part] !== 'object' || cur[part] === null) cur[part] = {};
    cur = cur[part];
  }
  Object.assign(cur, patchObj);
}
function deleteAtPath(root: any, p: string) {
  const parts = p.split('/').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) { if (cur == null) return; cur = cur[parts[i]]; }
  if (cur) delete cur[parts[parts.length - 1]];
}

function makeSandbox(tree: Record<string, unknown>) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const fakeFetch = async (url: string, opts: Record<string, unknown> = {}) => {
    const path_ = url.replace(/^https?:\/\/[^/]+\//, '').replace(/\.json(\?.*)?$/, '');
    const method = String(opts.method || 'GET').toUpperCase();
    const parsedBody = opts.body ? JSON.parse(opts.body as string) : undefined;
    calls.push({ method, path: path_, body: parsedBody });
    if (method === 'GET') return { ok: true, json: async () => getAtPath(tree, path_) };
    if (method === 'PUT') { putAtPath(tree, path_, parsedBody); return { ok: true, json: async () => parsedBody }; }
    if (method === 'PATCH') { patchAtPath(tree, path_, parsedBody as Record<string, unknown>); return { ok: true, json: async () => parsedBody }; }
    if (method === 'DELETE') { deleteAtPath(tree, path_); return { ok: true, json: async () => null }; }
    return { ok: false, status: 400, json: async () => null };
  };
  const fakeElement = { className: '', textContent: '', style: {} as Record<string, unknown> };
  const context = vm.createContext({
    fetch: fakeFetch,
    document: { getElementById: () => fakeElement },
    console,
    Object, Array, JSON, Promise, Date, Error, String, Number, Boolean,
  });
  return { context, calls, tree };
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite UP1 — Prova real: boot() da revisão ANTERIOR (708cbe9) apagava dados
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite UP1 — boot() da revisão 708cbe9 (execução real): apagava memberships/energyCredits');

{
  const oldFbGet = extractFunction(oldHtml, /async function fbGet\(/);
  const oldFbSet = extractFunction(oldHtml, /async function fbSet\(/);
  const oldFbPatch = extractFunction(oldHtml, /async function fbPatch\(/);
  const oldSetPill = extractFunction(oldHtml, /function setPill\(/);
  const oldBoot = extractFunction(oldHtml, /async function boot\(\)/);

  assert('UP01 boot() extraído da revisão 708cbe9 chama fbSet no dirKey (bug confirmado no source antigo)',
    /fbSet\('users\/'\+dirKey/.test(oldBoot));

  const fixture = {
    users: {
      lucas_vizentin: {
        uid: 'lucas_vizentin', name: 'Lucas Vizentin (antigo)', login: 'lucas.vizentin',
        passHash: 'hash-antigo', level: 'diretor',
        memberships: { 'org-1': { organizationId: 'org-1', role: 'owner', status: 'active' } },
        energyCredits: { generatingUnits: { 'ug-1': { id: 'ug-1' } } },
      },
    },
  };
  const { context, tree } = makeSandbox(fixture);
  vm.runInContext(`const DB = 'https://fake-rtdb.firebaseio.com';\n${oldFbGet}\n${oldFbSet}\n${oldFbPatch}\n${oldSetPill}\n${oldBoot}\nthis.__runBoot = boot;`, context);
  const runOldBoot = context.__runBoot as () => Promise<void>;

  (async () => {
    await runOldBoot();
    const userAfter = getAtPath(tree, 'users/lucas_vizentin') as Record<string, unknown>;
    assert('UP02 REPRODUZIDO: boot() antigo apaga users/lucas_vizentin/memberships', userAfter.memberships === undefined);
    assert('UP03 REPRODUZIDO: boot() antigo apaga users/lucas_vizentin/energyCredits', userAfter.energyCredits === undefined);
    assert('UP04 boot() antigo ainda grava os campos de perfil (login sobrescrito)', userAfter.login === 'lucas.vizentin');

    await runNewBootSuite();
  })();
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite UP2 — Prova real: boot() ATUAL (working tree) preserva os subtrees
// ═══════════════════════════════════════════════════════════════════════════

async function runNewBootSuite() {
  console.log('\nSuite UP2 — boot() atual (execução real): preserva memberships/energyCredits');

  const newFbGet = extractFunction(currentHtml, /async function fbGet\(/);
  const newFbSet = extractFunction(currentHtml, /async function fbSet\(/);
  const newFbPatch = extractFunction(currentHtml, /async function fbPatch\(/);
  const newFbDelete = extractFunction(currentHtml, /async function fbDelete\(/);
  const allowedFieldsDecl = extractStatement(currentHtml, /var USER_PROFILE_ALLOWED_FIELDS/);
  const protectedFieldsDecl = extractStatement(currentHtml, /var USER_PROFILE_PROTECTED_FIELDS/);
  const safeUpdateFn = extractFunction(currentHtml, /async function safeUpdateUserProfile\(/);
  const safeUpdateBlock = `${allowedFieldsDecl}\n${protectedFieldsDecl}\n${safeUpdateFn}`;
  const newSetPill = extractFunction(currentHtml, /function setPill\(/);
  const newBoot = extractFunction(currentHtml, /async function boot\(\)/);

  assert('UP05 boot() atual usa safeUpdateUserProfile (não fbSet) no dirKey',
    /safeUpdateUserProfile\(dirKey/.test(newBoot) && !/fbSet\('users\/'\+dirKey/.test(newBoot));

  const fixture = {
    users: {
      lucas_vizentin: {
        uid: 'lucas_vizentin', name: 'Lucas Vizentin (antigo)', login: 'lucas.vizentin',
        passHash: 'hash-antigo', level: 'diretor',
        memberships: { 'org-1': { organizationId: 'org-1', role: 'owner', status: 'active' } },
        energyCredits: { generatingUnits: { 'ug-1': { id: 'ug-1' } } },
      },
    },
  };
  const { context, tree, calls } = makeSandbox(fixture);
  vm.runInContext(
    `const DB = 'https://fake-rtdb.firebaseio.com';\n${newFbGet}\n${newFbSet}\n${newFbPatch}\n${newFbDelete}\n${safeUpdateBlock}\n${newSetPill}\n${newBoot}\nthis.__runBoot = boot;`,
    context,
  );
  const runNewBoot = context.__runBoot as () => Promise<void>;

  await runNewBoot();
  let userAfter = getAtPath(tree, 'users/lucas_vizentin') as Record<string, unknown>;
  assert('UP06 CORRIGIDO: boot() atual preserva users/lucas_vizentin/memberships', !!userAfter.memberships);
  assert('UP07 CORRIGIDO: boot() atual preserva memberships/org-1 com os dados originais',
    (userAfter.memberships as any)?.['org-1']?.role === 'owner' && (userAfter.memberships as any)?.['org-1']?.status === 'active');
  assert('UP08 CORRIGIDO: boot() atual preserva users/lucas_vizentin/energyCredits', !!userAfter.energyCredits);
  assert('UP09 CORRIGIDO: boot() atual preserva energyCredits/generatingUnits/ug-1',
    (userAfter.energyCredits as any)?.generatingUnits?.['ug-1']?.id === 'ug-1');
  assert('UP10 boot() atual ainda atualiza os campos de perfil (login gravado)', userAfter.login === 'lucas.vizentin');
  assert('UP11 Nenhuma chamada PUT foi feita em users/lucas_vizentin (só PATCH)',
    !calls.some(c => c.method === 'PUT' && c.path === 'users/lucas_vizentin'));
  assert('UP12 A escrita em users/lucas_vizentin foi um PATCH (merge raso)',
    calls.some(c => c.method === 'PATCH' && c.path === 'users/lucas_vizentin'));

  // ── Login repetido / duas abas / boot() chamado várias vezes — idempotência ──
  console.log('\nSuite UP3 — login repetido / duas abas: boot() chamado múltiplas vezes não perde dados');

  await runNewBoot();
  await runNewBoot();
  userAfter = getAtPath(tree, 'users/lucas_vizentin') as Record<string, unknown>;
  assert('UP13 boot() chamado 3x seguidas (duas abas + reload): memberships ainda presente', !!userAfter.memberships);
  assert('UP14 boot() chamado 3x seguidas: energyCredits ainda presente', !!userAfter.energyCredits);
  assert('UP15 boot() é idempotente: campos de perfil continuam corretos após múltiplas chamadas', userAfter.name === 'Lucas Vizentin');

  await runSafeUpdateSuite();
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite UP4 — safeUpdateUserProfile(): whitelist real (execução real)
// ═══════════════════════════════════════════════════════════════════════════

async function runSafeUpdateSuite() {
  console.log('\nSuite UP4 — safeUpdateUserProfile(): rejeita campos protegidos (execução real)');

  const newFbGet = extractFunction(currentHtml, /async function fbGet\(/);
  const newFbSet = extractFunction(currentHtml, /async function fbSet\(/);
  const newFbPatch = extractFunction(currentHtml, /async function fbPatch\(/);
  const newFbDelete = extractFunction(currentHtml, /async function fbDelete\(/);
  const allowedFieldsDecl = extractStatement(currentHtml, /var USER_PROFILE_ALLOWED_FIELDS/);
  const protectedFieldsDecl = extractStatement(currentHtml, /var USER_PROFILE_PROTECTED_FIELDS/);
  const safeUpdateFn = extractFunction(currentHtml, /async function safeUpdateUserProfile\(/);
  const safeUpdateBlock = `${allowedFieldsDecl}\n${protectedFieldsDecl}\n${safeUpdateFn}`;

  const fixture = {
    users: {
      test_user: {
        login: 'test.user', name: 'Test User',
        memberships: { 'org-1': { organizationId: 'org-1', role: 'owner', status: 'active' } },
        energyCredits: { generatingUnits: { 'ug-1': { id: 'ug-1' } } },
      },
    },
  };
  const { context, tree, calls } = makeSandbox(fixture);
  vm.runInContext(
    `const DB = 'https://fake-rtdb.firebaseio.com';\n${newFbGet}\n${newFbSet}\n${newFbPatch}\n${newFbDelete}\n${safeUpdateBlock}\nthis.__safeUpdate = safeUpdateUserProfile;`,
    context,
  );
  const safeUpdate = context.__safeUpdate as (uid: string, fields: Record<string, unknown>) => Promise<unknown>;

  for (const protectedField of ['memberships', 'energyCredits', 'organizationId', 'permissions', 'sessionToken']) {
    let threw = false;
    try { await safeUpdate('test_user', { [protectedField]: 'tentativa-maliciosa' }); }
    catch { threw = true; }
    assert(`UP16.${protectedField} safeUpdateUserProfile rejeita o campo protegido "${protectedField}"`, threw);
  }
  assert('UP17 Nenhuma chamada de rede foi feita ao rejeitar campos protegidos (fail-fast antes do fetch)',
    calls.length === 0);

  let threwUnknown = false;
  try { await safeUpdate('test_user', { arbitraryField: 'x' }); } catch { threwUnknown = true; }
  assert('UP18 safeUpdateUserProfile rejeita campo fora da whitelist (não é só protegido — é allowlist)', threwUnknown);

  let threwBadUid = false;
  try { await safeUpdate('../../etc/passwd', { name: 'x' }); } catch { threwBadUid = true; }
  assert('UP19 safeUpdateUserProfile rejeita uid com caracteres de path traversal', threwBadUid);

  await safeUpdate('test_user', { name: 'Test User Renomeado', login: 'test.user2' });
  const after = getAtPath(tree, 'users/test_user') as Record<string, unknown>;
  assert('UP20 safeUpdateUserProfile com campos válidos: atualiza login/name', after.name === 'Test User Renomeado' && after.login === 'test.user2');
  assert('UP21 safeUpdateUserProfile com campos válidos: preserva memberships/org-1', !!(after.memberships as any)?.['org-1']);
  assert('UP22 safeUpdateUserProfile com campos válidos: preserva energyCredits', !!after.energyCredits);

  // Novo usuário — uid ainda não existe.
  await safeUpdate('novo_uid_123', { uid: 'novo_uid_123', name: 'Novo Usuário', login: 'novo.usuario', level: 'executivo', createdAt: 1 });
  const newUser = getAtPath(tree, 'users/novo_uid_123') as Record<string, unknown>;
  assert('UP23 safeUpdateUserProfile cria usuário novo corretamente quando uid não existe', newUser?.name === 'Novo Usuário');

  runStaticSuite();
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite UP5 — checagens estáticas: nenhuma escrita destrutiva remanescente,
// session-init.js nunca escreveu em users/{uid}, dual-path da org preservado
// ═══════════════════════════════════════════════════════════════════════════

function runStaticSuite() {
  console.log('\nSuite UP5 — Nenhuma escrita destrutiva remanescente; session-init.js confirmado inocente');

  assert('UP24 Nenhum fbSet(\'users/... remanescente em index.html (auditoria completa)',
    !/fbSet\('users\//.test(currentHtml));
  assert('UP25 Apenas UM fbPatch(\'users/... remanescente — dentro do próprio safeUpdateUserProfile',
    (currentHtml.match(/fbPatch\('users\//g) || []).length === 1);
  assert('UP26 safeUpdateUserProfile() existe e é usado pelo boot() do diretor',
    currentHtml.includes('async function safeUpdateUserProfile') && /safeUpdateUserProfile\(dirKey/.test(currentHtml));
  assert('UP27 saveUser() (criação de usuário) usa safeUpdateUserProfile, não fbSet',
    /safeUpdateUserProfile\(uid,\{uid,name,login,passHash/.test(currentHtml));
  assert('UP28 saveEditUser() usa safeUpdateUserProfile',
    /safeUpdateUserProfile\(uid,updates\)/.test(currentHtml));
  assert('UP29 resetPass() usa safeUpdateUserProfile',
    /safeUpdateUserProfile\(uid,\{passHash:await hashPass\(nova\)\}\)/.test(currentHtml));
  assert('UP30 saveChangePass() usa safeUpdateUserProfile',
    /safeUpdateUserProfile\(CU\.uid,\{passHash:h\}\)/.test(currentHtml));
  assert('UP31 whitelist de campos permitidos não inclui memberships/energyCredits',
    !/USER_PROFILE_ALLOWED_FIELDS\s*=\s*\[[^\]]*memberships/.test(currentHtml) &&
    !/USER_PROFILE_ALLOWED_FIELDS\s*=\s*\[[^\]]*energyCredits/.test(currentHtml));
  assert('UP32 lista de campos protegidos inclui memberships, energyCredits, organizationId, permissions, sessionToken',
    /USER_PROFILE_PROTECTED_FIELDS\s*=\s*\[['"]memberships['"],\s*['"]energyCredits['"],\s*['"]organizationId['"],\s*['"]permissions['"],\s*['"]sessionToken['"]\]/.test(currentHtml));

  console.log('\nSuite UP6 — session-init.js: confirmado que NUNCA escreveu em users/{uid} (não era o culpado)');

  assert('UP33 session-init.js não contém nenhum .set( em users/', !/db\.ref\([^)]*users[^)]*\)\.set\(/.test(sessionInitSrc));
  assert('UP34 session-init.js não contém nenhum .update( em users/', !/db\.ref\([^)]*users[^)]*\)\.update\(/.test(sessionInitSrc));
  assert('UP35 session-init.js só lê "users" — agora via resolveUserByLogin() (_shared/user-identity.js), que internamente faz db.ref(\'users\').once(\'value\'); a leitura direta foi consolidada lá para resolver uid pela CHAVE do Firebase, nunca pelo campo .uid (correção de missão posterior)',
    sessionInitSrc.includes("resolveUserByLogin(db, normalizedLogin)") &&
    fs.readFileSync(path.join(NF, '_shared/user-identity.js'), 'utf8').includes("db.ref('users').once('value')"));
  assert('UP36 session-init.js não grava sessão/perfil nenhum no Firebase (nenhum db.ref(...).set/.update/.transaction) — só emite token',
    !/db\.ref\([^)]*\)\.(set|update|transaction)\(/.test(sessionInitSrc));

  console.log('\nSuite UP7 — dual-path do membership: lado organizacional nunca é reescrito pelo fix desta missão');

  assert('UP37 organization-members.js continua usando update multipath (dual-path atômico) para criar membership',
    orgMembersSrc.includes("[`organizations/${organizationId}/members/${resolvedUid}`]: membership") &&
    orgMembersSrc.includes("[`users/${resolvedUid}/memberships/${organizationId}`]: membership"));
  assert('UP38 organization-members.js nunca usa set()/PUT no node users/{uid} inteiro',
    !/db\.ref\(`users\/\$\{[^}]+\}`\)\.set\(/.test(orgMembersSrc));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`User Profile Write Safety Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}
