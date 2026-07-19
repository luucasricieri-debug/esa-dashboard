'use strict';

/**
 * ESA OS — Gate 8F: Organization Members
 *
 * Cobre: auth, membership do ator, list, add, update-role, suspend, reactivate,
 * idempotência, versionamento otimista, dual-path, proteções de owner.
 *
 * Rodar: node netlify/functions/__tests__/organization-members.test.js
 */

const { generateToken, verifyToken } = require('../_shared/upload-session');
const { _createHandler, _maskUid, _ALLOWED_ROLES } = require('../organization-members');

const SECRET = 'test-secret-gate8f';
process.env.UPLOAD_SESSION_SECRET = SECRET;

const ORG_ID  = 'org-test-8f';
const ACTOR   = 'actor-uid-8f';
const TARGET  = 'target-uid-8f';
const TARGET2 = 'target-uid-8f-2';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

// ── Mock DB ───────────────────────────────────────────────────────────────────

function makeMockDb(opts = {}) {
  const {
    actorMembership = null,
    orgMembers      = {},
    userProfiles    = {},
    loginIndex      = {},
    targetMembership = null,
    idempotencyHit  = false,
    dbThrowOnPaths  = [],
    dbThrowOnUpdate = false,
  } = opts;

  const writes = {};
  const updates = {};

  function makeRef(path) {
    const shouldThrow = dbThrowOnPaths.some((p) => path.startsWith(p));

    return {
      path,
      async once() {
        if (shouldThrow) throw new Error('DB error (simulated)');

        // actor membership
        if (path === `users/${ACTOR}/memberships/${ORG_ID}`)
          return { val: () => actorMembership, exists: () => !!actorMembership };

        // target membership (used by update-role / suspend / reactivate)
        if (path === `organizations/${ORG_ID}/members/${TARGET}`)
          return { val: () => targetMembership, exists: () => !!targetMembership };
        if (path === `organizations/${ORG_ID}/members/${TARGET2}`)
          return { val: () => null, exists: () => false };

        // org members list
        if (path === `organizations/${ORG_ID}/members`)
          return { val: () => Object.keys(orgMembers).length ? orgMembers : null, exists: () => Object.keys(orgMembers).length > 0 };

        // user profile lookup by uid
        if (path.startsWith('users/')) {
          const uid = path.split('/')[1];
          if (userProfiles[uid]) return { val: () => userProfiles[uid], exists: () => true };
          return { val: () => null, exists: () => false };
        }

        // idempotency check
        if (path.includes('/idempotency/')) {
          return { val: () => idempotencyHit ? { requestId: 'prior' } : null, exists: () => idempotencyHit };
        }

        // membership already-exists check for add
        if (path === `organizations/${ORG_ID}/members/${TARGET}` && targetMembership)
          return { val: () => targetMembership, exists: () => true };

        return { val: () => null, exists: () => false };
      },
      async set(value) {
        writes[path] = value;
      },
      orderByChild() {
        return {
          equalTo(val) {
            return {
              limitToFirst() {
                return {
                  async once() {
                    const hit = loginIndex[val];
                    return { val: () => hit ? { [hit.uid]: hit } : null };
                  },
                };
              },
            };
          },
        };
      },
      async update(payload) {
        if (dbThrowOnUpdate) throw new Error('DB update error (simulated)');
        Object.assign(updates, payload);
      },
    };
  }

  return {
    writes,
    updates,
    ref(path) {
      if (path === '/') {
        return {
          async update(payload) {
            if (dbThrowOnUpdate) throw new Error('DB update error (simulated)');
            Object.assign(updates, payload);
          },
        };
      }
      return makeRef(path);
    },
  };
}

// ── Handler factory ───────────────────────────────────────────────────────────

function makeHandler(db) {
  return _createHandler({ getDatabase: () => db, verifyToken });
}

