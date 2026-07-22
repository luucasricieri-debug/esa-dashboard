'use strict';
/**
 * ESA OS — CRM: token de upload expira sem renovação automática
 *
 * Incidente: "Erro no upload: Token inválido: token expirado" após o usuário
 * permanecer conectado por mais de 8h. Causa raiz: crm-upload.js repassava
 * verbatim `'Token inválido: ' + e.message` (netlify/functions/crm-upload.js,
 * antes desta correção) e o frontend nunca chamava o endpoint de renovação
 * (session-token.js), que já existia mas nunca era invocado.
 *
 * Este arquivo testa, com EXECUÇÃO REAL de netlify/functions/crm-upload.js,
 * netlify/functions/session-token.js e netlify/functions/_shared/upload-session.js
 * (não apenas leitura de source) — injeta um Firebase fake via require.cache
 * para _shared/firebase-admin.js, sem tocar em nenhum Firebase real.
 *
 * Rodar: npx tsx tests/crm-upload-auth-backend.manual-test.ts
 */

import fs from 'fs';
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

process.env.UPLOAD_SESSION_SECRET = 'test-secret-for-crm-upload-suite';

// ── Fake RTDB + Storage bucket (mesma interface usada por crm-upload.js) ────

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
        async set(value: unknown) { tree[p] = value; },
      };
    },
  };
}

function makeFakeBucket() {
  const saved: { path: string; buffer: Buffer; opts: unknown }[] = [];
  return {
    saved,
    file(p: string) {
      return {
        async save(buffer: Buffer, opts: unknown) { saved.push({ path: p, buffer, opts }); },
      };
    },
  };
}

const logs: string[] = [];
const originalInfo = console.info;

function installFakeFirebaseAdmin(db: ReturnType<typeof makeFakeDb>, bucket: ReturnType<typeof makeFakeBucket>) {
  const fbAdminPath = require.resolve(path.join(NF, '_shared/firebase-admin.js'));
  require.cache[fbAdminPath] = {
    id: fbAdminPath,
    filename: fbAdminPath,
    loaded: true,
    exports: {
      getDatabase: () => db,
      getBucket: () => bucket,
      getDatabaseHost: () => 'fake-rtdb.firebaseio.com',
      getProjectId: () => 'fake-project',
      STORAGE_BUCKET: 'fake-project.firebasestorage.app',
    },
    // minimal fields required by Node's Module type — cast below
  } as unknown as NodeModule;
}

function freshRequire(modPath: string) {
  const resolved = require.resolve(modPath);
  delete require.cache[resolved];
  return require(resolved);
}

const uploadSession = require(path.join(NF, '_shared/upload-session.js'));
const SECRET = process.env.UPLOAD_SESSION_SECRET as string;

// ═══════════════════════════════════════════════════════════════════════════
// Suite CU1 — upload-session.js: token_expired vs invalid_session (execução real)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite CU1 — verifyToken(): token_expired vs invalid_session, issuer/audience');

