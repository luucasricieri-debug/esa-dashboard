'use strict';
/**
 * ESA OS — Diagnóstico organization-context em produção
 *
 * Produção confirmava dados válidos no Firebase RTDB real (membership owner/active,
 * organização ESA ativa) mas a Function continuava retornando tenancyMode single-user
 * mesmo após DATABASE_URL ter sido adicionada no Netlify.
 *
 * Causa mais provável encontrada por auditoria de código: netlify/functions/_shared/firebase-admin.js
 * tinha DATABASE_URL HARDCODED, ignorando totalmente o env var DATABASE_URL — adicioná-lo no
 * Netlify não tinha nenhum efeito. Corrigido para `process.env.DATABASE_URL || DEFAULT`.
 *
 * Este arquivo testa, com execução real (não apenas checagem de string no source):
 *   - resolveDatabaseUrl()/getDatabaseHost()/getProjectId() do firebase-admin.js
 *   - getFirebaseAdminApp(): inicializa com DATABASE_URL correta; não reutiliza app
 *     incompatível (databaseURL diferente) já presente no processo
 *   - classifyMembership() do organization-context.js: fallback organizationId -> key,
 *     invalid_shape, missing_organization_id, membership_inactive
 *   - loadMembershipsWithDiagnostics()/enrichMembershipsWithOrganizations() contra um
 *     db RTDB fake (mesma interface .ref(path).once('value') -> {val(), exists()}) —
 *     cobre snapshot null, organização inexistente, organização inativa, owner
 *     retornando organization mode, availableOrganizations contendo ESA
 *   - diagnosticsEnabled(): desligado por padrão; ligado só com a env var exata
 *
 * Rodar: npx tsx tests/organization-context-diagnostics.manual-test.ts
 */

import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const NF   = path.join(ROOT, 'netlify/functions');
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const orgCtxSrc = fs.readFileSync(path.join(NF, 'organization-context.js'), 'utf8');
const fbAdminSrc = fs.readFileSync(path.join(NF, '_shared/firebase-admin.js'), 'utf8');

// ── Fake RTDB — mesma interface usada pelo código: db.ref(path).once('value') ──

type FakeNode = Record<string, unknown> | null;

function makeFakeDb(tree: Record<string, FakeNode>) {
  return {
    ref(path: string) {
      return {
        async once(_event: string) {
          const val = Object.prototype.hasOwnProperty.call(tree, path) ? tree[path] : null;
          return { val: () => val, exists: () => val !== null && val !== undefined };
        },
      };
    },
  };
}