function makeEvent(body, extraHeaders = {}) {
  return {
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function makeOptions() {
  return { httpMethod: 'OPTIONS', headers: {}, body: null };
}

function token(uid = ACTOR) {
  return generateToken(uid, SECRET);
}

function authHeader(uid = ACTOR) {
  return { Authorization: 'Bearer ' + token(uid) };
}

// Memberships base
const adminMembership   = { role: 'admin',   status: 'active', uid: ACTOR, version: 1 };
const managerMembership = { role: 'manager', status: 'active', uid: ACTOR, version: 1 };
const operatorMembership = { role: 'operator', status: 'active', uid: ACTOR, version: 1 };
const viewerMembership  = { role: 'viewer',  status: 'active', uid: ACTOR, version: 1 };
const inactiveMembership = { role: 'admin',  status: 'suspended', uid: ACTOR, version: 1 };

const targetActive    = { role: 'viewer', status: 'active',    uid: TARGET, version: 1 };
const targetSuspended = { role: 'viewer', status: 'suspended', uid: TARGET, version: 2 };
const targetOwner     = { role: 'owner',  status: 'active',    uid: TARGET, version: 1 };

// ── Suite MB: Validação HTTP e token ─────────────────────────────────────────

console.log('\nSuite MB — Validação HTTP e token');

(async () => {

const h = makeHandler(makeMockDb({ actorMembership: adminMembership }));

// MB01
const r1 = await makeHandler(makeMockDb()).call(null, makeOptions());
assert('MB01 OPTIONS → 204', r1.statusCode === 204);

// MB02
const r2 = await makeHandler(makeMockDb())({ httpMethod: 'GET', headers: {}, body: null });
assert('MB02 GET → 405', r2.statusCode === 405);

// MB03
const r3 = await h(makeEvent({ action: 'list', organizationId: ORG_ID }));
assert('MB03 Sem token → 401', r3.statusCode === 401);

// MB04
const r4 = await h({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: { Authorization: 'Bearer bad.token.here' } });
assert('MB04 Token inválido → 401', r4.statusCode === 401);

// MB05
const r5 = await makeHandler(makeMockDb({ actorMembership: adminMembership }))({
  httpMethod: 'POST', headers: { Authorization: 'Bearer ' + token(), 'content-type': 'application/json' }, body: '{{bad json',
});
assert('MB05 Body inválido → 400', r5.statusCode === 400);

// MB06
const r6 = await h({ ...makeEvent({ action: 'delete-all', organizationId: ORG_ID }), headers: authHeader() });
assert('MB06 Ação inválida → 400', r6.statusCode === 400);

// MB07
const r7 = await h({ ...makeEvent({ action: 'list' }), headers: authHeader() });
assert('MB07 Sem organizationId → 400', r7.statusCode === 400);

// MB08 — sem secret
const origSecret = process.env.UPLOAD_SESSION_SECRET;
delete process.env.UPLOAD_SESSION_SECRET;
const h8 = makeHandler(makeMockDb({ actorMembership: adminMembership }));
const r8 = await h8({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: { Authorization: 'Bearer ' + token() } });
assert('MB08 Sem UPLOAD_SESSION_SECRET → 500', r8.statusCode === 500);
process.env.UPLOAD_SESSION_SECRET = origSecret;

// ── Suite MC: Membership do ator ──────────────────────────────────────────────

console.log('\nSuite MC — Membership do ator');

// MC01
const hNoMem = makeHandler(makeMockDb({ actorMembership: null }));
const r9 = await hNoMem({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: authHeader() });
const b9 = JSON.parse(r9.body);
assert('MC01 Sem membership → 403 organization_invalid', r9.statusCode === 403 && b9.code === 'organization_invalid');

// MC02
const hInactive = makeHandler(makeMockDb({ actorMembership: inactiveMembership }));
const r10 = await hInactive({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: authHeader() });
const b10 = JSON.parse(r10.body);
assert('MC02 Membership inativo → 403 membership_inactive', r10.statusCode === 403 && b10.code === 'membership_inactive');

// MC03
const hDbErr = makeHandler(makeMockDb({ dbThrowOnPaths: [`users/${ACTOR}/memberships`] }));
const r11 = await hDbErr({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: authHeader() });
assert('MC03 Erro DB no membership check → 500', r11.statusCode === 500);

// ── Suite MD: list ────────────────────────────────────────────────────────────

console.log('\nSuite MD — list');

const membersFixture = {
  [TARGET]:  { uid: TARGET,  role: 'viewer', status: 'active',    version: 1 },
  [ACTOR]:   { uid: ACTOR,   role: 'admin',  status: 'active',    version: 1 },
};
const profilesFixture = {
  [TARGET]:  { displayName: 'Ana Lima',    login: 'ana.lima'    },
  [ACTOR]:   { displayName: 'Lucas Admin', login: 'lucas.admin' },
};

const hAdminList = makeHandler(makeMockDb({
  actorMembership: adminMembership,
  orgMembers:      membersFixture,
  userProfiles:    profilesFixture,
}));

// MD01
const r12 = await hAdminList({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: authHeader() });
const b12 = JSON.parse(r12.body);
assert('MD01 Admin lista → 200 ok:true', r12.statusCode === 200 && b12.ok === true);

// MD02
const hManagerList = makeHandler(makeMockDb({
  actorMembership: managerMembership,
  orgMembers:      membersFixture,
  userProfiles:    profilesFixture,
}));
const r13 = await hManagerList({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: authHeader() });
assert('MD02 Manager lista → 200', r13.statusCode === 200);

// MD03
const hOperatorList = makeHandler(makeMockDb({ actorMembership: operatorMembership }));
const r14 = await hOperatorList({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: authHeader() });
const b14 = JSON.parse(r14.body);
assert('MD03 Operator lista → 403 no_permission', r14.statusCode === 403 && b14.code === 'no_permission');

// MD04
const hViewerList = makeHandler(makeMockDb({ actorMembership: viewerMembership }));
const r15 = await hViewerList({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: authHeader() });
const b15 = JSON.parse(r15.body);
assert('MD04 Viewer lista → 403 no_permission', r15.statusCode === 403 && b15.code === 'no_permission');

// MD05 — enriquecimento com displayName e login
assert('MD05 Membros enriquecidos com displayName e login',
  Array.isArray(b12.data) && b12.data.some((m) => m.displayName === 'Ana Lima' && m.login === 'ana.lima'));

// MD06 — lista vazia
const hEmptyList = makeHandler(makeMockDb({
  actorMembership: adminMembership,
  orgMembers: {},
  userProfiles: {},
}));
const r16 = await hEmptyList({ ...makeEvent({ action: 'list', organizationId: ORG_ID }), headers: authHeader() });
const b16 = JSON.parse(r16.body);
assert('MD06 Lista vazia → ok:true data:[]', r16.statusCode === 200 && Array.isArray(b16.data) && b16.data.length === 0);

// MD07 — requestId na resposta
assert('MD07 requestId presente na resposta de list', typeof b12.requestId === 'string' && b12.requestId.length > 0);

// MD08 — uid e version presentes
assert('MD08 Cada membro tem uid e version', b12.data.every((m) => m.uid && typeof m.version === 'number'));

// ── Suite ME: add ─────────────────────────────────────────────────────────────

console.log('\nSuite ME — add');

const loginIndexFixture = { 'ana.lima': { uid: TARGET, displayName: 'Ana Lima', login: 'ana.lima' } };

// ME01 — add por login
const hAdd = makeHandler(makeMockDb({
  actorMembership: adminMembership,
  loginIndex: loginIndexFixture,
  userProfiles: { [TARGET]: { displayName: 'Ana Lima', login: 'ana.lima' } },
}));
const r17 = await hAdd({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, login: 'ana.lima', role: 'viewer', clientRequestId: 'req-me01' }),
  headers: authHeader(),
});
const b17 = JSON.parse(r17.body);
assert('ME01 Add por login → 200 ok:true', r17.statusCode === 200 && b17.ok === true);

// ME02 — add por targetUid
const hAddUid = makeHandler(makeMockDb({
  actorMembership: adminMembership,
  userProfiles: { [TARGET]: { displayName: 'Ana Lima', login: 'ana.lima' } },
}));
const r18 = await hAddUid({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, targetUid: TARGET, role: 'operator', clientRequestId: 'req-me02' }),
  headers: authHeader(),
});
assert('ME02 Add por targetUid → 200', r18.statusCode === 200);

