'use strict';

const crypto = require('crypto');

const TTL_SECONDS = 8 * 60 * 60;
const PURPOSE = 'crm-upload';

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
  const payload = { uid, iat: now, exp: now + TTL_SECONDS, purpose: PURPOSE };
  const body = toB64URL(JSON.stringify(payload));
  const sig = computeHMAC(body, secret);
  return `${body}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') throw new Error('token ausente ou inválido');
  const dot = token.lastIndexOf('.');
  if (dot <= 0) throw new Error('formato de token inválido');

  const body = token.slice(0, dot);
  const receivedSig = token.slice(dot + 1);

  const expectedSig = computeHMAC(body, secret);

  // Timing-safe comparison padded to equal length
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const paddedReceived = Buffer.alloc(expectedBuf.length, 0);
  Buffer.from(receivedSig, 'utf8').copy(paddedReceived, 0, 0, expectedBuf.length);

  if (!crypto.timingSafeEqual(expectedBuf, paddedReceived)) {
    throw new Error('assinatura inválida');
  }
  if (receivedSig.length !== expectedSig.length) {
    throw new Error('assinatura inválida');
  }

  let payload;
  try {
    payload = JSON.parse(fromB64URL(body));
  } catch (e) {
    throw new Error('payload inválido');
  }

  if (!payload.uid) throw new Error('uid ausente no token');
  if (typeof payload.iat !== 'number') throw new Error('iat inválido');
  if (typeof payload.exp !== 'number') throw new Error('exp inválido');
  if (Math.floor(Date.now() / 1000) > payload.exp) throw new Error('token expirado');
  if (payload.purpose !== PURPOSE) throw new Error('purpose incorreto');

  return payload;
}

module.exports = { generateToken, verifyToken, TTL_SECONDS, PURPOSE };
