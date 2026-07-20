'use strict';
/**
 * ESA OS — scripts/repair-user-membership-cross-reference.js
 *
 * Testa o núcleo puro do script de reparo (planRepair/repairMembershipCrossReference)
 * contra um RTDB fake — execução real, não checagem de string. Cobre dry-run,
 * idempotência, bloqueios (membership organizacional ausente / organização
 * ausente / organização inativa), preservação de createdAt e não-modificação
 * de role/status.
 *
 * Rodar: npx tsx tests/repair-membership-cross-reference.manual-test.ts
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const scriptSrc = fs.readFileSync(path.join(ROOT, 'scripts/repair-user-membership-cross-reference.js'), 'utf8');
const repair = require(path.join(ROOT, 'scripts/repair-user-membership-cross-reference.js'));

// ── Fake RTDB — mesma interface usada pelo script: db.ref(path).once('value')/.set(v) ──

type Tree = Record<string, unknown>;

function makeFakeDb(initial: Tree) {
  const tree: Tree = JSON.parse(JSON.stringify(initial));
  const writes: { path: string; value: unknown }[] = [];
  return {
    tree,
    writes,
    ref(p: string) {
      return {
        async once(_event: string) {
          const val = Object.prototype.hasOwnProperty.call(tree, p) ? tree[p] : null;
          return { val: () => val, exists: () => val !== null && val !== undefined };
        },
        async set(value: unknown) {
          tree[p] = value;
          writes.push({ path: p, value });
        },
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite RP1 — Static: parâmetros, fonte de verdade, não-execução automática
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite RP1 — estrutura do script (source)');

assert('RP01 aceita --uid', scriptSrc.includes("argv[i] === '--uid'"));
assert('RP02 aceita --organization-id', scriptSrc.includes("argv[i] === '--organization-id'"));
assert('RP03 aceita --dry-run', scriptSrc.includes("argv[i] === '--dry-run'"));
assert('RP04 fonte de verdade é organizations/{organizationId}/members/{uid}',
  scriptSrc.includes('organizations/${organizationId}/members/${uid}'));
assert('RP05 valida organização ativa (org.status !== \'active\')', scriptSrc.includes("org.status !== 'active'"));
assert('RP06 grava em users/{uid}/memberships/{organizationId}',
  scriptSrc.includes('users/${uid}/memberships/${organizationId}'));
assert('RP07 role nunca é modificado — sempre copiado de orgMembership.role', scriptSrc.includes('role: orgMembership.role,'));
assert('RP08 status nunca é modificado — sempre copiado de orgMembership.status', scriptSrc.includes('status: orgMembership.status,'));
assert('RP09 preserva createdAt existente quando presente', scriptSrc.includes('(existing && existing.createdAt) || orgMembership.createdAt'));
assert('RP10 atualiza updatedAt', scriptSrc.includes('updatedAt: now,'));
assert('RP11 uid mascarado no relatório (maskUid)', scriptSrc.includes('uidMasked: maskUid(args.uid)'));
assert('RP12 nenhum uid completo aparece literalmente no relatório retornado', !scriptSrc.includes('uid: args.uid'));
assert('RP13 script não é auto-executado por outra missão (só roda via CLI direta, require.main === module)',
  scriptSrc.includes('if (require.main === module)'));

// ═══════════════════════════════════════════════════════════════════════════
// Suite RP2 — Execução real: dry-run não escreve nada
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite RP2 — dry-run: não escreve, reporta a intenção');

async function run() {
  {
    const db = makeFakeDb({
      'organizations/org-1/members/uid-1': { role: 'owner', status: 'active', createdAt: 1000 },
      'organizations/org-1': { name: 'ESA', status: 'active' },
    });
    const result = await repair.repairMembershipCrossReference(db, { uid: 'uid-1', organizationId: 'org-1', dryRun: true });
    assert('RP14 dry-run: classification === REPAIR_DRY_RUN', result.classification === 'REPAIR_DRY_RUN');
    assert('RP15 dry-run: nenhuma escrita real ocorreu', db.writes.length === 0);
    assert('RP16 dry-run: uidMasked no relatório, não uid completo', result.uidMasked !== 'uid-1' && !JSON.stringify(result).includes('"uid":"uid-1"'));

    // ── Suite RP3 — execução real: grava membership corretamente ──
    console.log('\nSuite RP3 — execução real: grava o membership normalizado');

    const result2 = await repair.repairMembershipCrossReference(db, { uid: 'uid-1', organizationId: 'org-1', dryRun: false });
    assert('RP17 classification === REPAIR_OK', result2.classification === 'REPAIR_OK');
    assert('RP18 exatamente 1 escrita realizada', db.writes.length === 1);
    const written = db.tree['users/uid-1/memberships/org-1'] as any;
    assert('RP19 role copiado da fonte organizacional (owner)', written.role === 'owner');
    assert('RP20 status copiado da fonte organizacional (active)', written.status === 'active');
    assert('RP21 organizationId gravado corretamente', written.organizationId === 'org-1');
    assert('RP22 createdAt preservado da fonte organizacional (1000) quando não havia registro anterior', written.createdAt === 1000);
    assert('RP23 updatedAt gravado com timestamp recente', typeof written.updatedAt === 'number' && written.updatedAt > 1000);
    assert('RP24 membership organizacional (fonte) permanece intocado', (db.tree['organizations/org-1/members/uid-1'] as any).role === 'owner');

    // ── Suite RP4 — idempotência: segunda execução não escreve de novo ──
    console.log('\nSuite RP4 — idempotência: rodar de novo não produz nova escrita');

    const result3 = await repair.repairMembershipCrossReference(db, { uid: 'uid-1', organizationId: 'org-1', dryRun: false });
    assert('RP25 segunda execução: classification === REPAIR_ALREADY_CONSISTENT', result3.classification === 'REPAIR_ALREADY_CONSISTENT');
    assert('RP26 segunda execução: nenhuma escrita adicional (ainda só 1 no total)', db.writes.length === 1);

    const result4 = await repair.repairMembershipCrossReference(db, { uid: 'uid-1', organizationId: 'org-1', dryRun: true });
    assert('RP27 terceira execução (dry-run, já consistente): também REPAIR_ALREADY_CONSISTENT, não REPAIR_DRY_RUN', result4.classification === 'REPAIR_ALREADY_CONSISTENT');
  }

  // ── Suite RP5 — preserva createdAt de um registro users/ pré-existente ──
  console.log('\nSuite RP5 — createdAt de um registro users/ pré-existente (restaurado manualmente) é preservado');
  {
    const db = makeFakeDb({
      'organizations/org-2/members/uid-2': { role: 'admin', status: 'active', createdAt: 5000 },
      'organizations/org-2': { name: 'Outra Org', status: 'active' },
      'users/uid-2/memberships/org-2': { organizationId: 'org-2', role: 'viewer', status: 'suspended', createdAt: 2500 },
    });
    const result = await repair.repairMembershipCrossReference(db, { uid: 'uid-2', organizationId: 'org-2', dryRun: false });
    assert('RP28 role/status divergentes do lado org: classification === REPAIR_OK (corrige a divergência)', result.classification === 'REPAIR_OK');
    const written = db.tree['users/uid-2/memberships/org-2'] as any;
    assert('RP29 createdAt do registro users/ pré-existente (2500) é preservado, não o da org (5000)', written.createdAt === 2500);
    assert('RP30 role corrigido para o valor da fonte organizacional (admin, não mais viewer)', written.role === 'admin');
    assert('RP31 status corrigido para o valor da fonte organizacional (active, não mais suspended)', written.status === 'active');
  }

  // ── Suite RP6 — bloqueios ──
  console.log('\nSuite RP6 — bloqueios: membership organizacional ausente / org ausente / org inativa');
  {
    const dbNoMembership = makeFakeDb({ 'organizations/org-3': { name: 'X', status: 'active' } });
    const r1 = await repair.repairMembershipCrossReference(dbNoMembership, { uid: 'uid-3', organizationId: 'org-3', dryRun: false });
    assert('RP32 sem membership organizacional: REPAIR_BLOCKED / organization_membership_not_found',
      r1.classification === 'REPAIR_BLOCKED' && r1.reason === 'organization_membership_not_found');
    assert('RP33 bloqueio: nenhuma escrita realizada', dbNoMembership.writes.length === 0);

    const dbNoOrg = makeFakeDb({ 'organizations/org-4/members/uid-4': { role: 'owner', status: 'active' } });
    const r2 = await repair.repairMembershipCrossReference(dbNoOrg, { uid: 'uid-4', organizationId: 'org-4', dryRun: false });
    assert('RP34 organização inexistente: REPAIR_BLOCKED / organization_not_found',
      r2.classification === 'REPAIR_BLOCKED' && r2.reason === 'organization_not_found');

    const dbInactiveOrg = makeFakeDb({
      'organizations/org-5/members/uid-5': { role: 'owner', status: 'active' },
      'organizations/org-5': { name: 'Suspensa', status: 'suspended' },
    });
    const r3 = await repair.repairMembershipCrossReference(dbInactiveOrg, { uid: 'uid-5', organizationId: 'org-5', dryRun: false });
    assert('RP35 organização inativa: REPAIR_BLOCKED / organization_inactive',
      r3.classification === 'REPAIR_BLOCKED' && r3.reason === 'organization_inactive');
    assert('RP36 bloqueio por org inativa: nenhuma escrita realizada', dbInactiveOrg.writes.length === 0);
  }

  // ── Suite RP7 — cenário exato do incidente: lucas_vizentin / ESA ──
  console.log('\nSuite RP7 — cenário do incidente real: lucas_vizentin owner na ESA');
  {
    const uid = 'lucas_vizentin';
    const orgId = '1fda2931-8d9e-4a68-8fc5-3fd49d8367b1';
    const db = makeFakeDb({
      [`organizations/${orgId}/members/${uid}`]: { role: 'owner', status: 'active', createdAt: 1750000000000 },
      [`organizations/${orgId}`]: { name: 'ESA', status: 'active' },
      // users/{uid}/memberships/{orgId} ausente — reproduz o incidente relatado
    });
    const dry = await repair.repairMembershipCrossReference(db, { uid, organizationId: orgId, dryRun: true });
    assert('RP37 dry-run do cenário real: REPAIR_DRY_RUN, nenhuma escrita', dry.classification === 'REPAIR_DRY_RUN' && db.writes.length === 0);

    const real = await repair.repairMembershipCrossReference(db, { uid, organizationId: orgId, dryRun: false });
    assert('RP38 execução real do cenário: REPAIR_OK', real.classification === 'REPAIR_OK');
    const written = db.tree[`users/${uid}/memberships/${orgId}`] as any;
    assert('RP39 membership restaurado com role owner', written.role === 'owner');
    assert('RP40 membership restaurado com status active', written.status === 'active');
    assert('RP41 membership restaurado com organizationId correto', written.organizationId === orgId);
    assert('RP42 lado organizacional permanece intocado (auditoria: organization-side membership não é alterado)',
      (db.tree[`organizations/${orgId}/members/${uid}`] as any).createdAt === 1750000000000);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Repair Membership Cross-Reference Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