// ME03 — papel inválido
const r19 = await hAdd({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, login: 'ana.lima', role: 'owner', clientRequestId: 'req-me03' }),
  headers: authHeader(),
});
const b19 = JSON.parse(r19.body);
assert('ME03 Papel inválido → 400 invalid_role', r19.statusCode === 400 && b19.code === 'invalid_role');

// ME04 — sem targetUid e sem login
const r20 = await hAdd({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, role: 'viewer', clientRequestId: 'req-me04' }),
  headers: authHeader(),
});
assert('ME04 Sem login nem targetUid → 400', r20.statusCode === 400);

// ME05 — usuário não encontrado
const hAddNotFound = makeHandler(makeMockDb({ actorMembership: adminMembership, loginIndex: {}, userProfiles: {} }));
const r21 = await hAddNotFound({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, login: 'nao.existe', role: 'viewer', clientRequestId: 'req-me05' }),
  headers: authHeader(),
});
const b21 = JSON.parse(r21.body);
assert('ME05 Usuário não encontrado → 404 user_not_found', r21.statusCode === 404 && b21.code === 'user_not_found');

// ME06 — membership já existe
const hAddExists = makeHandler(makeMockDb({
  actorMembership: adminMembership,
  userProfiles: { [TARGET]: { displayName: 'Ana Lima' } },
  targetMembership: targetActive,
}));
const r22 = await hAddExists({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, targetUid: TARGET, role: 'viewer', clientRequestId: 'req-me06' }),
  headers: authHeader(),
});
const b22 = JSON.parse(r22.body);
assert('ME06 Membership já existe → 409 membership_already_exists', r22.statusCode === 409 && b22.code === 'membership_already_exists');

