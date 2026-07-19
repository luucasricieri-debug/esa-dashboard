'use strict';
/**
 * ESA OS — Gate 8F Hotfix 2: Falso aviso "Sem permissão de acesso" simultâneo à lista
 *
 * Causa raiz: o mini-parser de expressões do template runtime (assets/energy-credits-runtime/support.js,
 * função resolve()) não suporta o operador "&&". Expressões como "{{ !orgContextLoading && !membersCan.read }}"
 * eram avaliadas como segue:
 *   1. expr[0] === '!' -> return !resolve(vals, "orgContextLoading && !membersCan.read")
 *   2. resolve() do restante cai em resolvePath(), que resolve só o primeiro identificador
 *      ("orgContextLoading") e retorna `undefined` assim que encontra o espaço antes de "&&".
 *   3. !undefined === true — SEMPRE, independentemente do estado real.
 *
 * Resultado: tanto o aviso de "sem permissão" quanto a lista de membros (e a tabela) renderizavam
 * incondicionalmente como verdadeiros, mesmo quando corretos individualmente por outros motivos.
 *
 * Fix: mover a lógica composta para JavaScript real dentro do IIFE de renderVals
 * (orgAccessDenied, orgAccessGranted, membersTableReady) e referenciar esses booleanos
 * pré-computados como identificadores simples no template — o resolvePath() do runtime
 * lida corretamente com identificadores simples.
 *
 * Rodar: npx tsx tests/gate8f-permission-warning-hotfix.manual-test.ts
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const htmlSrc = fs.readFileSync(path.join(ROOT, 'energy-credits-v2.html'), 'utf8');

// ── Suite PW1 — replica exata do resolve() do template runtime ───────────────
// Prova empírica de que expressões compostas com "&&" sempre resolviam para true.

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function resolve(vals: Record<string, unknown>, src: string): unknown {
  const expr = String(src).trim();
  if (!expr) return void 0;
  if (expr[0] === '(' && expr[expr.length - 1] === ')' && parensWrapWhole(expr)) {
    return resolve(vals, expr.slice(1, -1));
  }
  const eq = findTopLevelEquality(expr);
  if (eq) {
    const lv = resolve(vals, expr.slice(0, eq.index));
    const rv = resolve(vals, expr.slice(eq.index + eq.op.length));
    switch (eq.op) {
      case '===': return lv === rv;
      case '!==': return lv !== rv;
      case '==':  return lv == rv;
      default:    return lv != rv;
    }
  }
  if (expr[0] === '!') return !resolve(vals, expr.slice(1));
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (expr === 'null') return null;
  if (expr === 'undefined') return void 0;
  if (NUMBER_RE.test(expr)) return Number(expr);
  if (expr.length >= 2 && (expr[0] === '"' || expr[0] === "'") && expr[expr.length - 1] === expr[0]) {
    return expr.slice(1, -1);
  }
  return resolvePath(vals, expr);
}
function parensWrapWhole(expr: string): boolean {
  let depth = 0;
  for (let i = 0; i < expr.length - 1; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')') { depth--; if (depth === 0) return false; }
  }
  return true;
}
function findTopLevelEquality(expr: string): { index: number; op: string } | null {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (depth === 0 && (c === '=' || c === '!') && expr[i + 1] === '=') {
      if (i > 0 && (expr[i - 1] === '=' || expr[i - 1] === '!')) continue;
      if (!expr.slice(0, i).trim()) continue;
      const op = expr[i + 2] === '=' ? c + '==' : c + '=';
      return { index: i, op };
    }
  }
  return null;
}
function resolvePath(vals: Record<string, unknown>, expr: string): unknown {
  const head = expr.match(IDENT_RE);
  if (!head) return void 0;
  let cur: unknown = vals == null ? void 0 : (vals as Record<string, unknown>)[head[0]];
  let i = head[0].length;
  while (i < expr.length) {
    if (expr[i] === '.') {
      const m = expr.slice(i + 1).match(IDENT_RE) || expr.slice(i + 1).match(/^\d+/);
      if (!m) return void 0;
      cur = cur == null ? void 0 : (cur as Record<string, unknown>)[m[0]];
      i += 1 + m[0].length;
    } else if (expr[i] === '[') {
      let depth = 1; let j = i + 1;
      while (j < expr.length && depth > 0) {
        if (expr[j] === '[') depth++;
        else if (expr[j] === ']') { depth--; if (depth === 0) break; }
        j++;
      }
      if (depth !== 0) return void 0;
      const key = resolve(vals, expr.slice(i + 1, j)) as string | number;
      cur = cur == null ? void 0 : (cur as Record<string, unknown>)[key];
      i = j + 1;
    } else {
      return void 0;
    }
  }
  return cur;
}

console.log('\nSuite PW1 — Prova empírica: resolve() do runtime não suporta "&&"');

const ownerLoaded = { orgContextLoading: false, membersCan: { read: true, manage: true } };
assert('PW01 Bug reproduzido: expressão antiga "!orgContextLoading && !membersCan.read" resolvia SEMPRE true (mesmo com read=true)',
  resolve(ownerLoaded, '!orgContextLoading && !membersCan.read') === true);
assert('PW02 Bug reproduzido: expressão antiga "!orgContextLoading && membersCan.read" também resolvia SEMPRE true',
  resolve(ownerLoaded, '!orgContextLoading && membersCan.read') === true);
assert('PW03 Bug reproduzido: "!membersLoading && !membersError" também sempre true',
  resolve({ membersLoading: false, membersError: null }, '!membersLoading && !membersError') === true);

assert('PW04 Fix: identificador simples "orgAccessDenied" resolve corretamente para false (owner com read)',
  resolve({ orgAccessDenied: false }, 'orgAccessDenied') === false);
assert('PW05 Fix: identificador simples "orgAccessGranted" resolve corretamente para true (owner com read)',
  resolve({ orgAccessGranted: true }, 'orgAccessGranted') === true);
assert('PW06 Fix: identificador simples "membersTableReady" resolve corretamente',
  resolve({ membersTableReady: true }, 'membersTableReady') === true);

// ── Suite PW2 — cálculo correto em JS real (não no template) para várias roles ──

console.log('\nSuite PW2 — orgAccessDenied/orgAccessGranted calculados em JS real por cenário');

function computeAccess(orgContextLoading: boolean, permissions: string[] | null, isOrgMode: boolean) {
  const membersCanRead = isOrgMode && Array.isArray(permissions) && permissions.includes('organization.members.read');
  const orgAccessDenied  = !orgContextLoading && !membersCanRead;
  const orgAccessGranted = !orgContextLoading && membersCanRead;
  return { orgAccessDenied, orgAccessGranted };
}

const OWNER_PERMS = ['organization.members.read', 'organization.members.manage'];
const MANAGER_PERMS = ['organization.members.read'];
const OPERATOR_PERMS: string[] = [];

const ownerAccess = computeAccess(false, OWNER_PERMS, true);
assert('PW07 owner: orgAccessDenied === false (não vê aviso de sem permissão)', ownerAccess.orgAccessDenied === false);
assert('PW08 owner: orgAccessGranted === true (vê lista de membros)', ownerAccess.orgAccessGranted === true);
assert('PW09 owner: nunca ambos true simultaneamente', !(ownerAccess.orgAccessDenied && ownerAccess.orgAccessGranted));

const managerAccess = computeAccess(false, MANAGER_PERMS, true);
assert('PW10 manager com read: orgAccessGranted === true, orgAccessDenied === false', managerAccess.orgAccessGranted === true && managerAccess.orgAccessDenied === false);

const operatorAccess = computeAccess(false, OPERATOR_PERMS, true);
assert('PW11 operator sem read: orgAccessDenied === true (vê aviso)', operatorAccess.orgAccessDenied === true);
assert('PW12 operator sem read: orgAccessGranted === false (não vê lista)', operatorAccess.orgAccessGranted === false);
assert('PW13 operator: nunca ambos true simultaneamente', !(operatorAccess.orgAccessDenied && operatorAccess.orgAccessGranted));

const loadingAccess = computeAccess(true, OWNER_PERMS, true);
assert('PW14 loading: orgAccessDenied === false (não mostra aviso durante carregamento)', loadingAccess.orgAccessDenied === false);
assert('PW15 loading: orgAccessGranted === false (não mostra lista durante carregamento)', loadingAccess.orgAccessGranted === false);
assert('PW16 loading: nunca ambos true simultaneamente', !(loadingAccess.orgAccessDenied && loadingAccess.orgAccessGranted));

const singleUserAccess = computeAccess(false, null, false);
assert('PW17 single-user (sem org): orgAccessDenied === true', singleUserAccess.orgAccessDenied === true);
assert('PW18 single-user: orgAccessGranted === false', singleUserAccess.orgAccessGranted === false);

// Exhaustive: for every combination of loading/permissions/orgMode, exactly one or zero of
// (denied, granted) is ever true — never both.
console.log('\nSuite PW3 — Exaustivo: denied e granted nunca ambos true, em nenhuma combinação');
let exhaustiveOk = true;
for (const loading of [true, false]) {
  for (const isOrgMode of [true, false]) {
    for (const perms of [OWNER_PERMS, MANAGER_PERMS, OPERATOR_PERMS, null]) {
      const r = computeAccess(loading, perms, isOrgMode);
      if (r.orgAccessDenied && r.orgAccessGranted) exhaustiveOk = false;
    }
  }
}
assert('PW19 Nenhuma combinação de loading/permissions/orgMode produz denied+granted simultâneos', exhaustiveOk);

// ── Suite PW4 — HTML: template não usa mais expressões compostas quebradas ──────

console.log('\nSuite PW4 — HTML usa flags pré-computadas, não expressões "&&" no template');

assert('PW20 Nenhum sc-if value contém "&&" (o mini-parser do runtime não suporta o operador)',
  !/sc-if value="\{\{[^}]*&&/.test(htmlSrc));
assert('PW21 orgAccessDenied calculado em JS (const orgAccessDenied = ...)',
  htmlSrc.includes('const orgAccessDenied  = !orgContextLoading && !membersCan.read') ||
  htmlSrc.includes('const orgAccessDenied = !orgContextLoading && !membersCan.read'));
assert('PW22 orgAccessGranted calculado em JS',
  htmlSrc.includes('const orgAccessGranted = !orgContextLoading && membersCan.read'));
assert('PW23 membersTableReady calculado em JS',
  htmlSrc.includes('const membersTableReady = !S._rtMembersLoading && !S._rtMembersError'));
assert('PW24 orgAccessDenied presente nas render values retornadas',
  htmlSrc.includes('orgAccessDenied,') || htmlSrc.includes('orgAccessDenied ,'));
assert('PW25 orgAccessGranted presente nas render values retornadas',
  htmlSrc.includes('orgAccessGranted,'));
assert('PW26 membersTableReady presente nas render values retornadas',
  htmlSrc.includes('membersTableReady,'));
assert('PW27 sc-if do aviso "Sem permissão" usa orgAccessDenied',
  htmlSrc.includes('<sc-if value="{{ orgAccessDenied }}"'));
assert('PW28 sc-if da lista de membros usa orgAccessGranted',
  htmlSrc.includes('<sc-if value="{{ orgAccessGranted }}"'));
assert('PW29 sc-if da tabela usa membersTableReady',
  htmlSrc.includes('<sc-if value="{{ membersTableReady }}"'));
assert('PW30 orgContextLoading continua um identificador simples (sem &&, sem !) — nunca foi afetado pelo bug',
  htmlSrc.includes('<sc-if value="{{ orgContextLoading }}"'));
assert('PW31 Texto "Sem permissão de acesso" ainda presente (aviso não removido, só a condição corrigida)',
  htmlSrc.includes('Sem permissão de acesso'));

// ── Relatório ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`Gate 8F Permission-Warning Hotfix Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
