'use strict';
/**
 * ESA OS — Login mobile: autenticação por login interno OU e-mail cadastrado
 *
 * INCIDENTE: no acesso mobile, o autofill do navegador preenche o campo LOGIN
 * com o e-mail cadastrado (ex.: lucas@esacapitalenergia.com.br). O sistema
 * retornava "Usuário não encontrado." mesmo o usuário existindo — porque
 * doLogin() (index.html) e resolveUserByLogin() (_shared/user-identity.js)
 * só comparavam o campo `login`, nunca `email`.
 *
 * CORREÇÃO: assets/user-identity-resolution.js (novo módulo UMD, fonte única
 * usada por backend E frontend) resolve por login OU e-mail cadastrado,
 * sempre por correspondência EXATA (trim + case-insensitive), nunca por
 * substring, nunca usando displayName/name, falhando de forma segura em
 * qualquer conflito. Mensagens de erro consolidadas em "Usuário ou senha
 * inválidos." (nunca mais diferenciar "não encontrado" de "senha incorreta").
 *
 * Suites:
 *   ML1 — assets/user-identity-resolution.js: resolução pura (login/email/uid, normalização, conflito)
 *   ML2 — backend (session-init.js): login por lucas_vizentin e por e-mail, ponta a ponta
 *   ML3 — session-token.js Path B: refresh continua funcionando (login-only e email-only)
 *   ML4 — crm-upload.js: upload não regride para usuário resolvido por e-mail
 *   ML5 — index.html: campo de login mobile/autofill, mensagem segura, underscore preservado
 *
 * Rodar: npx tsx tests/mobile-login-email-resolution.manual-test.ts
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

const resolution = require(path.join(ROOT, 'assets/user-identity-resolution.js'));
const currentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ═══════════════════════════════════════════════════════════════════════════
// Suite ML1 — resolveUserIdentifier(): resolução pura (login/email/uid)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\nSuite ML1 — resolveUserIdentifier(): login interno, e-mail, normalização, conflito');

{
  const users = {
    lucas_vizentin: { login: 'lucas_vizentin', email: 'lucas@esacapitalenergia.com.br', name: 'Lucas Vizentin', passHash: 'x' },
    exec_uid_diferente: { uid: 'algum_outro_valor', login: 'exec.divergente', email: 'exec.divergente@esacapitalenergia.com.br', passHash: 'x' },
    exec_legado_so_email: { email: 'legado@esacapitalenergia.com.br', name: 'Legado Só Email', passHash: 'x' }, // sem .login
    exec_sem_email: { login: 'exec.sememail', passHash: 'x' }, // sem .email
    dup_email_a: { login: 'dup.a', email: 'duplicado@esacapitalenergia.com.br', passHash: 'x' },
    dup_email_b: { login: 'dup.b', email: 'duplicado@esacapitalenergia.com.br', passHash: 'x' }, // conflito de e-mail
  };

  const byLogin = resolution.resolveUserIdentifier(users, 'lucas_vizentin');
  assert('ML01 login por lucas_vizentin (login interno exato)', byLogin && byLogin.uid === 'lucas_vizentin');

  const byEmail = resolution.resolveUserIdentifier(users, 'lucas@esacapitalenergia.com.br');
  assert('ML02 login por e-mail cadastrado resolve para o MESMO usuário canônico (uid lucas_vizentin)', byEmail && byEmail.uid === 'lucas_vizentin');

  const byEmailUpper = resolution.resolveUserIdentifier(users, 'LUCAS@ESACAPITALENERGIA.COM.BR');
  assert('ML03 e-mail com letras maiúsculas resolve igual (case-insensitive)', byEmailUpper && byEmailUpper.uid === 'lucas_vizentin');

  const byEmailSpaces = resolution.resolveUserIdentifier(users, '  lucas@esacapitalenergia.com.br  ');
  assert('ML04 espaços antes/depois do e-mail são ignorados (trim)', byEmailSpaces && byEmailSpaces.uid === 'lucas_vizentin');

  const byLoginSpaces = resolution.resolveUserIdentifier(users, '  lucas_vizentin  ');
  assert('ML05 espaços antes/depois do login são ignorados (trim)', byLoginSpaces && byLoginSpaces.uid === 'lucas_vizentin');

  const uidDiferente = resolution.resolveUserIdentifier(users, 'exec.divergente@esacapitalenergia.com.br');
  assert('ML06 uid diferente do login: resolve pela CHAVE real (exec_uid_diferente), nunca pelo campo .uid (algum_outro_valor)', uidDiferente && uidDiferente.uid === 'exec_uid_diferente' && uidDiferente.uid !== (uidDiferente.user as any).uid);

  const legado = resolution.resolveUserIdentifier(users, 'legado@esacapitalenergia.com.br');
  assert('ML07 usuário legado (sem campo login, só email) resolve corretamente', legado && legado.uid === 'exec_legado_so_email');

  const emailInexistente = resolution.resolveUserIdentifier(users, 'ninguem@esacapitalenergia.com.br');
  assert('ML08 e-mail inexistente: retorna null (nunca inventa associação)', emailInexistente === null);

  const conflito = resolution.resolveUserIdentifier(users, 'duplicado@esacapitalenergia.com.br');
  assert('ML09 conflito de e-mails (2 registros com o mesmo email): falha de forma segura (null), nunca "o melhor palpite"', conflito === null);

  assert('ML10 usuário sem campo email (só login): continua resolvendo por login normalmente', resolution.resolveUserIdentifier(users, 'exec.sememail')?.uid === 'exec_sem_email');

  assert('ML11 correspondência nunca por substring: "lucas" isolado não resolve para lucas_vizentin', resolution.resolveUserIdentifier(users, 'lucas') === null);
  assert('ML12 correspondência nunca por substring: "esacapitalenergia.com.br" isolado não resolve nada', resolution.resolveUserIdentifier(users, 'esacapitalenergia.com.br') === null);

  // Nunca usa displayName/name para resolução
  const usersComNomeParecido = { u1: { login: 'user1', email: 'user1@x.com', name: 'Lucas Vizentin', passHash: 'x' } };
  assert('ML13 nunca resolve por displayName/name — buscar por "Lucas Vizentin" não encontra nada', resolution.resolveUserIdentifier(usersComNomeParecido, 'Lucas Vizentin') === null);

  // uid direto (fallback) — só quando a chave existe literalmente e o valor não parece e-mail
  assert('ML14 uid direto: identificador igual à própria chave do Firebase resolve (fallback)', resolution.resolveUserIdentifier(users, 'exec_sem_email')?.uid === 'exec_sem_email');

  // canonicalSessionLogin
  assert('ML15 canonicalSessionLogin: usuário com login retorna o login', resolution.canonicalSessionLogin(users.lucas_vizentin) === 'lucas_vizentin');
  assert('ML16 canonicalSessionLogin: usuário legado sem login retorna o email', resolution.canonicalSessionLogin(users.exec_legado_so_email) === 'legado@esacapitalenergia.com.br');
}

// ═══════════════════════════════════════════════════════════════════════════
// Suite ML2 — Backend: session-init.js ponta a ponta (Firebase fake)
// ═══════════════════════════════════════════════════════════════════════════

process.env.UPLOAD_SESSION_SECRET = 'test-secret-for-mobile-login-suite';
const SECRET = process.env.UPLOAD_SESSION_SECRET as string;
const uploadSession = require(path.join(NF, '_shared/upload-session.js'));

type Tree = Record<string, unknown>;
function makeFakeDb(initial: Tree) {
  const tree: Tree = JSON.parse(JSON.stringify(initial));
  return {
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
  return { file(p: string) { return { async save() { /* noop */ } }; } };
}
function installFakeFirebaseAdmin(db: ReturnType<typeof makeFakeDb>) {
  const fbAdminPath = require.resolve(path.join(NF, '_shared/firebase-admin.js'));
  require.cache[fbAdminPath] = {
    id: fbAdminPath, filename: fbAdminPath, loaded: true,
    exports: {
      getDatabase: () => db,
      getBucket: () => makeFakeBucket(),
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

const crypto = require('crypto');
function sha256Hex(s: string) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

async function run() {
  const passHash = sha256Hex('senha-correta-123');
  const buildDb = () => makeFakeDb({
    users: {
      lucas_vizentin: { login: 'lucas_vizentin', email: 'lucas@esacapitalenergia.com.br', name: 'Lucas Vizentin', level: 'diretor', passHash },
    },
    'users/lucas_vizentin': { login: 'lucas_vizentin', email: 'lucas@esacapitalenergia.com.br', name: 'Lucas Vizentin', level: 'diretor', passHash },
  });

  console.log('\nSuite ML2 — session-init.js: login por lucas_vizentin e por e-mail (execução real)');
  {
    const db = buildDb();
    installFakeFirebaseAdmin(db);
    const sessionInit = freshRequire(path.join(NF, 'session-init.js'));
    const res = await sessionInit.handler({ httpMethod: 'POST', body: JSON.stringify({ login: 'lucas_vizentin', password: 'senha-correta-123' }) } as any);
    assert('ML17 login por lucas_vizentin: HTTP 200', res.statusCode === 200);
    const payload = uploadSession.verifyToken(JSON.parse(res.body).sessionToken, SECRET);
    assert('ML18 token emitido tem uid canônico = lucas_vizentin (a chave, nunca o e-mail)', payload.uid === 'lucas_vizentin');
  }
  {
    const db = buildDb();
    installFakeFirebaseAdmin(db);
    const sessionInit = freshRequire(path.join(NF, 'session-init.js'));
    const res = await sessionInit.handler({ httpMethod: 'POST', body: JSON.stringify({ login: 'lucas@esacapitalenergia.com.br', password: 'senha-correta-123' }) } as any);
    assert('ML19 login por E-MAIL (o incidente relatado): HTTP 200, não mais "usuário não encontrado"', res.statusCode === 200);
    const payload = uploadSession.verifyToken(JSON.parse(res.body).sessionToken, SECRET);
    assert('ML20 token emitido via e-mail: uid canônico = lucas_vizentin (NUNCA o e-mail usado como uid)', payload.uid === 'lucas_vizentin');
  }
  {
    const db = buildDb();
    installFakeFirebaseAdmin(db);
    const sessionInit = freshRequire(path.join(NF, 'session-init.js'));
    const res = await sessionInit.handler({ httpMethod: 'POST', body: JSON.stringify({ login: '  LUCAS@ESACAPITALENERGIA.COM.BR  ', password: 'senha-correta-123' }) } as any);
    assert('ML21 e-mail maiúsculo com espaços: ainda resolve (HTTP 200)', res.statusCode === 200);
  }
  console.log('\nSuite ML2b — mensagens seguras (nunca diferenciar usuário inexistente de senha incorreta)');
  {
    const db = buildDb();
    installFakeFirebaseAdmin(db);
    const sessionInit = freshRequire(path.join(NF, 'session-init.js'));
    const resSenhaErrada = await sessionInit.handler({ httpMethod: 'POST', body: JSON.stringify({ login: 'lucas_vizentin', password: 'senha-errada' }) } as any);
    const resEmailInexistente = await sessionInit.handler({ httpMethod: 'POST', body: JSON.stringify({ login: 'ninguem@esacapitalenergia.com.br', password: 'qualquer' }) } as any);
    assert('ML22 senha incorreta: HTTP 401', resSenhaErrada.statusCode === 401);
    assert('ML23 e-mail inexistente: HTTP 401 (mesmo código, não 404/400 diferenciado)', resEmailInexistente.statusCode === 401);
    assert('ML24 mensagens IDÊNTICAS para os dois casos (nunca vaza qual dos dois falhou)', JSON.parse(resSenhaErrada.body).error === JSON.parse(resEmailInexistente.body).error);
    assert('ML25 mensagem é exatamente "Usuário ou senha inválidos."', JSON.parse(resSenhaErrada.body).error === 'Usuário ou senha inválidos.');
  }

  console.log('\nSuite ML3 — session-token.js Path B: refresh continua funcionando após login por e-mail');
  {
    const db = buildDb();
    installFakeFirebaseAdmin(db);
    const sessionToken = freshRequire(path.join(NF, 'session-token.js'));
    // Path B: uid canônico + login CANÔNICO (o que doLogin() persiste: user.login,
    // não o e-mail bruto digitado) — deve continuar validando com sucesso.
    const res = await sessionToken.handler({ httpMethod: 'POST', body: JSON.stringify({ uid: 'lucas_vizentin', login: 'lucas_vizentin' }) } as any);
    assert('ML26 Path B com login canônico (lucas_vizentin): renovação OK (200)', res.statusCode === 200);
  }
  {
    // Usuário legado que só tem email (sem .login) — canonicalSessionLogin()
    // retorna o email, e Path B precisa aceitar isso.
    const db = makeFakeDb({
      users: { legado_uid: { email: 'legado@esacapitalenergia.com.br', passHash } },
      'users/legado_uid': { email: 'legado@esacapitalenergia.com.br', passHash },
    });
    installFakeFirebaseAdmin(db);
    const sessionToken = freshRequire(path.join(NF, 'session-token.js'));
    const res = await sessionToken.handler({ httpMethod: 'POST', body: JSON.stringify({ uid: 'legado_uid', login: 'legado@esacapitalenergia.com.br' }) } as any);
    assert('ML27 Path B para usuário legado (só email, sem login): renovação OK (200) — não regride', res.statusCode === 200);

    const resLoginErrado = await sessionToken.handler({ httpMethod: 'POST', body: JSON.stringify({ uid: 'legado_uid', login: 'outro@x.com' }) } as any);
    assert('ML28 Path B rejeita login/email que não bate com o canônico (401)', resLoginErrado.statusCode === 401);
  }

  console.log('\nSuite ML4 — crm-upload.js: não regride para usuário resolvido por e-mail');
  {
    const db = buildDb();
    installFakeFirebaseAdmin(db);
    const sessionInit = freshRequire(path.join(NF, 'session-init.js'));
    const loginRes = await sessionInit.handler({ httpMethod: 'POST', body: JSON.stringify({ login: 'lucas@esacapitalenergia.com.br', password: 'senha-correta-123' }) } as any);
    const token = JSON.parse(loginRes.body).sessionToken;

    const crmUpload = freshRequire(path.join(NF, 'crm-upload.js'));
    const uploadRes = await crmUpload.handler({ httpMethod: 'POST', body: JSON.stringify({ sessionToken: token, dealId: 'deal-1', fileName: 'contrato.pdf', contentType: 'application/pdf', fileBase64: Buffer.from('conteudo').toString('base64') }) } as any);
    assert('ML29 upload de CRM com token emitido via login por e-mail: HTTP 200 (não regride)', uploadRes.statusCode === 200);
    assert('ML30 uploadedBy reflete o usuário correto (Lucas Vizentin)', JSON.parse(uploadRes.body).uploadedBy === 'Lucas Vizentin');
  }

  console.log('\nSuite ML5 — index.html: campo de login mobile/autofill, underscore, mensagem segura (checagem estática)');
  {
    assert('ML31 script assets/user-identity-resolution.js é carregado', currentHtml.includes('<script src="/assets/user-identity-resolution.js"></script>'));
    assert('ML32 script carregado ANTES do script principal', currentHtml.indexOf('<script src="/assets/user-identity-resolution.js">') < currentHtml.indexOf('async function doLogin'));
    const loginInputMatch = /<input type="text" id="auth-login"[^>]*>/.exec(currentHtml);
    assert('ML33 campo de login existe', !!loginInputMatch);
    const loginInputHtml = loginInputMatch ? loginInputMatch[0] : '';
    assert('ML34 autocomplete="username" (não "email")', loginInputHtml.includes('autocomplete="username"') && !loginInputHtml.includes('autocomplete="email"'));
    assert('ML35 type="text" (aceita login com underscore e e-mail)', loginInputHtml.includes('type="text"'));
    assert('ML36 autocapitalize="off"', loginInputHtml.includes('autocapitalize="off"'));
    assert('ML37 autocorrect="off"', loginInputHtml.includes('autocorrect="off"'));
    assert('ML38 nenhum inputmode="email" (evita risco de prejudicar o underscore em login interno)', !loginInputHtml.includes('inputmode="email"'));
    assert('ML39 texto de apoio "Use seu login ou e-mail cadastrado." presente', currentHtml.includes('Use seu login ou e-mail cadastrado.'));
    assert('ML40 doLogin() NUNCA mais usa a mensagem "Usuário não encontrado."', !currentHtml.includes("errEl.textContent='Usuário não encontrado.'"));
    assert('ML41 doLogin() NUNCA mais usa a mensagem "Senha incorreta." isolada (mensagem unificada)', !currentHtml.includes("errEl.textContent='Senha incorreta.'"));
    assert('ML42 doLogin() usa resolveUserIdentifier() do módulo compartilhado, não mais Object.entries(users).find', currentHtml.includes('window.ESAUserIdentityResolution.resolveUserIdentifier(users, loginValRaw)'));
    assert('ML43 doLogin() persiste login canônico via canonicalSessionLogin() (nunca o texto bruto digitado)', currentHtml.includes('window.ESAUserIdentityResolution.canonicalSessionLogin(user)'));
    assert('ML44 doLogin() não força lowercase no valor do campo antes de resolver (preserva "lucas_vizentin" com underscore intacto)', !currentHtml.includes("document.getElementById('auth-login').value.trim().toLowerCase()"));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Mobile Login Email Resolution Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
