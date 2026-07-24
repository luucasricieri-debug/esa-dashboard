'use strict';

/**
 * ESA OS — Diagnóstico somente leitura: usuários sem e-mail cadastrado
 *
 * Contexto: a partir da correção do login mobile (assets/user-identity-resolution.js),
 * um usuário pode entrar com login interno OU e-mail cadastrado. Usuários sem
 * o campo `email` preenchido em users/{uid} só conseguem entrar pelo login
 * interno — este script identifica quais são, para follow-up administrativo
 * (ex.: cadastrar e-mail), sem nunca escrever no Firebase e sem nunca expor
 * e-mail/login completos (sempre mascarados).
 *
 * Também reporta, apenas por contagem, usuários sem `login` (dependem só de
 * e-mail) e o caso extremo sem nenhum dos dois campos (inacessível por
 * identificador — sinalizado, nunca "corrigido" automaticamente aqui).
 *
 * Uso:
 *   node scripts/diagnose-users-without-email.js
 *
 * Variáveis de ambiente obrigatórias (para rodar contra o Firebase real):
 *   FIREBASE_SERVICE_ACCOUNT_JSON — JSON da conta de serviço Firebase
 *   DATABASE_URL — URL do Firebase RTDB (opcional; cai no fallback do projeto)
 */

const DEFAULT_DATABASE_URL = 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

// Mascara preservando apenas o suficiente para diferenciar registros em uma
// lista, sem nunca reconstituir o valor original (login ou e-mail).
function maskIdentifier(value) {
  if (!value || typeof value !== 'string') return '(vazio)';
  const trimmed = value.trim();
  if (!trimmed) return '(vazio)';
  if (trimmed.length <= 3) return trimmed[0] + '*'.repeat(trimmed.length - 1);
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
}

// Núcleo testável sem Firebase — recebe um `db` com .ref(path).once('value').
async function diagnoseUsersWithoutEmail(db) {
  const snap = await db.ref('users').once('value');
  const all = snap.val() || {};
  const keys = Object.keys(all);

  const report = {
    totalUsers: keys.length,
    usersWithEmail: 0,
    usersWithoutEmail: 0,
    usersWithLogin: 0,
    usersWithoutLogin: 0,
    usersWithNeitherLoginNorEmail: 0,
    withoutEmailList: [],
    neitherList: [],
  };

  keys.forEach((key) => {
    const u = all[key];
    if (!u) return;
    const hasEmail = typeof u.email === 'string' && u.email.trim().length > 0;
    const hasLogin = typeof u.login === 'string' && u.login.trim().length > 0;

    if (hasEmail) report.usersWithEmail++;
    else report.usersWithoutEmail++;

    if (hasLogin) report.usersWithLogin++;
    else report.usersWithoutLogin++;

    if (!hasEmail && !hasLogin) {
      report.usersWithNeitherLoginNorEmail++;
      report.neitherList.push({ uidMasked: maskUid(key) });
    } else if (!hasEmail) {
      report.withoutEmailList.push({ uidMasked: maskUid(key), loginMasked: maskIdentifier(u.login) });
    }
  });

  return report;
}

// ── Firebase (produção) ──────────────────────────────────────────────────────

async function runAgainstRealFirebase() {
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
    report = await diagnoseUsersWithoutEmail(db);
  } catch (err) {
    report = { blocked: true, reason: 'unexpected_error', error: err.message };
  }

  try { await admin.app().delete(); } catch (_) { /* best-effort cleanup */ }
  return report;
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  runAgainstRealFirebase().then((report) => {
    console.log('\n═'.repeat(60));
    console.log('DIAGNÓSTICO DE USUÁRIOS SEM E-MAIL CADASTRADO (somente leitura):');
    console.log(JSON.stringify(report, null, 2));
    console.log('═'.repeat(60));
    process.exit(report.blocked ? 1 : 0);
  }).catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { diagnoseUsersWithoutEmail, maskUid, maskIdentifier, resolveDatabaseUrl };