// ME07 — idempotência
const hAddIdem = makeHandler(makeMockDb({ actorMembership: adminMembership, idempotencyHit: true }));
const r23 = await hAddIdem({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, login: 'ana.lima', role: 'viewer', clientRequestId: 'req-me07' }),
  headers: authHeader(),
});
const b23 = JSON.parse(r23.body);
assert('ME07 Idempotência → 200 idempotent:true', r23.statusCode === 200 && b23.idempotent === true);

// ME08 — dual-path escrita
const dbDualPath = makeMockDb({
  actorMembership: adminMembership,
  loginIndex: loginIndexFixture,
  userProfiles: { [TARGET]: { displayName: 'Ana Lima', login: 'ana.lima' } },
});
const hAddDual = makeHandler(dbDualPath);
await hAddDual({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, login: 'ana.lima', role: 'viewer', clientRequestId: 'req-me08' }),
  headers: authHeader(),
});
assert('ME08 Dual-path: organizations/members escrito',
  !!dbDualPath.updates[`organizations/${ORG_ID}/members/${TARGET}`]);
assert('ME08b Dual-path: users/memberships escrito',
  !!dbDualPath.updates[`users/${TARGET}/memberships/${ORG_ID}`]);

// ME09 — viewer tenta adicionar
const hViewerAdd = makeHandler(makeMockDb({ actorMembership: viewerMembership }));
const r24 = await hViewerAdd({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, login: 'alguem', role: 'viewer', clientRequestId: 'req-me09' }),
  headers: authHeader(),
});
assert('ME09 Viewer add → 403 no_permission', r24.statusCode === 403);

// ME10 — manager tenta adicionar
const hManagerAdd = makeHandler(makeMockDb({ actorMembership: managerMembership }));
const r25 = await hManagerAdd({
  ...makeEvent({ action: 'add', organizationId: ORG_ID, login: 'alguem', role: 'viewer', clientRequestId: 'req-me10' }),
  headers: authHeader(),
});
assert('ME10 Manager add → 403 no_permission', r25.statusCode === 403);

// ── Suite MF: update-role ─────────────────────────────────────────────────────

