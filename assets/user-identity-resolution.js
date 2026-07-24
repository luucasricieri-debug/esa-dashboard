/**
 * ESA OS — Resolução canônica de identidade de login (login interno OU e-mail).
 *
 * Fonte única usada tanto pelo backend (netlify/functions/_shared/user-identity.js,
 * via require() Node) quanto pelo frontend (index.html, via
 * <script src="/assets/user-identity-resolution.js"> — window.ESAUserIdentityResolution).
 * Mesmo padrão UMD de assets/performance-goals.js, assets/lead-origin.js e
 * assets/attendance-performance.js.
 *
 * Incidente corrigido: no acesso mobile, o autofill do navegador preenchia o
 * campo login com o e-mail cadastrado (ex.: lucas@esacapitalenergia.com.br),
 * mas a resolução de usuário só comparava contra o campo `login` — nunca
 * `email` — retornando "Usuário não encontrado" mesmo com o usuário existindo
 * (cadastrado como login interno lucas_vizentin).
 *
 * Campos suportados (apenas os REALMENTE encontrados no banco — ver
 * netlify/functions/organization-members.js:177, que já usa `u.login || u.email`
 * como fallback de exibição): `login` e `email`. NUNCA displayName/name — esses
 * campos são apenas para exibição, nunca para autenticação.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ESAUserIdentityResolution = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Caracteres proibidos em chaves do Firebase Realtime Database — um e-mail
  // (que sempre contém '.') nunca pode ser, ele mesmo, uma chave válida, então
  // a tentativa de resolução direta por uid é pulada nesses casos.
  var FORBIDDEN_FIREBASE_KEY_CHARS = /[.#$[\]/]/;

  function normalizeIdentifier(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw.trim().toLowerCase();
  }

  // usersMap: objeto bruto de users/ (chave Firebase -> registro), já
  // carregado pelo chamador (uma única leitura — esta função nunca acessa
  // Firebase diretamente, é pura/testável).
  //
  // Prioridade de resolução: login exato > e-mail exato > uid direto (a
  // própria chave do Firebase, quando o identificador informado já é uma
  // chave existente). Em qualquer ambiguidade — mais de um registro batendo
  // o mesmo login ou o mesmo e-mail normalizado — retorna null: NUNCA "o
  // melhor palpite". Comparação sempre EXATA após trim + minúsculas; nunca
  // por substring/prefixo. Nunca usa displayName/name.
  function resolveUserIdentifier(usersMap, identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    var trimmed = identifier.trim();
    if (!trimmed) return null;
    var normalized = trimmed.toLowerCase();
    var users = usersMap || {};
    var keys = Object.keys(users);

    var loginMatches = [];
    for (var i = 0; i < keys.length; i++) {
      var u = users[keys[i]];
      if (u && typeof u.login === 'string' && u.login.trim().toLowerCase() === normalized) {
        loginMatches.push({ uid: keys[i], user: u });
      }
    }
    if (loginMatches.length === 1) return loginMatches[0];
    if (loginMatches.length > 1) return null; // conflito de login — falha segura

    var emailMatches = [];
    for (var j = 0; j < keys.length; j++) {
      var u2 = users[keys[j]];
      if (u2 && typeof u2.email === 'string' && u2.email.trim().toLowerCase() === normalized) {
        emailMatches.push({ uid: keys[j], user: u2 });
      }
    }
    if (emailMatches.length === 1) return emailMatches[0];
    if (emailMatches.length > 1) return null; // conflito de e-mail — falha segura

    // uid direto: só faz sentido quando o identificador não pode ser um
    // e-mail/valor com caracteres proibidos em chave do Firebase, e quando a
    // chave literalmente existe em usersMap — nunca uma inferência.
    if (!FORBIDDEN_FIREBASE_KEY_CHARS.test(trimmed) && Object.prototype.hasOwnProperty.call(users, trimmed)) {
      var directUser = users[trimmed];
      if (directUser) return { uid: trimmed, user: directUser };
    }

    return null;
  }

  // Identificador canônico para persistir em sessão (sessionStorage/localStorage)
  // após uma resolução bem-sucedida: sempre user.login quando presente; cai
  // para user.email apenas quando o registro não tem login (usuário legado
  // cadastrado só com e-mail) — nunca o texto bruto digitado pelo usuário
  // (que pode ter sido o e-mail mesmo quando o registro tem login interno).
  function canonicalSessionLogin(user) {
    if (!user) return '';
    if (typeof user.login === 'string' && user.login.trim()) return user.login;
    if (typeof user.email === 'string' && user.email.trim()) return user.email;
    return '';
  }

  return {
    normalizeIdentifier: normalizeIdentifier,
    resolveUserIdentifier: resolveUserIdentifier,
    canonicalSessionLogin: canonicalSessionLogin,
  };
});
