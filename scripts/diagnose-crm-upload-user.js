'use strict';

/**
 * ESA OS — Diagnóstico somente leitura de um usuário para o upload do CRM
 *
 * Ajuda a comparar um usuário que consegue anexar arquivos com outro que
 * recebe HTTP 401 — sem nunca expor credenciais, tokens ou segredos.
 *
 * Causa raiz confirmada nesta missão: o uid canônico de qualquer usuário é a
 * CHAVE do Firebase sob `users/{uid}` — nunca o campo `.uid` dentro do valor,
 * que pode estar ausente ou desatualizado em registros legados. Quando isso
 * acontecia, doLogin()/session-init.js geravam sessões sem uid utilizável,
 * e todo upload subsequente falhava com 401 (e a renovação Path B também
 * falhava, pois dependia do mesmo uid ausente).
 *
 * Uso:
 *   node scripts/diagnose-crm-upload-user.js --uid <uid> [--login <login>]
 *
 * Variáveis de ambiente obrigatórias:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — JSON da conta de serviço Firebase
 *   DATABASE_URL — URL do Firebase RTDB (opcional; cai no fallback do projeto)
 */

const DEFAULT_DATABASE_URL = 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';
const CRM_LEVELS = ['diretor', 'trafego', 'gestor', 'engenharia', 'executivo', 'sdr', 'jackeline'];

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

function maskLogin(login) {
  if (!login || typeof login !== 'string') return '(vazio)';
  if (login.length <= 3) return '*'.repeat(login.length);
  return login.slice(0, 2) + '*'.repeat(login.length - 3) + login.slice(-1);
}

function isUserActive(user) {
  if (!user) return false;
  if (user.active === false) return false;
  if (typeof user.status === 'string' && ['inactive', 'suspended', 'disabled'].includes(user.status.toLowerCase())) return false;
  return true;
}

// ── Núcleo (testável sem Firebase — recebe um `db` com .ref(path).once('value')) ──

async function diagnoseCrmUploadUser(db, args) {
  const report = {
    uidQueried: maskUid(args.uid),
    loginQueried: args.login ? maskLogin(args.login) : null,
    usersByUidKeyExists: false,
    usersByLoginKeyExists: false,
    storedUidFieldPresent: false,
    storedUidFieldMatchesKey: null,
    storedLoginMasked: null,
    role: null,
    roleAuthorizedForCrmUpload: false,
    active: null,
    aliasesFoundForLogin: 0,
    sessionFormatExpected: null,
    canRenewViaPathB: false,
  };

  // 1. users/{uid} — o caminho canônico.
  const byUidSnap = await db.ref(`users/${args.uid}`).once('value');
  const byUidUser = byUidSnap.val();
  report.usersByUidKeyExists = !!byUidUser;

  if (byUidUser) {
    report.storedUidFieldPresent = typeof byUidUser.uid === 'string' && byUidUser.uid.length > 0;
    report.storedUidFieldMatchesKey = report.storedUidFieldPresent ? byUidUser.uid === args.uid : false;
    report.storedLoginMasked = byUidUser.login ? maskLogin(byUidUser.login) : null;
    report.role = byUidUser.level || null;
    report.roleAuthorizedForCrmUpload = CRM_LEVELS.includes((byUidUser.level || '').toLowerCase().trim());
    report.active = isUserActive(byUidUser);

    // Formato de sessão esperado: se .uid bate com a chave, o código ANTIGO
    // (baseado no campo) e o NOVO (baseado na chave) coincidem — usuário
    // "funciona" de qualquer jeito. Se não bate ou está ausente, só o
    // código novo (baseado na chave) resolve a sessão corretamente.
    if (report.storedUidFieldMatchesKey) {
      report.sessionFormatExpected = 'consistente (campo .uid == chave — funcionava mesmo antes da correção)';
    } else if (report.storedUidFieldPresent) {
      report.sessionFormatExpected = 'DIVERGENTE (campo .uid != chave — só a resolução por chave corrige)';
    } else {
      report.sessionFormatExpected = 'LEGADO (campo .uid ausente — só a resolução por chave corrige)';
    }

    // Path B de renovação exige users/{uid}.login === login informado.
    if (args.login) {
      const normalized = args.login.trim().toLowerCase();
      report.canRenewViaPathB = typeof byUidUser.login === 'string' && byUidUser.login.trim().toLowerCase() === normalized;
    }
  }

  // 2. users/{login} — verifica se o login foi usado (por engano ou por
  //    convenção antiga) como a própria chave do registro.
  if (args.login) {
    const byLoginSnap = await db.ref(`users/${args.login}`).once('value');
    report.usersByLoginKeyExists = !!byLoginSnap.val();
  }

  // 3. Aliases — outros registros cujo campo .login bate com o mesmo login
  //    (duplicidade/conflito de identidade).
  if (args.login) {
    const allSnap = await db.ref('users').once('value');
    const all = allSnap.val() || {};
    const normalized = args.login.trim().toLowerCase();
    let count = 0;
    Object.entries(all).forEach(([key, u]) => {
      if (u && typeof u.login === 'string' && u.login.trim().toLowerCase() === normalized) count++;
    });
    report.aliasesFoundForLogin = count;
  }

  return report;
}

// ── Firebase (produção) ──────────────────────────────────────────────────────

async function runAgainstRealFirebase(args) {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.error('[DIAG-BLOCKED] FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
    return { blocked: true, reason: 'missing_credentials' };
  }

  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch {
    console.error('[DIAG-BLOCKED] FIREBASE_SERVICE_ACCOUNT_JSON: JSON malformado.');
    return { blocked: true, reason: 'invalid_credentials_json' };
  }

  const admin = require('firebase-admin');
  const databaseURL = resolveDatabaseUrl();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL });
  }
  const db = admin.database();

  let report;
  try {
    report = await diagnoseCrmUploadUser(db, args);
  } catch (err) {
    report = { blocked: true, reason: 'unexpected_error', error: err.message };
  }

  try { await admin.app().delete(); } catch (_) { /* best-effort cleanup */ }
  return report;
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--uid') { args.uid = argv[++i]; }
    else if (argv[i] === '--login') { args.login = argv[++i]; }
  }

  if (!args.uid) {
    console.error('Uso: node scripts/diagnose-crm-upload-user.js --uid <uid> [--login <login>]');
    process.exit(1);
  }

  runAgainstRealFirebase(args).then((report) => {
    console.log('\n═'.repeat(60));
    console.log('DIAGNÓSTICO DE USUÁRIO PARA UPLOAD DO CRM (somente leitura):');
    console.log(JSON.stringify(report, null, 2));
    console.log('═'.repeat(60));
    process.exit(report.blocked ? 1 : 0);
  }).catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { diagnoseCrmUploadUser, maskUid, maskLogin, isUserActive, resolveDatabaseUrl, CRM_LEVELS };