console.log('\nSuite MF — update-role');

function hRole(targetM, extra = {}) {
  return makeHandler(makeMockDb({ actorMembership: adminMembership, targetMembership: targetM, ...extra }));
}

// MF01 — alterar papel de viewer → operator
const r26 = await hRole(targetActive)({
  ...makeEvent({ action: 'update-role', organizationId: ORG_ID, targetUid: TARGET, newRole: 'operator', expectedVersion: 1, clientRequestId: 'req-mf01' }),
  headers: authHeader(),
});
const b26 = JSON.parse(r26.body);
assert('MF01 Update-role viewer→operator → 200', r26.statusCode === 200 && b26.ok === true);
assert('MF01b Versão incrementada', b26.data && b26.data.version === 2);

// MF02 — self-role-change (actor tenta alterar a si mesmo)
const selfTarget = { role: 'admin', status: 'active', uid: ACTOR, version: 1 };
const hSelf = makeHandler(makeMockDb({
  actorMembership: adminMembership,
  // Mock que retorna selfTarget quando path = organizations/.../members/ACTOR
  dbThrowOnPaths: [],
}));
// Override: precisamos de um db que retorna selfTarget para members/ACTOR
const dbSelfRole = makeMockDb({ actorMembership: adminMembership });
const origRef = dbSelfRole.ref.bind(dbSelfRole);
dbSelfRole.ref = (p) => {
  if (p === `organizations/${ORG_ID}/members/${ACTOR}`) {
    return { async once() { return { val: () => selfTarget, exists: () => true }; }, async set() {} };
  }
  return origRef(p);
};
const hSelfRole = makeHandler(dbSelfRole);
const r27 = await hSelfRole({
  ...makeEvent({ action: 'update-role', organizationId: ORG_ID, targetUid: ACTOR, newRole: 'viewer', clientRequestId: 'req-mf02' }),
  headers: authHeader(),
});
const b27 = JSON.parse(r27.body);
assert('MF02 Self-role-change → 403 self_role_change_forbidden', r27.statusCode === 403 && b27.code === 'self_role_change_forbidden');

// MF03 — promover para owner (owner não está em ALLOWED_ROLES → 400 invalid_role)
const r28 = await hRole(targetActive)({
  ...makeEvent({ action: 'update-role', organizationId: ORG_ID, targetUid: TARGET, newRole: 'owner', clientRequestId: 'req-mf03' }),
  headers: authHeader(),
});
const b28 = JSON.parse(r28.body);
assert('MF03 Promover para owner → 400 invalid_role (owner fora de ALLOWED_ROLES)', r28.statusCode === 400 && b28.code === 'invalid_role');

// MF04 — alterar owner
const r29 = await hRole(targetOwner)({
  ...makeEvent({ action: 'update-role', organizationId: ORG_ID, targetUid: TARGET, newRole: 'admin', clientRequestId: 'req-mf04' }),
  headers: authHeader(),
});
const b29 = JSON.parse(r29.body);
assert('MF04 Alterar owner → 403 owner_protected', r29.statusCode === 403 && b29.code === 'owner_protected');

// MF05 — version conflict
const r30 = await hRole(targetActive)({
  ...makeEvent({ action: 'update-role', organizationId: ORG_ID, targetUid: TARGET, newRole: 'operator', expectedVersion: 99, clientRequestId: 'req-mf05' }),
  headers: authHeader(),
});
const b30 = JSON.parse(r30.body);
assert('MF05 Version conflict → 409', r30.statusCode === 409 && b30.code === 'version_conflict');

// MF06 — membro não encontrado
const hRoleNotFound = makeHandler(makeMockDb({ actorMembership: adminMembership, targetMembership: null }));
const r31 = await hRoleNotFound({
  ...makeEvent({ action: 'update-role', organizationId: ORG_ID, targetUid: TARGET, newRole: 'operator', clientRequestId: 'req-mf06' }),
  headers: authHeader(),
});
const b31 = JSON.parse(r31.body);
assert('MF06 Membro não encontrado → 404 user_not_found', r31.statusCode === 404 && b31.code === 'user_not_found');

