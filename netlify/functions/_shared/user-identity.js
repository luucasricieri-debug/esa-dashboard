'use strict';

// ── ESA OS — Resolução canônica de identidade autenticada ───────────────────
//
// Causa raiz do incidente "HTTP 401 para alguns usuários": doLogin() (index.html)
// e session-init.js resolviam o uid da sessão a partir do CAMPO `.uid` dentro
// do registro do usuário (`Object.values(users).find(...)`), em vez da CHAVE
// real do Firebase sob a qual o registro está armazenado. Registros legados
// sem o campo `.uid` preenchido geravam `_sessObj.uid = undefined` — e como
// JSON.stringify descarta chaves com valor undefined, o token emitido (e a
// sessão salva) simplesmente não carregavam uid nenhum. Path B de renovação
// (session-token.js) também dependia de `sess.uid`, então nunca conseguia
// recuperar essas sessões.
//
// A partir desta correção, o uid canônico de qualquer usuário é SEMPRE a
// chave do Firebase (`users/{uid}`) — nunca o campo `.uid` dentro do valor,
// que é tratado apenas como metadado redundante, nunca como fonte de verdade.

const { verifyToken } = require('./upload-session');
const { resolveUserIdentifier, canonicalSessionLogin } = require('../../../assets/user-identity-resolution.js');

function identityError(code, stage, message) {
  const err = new Error(message);
  err.code = code;
  err.stage = stage;
  return err;
}

// Localiza um usuário por LOGIN INTERNO ou E-MAIL cadastrado, escaneando
// `users` e retornando a CHAVE do Firebase como uid canônico — nunca o campo
// `.uid` do valor, nunca displayName/name. Usado por session-init.js
// (emissão) e por qualquer fluxo que precise resolver identificador → uid a
// partir de uma varredura, nunca confiando em um campo possivelmente
// ausente/desatualizado.
//
// Incidente corrigido (login mobile): o autofill do navegador preenche o
// campo login com o e-mail cadastrado (ex.: lucas@esacapitalenergia.com.br);
// antes desta correção, só o campo `login` era comparado, então o e-mail
// nunca resolvia, mesmo com o usuário existindo (cadastrado como
// lucas_vizentin). A regra de correspondência (login > email > uid direto,
// sempre exata, nunca substring, falha segura em conflito) vive em
// assets/user-identity-resolution.js — fonte única também usada pelo
// frontend (doLogin(), index.html), garantindo que backend e frontend nunca
// divirjam nessa lógica.
async function resolveUserByLogin(db, identifier) {
  if (!identifier || typeof identifier !== 'string') return null;
  const snap = await db.ref('users').once('value');
  const all = snap.val() || {};
  return resolveUserIdentifier(all, identifier);
}

// Política de usuário ativo: como o schema legado não tem um campo padrão de
// ativação, tratamos AUSÊNCIA do campo como ativo (compatibilidade com todo
// o histórico existente) — só bloqueia quando EXPLICITAMENTE marcado inativo.
function isUserActive(user) {
  if (!user) return false;
  if (user.active === false) return false;
  if (typeof user.status === 'string' && ['inactive', 'suspended', 'disabled'].includes(user.status.toLowerCase())) return false;
  return true;
}

// Fonte única de resolução de identidade para endpoints autenticados por
// sessionToken (Authorization/body). O uid retornado vem SEMPRE do payload do
// token já verificado — nunca de um uid enviado solto no body da requisição.
//
// Etapas (ver docs/CRM-UPLOAD-AUTH-RELIABILITY.md):
//   1. valida assinatura/estrutura do token (verifyToken)
//   2. extrai uid canônico do payload
//   3. localiza o usuário em users/{uid} (a mesma chave do token — nunca um
//      campo alternativo)
//   4. confirma usuário ativo
//   5. retorna uid canônico + perfil + role + versão do token
//
// Lança Error com .code/.stage em qualquer falha — o chamador decide o
// statusCode e a mensagem (nunca vaza detalhes sensíveis).
async function resolveAuthenticatedUserIdentity(db, sessionToken, secret) {
  let payload;
  try {
    payload = verifyToken(sessionToken, secret);
  } catch (e) {
    throw identityError(e.code || 'invalid_session', 'upload_initial_auth', e.message);
  }

  const uid = payload.uid;

  let user;
  try {
    const snap = await db.ref(`users/${uid}`).once('value');
    user = snap.val();
  } catch (e) {
    throw identityError('invalid_session', 'upload_initial_auth', 'Erro ao verificar usuário');
  }

  if (!user) {
    throw identityError('invalid_session', 'upload_initial_auth', 'Usuário não encontrado');
  }
  if (!isUserActive(user)) {
    throw identityError('invalid_session', 'upload_initial_auth', 'Usuário inativo');
  }

  return {
    uid,
    user,
    role: user.level || null,
    tokenVersion: typeof payload.version === 'number' ? payload.version : 1,
  };
}

module.exports = { resolveUserByLogin, resolveAuthenticatedUserIdentity, isUserActive, canonicalSessionLogin };
