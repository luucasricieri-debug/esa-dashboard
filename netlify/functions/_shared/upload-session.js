'use strict';

const crypto = require('crypto');

const TTL_SECONDS = 8 * 60 * 60;
const PURPOSE = 'crm-upload';
const ISSUER = 'esa-dashboard';
const AUDIENCE = 'crm-upload';

function tokenError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function toB64URL(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function fromB64URL(str) {
  const padded = str + '=='.slice(0, (4 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function computeHMAC(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateToken(uid, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { uid, iat: now, exp: now + TTL_SECONDS, purpose: PURPOSE, iss: ISSUER, aud: AUDIENCE };
  const body = toB64URL(JSON.stringify(payload));
  const sig = computeHMAC(body, secret);
  return `${body}.${sig}`;
}

// Lança um Error com `.code` — 'token_expired' quando a única falha é expiração
// (permite ao chamador acionar renovação automática); 'invalid_session' para
// qualquer outra falha estrutural/assinatura/issuer/audience (não renovável
// sem revalidar a sessão do zero).
function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') throw tokenError('invalid_session', 'token ausente ou inválido');
  const dot = token.lastIndexOf('.');
  if (dot <= 0) throw tokenError('invalid_session', 'formato de token inválido');

  const body = token.slice(0, dot);
  const receivedSig = token.slice(dot + 1);

  const expectedSig = computeHMAC(body, secret);

  // Timing-safe comparison padded to equal length
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const paddedReceived = Buffer.alloc(expectedBuf.length, 0);
  Buffer.from(receivedSig, 'utf8').copy(paddedReceived, 0, 0, expectedBuf.length);

  if (!crypto.timingSafeEqual(expectedBuf, paddedReceived)) {
    throw tokenError('invalid_session', 'assinatura inválida');
  }
  if (receivedSig.length !== expectedSig.length) {
    throw tokenError('invalid_session', 'assinatura inválida');
  }

  let payload;
  try {
    payload = JSON.parse(fromB64URL(body));
  } catch (e) {
    throw tokenError('invalid_session', 'payload inválido');
  }

  if (!payload.uid) throw tokenError('invalid_session', 'uid ausente no token');
  if (typeof payload.iat !== 'number') throw tokenError('invalid_session', 'iat inválido');
  if (typeof payload.exp !== 'number') throw tokenError('invalid_session', 'exp inválido');
  if (payload.iss !== ISSUER) throw tokenError('invalid_session', 'issuer incorreto');
  if (payload.aud !== AUDIENCE) throw tokenError('invalid_session', 'audience incorreta');
  if (payload.purpose !== PURPOSE) throw tokenError('invalid_session', 'purpose incorreto');
  // Expiração checada por último: um token estruturalmente válido mas vencido
  // deve retornar especificamente 'token_expired' (aciona renovação automática),
  // nunca 'invalid_session' (que exigiria novo login).
  if (Math.floor(Date.now() / 1000) > payload.exp) throw tokenError('token_expired', 'token expirado');

  return payload;
}

module.exports = { generateToken, verifyToken, TTL_SECONDS, PURPOSE, ISSUER, AUDIENCE };
