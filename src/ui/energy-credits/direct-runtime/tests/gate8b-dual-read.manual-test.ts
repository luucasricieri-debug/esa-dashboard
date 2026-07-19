'use strict';
/**
 * ESA OS — Gate 8B: Dual-Read e Escritas Organizacionais
 *
 * Valida: pathResolver, org-permissions, dual-read snapshot, escritas org com
 * versionamento, idempotência, permissões por operação, httpFirebaseClient
 * (setVersioned), persistentUiProvider (org mode) e standaloneProviderBootstrap.
 *
 * Rodar: npx tsx tests/gate8b-dual-read.manual-test.ts
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveEnergyCreditsPath, resolveLegacyEnergyCreditsPath, resolveEntityPath } from '../multitenancy/pathResolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MT   = path.join(__dirname, '../multitenancy');
const BS   = path.join(__dirname, '../bootstrap');
const ROOT = path.resolve(__dirname, '../../../../..');
const NF   = path.join(ROOT, 'netlify/functions');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

// ── Leitura de fontes ─────────────────────────────────────────────────────────

const typesSrc         = fs.readFileSync(path.join(MT, 'types.ts'), 'utf8');
const pathResolverSrc  = fs.readFileSync(path.join(MT, 'pathResolver.ts'), 'utf8');
const orgPermsSrc      = fs.readFileSync(path.join(NF, '_shared/org-permissions.js'), 'utf8');
const ecDataSrc        = fs.readFileSync(path.join(NF, 'energy-credits-data.js'), 'utf8');
const orgCtxSrc        = fs.readFileSync(path.join(NF, 'organization-context.js'), 'utf8');
const httpClientSrc    = fs.readFileSync(path.join(BS, 'httpFirebaseClient.ts'), 'utf8');
const persistProvSrc   = fs.readFileSync(path.join(BS, 'persistentUiProvider.ts'), 'utf8');
const bootstrapSrc     = fs.readFileSync(path.join(BS, 'standaloneProviderBootstrap.ts'), 'utf8');
const htmlSrc          = fs.readFileSync(path.join(ROOT, 'energy-credits-v2.html'), 'utf8');

// ── Suite 1: pathResolver — exportações e comportamento ──────────────────────

console.log('\nSuite 1 — pathResolver.ts: exportações e comportamento runtime');

assert('resolveEnergyCreditsPath exportada', pathResolverSrc.includes('export function resolveEnergyCreditsPath'));
assert('resolveLegacyEnergyCreditsPath exportada', pathResolverSrc.includes('export function resolveLegacyEnergyCreditsPath'));
assert('resolveEntityPath exportada', pathResolverSrc.includes('export function resolveEntityPath'));

const orgCtx = {
  tenancyMode: 'organization' as const,
  organizationId: 'org-abc-123',
  organizationName: 'ESA Energia',
  uid: 'uid-xyz-456',
  role: 'owner' as const,
  permissions: [] as never[],
  availableOrganizations: [],
};
const suCtx = { ...orgCtx, tenancyMode: 'single-user' as const, organizationId: 'uid-xyz-456' };

assert('org mode: retorna organizations/{orgId}/energyCredits',
  resolveEnergyCreditsPath(orgCtx) === 'organizations/org-abc-123/energyCredits');
assert('single-user mode: retorna users/{uid}/energyCredits',
  resolveEnergyCreditsPath(suCtx) === 'users/uid-xyz-456/energyCredits');
assert('legacy path usa sempre uid',
  resolveLegacyEnergyCreditsPath('uid-xyz-456') === 'users/uid-xyz-456/energyCredits');
assert('resolveEntityPath constrói path completo',
  resolveEntityPath(orgCtx, 'generatingUnits', 'ug-001') === 'organizations/org-abc-123/energyCredits/generatingUnits/ug-001');

// ── Suite 2: types.ts — DataSource e SnapshotResult ──────────────────────────

console.log('\nSuite 2 — types.ts: DataSource e SnapshotResult (Gate 8B)');

assert('DataSource type exportado', typesSrc.includes("export type DataSource"));
assert("DataSource tem 'organization'", typesSrc.includes("'organization'"));
assert("DataSource tem 'legacy-single-user'", typesSrc.includes("'legacy-single-user'"));
assert('SnapshotResult interface exportada', typesSrc.includes('export interface SnapshotResult'));
assert('SnapshotResult tem data', typesSrc.includes('data: Record<string, unknown[]>'));
assert('SnapshotResult tem dataSource', typesSrc.includes('dataSource: DataSource'));
assert('SnapshotResult tem migrationRequired', typesSrc.includes('migrationRequired: boolean'));

// ── Suite 3: org-permissions.js — estrutura e comportamento ──────────────────

console.log('\nSuite 3 — org-permissions.js: matriz de permissões no backend');

assert('ROLE_PERMISSIONS exportado', orgPermsSrc.includes('ROLE_PERMISSIONS'));
assert('hasPermission exportado', orgPermsSrc.includes('function hasPermission'));
assert('module.exports expõe ambos', orgPermsSrc.includes('module.exports'));

const { ROLE_PERMISSIONS: RP, hasPermission: hp } = (await import(`file://${path.join(NF, '_shared/org-permissions.js')}`)).default
  ?? await import(`file://${path.join(NF, '_shared/org-permissions.js')}`);

assert('hasPermission: owner lê energyCredits',   hp('owner', 'energyCredits.read'));
assert('hasPermission: viewer NÃO cria',           !hp('viewer', 'energyCredits.create'));
assert('hasPermission: operator NÃO acessa financeiro', !hp('operator', 'energyCredits.financial.read'));
assert('hasPermission: financial pode settlement.write', hp('financial', 'energyCredits.settlement.write'));

// ── Suite 4: energy-credits-data.js — dual-read com mock ─────────────────────

console.log('\nSuite 4 — energy-credits-data.js: dual-read snapshot com mock');

const { _createHandler } = await import(`file://${path.join(NF, 'energy-credits-data.js')}`);
const { generateToken, verifyToken } = await import(`file://${path.join(NF, '_shared/upload-session.js')}`);

const TEST_SECRET = 'gate8b-test-secret';
process.env.UPLOAD_SESSION_SECRET = TEST_SECRET;
const UID = 'uid-gate8b-test';
const ORG = 'org-gate8b-test';

function makeToken(uid: string) { return generateToken(uid, TEST_SECRET); }

function makeEvent(body: object) {
  return {
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function makeMockDb(store: Record<string, unknown> = {}) {
  const calls = { set: [] as unknown[], transaction: [] as unknown[] };
  return {
    store, calls,
    ref(p: string) {
      return {
        async once() { return { val: () => store[p] ?? null }; },
        async set(v: unknown) { store[p] = v; calls.set.push({ path: p, value: v }); },
        async transaction(updateFn: (current: unknown) => unknown) {
          const current = store[p] ?? null;
          const newVal = updateFn(current);
          if (newVal === undefined) {
            return { committed: false, snapshot: { val: () => current } };
          }
          store[p] = newVal;
          calls.transaction.push({ path: p, value: newVal });
          return { committed: true, snapshot: { val: () => newVal } };
        },
      };
    },
  };
}

async function call(handler: Function, body: object) {
  const res = await handler(makeEvent(body));
  return { ...res, json: JSON.parse(res.body || '{}') };
}

// Single-user snapshot: backward compat
const suDb = makeMockDb({ [`users/${UID}/energyCredits`]: { generatingUnits: { 'ug-1': { id: 'ug-1', name: 'UG 1' } } } });
const suHandler = _createHandler({ getDatabase: () => suDb, verifyToken });
const snapSu = await call(suHandler, { sessionToken: makeToken(UID), operation: 'snapshot' });
assert('SU: snapshot → 200', snapSu.statusCode === 200);
assert('SU: snapshot.data tem 12 collections', Object.keys(snapSu.json.data).length === 12);
assert("SU: dataSource = 'legacy-single-user'", snapSu.json.dataSource === 'legacy-single-user');
assert('SU: migrationRequired = false', snapSu.json.migrationRequired === false);
assert('SU: snapshot inclui requestId', typeof snapSu.json.requestId === 'string');

// Org mode snapshot — org tem dados
const orgDb = makeMockDb({
  [`users/${UID}/memberships/${ORG}`]: { organizationId: ORG, uid: UID, role: 'owner', status: 'active' },
  [`organizations/${ORG}/energyCredits`]: { generatingUnits: { 'ug-2': { id: 'ug-2', name: 'UG Org' } } },
});
const orgHandler = _createHandler({ getDatabase: () => orgDb, verifyToken });
const snapOrg = await call(orgHandler, { sessionToken: makeToken(UID), operation: 'snapshot', organizationId: ORG });
assert('ORG: snapshot org → 200', snapOrg.statusCode === 200);
assert("ORG: dataSource = 'organization'", snapOrg.json.dataSource === 'organization');
assert('ORG: migrationRequired = false (org tem dados)', snapOrg.json.migrationRequired === false);
assert('ORG: dados vêm de organizations/', snapOrg.json.data.generatingUnits.length === 1 && snapOrg.json.data.generatingUnits[0].name === 'UG Org');

// Org mode snapshot — org vazia → fallback para legacy
const fallbackDb = makeMockDb({
  [`users/${UID}/memberships/${ORG}`]: { organizationId: ORG, uid: UID, role: 'owner', status: 'active' },
  [`organizations/${ORG}/energyCredits`]: null,
  [`users/${UID}/energyCredits`]: { generatingUnits: { 'ug-3': { id: 'ug-3', name: 'UG Legacy' } } },
});
const fallbackHandler = _createHandler({ getDatabase: () => fallbackDb, verifyToken });
const snapFallback = await call(fallbackHandler, { sessionToken: makeToken(UID), operation: 'snapshot', organizationId: ORG });
assert('FALLBACK: snapshot → 200', snapFallback.statusCode === 200);
assert("FALLBACK: dataSource = 'legacy-single-user'", snapFallback.json.dataSource === 'legacy-single-user');
assert('FALLBACK: migrationRequired = true', snapFallback.json.migrationRequired === true);
assert('FALLBACK: dados vêm de users/{uid}/', snapFallback.json.data.generatingUnits.length === 1 && snapFallback.json.data.generatingUnits[0].name === 'UG Legacy');

// ── Suite 5: energy-credits-data.js — permissões org mode ────────────────────

console.log('\nSuite 5 — energy-credits-data.js: permissões por operação no org mode');

// Membership ausente → 403
const noMemberDb = makeMockDb({});
const noMemberHandler = _createHandler({ getDatabase: () => noMemberDb, verifyToken });
const r403 = await call(noMemberHandler, { sessionToken: makeToken(UID), operation: 'snapshot', organizationId: ORG });
assert('ORG: sem membership → 403', r403.statusCode === 403);
assert("ORG: code = 'organization_invalid'", r403.json.code === 'organization_invalid');

// Role viewer não pode criar
const viewerDb = makeMockDb({
  [`users/${UID}/memberships/${ORG}`]: { organizationId: ORG, uid: UID, role: 'viewer', status: 'active' },
});
const viewerHandler = _createHandler({ getDatabase: () => viewerDb, verifyToken });
const rNoCreate = await call(viewerHandler, {
  sessionToken: makeToken(UID), operation: 'set', organizationId: ORG, path: 'energyCredits/generatingUnits/ug-1',
  value: { id: 'ug-1', name: 'Teste' }, expectedVersion: 0,
});
assert('ORG: viewer sem permissão de criar → 403', rNoCreate.statusCode === 403);
assert("ORG: code = 'no_permission'", rNoCreate.json.code === 'no_permission');

// Owner pode ler
const ownerReadDb = makeMockDb({
  [`users/${UID}/memberships/${ORG}`]: { organizationId: ORG, uid: UID, role: 'owner', status: 'active' },
  [`organizations/${ORG}/energyCredits`]: null,
  [`users/${UID}/energyCredits`]: null,
});
const ownerHandler = _createHandler({ getDatabase: () => ownerReadDb, verifyToken });
const rOk = await call(ownerHandler, { sessionToken: makeToken(UID), operation: 'snapshot', organizationId: ORG });
assert('ORG: owner pode ler (snapshot) → 200', rOk.statusCode === 200);

assert('ORG: body.role não é aceito (permissões calculadas do membership)', ecDataSrc.includes('orgRole = membership.role') && !ecDataSrc.includes('body.role'));

// ── Suite 6: energy-credits-data.js — versionamento otimista ─────────────────

console.log('\nSuite 6 — energy-credits-data.js: versionamento otimista no org mode');

// Create (expectedVersion = 0) → versão = 1
const createDb = makeMockDb({
  [`users/${UID}/memberships/${ORG}`]: { organizationId: ORG, uid: UID, role: 'owner', status: 'active' },
});
const createHandler = _createHandler({ getDatabase: () => createDb, verifyToken });
const rCreate = await call(createHandler, {
  sessionToken: makeToken(UID), operation: 'set', organizationId: ORG,
  path: 'energyCredits/generatingUnits/ug-versioned',
  value: { id: 'ug-versioned', name: 'UG Versioned' }, expectedVersion: 0,
  requestId: 'req-create-001',
});
assert('ORG create → 200', rCreate.statusCode === 200);
assert('ORG create → version = 1', rCreate.json.version === 1);
const stored = createDb.store[`organizations/${ORG}/energyCredits/generatingUnits/ug-versioned`] as Record<string, unknown>;
assert('ORG create: entity.version = 1 no RTDB', stored?.version === 1);
assert('ORG create: entity.updatedBy = uid', stored?.updatedBy === UID);

// Idempotência: segundo request com mesmo requestId → 200
const rIdem = await call(createHandler, {
  sessionToken: makeToken(UID), operation: 'set', organizationId: ORG,
  path: 'energyCredits/generatingUnits/ug-versioned',
  value: { id: 'ug-versioned', name: 'UG Versioned Dup' }, expectedVersion: 0,
  requestId: 'req-create-001',
});
assert('ORG idempotência: mesmo requestId → 200', rIdem.statusCode === 200);
assert('ORG idempotência: idempotent=true na resposta', rIdem.json.idempotent === true);

// Conflict: tentar criar item que já existe (sem idempotência)
const rConflict = await call(createHandler, {
  sessionToken: makeToken(UID), operation: 'set', organizationId: ORG,
  path: 'energyCredits/generatingUnits/ug-versioned',
  value: { id: 'ug-versioned', name: 'UG Dup' }, expectedVersion: 0,
  requestId: 'req-create-002',
});
assert('ORG create conflito → 409', rConflict.statusCode === 409);
assert("ORG create conflito: code = 'version_conflict'", rConflict.json.code === 'version_conflict');

// Update (expectedVersion = 1) → versão = 2
const rUpdate = await call(createHandler, {
  sessionToken: makeToken(UID), operation: 'set', organizationId: ORG,
  path: 'energyCredits/generatingUnits/ug-versioned',
  value: { id: 'ug-versioned', name: 'UG Updated' }, expectedVersion: 1,
  requestId: 'req-update-001',
});
assert('ORG update → 200', rUpdate.statusCode === 200);
assert('ORG update → version = 2', rUpdate.json.version === 2);

// Update com versão errada → 409
const rUpdateWrong = await call(createHandler, {
  sessionToken: makeToken(UID), operation: 'set', organizationId: ORG,
  path: 'energyCredits/generatingUnits/ug-versioned',
  value: { id: 'ug-versioned', name: 'UG Bad' }, expectedVersion: 1, // atual é 2
  requestId: 'req-update-002',
});
assert('ORG update versão errada → 409', rUpdateWrong.statusCode === 409);
assert('ORG update conflito inclui currentVersion', typeof rUpdateWrong.json.currentVersion === 'number');

// ── Suite 7: httpFirebaseClient.ts — estrutura ────────────────────────────────

console.log('\nSuite 7 — httpFirebaseClient.ts: setVersioned e org context');

assert('setVersioned exportado na interface', httpClientSrc.includes('setVersioned'));
assert('VersionConflictException exportada', httpClientSrc.includes('export class VersionConflictException'));
assert('orgContext baked no factory', httpClientSrc.includes('orgContext?.tenancyMode'));
assert('org mode inclui organizationId no body', httpClientSrc.includes("organizationId: orgContext.organizationId"));
assert('setVersioned lança VersionConflictException em 409', httpClientSrc.includes('response.status === 409'));
assert('loadEnergyCreditsSnapshot retorna SnapshotResult', httpClientSrc.includes('SnapshotResult'));
assert('loadEnergyCreditsSnapshot aceita orgContext', httpClientSrc.includes('orgContext?: OrganizationContext | null'));
assert('single-user NÃO inclui organizationId (evita quebrar backward compat)',
  httpClientSrc.includes("tenancyMode === 'organization'") && httpClientSrc.includes('? {'));

// ── Suite 8: persistentUiProvider.ts — org mode ──────────────────────────────

console.log('\nSuite 8 — persistentUiProvider.ts: escrita org mode com versionamento');

assert('aceita orgContext como parâmetro', persistProvSrc.includes('orgContext?: OrganizationContext | null'));
assert('aceita httpClient como parâmetro', persistProvSrc.includes('httpClient?: HttpFirebaseClient | null'));
assert('usa setVersioned para creates em org mode', persistProvSrc.includes('httpClient.setVersioned'));
assert('version=0 para creates (org mode)', persistProvSrc.includes(', 0, clientRequestId'));
assert('usa existingVersion para updates (org mode)', persistProvSrc.includes('existingVersion'));
assert('trata VersionConflictException', persistProvSrc.includes('VersionConflictException'));
assert('retorna VERSION_CONFLICT para o caller', persistProvSrc.includes("'VERSION_CONFLICT'"));
assert('entidade ganha version após org write', persistProvSrc.includes('entityWithVersion') || persistProvSrc.includes('updatedWithVersion'));
assert('updatedAt em updates (backward compat CC3)', persistProvSrc.includes('updatedAt: new Date().toISOString()'));
assert('audit log best-effort (.catch()', persistProvSrc.match(/\.catch\(\s*\(\)\s*=>\s*\{\s*\}/) !== null);
assert('single-user path preservado (sem org mode)', persistProvSrc.includes("// Modo single-user — inalterado") || persistProvSrc.includes('// single-user'));

// ── Suite 9: standaloneProviderBootstrap.ts — propagação de org context ───────

console.log('\nSuite 9 — standaloneProviderBootstrap.ts: propagação Gate 8B');

assert('passa orgContext para createHttpFirebaseClient',
  bootstrapSrc.includes('createHttpFirebaseClient(sessionToken, orgContext)'));
assert('passa orgContext para loadEnergyCreditsSnapshot',
  bootstrapSrc.includes('loadEnergyCreditsSnapshot(sessionToken, orgContext)'));
assert('usa snapshotResult.data como snapshot',
  bootstrapSrc.includes('snapshotResult.data') || bootstrapSrc.includes('snapshotResult'));
assert('passa orgContext para createPersistentUiProvider',
  bootstrapSrc.includes('orgContext, httpClient'));
assert('bootstrap NÃO hardcoda path organizations/',
  !bootstrapSrc.includes('"organizations/') && !bootstrapSrc.includes("'organizations/"));

// ── Suite 10: organization-context.js — nomes das orgs ───────────────────────

console.log('\nSuite 10 — organization-context.js: availableOrganizations com nomes');

assert('carrega nomes via Promise.all', orgCtxSrc.includes('Promise.all'));
assert('carrega org data de organizations/{orgId}', orgCtxSrc.includes('`organizations/${m.organizationId}`'));
assert("single-user retorna availableOrganizations: []", orgCtxSrc.includes('availableOrganizations: []'));
assert('nome carregado do field name', orgCtxSrc.includes("orgData?.name"));
assert('name: fallback para string vazia', orgCtxSrc.includes("''"));

// ── Suite 11: energy-credits-v2.html — mensagens de erro Gate 8B ──────────────

console.log('\nSuite 11 — energy-credits-v2.html: mensagens de erro organizacionais');

assert("HTML inclui mensagem version_conflict",
  htmlSrc.includes('version_conflict') && htmlSrc.includes('Conflito de versão'));
assert("HTML inclui mensagem no_permission",
  htmlSrc.includes('no_permission') && htmlSrc.includes('permissão'));
assert("HTML inclui mensagem organization_invalid",
  htmlSrc.includes('organization_invalid') && htmlSrc.includes('Organização inválida'));

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Gate 8B dual-read: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
