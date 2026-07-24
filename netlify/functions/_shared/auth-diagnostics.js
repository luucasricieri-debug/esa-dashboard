'use strict';

// ── ESA OS — Diagnóstico seguro e temporário do fluxo de autenticação ───────
// Habilitado só com CRM_UPLOAD_AUTH_DIAGNOSTICS=true. Nunca inclui token,
// assinatura, secret, credenciais Firebase, conteúdo de arquivo ou dados
// pessoais completos — apenas booleans/valores estruturais seguros.

const { ISSUER, AUDIENCE } = require('./upload-session');

function isAuthDiagnosticsEnabled() {
  return process.env.CRM_UPLOAD_AUTH_DIAGNOSTICS === 'true';
}

// Decodifica o payload do token SEM validar assinatura — usado apenas para
// relatar estrutura em diagnóstico; NUNCA para decisões de autorização (a
// autorização real sempre passa por verifyToken(), que valida a assinatura).
function inspectTokenUnsafe(token) {
  const out = {
    tokenPresent: !!token && typeof token === 'string',
    tokenVersion: null,
    uidPresent: false,
    loginPresent: false,
    issuerValid: false,
    audienceValid: false,
    expired: null,
  };
  if (!out.tokenPresent) return out;
  try {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return out;
    const body = token.slice(0, dot);
    const padded = body + '=='.slice(0, (4 - (body.length % 4)) % 4);
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    out.tokenVersion = typeof payload.version === 'number' ? payload.version : null;
    out.uidPresent = !!payload.uid;
    out.loginPresent = !!payload.login;
    out.issuerValid = payload.iss === ISSUER;
    out.audienceValid = payload.aud === AUDIENCE;
    out.expired = typeof payload.exp === 'number' ? Math.floor(Date.now() / 1000) > payload.exp : null;
  } catch {
    // payload ilegível — mantém os defaults seguros (tudo false/null)
  }
  return out;
}

function buildDiagnostics(stage, opts) {
  const o = opts || {};
  return {
    stage,
    tokenPresent: !!o.tokenPresent,
    tokenVersion: o.tokenVersion === undefined ? null : o.tokenVersion,
    uidPresent: !!o.uidPresent,
    loginPresent: !!o.loginPresent,
    issuerValid: !!o.issuerValid,
    audienceValid: !!o.audienceValid,
    expired: o.expired === undefined ? null : o.expired,
    refreshAttempted: !!o.refreshAttempted,
    refreshSucceeded: !!o.refreshSucceeded,
  };
}

module.exports = { isAuthDiagnosticsEnabled, inspectTokenUnsafe, buildDiagnostics };
