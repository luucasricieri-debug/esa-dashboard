'use strict';
/**
 * ESA OS — Gate 8F Hotfix: Auto-seleção da única organização
 *
 * Valida estáticamente:
 *   - loadMemberships usa key como fallback para organizationId
 *   - resolveOrganizationContext auto-seleciona org única
 *   - writeActiveOrgId existe e grava em sessionStorage
 *   - provider-bootstrap.js compilado contém o fix
 *   - HTML contém orgContextLoading e condições corretas
 *   - render values presentes e com nomes corretos
 *
 * Rodar: npx tsx tests/gate8f-autoselect.manual-test.ts
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const NF   = path.join(ROOT, 'netlify/functions');
const MT   = path.join(__dirname, '../multitenancy');
const BOOT = path.join(ROOT, 'assets/energy-credits-runtime/provider-bootstrap.js');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const orgCtxSrc  = fs.readFileSync(path.join(NF, 'organization-context.js'), 'utf8');
const resolverSrc = fs.readFileSync(path.join(MT, 'organizationContextResolver.ts'), 'utf8');
const bootSrc    = fs.readFileSync(BOOT, 'utf8');
const htmlSrc    = fs.readFileSync(path.join(ROOT, 'energy-credits-v2.html'), 'utf8');

// ── Suite 1: organization-context.js — loadMemberships key fallback ───────────

console.log('\nSuite AS1 — loadMemberships usa key como fallback para organizationId');

assert('AS01 Object.entries usado em loadMemberships',
  orgCtxSrc.includes('Object.entries(raw)'));
assert('AS02 Fallback: m.organizationId || key',
  orgCtxSrc.includes('m.organizationId || key'));
assert('AS03 Filtro por status active mantido',
  orgCtxSrc.includes("m.status === 'active'"));
assert('AS04 Filtro por organizationId mantido',
  orgCtxSrc.includes('m.organizationId'));
assert('AS05 Guarda contra m nulo (typeof check ou conditional spread)',
  orgCtxSrc.includes('typeof m === \'object\'') || orgCtxSrc.includes("typeof m === \"object\""));

// ── Suite 2: organizationContextResolver.ts — auto-seleção ───────────────────

console.log('\nSuite AS2 — Auto-seleção da única organização no resolver');

assert('AS06 writeActiveOrgId exportada',
  resolverSrc.includes('function writeActiveOrgId'));
assert('AS07 _fetchAndParse extraída como helper',
  resolverSrc.includes('async function _fetchAndParse'));
assert('AS08 Auto-seleção quando avail.length === 1',
  resolverSrc.includes('avail.length === 1') || resolverSrc.includes('availableOrganizations?.length === 1'));
assert('AS09 Grava na sessionStorage via writeActiveOrgId',
  resolverSrc.includes('writeActiveOrgId(') && resolverSrc.includes('avail[0].id'));
assert('AS10 Re-resolve com organizationId explícito',
  resolverSrc.includes("organizationId: avail[0].id") || resolverSrc.includes("organizationId: singleOrgId"));
assert('AS11 Fallback para primeiro resultado se re-resolve falhar',
  resolverSrc.includes('if (confirmed.context) return confirmed'));
assert('AS12 Auto-seleção só quando sem activeOrgId',
  resolverSrc.includes('!activeOrgId'));
assert('AS13 clearActiveOrganization ainda exportada',
  resolverSrc.includes('export function clearActiveOrganization'));
assert('AS14 ACTIVE_ORG_KEY preservado',
  resolverSrc.includes("ACTIVE_ORG_KEY = 'esa_active_organization'"));

// ── Suite 3: provider-bootstrap.js compilado ──────────────────────────────────

console.log('\nSuite AS3 — provider-bootstrap.js contém o fix compilado');

assert('AS15 writeActiveOrgId presente no bundle',
  bootSrc.includes('writeActiveOrgId'));
assert('AS16 _fetchAndParse presente no bundle',
  bootSrc.includes('_fetchAndParse'));
assert('AS17 avail.length === 1 presente no bundle',
  bootSrc.includes('avail.length === 1'));
assert('AS18 organizationId: avail[0].id presente no bundle',
  bootSrc.includes('avail[0].id'));
assert('AS19 confirmed.context presente no bundle (fallback)',
  bootSrc.includes('confirmed.context'));
assert('AS20 ORG_CONTEXT_MESSAGES presente (Gate 8E sincronizado)',
  bootSrc.includes('ORG_CONTEXT_MESSAGES') || bootSrc.includes('org_context_code'));

// ── Suite 4: HTML — loading state e render values ────────────────────────────

console.log('\nSuite AS4 — HTML: loading state e render values corretos');

assert('AS21 orgContextLoading declarado nas render values',
  htmlSrc.includes('orgContextLoading'));
assert('AS22 orgContextLoading: real mode + sem _rtOrgContext',
  htmlSrc.includes("_rtMode === 'real' && !S._rtOrgContext") || htmlSrc.includes('_rtMode === "real" && !S._rtOrgContext'));
assert('AS23 Carregando contexto organizacional presente no HTML',
  htmlSrc.includes('Carregando contexto organizacional'));
assert('AS24 !orgContextLoading && !membersCan.read (evita falso Sem permissão)',
  htmlSrc.includes('!orgContextLoading && !membersCan.read'));
assert('AS25 !orgContextLoading && membersCan.read (lista só após ctx)',
  htmlSrc.includes('!orgContextLoading && membersCan.read'));
assert('AS26 orgBannerBadge presente nas render values',
  htmlSrc.includes('orgBannerBadge:'));
assert('AS27 orgBannerSub presente nas render values',
  htmlSrc.includes('orgBannerSub:'));
assert('AS28 membersHeaderIcon presente nas render values',
  htmlSrc.includes('membersHeaderIcon:'));
assert('AS29 memberAddBtnIcon presente nas render values',
  htmlSrc.includes('memberAddBtnIcon:'));
assert('AS30 memberAddBtnCursor presente nas render values',
  htmlSrc.includes('memberAddBtnCursor:'));
assert('AS31 memberAddSubmitLabel presente nas render values',
  htmlSrc.includes('memberAddSubmitLabel:'));
assert('AS32 onMemberAddLoginChange presente nas render values',
  htmlSrc.includes('onMemberAddLoginChange:'));
assert('AS33 onMemberAddRoleChange presente nas render values',
  htmlSrc.includes('onMemberAddRoleChange:'));

// ── Suite 5: organization-context.js — comportamento com key fallback ─────────

console.log('\nSuite AS5 — organization-context.js comportamento esperado (análise estática)');

assert('AS34 buildSingleUserContext retorna availableOrganizations: []',
  orgCtxSrc.includes('availableOrganizations: []'));
assert('AS35 loadOrganization ainda presente',
  orgCtxSrc.includes('function loadOrganization'));
assert('AS36 ROLE_PERMISSIONS inclui organization.members.manage para owner',
  orgCtxSrc.includes("organization.members.manage'") && orgCtxSrc.includes('owner:'));
assert('AS37 loadMemberships usa key como fallback via map+filter',
  orgCtxSrc.includes('.map(([key, m])') || orgCtxSrc.includes('.map(([key,m]'));
assert('AS38 Fallback não quebra records nulos (conditional)',
  orgCtxSrc.includes('m && typeof m') || orgCtxSrc.includes('m &&'));

// ── Relatório ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`Gate 8F Auto-Select Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