// MF07 — papel inválido
const r32 = await hRole(targetActive)({
  ...makeEvent({ action: 'update-role', organizationId: ORG_ID, targetUid: TARGET, newRole: 'god', clientRequestId: 'req-mf07' }),
  headers: authHeader(),
});
const b32 = JSON.parse(r32.body);
assert('MF07 Papel inválido → 400 invalid_role', r32.statusCode === 400 && b32.code === 'invalid_role');

// MF08 — idempotência
const hRoleIdem = makeHandler(makeMockDb({ actorMembership: adminMembership, targetMembership: targetActive, idempotencyHit: true }));
const r33 = await hRoleIdem({
  ...makeEvent({ action: 'update-role', organizationId: ORG_ID, targetUid: TARGET, newRole: 'operator', clientRequestId: 'req-mf08' }),
  headers: authHeader(),
});
const b33 = JSON.parse(r33.body);
assert('MF08 Idempotência update-role → 200 idempotent:true', r33.statusCode === 200 && b33.idempotent === true);

// ── Suite MG: suspend ─────────────────────────────────────────────────────────

console.log('\nSuite MG — suspend');

function hSuspend(targetM, extra = {}) {
  return makeHandler(makeMockDb({ actorMembership: adminMembership, targetMembership: targetM, ...extra }));
}

// MG01 — suspender viewer
const r34 = await hSuspend(targetActive)({
  ...makeEvent({ action: 'suspend', organizationId: ORG_ID, targetUid: TARGET, expectedVersion: 1, clientRequestId: 'req-mg01' }),
  headers: authHeader(),
});
const b34 = JSON.parse(r34.body);
assert('MG01 Suspend viewer → 200 ok:true', r34.statusCode === 200 && b34.ok === true);
assert('MG01b Status retornado é suspended', b34.data && b34.data.status === 'suspended');

// MG02 — suspender a si mesmo
const dbSelfSuspend = makeMockDb({ actorMembership: adminMembership });
const origRef2 = dbSelfSuspend.ref.bind(dbSelfSuspend);
dbSelfSuspend.ref = (p) => {
  if (p === `organizations/${ORG_ID}/members/${ACTOR}`)
    return { async once() { return { val: () => ({ role: 'admin', status: 'active', uid: ACTOR, version: 1 }), exists: () => true }; }, async set() {} };
  return origRef2(p);
};
const hSelfSuspend = makeHandler(dbSelfSuspend);
const r35 = await hSelfSuspend({
  ...makeEvent({ action: 'suspend', organizationId: ORG_ID, targetUid: ACTOR, clientRequestId: 'req-mg02' }),
  headers: authHeader(),
});
const b35 = JSON.parse(r35.body);
assert('MG02 Suspender a si mesmo → 403 self_role_change_forbidden', r35.statusCode === 403 && b35.code === 'self_role_change_forbidden');

// MG03 — suspender owner
const r36 = await hSuspend(targetOwner)({
  ...makeEvent({ action: 'suspend', organizationId: ORG_ID, targetUid: TARGET, clientRequestId: 'req-mg03' }),
  headers: authHeader(),
});
const b36 = JSON.parse(r36.body);
assert('MG03 Suspender owner → 403 owner_protected', r36.statusCode === 403 && b36.code === 'owner_protected');

// MG04 — version conflict
const r37 = await hSuspend(targetActive)({
  ...makeEvent({ action: 'suspend', organizationId: ORG_ID, targetUid: TARGET, expectedVersion: 99, clientRequestId: 'req-mg04' }),
  headers: authHeader(),
});
const b37 = JSON.parse(r37.body);
assert('MG04 Version conflict suspend → 409', r37.statusCode === 409 && b37.code === 'version_conflict');

// MG05 — membro não encontrado
const r38 = await hSuspend(null)({
  ...makeEvent({ action: 'suspend', organizationId: ORG_ID, targetUid: TARGET, clientRequestId: 'req-mg05' }),
  headers: authHeader(),
});
const b38 = JSON.parse(r38.body);
assert('MG05 Membro não encontrado → 404', r38.statusCode === 404 && b38.code === 'user_not_found');