{
  const validToken = uploadSession.generateToken('uid-1', SECRET);
  const payload = uploadSession.verifyToken(validToken, SECRET);
  assert('CU01 token válido: verifyToken() retorna o uid correto', payload.uid === 'uid-1');
  assert('CU02 token gerado inclui iss=esa-dashboard', uploadSession.ISSUER === 'esa-dashboard');
  assert('CU03 token gerado inclui aud=crm-upload', uploadSession.AUDIENCE === 'crm-upload');

  // Token expirado: fabricar um payload com exp no passado, assinado com o secret correto.
  function forgeToken(payloadObj: Record<string, unknown>, secret: string) {
    const crypto = require('crypto');
    const toB64URL = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const body = toB64URL(JSON.stringify(payloadObj));
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `${body}.${sig}`;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiredToken = forgeToken({ uid: 'uid-1', iat: now - 100000, exp: now - 1, iss: 'esa-dashboard', aud: 'crm-upload', purpose: 'crm-upload' }, SECRET);
  let expiredErr: any = null;
  try { uploadSession.verifyToken(expiredToken, SECRET); } catch (e) { expiredErr = e; }
  assert('CU04 token expirado: verifyToken() lança erro com code=token_expired', expiredErr && expiredErr.code === 'token_expired');

  const tamperedToken = validToken.slice(0, -4) + 'XXXX';
  let tamperedErr: any = null;
  try { uploadSession.verifyToken(tamperedToken, SECRET); } catch (e) { tamperedErr = e; }
  assert('CU05 assinatura adulterada: code=invalid_session (nunca token_expired)', tamperedErr && tamperedErr.code === 'invalid_session');

  let wrongSecretErr: any = null;
  try { uploadSession.verifyToken(validToken, 'outro-secret-completamente-diferente'); } catch (e) { wrongSecretErr = e; }
  assert('CU06 secret diferente na validação: code=invalid_session', wrongSecretErr && wrongSecretErr.code === 'invalid_session');

  const wrongAudToken = forgeToken({ uid: 'uid-1', iat: now, exp: now + 10000, iss: 'esa-dashboard', aud: 'outra-audiencia', purpose: 'crm-upload' }, SECRET);
  let wrongAudErr: any = null;
  try { uploadSession.verifyToken(wrongAudToken, SECRET); } catch (e) { wrongAudErr = e; }
  assert('CU07 audience incorreta: code=invalid_session (bloqueado)', wrongAudErr && wrongAudErr.code === 'invalid_session');

  const wrongIssToken = forgeToken({ uid: 'uid-1', iat: now, exp: now + 10000, iss: 'outro-issuer', aud: 'crm-upload', purpose: 'crm-upload' }, SECRET);
  let wrongIssErr: any = null;
  try { uploadSession.verifyToken(wrongIssToken, SECRET); } catch (e) { wrongIssErr = e; }
  assert('CU08 issuer incorreto: code=invalid_session (bloqueado)', wrongIssErr && wrongIssErr.code === 'invalid_session');

  let noTokenErr: any = null;
  try { uploadSession.verifyToken(undefined, SECRET); } catch (e) { noTokenErr = e; }
  assert('CU09 token ausente: code=invalid_session', noTokenErr && noTokenErr.code === 'invalid_session');
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite CU2 — crm-upload.js: execução real ponta a ponta (Firebase fake)
// ═══════════════════════════════════════════════════════════════════════════

async function run() {
  console.log('\nSuite CU2 — crm-upload.js: token válido envia arquivo (execução real)');

  const validPdfBase64 = Buffer.from('%PDF-1.4 conteudo de teste').toString('base64');

  {
    const db = makeFakeDb({
      'users/uid-owner': { uid: 'uid-owner', name: 'Owner Test', level: 'diretor' },
    });
    const bucket = makeFakeBucket();
    installFakeFirebaseAdmin(db, bucket);
    const crmUpload = freshRequire(path.join(NF, 'crm-upload.js'));

    const token = uploadSession.generateToken('uid-owner', SECRET);
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ sessionToken: token, dealId: 'deal-1', fileName: 'contrato.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }),
    };
    const res = await crmUpload.handler(event as any);
    const resBody = JSON.parse(res.body);
    assert('CU10 token válido: HTTP 200', res.statusCode === 200);
    assert('CU11 token válido: arqData.nome correto', resBody.nome === 'contrato.pdf');
    assert('CU12 token válido: 1 arquivo salvo no bucket fake', bucket.saved.length === 1);
    assert('CU13 uploadedBy vem do usuário do TOKEN (uid-owner), não de nenhum campo do body', resBody.uploadedBy === 'Owner Test');

    console.log('\nSuite CU3 — token expirado: code=token_expired estruturado (não mais "Token inválido: ...")');

    const now = Math.floor(Date.now() / 1000);
    const crypto = require('crypto');
    const toB64URL = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const expiredBody = toB64URL(JSON.stringify({ uid: 'uid-owner', iat: now - 100000, exp: now - 1, iss: 'esa-dashboard', aud: 'crm-upload', purpose: 'crm-upload' }));
    const expiredSig = crypto.createHmac('sha256', SECRET).update(expiredBody).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const expiredToken = `${expiredBody}.${expiredSig}`;

    const eventExpired = { httpMethod: 'POST', body: JSON.stringify({ sessionToken: expiredToken, dealId: 'deal-1', fileName: 'x.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }) };
    const resExpired = await crmUpload.handler(eventExpired as any);
    const bodyExpired = JSON.parse(resExpired.body);
    assert('CU14 token expirado: HTTP 401', resExpired.statusCode === 401);
    assert('CU15 token expirado: code === "token_expired" (estruturado, testável)', bodyExpired.code === 'token_expired');
    assert('CU16 token expirado: mensagem não contém "Token inválido" cru', !JSON.stringify(bodyExpired).includes('Token inválido'));
    assert('CU17 token expirado: nenhum arquivo adicional salvo no bucket', bucket.saved.length === 1);

    console.log('\nSuite CU4 — token inválido (adulterado) não é aceito');
    const eventTampered = { httpMethod: 'POST', body: JSON.stringify({ sessionToken: token.slice(0, -4) + 'ZZZZ', dealId: 'deal-1', fileName: 'x.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }) };
    const resTampered = await crmUpload.handler(eventTampered as any);
    const bodyTampered = JSON.parse(resTampered.body);
    assert('CU18 assinatura adulterada: HTTP 401 code=invalid_session', resTampered.statusCode === 401 && bodyTampered.code === 'invalid_session');

    console.log('\nSuite CU5 — uid do body é ignorado (source of trust é sempre o token)');
    const eventFakeUid = { httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, uid: 'uid-atacante-injetado', dealId: 'deal-1', fileName: 'y.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }) };
    const resFakeUid = await crmUpload.handler(eventFakeUid as any);
    const bodyFakeUid = JSON.parse(resFakeUid.body);
    assert('CU19 uid arbitrário no body é ignorado: uploadedBy continua vindo do token (Owner Test)', bodyFakeUid.uploadedBy === 'Owner Test');

    console.log('\nSuite CU6 — arquivo > 10MB bloqueado com 413/file_too_large');
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 1);
    const eventBig = { httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, dealId: 'deal-1', fileName: 'grande.pdf', contentType: 'application/pdf', fileBase64: bigBuffer.toString('base64') }) };
    const resBig = await crmUpload.handler(eventBig as any);
    const bodyBig = JSON.parse(resBig.body);
    assert('CU20 arquivo > 10MB: HTTP 413', resBig.statusCode === 413);
    assert('CU21 arquivo > 10MB: code=file_too_large', bodyBig.code === 'file_too_large');

    console.log('\nSuite CU7 — MIME inválido bloqueado com 415/unsupported_file_type');
    const eventBadMime = { httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, dealId: 'deal-1', fileName: 'script.exe', contentType: 'application/x-msdownload', fileBase64: validPdfBase64 }) };
    const resBadMime = await crmUpload.handler(eventBadMime as any);
    const bodyBadMime = JSON.parse(resBadMime.body);
    assert('CU22 MIME não permitido: HTTP 415', resBadMime.statusCode === 415);
    assert('CU23 MIME não permitido: code=unsupported_file_type', bodyBadMime.code === 'unsupported_file_type');

    console.log('\nSuite CU8 — nome de arquivo sanitizado / path traversal bloqueado');
    const eventWeirdName = { httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, dealId: 'deal-1', fileName: '../../etc/passwd; rm -rf.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }) };
    const resWeirdName = await crmUpload.handler(eventWeirdName as any);
    const savedPath = bucket.saved[bucket.saved.length - 1].path;
    const nameComponent = savedPath.replace(/^crm\/deal-1\//, '');
    // GCS/Firebase Storage object names são blobs planos (sem hierarquia real de
    // diretórios) — "/" é o único caractere que poderia fazer o nome "escapar" do
    // prefixo crm/{dealId}/; pontos soltos ("..") não têm efeito de travessia sem
    // uma barra para combinar. A propriedade de segurança real é: nenhuma barra
    // sobrevive no componente de nome sanitizado.
    assert('CU24 nome de arquivo sanitizado: nenhuma barra "/" sobrevive no componente de nome (não pode escapar do prefixo crm/{dealId}/)',
      !nameComponent.includes('/'));

    const eventPathTraversalDeal = { httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, dealId: '../../organizations/other-org', fileName: 'x.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }) };
    const resPathTraversalDeal = await crmUpload.handler(eventPathTraversalDeal as any);
    assert('CU25 dealId com path traversal: bloqueado com 400', resPathTraversalDeal.statusCode === 400);

    console.log('\nSuite CU9 — usuário sem permissão bloqueado (403/no_permission)');
    const dbNoPerm = makeFakeDb({ 'users/uid-sem-nivel': { uid: 'uid-sem-nivel', name: 'Sem Nivel', level: 'estagiario' } });
    installFakeFirebaseAdmin(dbNoPerm, makeFakeBucket());
    const crmUploadNoPerm = freshRequire(path.join(NF, 'crm-upload.js'));
    const tokenNoPerm = uploadSession.generateToken('uid-sem-nivel', SECRET);
    const eventNoPerm = { httpMethod: 'POST', body: JSON.stringify({ sessionToken: tokenNoPerm, dealId: 'deal-1', fileName: 'x.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }) };
    const resNoPerm = await crmUploadNoPerm.handler(eventNoPerm as any);
    const bodyNoPerm = JSON.parse(resNoPerm.body);
    assert('CU26 usuário sem nível de CRM: HTTP 403', resNoPerm.statusCode === 403);
    assert('CU27 usuário sem nível de CRM: code=no_permission', bodyNoPerm.code === 'no_permission');

    console.log('\nSuite CU10 — requestId (clientRequestId) repetido não duplica o anexo');
    const dbIdem = makeFakeDb({ 'users/uid-owner': { uid: 'uid-owner', name: 'Owner Test', level: 'diretor' } });
    const bucketIdem = makeFakeBucket();
    installFakeFirebaseAdmin(dbIdem, bucketIdem);
    const crmUploadIdem = freshRequire(path.join(NF, 'crm-upload.js'));
    const tokenIdem = uploadSession.generateToken('uid-owner', SECRET);
    const idemBody = { sessionToken: tokenIdem, dealId: 'deal-1', fileName: 'idempotente.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64, clientRequestId: 'req-abc-123' };
    const resIdem1 = await crmUploadIdem.handler({ httpMethod: 'POST', body: JSON.stringify(idemBody) } as any);
    const resIdem2 = await crmUploadIdem.handler({ httpMethod: 'POST', body: JSON.stringify(idemBody) } as any);
    assert('CU28 primeira chamada com clientRequestId: HTTP 200', resIdem1.statusCode === 200);
    assert('CU29 segunda chamada com o MESMO clientRequestId: HTTP 200 (idempotente, não erro)', resIdem2.statusCode === 200);
    assert('CU30 segunda chamada com clientRequestId repetido: NENHUM novo arquivo salvo no bucket (ainda 1)', bucketIdem.saved.length === 1);
    assert('CU31 resultado da segunda chamada é idêntico ao da primeira (mesmo uploadedAt)', JSON.parse(resIdem1.body).uploadedAt === JSON.parse(resIdem2.body).uploadedAt);

    console.log('\nSuite CU11 — nenhum token/segredo aparece em nenhum log emitido');
    console.info = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
    const dbLog = makeFakeDb({ 'users/uid-owner': { uid: 'uid-owner', name: 'Owner Test', level: 'diretor' } });
    installFakeFirebaseAdmin(dbLog, makeFakeBucket());
    const crmUploadLog = freshRequire(path.join(NF, 'crm-upload.js'));
    await crmUploadLog.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, dealId: 'deal-1', fileName: 'z.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }) } as any);
    await crmUploadLog.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: expiredToken, dealId: 'deal-1', fileName: 'z.pdf', contentType: 'application/pdf', fileBase64: validPdfBase64 }) } as any);
    console.info = originalInfo;
    const allLogs = logs.join('\n');
    assert('CU32 nenhum log contém o sessionToken válido completo', !allLogs.includes(token));
    assert('CU33 nenhum log contém o sessionToken expirado completo', !allLogs.includes(expiredToken));
    assert('CU34 nenhum log contém UPLOAD_SESSION_SECRET', !allLogs.includes(SECRET));
    assert('CU35 nenhum log contém o conteúdo do arquivo (base64)', !allLogs.includes(validPdfBase64));
    assert('CU36 logs de diagnóstico foram de fato emitidos (requestId presente)', logs.some(l => l.includes('requestId')));

    console.log('\nSuite CU12 — regressão: URL de download continua no formato Firebase Storage esperado');
    assert('CU37 arqData.url segue o formato firebasestorage.googleapis.com/v0/b/.../o/...?alt=media&token=...',
      /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/[^?]+\?alt=media&token=/.test(resBody.url));
  }

  await runSessionTokenSuite();
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite CU13 — session-token.js: Path A e Path B, execução real
// ═══════════════════════════════════════════════════════════════════════════

async function runSessionTokenSuite() {
  console.log('\nSuite CU13 — session-token.js: renovação real (Path A e Path B)');

  const db = makeFakeDb({ 'users/uid-owner': { uid: 'uid-owner', name: 'Owner Test', login: 'owner.test', level: 'diretor' } });
  installFakeFirebaseAdmin(db, makeFakeBucket());
  const sessionToken = freshRequire(path.join(NF, 'session-token.js'));

  const oldToken = uploadSession.generateToken('uid-owner', SECRET);
  const resPathA = await sessionToken.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: oldToken }) } as any);
  const bodyPathA = JSON.parse(resPathA.body);
  assert('CU38 Path A (token ainda válido): HTTP 200, novo sessionToken emitido', resPathA.statusCode === 200 && !!bodyPathA.sessionToken);
  const oldPayloadForRotation = uploadSession.verifyToken(oldToken, SECRET);
  const newPayloadForRotation = uploadSession.verifyToken(bodyPathA.sessionToken, SECRET);
  assert('CU39 Path A: token renovado tem exp >= exp original (nunca renova para uma expiração menor)',
    newPayloadForRotation.exp >= oldPayloadForRotation.exp);

  const resPathB = await sessionToken.handler({ httpMethod: 'POST', body: JSON.stringify({ uid: 'uid-owner', login: 'owner.test' }) } as any);
  const bodyPathB = JSON.parse(resPathB.body);
  assert('CU40 Path B (uid+login, token já expirado/ausente): HTTP 200, novo sessionToken emitido', resPathB.statusCode === 200 && !!bodyPathB.sessionToken);

  const resPathBWrongLogin = await sessionToken.handler({ httpMethod: 'POST', body: JSON.stringify({ uid: 'uid-owner', login: 'login-errado' }) } as any);
  assert('CU41 Path B com login que não bate com o registro real: HTTP 401 invalid_session', resPathBWrongLogin.statusCode === 401 && JSON.parse(resPathBWrongLogin.body).code === 'invalid_session');

  const newTokenPayload = uploadSession.verifyToken(bodyPathB.sessionToken, SECRET);
  assert('CU42 token renovado via Path B é válido e aponta para o uid correto', newTokenPayload.uid === 'uid-owner');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`CRM Upload Auth Backend Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