function genFakeServiceAccount(projectId: string) {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  return JSON.stringify({
    project_id: projectId,
    client_email: `test@${projectId}.iam.gserviceaccount.com`,
    private_key: privateKey,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite DX1 — firebase-admin.js: DATABASE_URL passa a ser lida do ambiente
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite DX1 — firebase-admin.js usa process.env.DATABASE_URL (não mais hardcoded)');

assert('DX01 DATABASE_URL não está mais hardcoded sem fallback para env var',
  fbAdminSrc.includes('process.env.DATABASE_URL'));
assert('DX02 resolveDatabaseUrl() exportada',
  fbAdminSrc.includes('function resolveDatabaseUrl') && fbAdminSrc.includes('resolveDatabaseUrl,'));
assert('DX03 getFirebaseAdminApp() exportada (helper determinístico pedido)',
  fbAdminSrc.includes('function getFirebaseAdminApp') && fbAdminSrc.includes('getFirebaseAdminApp,'));
assert('DX04 getProjectId() exportada — lê project_id do service account sem expor private_key',
  fbAdminSrc.includes('function getProjectId') && !fbAdminSrc.includes('.private_key)'));
assert('DX05 getDatabaseHost() exportada',
  fbAdminSrc.includes('function getDatabaseHost'));
assert('DX06 App existente com databaseURL incompatível não é silenciosamente reutilizado',
  fbAdminSrc.includes('databaseURL incompatível') || fbAdminSrc.includes('databaseURL diferente') || fbAdminSrc.includes('existingUrl === databaseURL'));
assert('DX07 Nenhum log de private_key completo',
  !fbAdminSrc.includes('console.log(serviceAccount)') && !fbAdminSrc.includes('console.info(serviceAccount)'));

// ═══════════════════════════════════════════════════════════════════════════
// Suite DX2 — firebase-admin.js: execução real de resolveDatabaseUrl/getProjectId/getDatabaseHost
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite DX2 — Execução real: env var DATABASE_URL tem precedência sobre o hardcoded');

{
  const savedDbUrl = process.env.DATABASE_URL;
  const savedSaJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete require.cache[require.resolve(path.join(NF, '_shared/firebase-admin.js'))];

  delete process.env.DATABASE_URL;
  const fbAdminNoEnv = require(path.join(NF, '_shared/firebase-admin.js'));
  assert('DX08 Sem DATABASE_URL no ambiente: cai no fallback hardcoded (agenda-executiva-esa)',
    fbAdminNoEnv.resolveDatabaseUrl().includes('agenda-executiva-esa'));

  process.env.DATABASE_URL = 'https://producao-real-esa-default-rtdb.firebaseio.com';
  delete require.cache[require.resolve(path.join(NF, '_shared/firebase-admin.js'))];
  const fbAdminWithEnv = require(path.join(NF, '_shared/firebase-admin.js'));
  assert('DX09 Com DATABASE_URL no ambiente: resolveDatabaseUrl() usa o valor do env var, não o hardcoded',
    fbAdminWithEnv.resolveDatabaseUrl() === 'https://producao-real-esa-default-rtdb.firebaseio.com');
  assert('DX10 getDatabaseHost() reflete o host do DATABASE_URL do ambiente',
    fbAdminWithEnv.getDatabaseHost() === 'producao-real-esa-default-rtdb.firebaseio.com');

  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = genFakeServiceAccount('esa-producao-real');
  assert('DX11 getProjectId() lê project_id do FIREBASE_SERVICE_ACCOUNT_JSON sem expor a chave privada',
    fbAdminWithEnv.getProjectId() === 'esa-producao-real');

  // restore
  if (savedDbUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedDbUrl;
  if (savedSaJson === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON; else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = savedSaJson;
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite DX3 — getFirebaseAdminApp(): inicializa com DATABASE_URL correta;
//             não reutiliza app incompatível já presente no processo
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite DX3 — getFirebaseAdminApp(): init correto e rejeição de app incompatível (execução real)');

{
  const admin = require('firebase-admin');
  const savedDbUrl = process.env.DATABASE_URL;
  const savedSaJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    // Cenário A: nenhum app [DEFAULT] existente -> inicializa com a DATABASE_URL correta.
    for (const app of [...admin.apps]) { if (app && app.name === '[DEFAULT]') { try { (app as any).delete(); } catch {} } }
    process.env.DATABASE_URL = 'https://correta-rtdb.firebaseio.com';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = genFakeServiceAccount('esa-correto');
    delete require.cache[require.resolve(path.join(NF, '_shared/firebase-admin.js'))];
    const fbAdminA = require(path.join(NF, '_shared/firebase-admin.js'));
    const appA = fbAdminA.getFirebaseAdminApp();
    assert('DX12 getFirebaseAdminApp(): inicializa app com a DATABASE_URL do ambiente (não o hardcoded)',
      appA.options.databaseURL === 'https://correta-rtdb.firebaseio.com');

    const appA2 = fbAdminA.getFirebaseAdminApp();
    assert('DX13 Segunda chamada no mesmo processo reaproveita o mesmo app (não reinicializa)',
      appA2 === appA);

    // Cenário B: um app [DEFAULT] já existe com uma databaseURL DIFERENTE (simula container
    // que inicializou antes de DATABASE_URL estar configurada) -> não deve ser reutilizado
    // silenciosamente; deve lançar erro explícito em vez de servir dados da instância errada.
    process.env.DATABASE_URL = 'https://nova-rtdb-esperada.firebaseio.com';
    delete require.cache[require.resolve(path.join(NF, '_shared/firebase-admin.js'))];
    const fbAdminB = require(path.join(NF, '_shared/firebase-admin.js'));
    let threw = false;
    let threwMessage = '';
    try {
      fbAdminB.getFirebaseAdminApp();
    } catch (e) {
      threw = true;
      threwMessage = (e as Error).message;
    }
    assert('DX14 App [DEFAULT] existente com databaseURL diferente da esperada: getFirebaseAdminApp() lança erro em vez de reutilizar silenciosamente',
      threw);
    assert('DX15 Mensagem de erro não expõe segredos (sem private_key/token)',
      !/private_key|BEGIN RSA|Bearer /.test(threwMessage));
  } finally {
    for (const app of [...admin.apps]) { if (app && app.name === '[DEFAULT]') { try { (app as any).delete(); } catch {} } }
    if (savedDbUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedDbUrl;
    if (savedSaJson === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON; else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = savedSaJson;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite DX4 — organization-context.js: classifyMembership() (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite DX4 — classifyMembership(): execução real por cenário');

{
  const orgCtx = require(path.join(NF, 'organization-context.js'));

  const withOrgId = orgCtx.classifyMembership('someKey', { organizationId: 'org-explicit', role: 'owner', status: 'active' });
  assert('DX16 membership com organizationId no valor: usa o valor, não a key', withOrgId.organizationId === 'org-explicit' && withOrgId.reason === null);

  const withoutOrgId = orgCtx.classifyMembership('1fda2931-8d9e-4a68-8fc5-3fd49d8367b1', { role: 'owner', status: 'active' });
  assert('DX17 membership SEM organizationId no valor: usa child.key como fallback',
    withoutOrgId.organizationId === '1fda2931-8d9e-4a68-8fc5-3fd49d8367b1' && withoutOrgId.reason === null);

  const inactive = orgCtx.classifyMembership('org-x', { organizationId: 'org-x', role: 'owner', status: 'suspended' });
  assert('DX18 membership inativo (status !== active): descartado com reason=membership_inactive', inactive.reason === 'membership_inactive');

  const invalidShape = orgCtx.classifyMembership('org-y', 'not-an-object');
  assert('DX19 membership com shape inválido (não-objeto): descartado com reason=invalid_shape', invalidShape.reason === 'invalid_shape');

  const nullShape = orgCtx.classifyMembership('org-z', null);
  assert('DX20 membership null: descartado com reason=invalid_shape', nullShape.reason === 'invalid_shape');
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite DX5 — loadMembershipsWithDiagnostics() + enrichMembershipsWithOrganizations()
//             contra um RTDB fake (execução real, sem Firebase de verdade)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite DX5 — Fluxo completo contra RTDB fake: snapshot null, org inexistente/inativa, owner ESA');

{
  const orgCtx = require(path.join(NF, 'organization-context.js'));

  // Cenário: memberships snapshot null (path não existe) -> raw=0, normalized=0.
  const dbEmpty = makeFakeDb({ 'users/uid-empty/memberships': null });
  (async () => {
    const diag: Record<string, unknown> = {};
    const result = await orgCtx.loadMembershipsWithDiagnostics(dbEmpty, 'uid-empty', diag);
    assert('DX21 memberships snapshot null: userMembershipsSnapshotExists === false', diag.userMembershipsSnapshotExists === false);
    assert('DX22 memberships snapshot null: rawMembershipCount === 0', diag.rawMembershipCount === 0);
    assert('DX23 memberships snapshot null: normalizedMembershipCount === 0', diag.normalizedMembershipCount === 0);
    assert('DX24 memberships snapshot null: retorna array vazio', Array.isArray(result) && result.length === 0);

    // Cenário owner ESA: membership real confirmado pelo incidente de produção.
    const uid = 'lucas_vizentin';
    const orgId = '1fda2931-8d9e-4a68-8fc5-3fd49d8367b1';
    const dbOwner = makeFakeDb({
      [`users/${uid}/memberships`]: {
        [orgId]: { role: 'owner', status: 'active' }, // sem organizationId no valor — usa key
      },
      [`organizations/${orgId}`]: { name: 'ESA', status: 'active' },
      [`organizations/${orgId}/members/${uid}`]: { role: 'owner' },
    });
    const diagOwner: Record<string, unknown> = {};
    const normalized = await orgCtx.loadMembershipsWithDiagnostics(dbOwner, uid, diagOwner);
    assert('DX25 owner ESA: rawMembershipCount === 1', diagOwner.rawMembershipCount === 1);
    assert('DX26 owner ESA: normalizedMembershipCount === 1 (fallback organizationId=key funcionou)', diagOwner.normalizedMembershipCount === 1);
    assert('DX27 owner ESA: normalized[0].organizationId === orgId', normalized[0]?.organizationId === orgId);

    const enriched = await orgCtx.enrichMembershipsWithOrganizations(dbOwner, uid, normalized, diagOwner);
    assert('DX28 owner ESA: activeMembershipCount === 1 (organização existe e está ativa)', diagOwner.activeMembershipCount === 1);
    assert('DX29 owner ESA: enriched[0].orgData.name === "ESA"', enriched[0]?.orgData?.name === 'ESA');
    assert('DX30 owner ESA: enriched[0].reason === null (nada descartado)', enriched[0]?.reason === null);
    const availableOrganizations = enriched.map((r: any) => ({ id: r.membership.organizationId, name: r.orgData?.name || '', role: r.membership.role }));
    assert('DX31 availableOrganizations contém ESA', availableOrganizations.some((o: any) => o.name === 'ESA' && o.id === orgId));

    // Cenário: organização inexistente.
    const dbOrgMissing = makeFakeDb({
      'users/uid-x/memberships': { 'org-missing': { role: 'owner', status: 'active' } },
      'organizations/org-missing': null,
    });
    const diagMissing: Record<string, unknown> = {};
    const normMissing = await orgCtx.loadMembershipsWithDiagnostics(dbOrgMissing, 'uid-x', diagMissing);
    const enrichedMissing = await orgCtx.enrichMembershipsWithOrganizations(dbOrgMissing, 'uid-x', normMissing, diagMissing);
    assert('DX32 organização inexistente: reason=organization_not_found', enrichedMissing[0]?.reason === 'organization_not_found');
    assert('DX33 organização inexistente: activeMembershipCount === 0', diagMissing.activeMembershipCount === 0);

    // Cenário: organização inativa.
    const dbOrgInactive = makeFakeDb({
      'users/uid-y/memberships': { 'org-inactive': { role: 'admin', status: 'active' } },
      'organizations/org-inactive': { name: 'Inativa Ltda', status: 'suspended' },
    });
    const diagInactive: Record<string, unknown> = {};
    const normInactive = await orgCtx.loadMembershipsWithDiagnostics(dbOrgInactive, 'uid-y', diagInactive);
    const enrichedInactive = await orgCtx.enrichMembershipsWithOrganizations(dbOrgInactive, 'uid-y', normInactive, diagInactive);
    assert('DX34 organização inativa: reason=organization_inactive', enrichedInactive[0]?.reason === 'organization_inactive');
    assert('DX35 organização inativa: activeMembershipCount === 0', diagInactive.activeMembershipCount === 0);

    // Cenário: dual-path inconsistency (membership existe, cross-reference reverso não existe) —
    // não deve virar fallback silencioso; reason continua null (autorização não muda).
    const dbDualPath = makeFakeDb({
      'users/uid-z/memberships': { 'org-dual': { role: 'manager', status: 'active' } },
      'organizations/org-dual': { name: 'Dual Path Co', status: 'active' },
      'organizations/org-dual/members/uid-z': null, // reverse path ausente
    });
    const diagDual: Record<string, unknown> = {};
    const normDual = await orgCtx.loadMembershipsWithDiagnostics(dbDualPath, 'uid-z', diagDual);
    const enrichedDual = await orgCtx.enrichMembershipsWithOrganizations(dbDualPath, 'uid-z', normDual, diagDual);
    assert('DX36 dual-path: reverseExists === false detectado', enrichedDual[0]?.reverseExists === false);
    assert('DX37 dual-path: NÃO vira fallback silencioso — reason continua null, membership autorizado normalmente', enrichedDual[0]?.reason === null);
  })().then(() => {
    // ═══════════════════════════════════════════════════════════════════════════
    // Suite DX6 — diagnosticsEnabled() / maskUid / maskKey (execução real)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\nSuite DX6 — diagnosticsEnabled() desligado por padrão; máscaras de PII');

    const orgCtx2 = require(path.join(NF, 'organization-context.js'));
    const savedFlag = process.env.ORGANIZATION_CONTEXT_DIAGNOSTICS;

    delete process.env.ORGANIZATION_CONTEXT_DIAGNOSTICS;
    assert('DX38 diagnosticsEnabled() === false por padrão (env var ausente)', orgCtx2.diagnosticsEnabled() === false);

    process.env.ORGANIZATION_CONTEXT_DIAGNOSTICS = 'false';
    assert('DX39 diagnosticsEnabled() === false com valor "false" explícito', orgCtx2.diagnosticsEnabled() === false);

    process.env.ORGANIZATION_CONTEXT_DIAGNOSTICS = 'true';
    assert('DX40 diagnosticsEnabled() === true somente com valor exato "true"', orgCtx2.diagnosticsEnabled() === true);

    if (savedFlag === undefined) delete process.env.ORGANIZATION_CONTEXT_DIAGNOSTICS; else process.env.ORGANIZATION_CONTEXT_DIAGNOSTICS = savedFlag;

    assert('DX41 maskUid: uid longo mascarado no meio (não exposto por completo)',
      orgCtx2.maskUid('lucas_vizentin') === 'lu***in' && !orgCtx2.maskUid('lucas_vizentin').includes('lucas_vizentin'));
    assert('DX42 maskKey: chave longa (UUID) truncada com reticências',
      orgCtx2.maskKey('1fda2931-8d9e-4a68-8fc5-3fd49d8367b1').endsWith('…') &&
      !orgCtx2.maskKey('1fda2931-8d9e-4a68-8fc5-3fd49d8367b1').includes('3fd49d8367b1'));

    // ── Suite DX7 — diagnostics no response só com a env var ativa; nunca contém segredos ──
    console.log('\nSuite DX7 — Response diagnostics: campo correto, sem PII/segredos, condicional');

    assert('DX43 diagnostics no response só quando ORGANIZATION_CONTEXT_DIAGNOSTICS === "true"',
      orgCtxSrc.includes("diagnosticsEnabled()") && orgCtxSrc.includes("ORGANIZATION_CONTEXT_DIAGNOSTICS"));
    assert('DX44 diagnostics inclui projectId', orgCtxSrc.includes('projectId: diag.serviceAccountProjectId'));
    assert('DX45 diagnostics inclui databaseHost', orgCtxSrc.includes('databaseHost: diag.databaseHost'));
    assert('DX46 diagnostics inclui userMembershipsExists', orgCtxSrc.includes('userMembershipsExists: diag.userMembershipsSnapshotExists'));
    assert('DX47 diagnostics inclui rawMembershipCount', orgCtxSrc.includes('rawMembershipCount: diag.rawMembershipCount'));
    assert('DX48 diagnostics inclui normalizedMembershipCount', orgCtxSrc.includes('normalizedMembershipCount: diag.normalizedMembershipCount'));
    assert('DX49 diagnostics inclui activeMembershipCount', orgCtxSrc.includes('activeMembershipCount: diag.activeMembershipCount'));
    assert('DX50 diagnostics é anexado também no caminho single-user (o caso do incidente relatado)',
      /activeMembershipCount = 0;[\s\S]{0,400}diagnosticsEnabled\(\)/.test(orgCtxSrc));
    assert('DX51 código nunca loga rawToken/token completo', !/console\.(log|info|warn)\([^)]*rawToken/.test(orgCtxSrc));
    assert('DX52 código nunca loga o body completo do request', !/console\.(log|info|warn)\([^)]*event\.body/.test(orgCtxSrc));
    assert('DX53 requestId gerado por invocação (crypto.randomUUID ou fallback)', orgCtxSrc.includes('newRequestId()'));
    assert('DX54 uid sempre mascarado nos logs (maskUid), nunca em texto puro', /logDiagnostics\(requestId, \{ \.\.\.diag, uid: maskUid\(uid\)/.test(orgCtxSrc));

    // ── Relatório ─────────────────────────────────────────────────────────────
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Organization Context Diagnostics Tests: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));
    if (failed > 0) process.exit(1);
  });
}
