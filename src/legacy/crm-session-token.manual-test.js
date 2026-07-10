/**
 * ESA OS — Hotfix: crm-upload-arquivos — Ponte Segura
 * Suite: SESSION TOKEN — geração e validação HMAC-SHA256
 * 9 cenários
 *
 * Execução: node src/legacy/crm-session-token.manual-test.js
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { generateToken, verifyToken, TTL_SECONDS, PURPOSE } = require('../../netlify/functions/_shared/upload-session.js');

// ── Runner ─────────────────────────────────────────────────────────────────────

let total = 0;
let failed = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function assertThrows(fn, msgSubstring, label) {
  total++;
  let threw = false;
  try {
    fn();
    threw = false;
  } catch (e) {
    threw = true;
    if (msgSubstring && !e.message.includes(msgSubstring)) {
      failed++;
      console.error(`  ✗ FALHOU (mensagem errada): ${label}\n    esperado: "${msgSubstring}"\n    recebido: "${e.message}"`);
      return;
    }
  }
  if (!threw) {
    failed++;
    console.error(`  ✗ FALHOU (não lançou): ${label}`);
  }
}

function section(n, title) {
  console.log(`\n[${n}/9] ${title}`);
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const SECRET = 'supersecreto_para_testes_unitarios_apenas';
const UID = 'uid_paulo_oliveira_test';

// ── Cenários ───────────────────────────────────────────────────────────────────

section(1, 'TTL e PURPOSE estão corretos');
{
  assert(TTL_SECONDS === 8 * 60 * 60, `TTL_SECONDS = ${TTL_SECONDS} (esperado: ${8 * 60 * 60})`);
  assert(PURPOSE === 'crm-upload', `PURPOSE = "${PURPOSE}" (esperado: "crm-upload")`);
}

section(2, 'generateToken gera token no formato body.sig');
{
  const token = generateToken(UID, SECRET);
  assert(typeof token === 'string', 'token é string');
  const parts = token.split('.');
  assert(parts.length === 2, 'token tem exatamente dois segmentos separados por "."');
  assert(parts[0].length > 10, 'body (segmento 0) não é vazio');
  assert(parts[1].length > 10, 'sig (segmento 1) não é vazio');
}

section(3, 'verifyToken retorna payload com campos corretos');
{
  const before = Math.floor(Date.now() / 1000);
  const token = generateToken(UID, SECRET);
  const after = Math.floor(Date.now() / 1000);
  const payload = verifyToken(token, SECRET);

  assert(payload.uid === UID, `uid correto: "${payload.uid}"`);
  assert(payload.purpose === PURPOSE, `purpose correto: "${payload.purpose}"`);
  assert(typeof payload.iat === 'number', 'iat é número');
  assert(typeof payload.exp === 'number', 'exp é número');
  assert(payload.iat >= before && payload.iat <= after + 1, 'iat dentro da janela de tempo');
  assert(payload.exp === payload.iat + TTL_SECONDS, `exp = iat + TTL (${TTL_SECONDS}s)`);
}

section(4, 'verifyToken rejeita token com assinatura inválida');
{
  const token = generateToken(UID, SECRET);
  const parts = token.split('.');
  const tampered = parts[0] + '.' + parts[1].slice(0, -1) + 'X';
  assertThrows(() => verifyToken(tampered, SECRET), 'assinatura inválida', 'assinatura corrompida → throw');
}

section(5, 'verifyToken rejeita token com secret errado');
{
  const token = generateToken(UID, SECRET);
  assertThrows(() => verifyToken(token, SECRET + '_errado'), 'assinatura inválida', 'secret diferente → throw');
}

section(6, 'verifyToken rejeita token expirado');
{
  // Simular token com exp no passado manipulando o payload diretamente
  function toB64URL(str) {
    return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  const crypto = require('crypto');
  function computeHMAC(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  const expiredPayload = { uid: UID, iat: 1000, exp: 1001, purpose: PURPOSE };
  const body = toB64URL(JSON.stringify(expiredPayload));
  const sig = computeHMAC(body, SECRET);
  const expiredToken = `${body}.${sig}`;

  assertThrows(() => verifyToken(expiredToken, SECRET), 'expirado', 'token expirado → throw');
}

section(7, 'verifyToken rejeita token com purpose incorreto');
{
  function toB64URL(str) {
    return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  const crypto = require('crypto');
  function computeHMAC(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  const now = Math.floor(Date.now() / 1000);
  const wrongPurpose = { uid: UID, iat: now, exp: now + 3600, purpose: 'outro-propósito' };
  const body = toB64URL(JSON.stringify(wrongPurpose));
  const sig = computeHMAC(body, SECRET);
  const wrongToken = `${body}.${sig}`;

  assertThrows(() => verifyToken(wrongToken, SECRET), 'purpose incorreto', 'purpose incorreto → throw');
}

section(8, 'verifyToken rejeita token com payload inválido');
{
  const lixo = 'naoBase64URL!!!!.qualquercoisa';
  assertThrows(() => verifyToken(lixo, SECRET), '', 'payload lixo → throw');

  const vazio = '';
  assertThrows(() => verifyToken(vazio, SECRET), '', 'token vazio → throw');

  const semPonto = 'aGVsbG8';
  assertThrows(() => verifyToken(semPonto, SECRET), '', 'token sem ponto → throw');
}

section(9, 'timingSafeEqual path — assinaturas do mesmo comprimento com conteúdo diferente são rejeitadas');
{
  // Gerar dois tokens com UID diferentes → assinaturas diferentes mas mesmo comprimento
  const token1 = generateToken('uid_user_A', SECRET);
  const token2 = generateToken('uid_user_B', SECRET);

  const [body1] = token1.split('.');
  const [, sig2] = token2.split('.');

  // Combinar body de uid_A com sig de uid_B — assinatura válida para uid_B mas não para uid_A
  const crossedToken = `${body1}.${sig2}`;

  assertThrows(
    () => verifyToken(crossedToken, SECRET),
    'assinatura inválida',
    'assinatura de uid diferente rejeitada em tempo constante',
  );

  // Garantir que cada token original é aceito
  const payload1 = verifyToken(token1, SECRET);
  const payload2 = verifyToken(token2, SECRET);
  assert(payload1.uid === 'uid_user_A', 'token uid_A aceito corretamente');
  assert(payload2.uid === 'uid_user_B', 'token uid_B aceito corretamente');
}

// ── Resultado ──────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ PASSOU: ${total}/${total} cenários`);
} else {
  console.log(`❌ FALHOU: ${failed}/${total} cenários`);
  process.exit(1);
}