// MG06 — idempotência
const r39 = await hSuspend(targetActive, { idempotencyHit: true })({
  ...makeEvent({ action: 'suspend', organizationId: ORG_ID, targetUid: TARGET, clientRequestId: 'req-mg06' }),
  headers: authHeader(),
});
const b39 = JSON.parse(r39.body);
assert('MG06 Idempotência suspend → 200 idempotent:true', r39.statusCode === 200 && b39.idempotent === true);

// ── Suite MH: reactivate ──────────────────────────────────────────────────────

console.log('\nSuite MH — reactivate');

function hReactivate(targetM, extra = {}) {
  return makeHandler(makeMockDb({ actorMembership: adminMembership, targetMembership: targetM, ...extra }));
}

// MH01 — reativar
const r40 = await hReactivate(targetSuspended)({
  ...makeEvent({ action: 'reactivate', organizationId: ORG_ID, targetUid: TARGET, expectedVersion: 2, clientRequestId: 'req-mh01' }),
  headers: authHeader(),
});
const b40 = JSON.parse(r40.body);
assert('MH01 Reactivate → 200 ok:true', r40.statusCode === 200 && b40.ok === true);
assert('MH01b Status retornado é active', b40.data && b40.data.status === 'active');

// MH02 — version conflict
const r41 = await hReactivate(targetSuspended)({
  ...makeEvent({ action: 'reactivate', organizationId: ORG_ID, targetUid: TARGET, expectedVersion: 99, clientRequestId: 'req-mh02' }),
  headers: authHeader(),
});
const b41 = JSON.parse(r41.body);
assert('MH02 Version conflict reactivate → 409', r41.statusCode === 409 && b41.code === 'version_conflict');

// MH03 — membro não encontrado
const r42 = await hReactivate(null)({
  ...makeEvent({ action: 'reactivate', organizationId: ORG_ID, targetUid: TARGET, clientRequestId: 'req-mh03' }),
  headers: authHeader(),
});
const b42 = JSON.parse(r42.body);
assert('MH03 Membro não encontrado reactivate → 404', r42.statusCode === 404 && b42.code === 'user_not_found');

// MH04 — idempotência
const r43 = await hReactivate(targetSuspended, { idempotencyHit: true })({
  ...makeEvent({ action: 'reactivate', organizationId: ORG_ID, targetUid: TARGET, clientRequestId: 'req-mh04' }),
  headers: authHeader(),
});
const b43 = JSON.parse(r43.body);
assert('MH04 Idempotência reactivate → 200 idempotent:true', r43.statusCode === 200 && b43.idempotent === true);

// MH05 — dual-path escrita reactivate
const dbReactDual = makeMockDb({ actorMembership: adminMembership, targetMembership: targetSuspended });
const hReactDual = makeHandler(dbReactDual);
await hReactDual({
  ...makeEvent({ action: 'reactivate', organizationId: ORG_ID, targetUid: TARGET, expectedVersion: 2, clientRequestId: 'req-mh05' }),
  headers: authHeader(),
});
assert('MH05 Dual-path reactivate escrito', !!dbReactDual.updates[`organizations/${ORG_ID}/members/${TARGET}`]);

// ── Suite MI: exportações e utilitários ───────────────────────────────────────

console.log('\nSuite MI — Exportações e utilitários');

assert('MI01 _maskUid exportado', typeof _maskUid === 'function');
assert('MI02 _ALLOWED_ROLES exportado e correto',
  Array.isArray(_ALLOWED_ROLES) && _ALLOWED_ROLES.includes('admin') && !_ALLOWED_ROLES.includes('owner'));
assert('MI03 _createHandler exportado', typeof _createHandler === 'function');
assert('MI04 _maskUid uid curto → ***', _maskUid('ab') === '***');
assert('MI05 _maskUid mascara apenas bordas', _maskUid('abcdefgh') === 'abc***fgh');

// ── Relatório ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`Gate 8F Organization Members Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);

})();
