'use strict';
/**
 * ESA OS — Session Compat Fix
 *
 * Valida que o módulo standalone trata corretamente sessões do dashboard
 * que não possuem sessionToken (criadas quando session-init falhou silenciosamente).
 *
 * Rodar: npx tsx tests/hotfix-session-compat.manual-test.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveSessionToken } from '../bootstrap/sessionResolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRT = path.resolve(__dirname, '..');
const ROOT = path.resolve(__dirname, '../../../../..');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

const sessionResSrc    = fs.readFileSync(path.join(DRT, 'bootstrap/sessionResolver.ts'), 'utf8');
const bootstrapSrc     = fs.readFileSync(path.join(DRT, 'bootstrap/standaloneProviderBootstrap.ts'), 'utf8');
const sessionTokenPath = path.join(ROOT, 'netlify/functions/session-token.js');
const sessionTokenSrc  = fs.existsSync(sessionTokenPath)
  ? fs.readFileSync(sessionTokenPath, 'utf8')
  : '';
const htmlSrc          = fs.readFileSync(path.join(ROOT, 'energy-credits-v2.html'), 'utf8');

// ── Suite 1: session-token.js existe e é estruturalmente correto ──────────────

console.log('\nSuite 1 — session-token.js: estrutura e segurança');

assert(
  'session-token.js existe em netlify/functions/',
  fs.existsSync(sessionTokenPath),
);
assert(
  'Path A: verifica token existente via verifyToken antes de emitir novo',
  sessionTokenSrc.includes('verifyToken'),
);
assert(
  'Path A: emite token renovado via generateToken após verificação',
  sessionTokenSrc.includes('generateToken') && sessionTokenSrc.includes('body.sessionToken'),
);
assert(
  'Path B: requer AMBOS uid E login (não aceita uid sozinho)',
  sessionTokenSrc.includes('!uid') && sessionTokenSrc.includes('!login'),
);
assert(
  'Path B: carrega usuário do Firebase por uid e compara login',
  sessionTokenSrc.includes('users/${uid}') || sessionTokenSrc.includes("users/'+uid+'") || sessionTokenSrc.includes('`users/${uid}`'),
);
assert(
  'Path B: retorna 401 se login não corresponde (rejeita uid spoofado)',
  sessionTokenSrc.includes("statusCode: 401") && sessionTokenSrc.includes('Sessão inválida'),
);

// ── Suite 2: sessionResolver.ts é async com troca de sessão ──────────────────

console.log('\nSuite 2 — sessionResolver.ts: resolução async + exchange');

assert(
  'resolveSessionToken é async',
  sessionResSrc.includes('export async function resolveSessionToken'),
);
assert(
  'chama exchangeSessionToken quando sessionToken ausente mas uid+login presentes',
  sessionResSrc.includes('exchangeSessionToken'),
);
assert(
  'exchange 401 retorna code unauthorized',
  sessionResSrc.includes("code: 'unauthorized'"),
);
assert(
  'erro de rede retorna code backend_unavailable',
  sessionResSrc.includes("code: 'backend_unavailable'"),
);
assert(
  'armazena token trocado no sessionStorage (cacheToken)',
  sessionResSrc.includes('cacheToken') && sessionResSrc.includes("sessionStorage.setItem('esa_session'"),
);

// ── Suite 3: standaloneProviderBootstrap.ts usa await + trata códigos ─────────

console.log('\nSuite 3 — standaloneProviderBootstrap.ts: await + mensagens de erro');

assert(
  'aguarda resolveSessionToken com await',
  bootstrapSrc.includes('await resolveSessionToken()'),
);
assert(
  'mapeia session_exchange_failed para mensagem orientada ao usuário',
  bootstrapSrc.includes('session_exchange_failed'),
);

// ── Suite 4: HTML cobre todos os códigos de sessão ────────────────────────────

console.log('\nSuite 4 — energy-credits-v2.html: mensagens de erro de sessão');

assert(
  'rtErrorMsg cobre no_session',
  htmlSrc.includes('"no_session"') && htmlSrc.includes('Faça login para acessar o painel'),
);
assert(
  'rtErrorMsg cobre backend_unavailable',
  htmlSrc.includes('"backend_unavailable"') && htmlSrc.includes('Serviço de autenticação indisponível'),
);
assert(
  'rtRetry redireciona para / em erros de sessão (não recarrega infinitamente)',
  htmlSrc.includes("window.location.href = '/'") && htmlSrc.includes('_rtSessionErrors'),
);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Session compat: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
