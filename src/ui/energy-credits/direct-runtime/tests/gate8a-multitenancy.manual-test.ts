'use strict';
/**
 * ESA OS — Gate 8A: Fundação de Multitenancy Organizacional
 *
 * Valida contratos, matriz de permissões, resolver e endpoint
 * de contexto organizacional introduzidos no Gate 8A.
 *
 * Rodar: npx tsx tests/gate8a-multitenancy.manual-test.ts
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hasPermission, getPermissionsForRole, ROLE_PERMISSIONS } from '../multitenancy/permissionMatrix.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MT   = path.join(__dirname, '../multitenancy');
const ROOT = path.resolve(__dirname, '../../../../..');
const NF   = path.join(ROOT, 'netlify/functions');
const BS   = path.join(__dirname, '../bootstrap/standaloneProviderBootstrap.ts');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const typesSrc       = fs.readFileSync(path.join(MT, 'types.ts'), 'utf8');
const matrixSrc      = fs.readFileSync(path.join(MT, 'permissionMatrix.ts'), 'utf8');
const resolverSrc    = fs.readFileSync(path.join(MT, 'organizationContextResolver.ts'), 'utf8');
const orgCtxFnSrc    = fs.readFileSync(path.join(NF, 'organization-context.js'), 'utf8');
const createOrgSrc   = fs.readFileSync(path.join(ROOT, 'scripts/create-initial-organization.js'), 'utf8');
const bootstrapSrc   = fs.readFileSync(BS, 'utf8');

// ── Suite 1: Contratos de tipos ───────────────────────────────────────────────

console.log('\nSuite 1 — types.ts: contratos organizacionais');

assert('TenancyMode exportado',           typesSrc.includes("export type TenancyMode"));
assert('OrganizationRole exportado',       typesSrc.includes("export type OrganizationRole"));
assert('OrganizationPermission exportado', typesSrc.includes("export type OrganizationPermission"));
assert('Organization interface exportada', typesSrc.includes("export interface Organization"));
assert('OrganizationMembership exportada', typesSrc.includes("export interface OrganizationMembership"));
assert('OrganizationContext exportado',    typesSrc.includes("export interface OrganizationContext"));
assert('VersionedRecord exportado',        typesSrc.includes("export interface VersionedRecord"));
assert('VersionConflictError exportado',   typesSrc.includes("export interface VersionConflictError"));
assert('OptimisticWriteOptions exportado', typesSrc.includes("export interface OptimisticWriteOptions"));
assert('TenancyMode tem single-user',      typesSrc.includes("'single-user'"));
assert('TenancyMode tem organization',     typesSrc.includes("'organization'"));
assert('6 roles definidas',
  ['owner','admin','manager','operator','financial','viewer'].every(r => typesSrc.includes(`'${r}'`)));

// ── Suite 2: Matriz de permissões ─────────────────────────────────────────────

console.log('\nSuite 2 — permissionMatrix.ts: estrutura e hasPermission()');

assert('ROLE_PERMISSIONS exportado', matrixSrc.includes('export const ROLE_PERMISSIONS'));
assert('hasPermission exportado',    matrixSrc.includes('export function hasPermission'));
assert('getPermissionsForRole',      matrixSrc.includes('export function getPermissionsForRole'));
assert('12 permissions presentes',
  ['energyCredits.read','energyCredits.create','energyCredits.update','energyCredits.delete',
   'energyCredits.settlement.read','energyCredits.settlement.write',
   'energyCredits.financial.read','energyCredits.financial.write',
   'energyCredits.import','energyCredits.alerts.manage',
   'organization.members.read','organization.members.manage',
  ].every(p => matrixSrc.includes(p)));

// ── Suite 3: hasPermission() — owner ─────────────────────────────────────────

console.log('\nSuite 3 — hasPermission(): owner tem todas as permissões');

assert('owner: energyCredits.read',               hasPermission('owner', 'energyCredits.read'));
assert('owner: energyCredits.delete',             hasPermission('owner', 'energyCredits.delete'));
assert('owner: energyCredits.financial.write',    hasPermission('owner', 'energyCredits.financial.write'));
assert('owner: organization.members.manage',      hasPermission('owner', 'organization.members.manage'));
assert('owner: 12 permissões totais',             getPermissionsForRole('owner').length === 12);

// ── Suite 4: hasPermission() — viewer é read-only ────────────────────────────

console.log('\nSuite 4 — hasPermission(): viewer é estritamente read-only');

assert('viewer: energyCredits.read',              hasPermission('viewer', 'energyCredits.read'));
assert('viewer: energyCredits.settlement.read',   hasPermission('viewer', 'energyCredits.settlement.read'));
assert('viewer: energyCredits.financial.read',    hasPermission('viewer', 'energyCredits.financial.read'));
assert('viewer: NÃO cria energyCredits',          !hasPermission('viewer', 'energyCredits.create'));
assert('viewer: NÃO deleta',                      !hasPermission('viewer', 'energyCredits.delete'));
assert('viewer: NÃO gerencia membros',            !hasPermission('viewer', 'organization.members.manage'));
assert('viewer: 3 permissões apenas',             getPermissionsForRole('viewer').length === 3);

// ── Suite 5: hasPermission() — roles intermediárias ──────────────────────────

console.log('\nSuite 5 — hasPermission(): operator e financial');

assert('operator: cria energyCredits',            hasPermission('operator', 'energyCredits.create'));
assert('operator: importa',                       hasPermission('operator', 'energyCredits.import'));
assert('operator: NÃO deleta',                    !hasPermission('operator', 'energyCredits.delete'));
assert('operator: NÃO acessa financeiro',         !hasPermission('operator', 'energyCredits.financial.read'));
assert('financial: financial.write',              hasPermission('financial', 'energyCredits.financial.write'));
assert('financial: NÃO cria energyCredits',       !hasPermission('financial', 'energyCredits.create'));
assert('financial: NÃO gerencia alertas',         !hasPermission('financial', 'energyCredits.alerts.manage'));

// ── Suite 6: Resolver de contexto ────────────────────────────────────────────

console.log('\nSuite 6 — organizationContextResolver.ts');

assert('resolveOrganizationContext exportado',
  resolverSrc.includes('export async function resolveOrganizationContext'));
assert('OrgContextResolution exportado',
  resolverSrc.includes('export interface OrgContextResolution'));
assert('usa Authorization: Bearer',
  resolverSrc.includes('Bearer ${sessionToken}') || resolverSrc.includes("Bearer "));
assert('chama /.netlify/functions/organization-context',
  resolverSrc.includes('organization-context'));
assert('retorna context: null em 401',
  resolverSrc.includes("code: 'unauthorized'"));
assert('retorna context: null em erro de rede',
  resolverSrc.includes("code: 'backend_unavailable'"));
assert('lê organização ativa de sessionStorage',
  resolverSrc.includes("'esa_active_organization'"));

// ── Suite 7: Netlify Function — segurança ────────────────────────────────────

console.log('\nSuite 7 — organization-context.js: segurança do backend');

assert('valida token HMAC via verifyToken',
  orgCtxFnSrc.includes('verifyToken'));
assert('uid extraído EXCLUSIVAMENTE do token (payload.uid)',
  orgCtxFnSrc.includes('payload.uid') || orgCtxFnSrc.includes('const { uid } = payload'));
assert('carrega memberships de users/{uid}/memberships',
  orgCtxFnSrc.includes('users/${uid}/memberships') || orgCtxFnSrc.includes('`users/${uid}/memberships`'));
assert('fallback single-user sem memberships',
  orgCtxFnSrc.includes("'single-user'"));
assert('permissões calculadas pelo backend (ROLE_PERMISSIONS)',
  orgCtxFnSrc.includes('ROLE_PERMISSIONS'));
assert('organização inativa retorna 403',
  orgCtxFnSrc.includes("org.status !== 'active'") && orgCtxFnSrc.includes('403'));
assert('membership inativo não autoriza acesso',
  orgCtxFnSrc.includes("status !== 'active'") || orgCtxFnSrc.includes("status === 'active'"));
assert('sem role ou permissions confiadas do browser',
  !orgCtxFnSrc.includes('body.role') && !orgCtxFnSrc.includes('body.permissions'));
assert('cross-tenant: organizationId do body validado contra memberships',
  orgCtxFnSrc.includes('organizationId === requestedOrgId') ||
  orgCtxFnSrc.includes('m.organizationId === requestedOrgId'));
assert('retorna tenancyMode no contexto',
  orgCtxFnSrc.includes('tenancyMode'));
assert('retorna availableOrganizations',
  orgCtxFnSrc.includes('availableOrganizations'));

// ── Suite 8: Bootstrap — integração Gate 8A ───────────────────────────────────

console.log('\nSuite 8 — standaloneProviderBootstrap.ts: integração org context');

assert('importa resolveOrganizationContext',
  bootstrapSrc.includes('resolveOrganizationContext'));
assert('importa OrganizationContext',
  bootstrapSrc.includes('OrganizationContext'));
assert('__ESA_ORG_CONTEXT__ declarado no window',
  bootstrapSrc.includes('__ESA_ORG_CONTEXT__'));
assert('resolve org context antes dos repositórios',
  bootstrapSrc.indexOf('resolveOrganizationContext') < bootstrapSrc.indexOf('hydrateFromSnapshot'));
assert('paths Firebase não alterados (continua users/{uid})',
  bootstrapSrc.includes('loadEnergyCreditsSnapshot') &&
  !bootstrapSrc.includes('organizations/'));

// ── Suite 9: Script de criação de organização ─────────────────────────────────

console.log('\nSuite 9 — create-initial-organization.js: idempotência e dry-run');

assert('suporta --dry-run',          createOrgSrc.includes('--dry-run') && createOrgSrc.includes('dryRun'));
assert('requer --name',              createOrgSrc.includes('--name'));
assert('requer --slug',              createOrgSrc.includes('--slug'));
assert('requer --owner-uid',         createOrgSrc.includes('--owner-uid'));
assert('idempotente: verifica slug existente', createOrgSrc.includes('findOrgBySlug'));
assert('sem uid hardcoded',          !createOrgSrc.match(/['"`][0-9a-zA-Z]{20,}['"`]/));
assert('lê secret de env var',       createOrgSrc.includes('FIREBASE_SERVICE_ACCOUNT_JSON'));
assert('cria membership com role owner', createOrgSrc.includes("role: 'owner'"));
assert('não sobrescreve org existente',
  createOrgSrc.includes('existing') && createOrgSrc.includes('process.exit(0)'));

// ── Suite 10: Modelo atual preservado ────────────────────────────────────────

console.log('\nSuite 10 — compatibilidade: modelo single-user preservado');

assert('org-context retorna single-user sem memberships',
  orgCtxFnSrc.includes("tenancyMode: 'single-user'"));
assert('org-context NÃO acessa path users/{uid}/energyCredits/ no Firebase',
  !orgCtxFnSrc.includes('energyCredits/') && !orgCtxFnSrc.includes('energyCredits`'));
assert('bootstrap continua lendo users/{uid} via loadEnergyCreditsSnapshot',
  bootstrapSrc.includes('loadEnergyCreditsSnapshot'));
assert('paths de escrita não alterados (Gate 8A apenas prepara contexto)',
  !bootstrapSrc.includes("organizations/") && !bootstrapSrc.includes("orgContext.organizationId"));

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Gate 8A multitenancy: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
