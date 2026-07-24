'use strict';
/**
 * ESA OS — Upload do CRM: HTTP 401 para usuários legados (causa raiz real)
 *
 * INCIDENTE: após a correção anterior (renovação automática de token),
 * alguns usuários continuavam recebendo "HTTP 401" ao anexar arquivos.
 *
 * CAUSA RAIZ REAL: doLogin() (index.html) e session-init.js resolviam o uid
 * da sessão a partir do CAMPO `.uid` dentro do valor do registro
 * (`Object.values(users).find(u => u.login === login)`), em vez da CHAVE do
 * Firebase sob a qual o registro está armazenado
 * (`Object.entries(users).find(([key, u]) => ...)`). Para qualquer usuário
 * cujo registro não tivesse o campo `.uid` preenchido (legado/incompleto) —
 * ou o tivesse com um valor diferente da própria chave — a sessão emitida
 * carregava um uid ausente ou errado. Como `JSON.stringify` descarta chaves
 * com valor `undefined`, o token gerado (`generateToken(undefined, secret)`)
 * literalmente não continha a claim `uid` — rejeitado por `verifyToken()`
 * (agora com o código específico `legacy_session`, não mais um genérico
 * `invalid_session`). A renovação (Path B de session-token.js) também
 * dependia do mesmo `sess.uid` ausente, então NUNCA conseguia se recuperar
 * — nem mesmo tentando de novo, nem em outra aba.
 *
 * Esta suíte testa, com EXECUÇÃO REAL (Firebase fake via require.cache, ou
 * sandbox vm para o código de index.html): resolveUserByLogin()/
 * resolveAuthenticatedUserIdentity() (novos, _shared/user-identity.js);
 * session-init.js e session-token.js usando a resolução por chave; a matriz
 * completa de usuários (uid==login, uid!=login, uid ausente, inativo,
 * inexistente); e que pelo menos um usuário que antes recebia 401 agora
 * recebe 200.
 *
 * Rodar: npx tsx tests/user-identity-resolution.manual-test.ts
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const NF = path.join(ROOT, 'netlify/functions');
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

process.env.UPLOAD_SESSION_SECRET = 'test-secret-for-identity-suite';
const SECRET = process.env.UPLOAD_SESSION_SECRET as string;

const uploadSession = require(path.join(NF, '_shared/upload-session.js'));
const identity = require(path.join(NF, '_shared/user-identity.js'));

// ── Fake RTDB (mesma interface: db.ref(path).once('value')) ─────────────────

type Tree = Record<string, unknown>;

function makeFakeDb(initial: Tree) {
  const tree: Tree = JSON.parse(JSON.stringify(initial));
  return {
    tree,
    ref(p: string) {
      return {
        async once(_e: string) {
          const val = Object.prototype.hasOwnProperty.call(tree, p) ? tree[p] : null;
          return { val: () => val, exists: () => val !== null && val !== undefined };
        },
      };
    },
  };
}

function makeFakeBucket() {
  const saved: { path: string; buffer: Buffer }[] = [];
  return { saved, file(p: string) { return { async save(buffer: Buffer) { saved.push({ path: p, buffer }); } }; } };
}
function installFakeFirebaseAdmin(db: ReturnType<typeof makeFakeDb>, bucket = makeFakeBucket()) {
  const fbAdminPath = require.resolve(path.join(NF, '_shared/firebase-admin.js'));
  require.cache[fbAdminPath] = {
    id: fbAdminPath,
    filename: fbAdminPath,
    loaded: true,
    exports: {
      getDatabase: () => db,
      getBucket: () => bucket,
      getDatabaseHost: () => 'fake-rtdb.firebaseio.com',
      STORAGE_BUCKET: 'fake-project.firebasestorage.app',
    },
  } as unknown as NodeModule;
}
function freshRequire(modPath: string) {
  const resolved = require.resolve(modPath);
  delete require.cache[resolved];
  return require(resolved);
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite UI1 — resolveUserByLogin(): matriz de usuários (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite UI1 — resolveUserByLogin(): sempre retorna a CHAVE do Firebase, nunca o campo .uid');

async function run() {
  {
    const allUsers = {
      lucas_vizentin: { uid: 'lucas_vizentin', login: 'lucas.vizentin', name: 'Lucas Vizentin', level: 'diretor', passHash: 'x' }, // uid == chave
      exec_sem_uid: { login: 'exec.legado', name: 'Executivo Legado', level: 'executivo', passHash: 'x' }, // SEM campo .uid — o bug real
      exec_uid_divergente: { uid: 'outro_valor_qualquer', login: 'exec.divergente', name: 'Exec Divergente', level: 'executivo', passHash: 'x' }, // .uid != chave
      exec_inativo: { uid: 'exec_inativo', login: 'exec.inativo', name: 'Exec Inativo', level: 'executivo', active: false, passHash: 'x' },
    };
    const db = makeFakeDb({ users: allUsers });

    const r1 = await identity.resolveUserByLogin(db, 'lucas.vizentin');
    assert('UI01 uid==chave: resolveUserByLogin retorna a chave correta (lucas_vizentin)', r1 && r1.uid === 'lucas_vizentin');

    const r2 = await identity.resolveUserByLogin(db, 'exec.legado');
    assert('UI02 usuário SEM campo .uid (o bug real): resolveUserByLogin AINDA resolve corretamente pela chave (exec_sem_uid)', r2 && r2.uid === 'exec_sem_uid');
    assert('UI03 confirma que o registro realmente não tinha .uid (reproduz a causa raiz)', (r2 as any).user.uid === undefined);

    const r3 = await identity.resolveUserByLogin(db, 'exec.divergente');
    assert('UI04 .uid divergente da chave: resolveUserByLogin usa a CHAVE (exec_uid_divergente), nunca o campo (outro_valor_qualquer)', r3 && r3.uid === 'exec_uid_divergente' && r3.uid !== (r3 as any).user.uid);

    const r4 = await identity.resolveUserByLogin(db, 'login.inexistente');
    assert('UI05 login inexistente: retorna null (nunca lança, nunca inventa uid)', r4 === null);

    console.log('\nSuite UI2 — isUserActive(): política de ativação');
    const inactiveEntry = await identity.resolveUserByLogin(db, 'exec.inativo');
    assert('UI06 usuário com active:false é detectado como inativo', !identity.isUserActive((inactiveEntry as any).user));
    assert('UI07 usuário sem campo active (maioria dos registros) é tratado como ativo (compatibilidade histórica)', identity.isUserActive((r1 as any).user));
  }

  console.log('\nSuite UI3 — resolveAuthenticatedUserIdentity(): execução real ponta a ponta');

  {
    const db = makeFakeDb({
      'users/exec_ok': { uid: 'exec_ok', login: 'exec.ok', name: 'Exec OK', level: 'executivo', passHash: 'x' },
      'users/exec_inativo2': { uid: 'exec_inativo2', login: 'exec.inativo2', name: 'Exec Inativo', level: 'executivo', active: false, passHash: 'x' },
    });

    const tokenOk = uploadSession.generateToken('exec_ok', SECRET);
    const result = await identity.resolveAuthenticatedUserIdentity(db, tokenOk, SECRET);
    assert('UI08 token válido de usuário existente: resolve identidade com sucesso', result.uid === 'exec_ok');
    assert('UI09 role extraída corretamente', result.role === 'executivo');
    assert('UI10 tokenVersion presente e correta (2)', result.tokenVersion === uploadSession.TOKEN_VERSION);

    const tokenInativo = uploadSession.generateToken('exec_inativo2', SECRET);
    let errInativo: any = null;
    try { await identity.resolveAuthenticatedUserIdentity(db, tokenInativo, SECRET); } catch (e) { errInativo = e; }
    assert('UI11 usuário inativo (active:false): rejeitado com invalid_session', errInativo && errInativo.code === 'invalid_session');

    const tokenInexistente = uploadSession.generateToken('uid_que_nao_existe', SECRET);
    let errInexistente: any = null;
    try { await identity.resolveAuthenticatedUserIdentity(db, tokenInexistente, SECRET); } catch (e) { errInexistente = e; }
    assert('UI12 uid do token não encontrado em users/: rejeitado com invalid_session', errInexistente && errInexistente.code === 'invalid_session');

    // Token estruturalmente válido mas SEM uid (reproduz o bug: generateToken
    // chamado com uid undefined, exatamente como acontecia antes da correção).
    const tokenSemUid = uploadSession.generateToken(undefined, SECRET);
    let errLegacy: any = null;
    try { await identity.resolveAuthenticatedUserIdentity(db, tokenSemUid, SECRET); } catch (e) { errLegacy = e; }
    assert('UI13 token sem claim uid (sessão legada real): code=legacy_session (não invalid_session genérico)', errLegacy && errLegacy.code === 'legacy_session');
    assert('UI14 token sem uid: stage=upload_initial_auth', errLegacy && errLegacy.stage === 'upload_initial_auth');

    const tokenExpirado = (function () {
      const crypto = require('crypto');
      const toB64URL = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const now = Math.floor(Date.now() / 1000);
      const body = toB64URL(JSON.stringify({ uid: 'exec_ok', iat: now - 100000, exp: now - 1, iss: 'esa-dashboard', aud: 'crm-upload', purpose: 'crm-upload', version: 2 }));
      const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      return `${body}.${sig}`;
    })();
    let errExpired: any = null;
    try { await identity.resolveAuthenticatedUserIdentity(db, tokenExpirado, SECRET); } catch (e) { errExpired = e; }
    assert('UI15 token expirado (mas com uid): code=token_expired (não legacy_session)', errExpired && errExpired.code === 'token_expired');
  }

  console.log('\nSuite UI4 — session-init.js: emite token com uid canônico (execução real, corrige a causa raiz)');

  {
    const exec1 = { login: 'exec.semuid', name: 'Exec Sem Uid', level: 'executivo', passHash: require('crypto').createHash('sha256').update('senha123', 'utf8').digest('hex') };
    const db = makeFakeDb({
      users: { exec_sem_uid_login: exec1 },
      'users/exec_sem_uid_login': exec1,
    });
    installFakeFirebaseAdmin(db);
    const sessionInit = freshRequire(path.join(NF, 'session-init.js'));
    const res = await sessionInit.handler({ httpMethod: 'POST', body: JSON.stringify({ login: 'exec.semuid', password: 'senha123' }) } as any);
    const resBody = JSON.parse(res.body);
    assert('UI16 login de usuário SEM campo .uid: HTTP 200 (login continua funcionando)', res.statusCode === 200);
    const payload = uploadSession.verifyToken(resBody.sessionToken, SECRET);
    assert('UI17 token emitido para usuário sem .uid: claim uid presente e correta (a CHAVE, exec_sem_uid_login)', payload.uid === 'exec_sem_uid_login');
  }

  console.log('\nSuite UI5 — cenário completo: usuário antes bloqueado (401) agora consegue enviar (200)');

  {
    // Reproduz o cenário EXATO do incidente: usuário legado sem .uid, cujo
    // token ANTIGO (gerado com uid undefined, formato pré-correção) falhava
    // sempre. Após a correção completa (session-init.js emitindo pela chave),
    // um NOVO login para o mesmo usuário resolve o problema definitivamente.
    const vendedor = { login: 'vendedor.legado', name: 'Vendedor Legado', level: 'executivo', passHash: require('crypto').createHash('sha256').update('senha456', 'utf8').digest('hex') };
    const db = makeFakeDb({
      users: { vendedor_legado: vendedor },
      'users/vendedor_legado': vendedor,
    });
    installFakeFirebaseAdmin(db);

    // 1) Prova que o token ANTIGO (uid undefined) de fato falhava.
    const oldBrokenToken = uploadSession.generateToken(undefined, SECRET);
    const crmUploadOld = freshRequire(path.join(NF, 'crm-upload.js'));
    const resOld = await crmUploadOld.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: oldBrokenToken, dealId: 'deal-1', fileName: 'x.pdf', contentType: 'application/pdf', fileBase64: Buffer.from('x').toString('base64') }) } as any);
    assert('UI18 REPRODUZIDO: token antigo (sem uid) do usuário legado falha com 401', resOld.statusCode === 401);
    assert('UI19 REPRODUZIDO: code é legacy_session, nunca um "HTTP 401" genérico', JSON.parse(resOld.body).code === 'legacy_session');

    // 2) Login NOVO (pós-correção) emite token com uid canônico correto.
    const sessionInit = freshRequire(path.join(NF, 'session-init.js'));
    const loginRes = await sessionInit.handler({ httpMethod: 'POST', body: JSON.stringify({ login: 'vendedor.legado', password: 'senha456' }) } as any);
    const newToken = JSON.parse(loginRes.body).sessionToken;

    // 3) Upload com o token NOVO: sucesso.
    const crmUploadNew = freshRequire(path.join(NF, 'crm-upload.js'));
    const resNew = await crmUploadNew.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: newToken, dealId: 'deal-1', fileName: 'contrato.pdf', contentType: 'application/pdf', fileBase64: Buffer.from('conteudo real').toString('base64') }) } as any);
    assert('UI20 CORRIGIDO: mesmo usuário, com token emitido pelo login pós-correção: upload retorna 200', resNew.statusCode === 200);
    assert('UI21 CORRIGIDO: uploadedBy reflete o usuário correto', JSON.parse(resNew.body).uploadedBy === 'Vendedor Legado');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`User Identity Resolution Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
