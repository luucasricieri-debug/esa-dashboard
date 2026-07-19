// ============================================================
// ESA OS — Energy Credits Direct Runtime
// Gate 7 — Real Persistence
//
// Verifica: Netlify Function, HTTP client, session resolver,
// persistent UIProvider wrapper, bootstrap hidratado, invariantes
// de segurança, e comportamento correto de escrita/leitura.
//
// Rodar: npx tsx tests/gate7-persistence.manual-test.ts
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHttpFirebaseClient, loadEnergyCreditsSnapshot } from '../bootstrap/httpFirebaseClient.js';
import { resolveSessionToken } from '../bootstrap/sessionResolver.js';
import { createPersistentUiProvider } from '../bootstrap/persistentUiProvider.js';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const DRT  = path.resolve(__dirname, '..');

const netlifyFnSrc   = fs.readFileSync(path.join(ROOT, 'netlify/functions/energy-credits-data.js'), 'utf8');
const httpClientSrc  = fs.readFileSync(path.join(DRT, 'bootstrap/httpFirebaseClient.ts'), 'utf8');
const sessionResSrc  = fs.readFileSync(path.join(DRT, 'bootstrap/sessionResolver.ts'), 'utf8');
const persistProvSrc = fs.readFileSync(path.join(DRT, 'bootstrap/persistentUiProvider.ts'), 'utf8');
const bootstrapSrc   = fs.readFileSync(path.join(DRT, 'bootstrap/standaloneProviderBootstrap.ts'), 'utf8');
const bundleSrc      = fs.readFileSync(path.join(ROOT, 'assets/energy-credits-runtime/provider-bootstrap.js'), 'utf8');
const rtProvSrc      = fs.readFileSync(path.join(DRT, 'providers/esaRuntimeProvider.ts'), 'utf8');

// ============================================================
// Suite CW — Netlify Function: estrutura e segurança
// ============================================================
async function suiteCW() {
  console.log('\nSuite CW — Netlify Function: energy-credits-data.js');

  assert('CW1 arquivo existe', fs.existsSync(path.join(ROOT, 'netlify/functions/energy-credits-data.js')));

  assert('CW2 importa firebase-admin via wrapper interno (_shared/firebase-admin)',
    netlifyFnSrc.includes("require('./_shared/firebase-admin')") &&
    !netlifyFnSrc.includes("require('firebase-admin')"));

  assert('CW3 importa verifyToken de _shared/upload-session',
    netlifyFnSrc.includes("require('./_shared/upload-session')"));

  // verifyToken(sessionToken, ...) must appear before any db.ref() call in the handler body
  assert('CW4 valida token antes de qualquer operação RTDB (verifyToken antes de db.ref)',
    netlifyFnSrc.indexOf('verifyToken(sessionToken') < netlifyFnSrc.indexOf('db.ref('));

  assert('CW5 uid extraído do token (nunca do body)',
    netlifyFnSrc.includes('payload.uid') &&
    !netlifyFnSrc.match(/body\s*\.\s*uid/));

  assert('CW6 path scoped por uid (users/${uid})',
    netlifyFnSrc.includes('users/${uid}'));

  assert('CW7 suporta operação snapshot (carrega todas as collections)',
    netlifyFnSrc.includes("operation === 'snapshot'") &&
    netlifyFnSrc.includes('energyCredits'));

  assert('CW8 valida collection contra EC_COLLECTIONS',
    netlifyFnSrc.includes('EC_COLLECTIONS') &&
    netlifyFnSrc.includes('generatingUnits') &&
    netlifyFnSrc.includes('beneficiaryUnits'));

  assert('CW9 sanitiza dados antes de escrever (FORBIDDEN_KEYS)',
    netlifyFnSrc.includes('FORBIDDEN_KEYS') &&
    netlifyFnSrc.includes('sanitize'));

  assert('CW10 exige id no value para operação set',
    netlifyFnSrc.includes("'id é obrigatório no value'") ||
    netlifyFnSrc.includes('id é obrigatório'));

  assert('CW11 força organizationId = uid em toda escrita',
    netlifyFnSrc.includes('organizationId: uid'));

  assert('CW12 sem PII em logs (sem console.log de dados do usuário)',
    !netlifyFnSrc.match(/console\.(log|info)\s*\([^)]*\b(uid|email|cpf|phone)\b/u));

  assert('CW13 sem dados financeiros em logs',
    !netlifyFnSrc.match(/console\.(log|info)\s*\([^)]*\b(value|data|amount)\b/u));

  assert('CW14 retorna { ok: false } sem lançar exceção não tratada',
    netlifyFnSrc.includes("{ ok: false, error:") &&
    !!netlifyFnSrc.match(/catch\s*\(/));
}

// ============================================================
// Suite CX — HTTP Firebase Client: comportamento e invariantes
// ============================================================
async function suiteCX() {
  console.log('\nSuite CX — HTTP Firebase Client: httpFirebaseClient.ts');

  assert('CX1 arquivo existe', fs.existsSync(path.join(DRT, 'bootstrap/httpFirebaseClient.ts')));

  assert('CX2 chama /.netlify/functions/energy-credits-data',
    httpClientSrc.includes('/.netlify/functions/energy-credits-data'));

  assert('CX3 exporta createHttpFirebaseClient',
    httpClientSrc.includes('export function createHttpFirebaseClient'));

  assert('CX4 exporta loadEnergyCreditsSnapshot',
    httpClientSrc.includes('export async function loadEnergyCreditsSnapshot'));

  assert('CX5 get() retorna result.data',
    httpClientSrc.includes('result.data'));

  assert('CX6 set() lança erro se !result.ok',
    httpClientSrc.includes('!result.ok'));

  assert('CX7 sem import de Firebase SDK',
    !httpClientSrc.includes('firebase') &&
    !httpClientSrc.includes('admin'));

  assert('CX8 usa fetch (não XMLHttpRequest nem axios)',
    httpClientSrc.includes('fetch(') &&
    !httpClientSrc.includes('XMLHttpRequest') &&
    !httpClientSrc.includes('axios'));

  // createHttpFirebaseClient e loadEnergyCreditsSnapshot podem ser instanciados
  const client = createHttpFirebaseClient('fake.token.sig');
  assert('CX9 createHttpFirebaseClient retorna objeto com get e set',
    typeof client.get === 'function' && typeof client.set === 'function');
}

// ============================================================
// Suite CY — Session Resolver: leitura de token
// ============================================================
async function suiteCY() {
  console.log('\nSuite CY — Session Resolver: sessionResolver.ts');

  assert('CY1 arquivo existe', fs.existsSync(path.join(DRT, 'bootstrap/sessionResolver.ts')));

  assert('CY2 exporta resolveSessionToken',
    sessionResSrc.includes('export function resolveSessionToken'));

  assert('CY3 lê de sessionStorage.getItem("esa_session")',
    sessionResSrc.includes('"esa_session"') || sessionResSrc.includes("'esa_session'"));

  assert('CY4 lê de localStorage.getItem("esa_remember") como fallback',
    sessionResSrc.includes('"esa_remember"') || sessionResSrc.includes("'esa_remember'"));

  assert('CY5 retorna null se token ausente',
    sessionResSrc.includes('return null'));

  assert('CY6 sem PII em logs',
    !sessionResSrc.match(/console\.(log|info|warn)\s*\(/));

  // resolveSessionToken retorna null em ambiente Node (sem sessionStorage/localStorage)
  const token = resolveSessionToken();
  assert('CY7 resolveSessionToken retorna null em ambiente sem sessão (Node)', token === null);
}

// ============================================================
// Suite CZ — Persistent UIProvider: write-through + read pass-through
// ============================================================
async function suiteCZ() {
  console.log('\nSuite CZ — Persistent UIProvider: persistentUiProvider.ts');

  assert('CZ1 arquivo existe', fs.existsSync(path.join(DRT, 'bootstrap/persistentUiProvider.ts')));

  assert('CZ2 exporta createPersistentUiProvider',
    persistProvSrc.includes('export function createPersistentUiProvider'));

  assert('CZ3 intercepta createGeneratingUnit',
    persistProvSrc.includes('createGeneratingUnit'));

  assert('CZ4 intercepta updateGeneratingUnit',
    persistProvSrc.includes('updateGeneratingUnit'));

  assert('CZ5 intercepta createBeneficiaryUnit',
    persistProvSrc.includes('createBeneficiaryUnit'));

  assert('CZ6 intercepta updateBeneficiaryUnit',
    persistProvSrc.includes('updateBeneficiaryUnit'));

  assert('CZ7 usa crypto.randomUUID() para IDs em creates',
    persistProvSrc.includes('crypto.randomUUID()'));

  // Firebase save call (fbResult.ok check) must appear before syncStores call inside createUnit
  assert('CZ8 escreve no Firebase ANTES de atualizar memória (Firebase-first)',
    persistProvSrc.includes('fbResult.ok') &&
    persistProvSrc.indexOf('fbResult.ok') < persistProvSrc.lastIndexOf('syncStores('));

  assert('CZ9 retorna { ok: false } se Firebase falha (sem fake persisted:true)',
    persistProvSrc.includes('backendError') || persistProvSrc.includes('BACKEND_UNAVAILABLE'));

  assert('CZ10 usa Proxy para pass-through de métodos de leitura',
    persistProvSrc.includes('new Proxy'));

  assert('CZ11 escreve audit log (appendCreditAuditLog)',
    persistProvSrc.includes('appendCreditAuditLog'));

  assert('CZ12 audit log é best-effort (não bloqueia escrita)',
    persistProvSrc.includes('.catch(') || persistProvSrc.includes('catch(() =>'));

  assert('CZ13 sem PII em logs de erros',
    !persistProvSrc.match(/console\.(log|info)\s*\([^)]*\b(input|patch|entity)\b/));

  assert('CZ14 sem dados financeiros expostos',
    !persistProvSrc.match(/console\.(log|info)\s*\([^)]*\b(price|value|amount)\b/));

  // Behavioral test: write-through creates with faked Firebase
  const calls: Array<{ method: string; path: string; value: unknown }> = [];
  const readModelUpdates: unknown[] = [];

  const fakeFirebaseRepo = {
    saveGeneratingUnit: async (entity: unknown) => {
      calls.push({ method: 'saveGeneratingUnit', path: '', value: entity });
      return { ok: true };
    },
    saveBeneficiaryUnit: async (entity: unknown) => {
      calls.push({ method: 'saveBeneficiaryUnit', path: '', value: entity });
      return { ok: true };
    },
    appendCreditAuditLog: async () => ({ ok: true }),
  };

  const fakeMemoryRepo = {
    _guMap: new Map<string, unknown>(),
    _ubMap: new Map<string, unknown>(),
    saveGeneratingUnit(u: { id: string }) { this._guMap.set(u.id, u); return { ok: true }; },
    saveBeneficiaryUnit(u: { id: string }) { this._ubMap.set(u.id, u); return { ok: true }; },
    getGeneratingUnit(id: string) { return { ok: true, data: this._guMap.get(id) ?? null }; },
    getBeneficiaryUnit(id: string) { return { ok: true, data: this._ubMap.get(id) ?? null }; },
  };

  const fakeEsa = {
    hydrateEnergyCreditsReadModel(snapshot: unknown) { readModelUpdates.push(snapshot); },
  };

  // Inner provider: always returns ok from domain
  const fakeInner = {
    createGeneratingUnit: (input: { id: string; name: string }) => ({ ok: true, data: { ...input, status: 'active' } }),
    updateGeneratingUnit: () => ({ ok: true, data: {} }),
    createBeneficiaryUnit: (input: { id: string; name: string }) => ({ ok: true, data: { ...input, status: 'active' } }),
    updateBeneficiaryUnit: () => ({ ok: true, data: {} }),
    listSomething: () => [1, 2, 3],
  };

  const provider = createPersistentUiProvider(
    fakeInner as Record<string, (...args: unknown[]) => unknown>,
    fakeFirebaseRepo,
    fakeMemoryRepo,
    fakeEsa,
    'test-uid',
  );

  // CZ15: createGeneratingUnit calls Firebase and updates memory + read model
  const createResult = await (provider.createGeneratingUnit as (i: unknown) => Promise<{ ok: boolean }>) ({
    name: 'Usina Teste', capacity: 100,
  });
  assert('CZ15 createGeneratingUnit retorna ok:true', createResult.ok === true);
  assert('CZ16 createGeneratingUnit chamou saveGeneratingUnit no Firebase',
    calls.some(c => c.method === 'saveGeneratingUnit'));
  assert('CZ17 createGeneratingUnit atualizou o read model',
    readModelUpdates.length > 0);

  // CZ18: read methods pass through to inner
  const listResult = (provider.listSomething as () => unknown[])();
  assert('CZ18 métodos de leitura passam pelo inner (Proxy pass-through)',
    Array.isArray(listResult) && listResult.length === 3);

  // CZ19: updateGeneratingUnit with existing entity
  const ugId = 'ug-test-' + Date.now();
  fakeMemoryRepo.saveGeneratingUnit({ id: ugId, name: 'UG Original' } as { id: string; name: string });
  const updateResult = await (provider.updateGeneratingUnit as (id: string, p: unknown) => Promise<{ ok: boolean }>)(
    ugId, { name: 'UG Atualizada' }
  );
  assert('CZ19 updateGeneratingUnit com entidade existente retorna ok:true', updateResult.ok === true);

  // CZ20: updateGeneratingUnit with non-existent entity returns { ok: false }
  const notFoundResult = await (provider.updateGeneratingUnit as (id: string, p: unknown) => Promise<{ ok: boolean }>)(
    'nao-existe', { name: 'X' }
  );
  assert('CZ20 updateGeneratingUnit com entidade inexistente retorna ok:false', notFoundResult.ok === false);
}

// ============================================================
// Suite DA — Bootstrap Gate 7: hidratação e provider persistente
// ============================================================
async function suiteDA() {
  console.log('\nSuite DA — Bootstrap Gate 7: standaloneProviderBootstrap.ts');

  assert('DA1 importa resolveSessionToken',
    bootstrapSrc.includes("from './sessionResolver.js'") ||
    bootstrapSrc.includes("from './sessionResolver'"));

  assert('DA2 importa createHttpFirebaseClient',
    bootstrapSrc.includes('createHttpFirebaseClient'));

  assert('DA3 importa loadEnergyCreditsSnapshot',
    bootstrapSrc.includes('loadEnergyCreditsSnapshot'));

  assert('DA4 importa createPersistentUiProvider',
    bootstrapSrc.includes('createPersistentUiProvider'));

  assert('DA5 verifica sessão antes de prosseguir',
    bootstrapSrc.includes('resolveSessionToken') &&
    bootstrapSrc.includes('no_session'));

  assert('DA6 hidrata memoryRepo (hydrateFromSnapshot)',
    bootstrapSrc.includes('hydrateFromSnapshot'));

  assert('DA7 hidrata read model (hydrateEnergyCreditsReadModel)',
    bootstrapSrc.includes('hydrateEnergyCreditsReadModel'));

  assert('DA8 cria Firebase repo via ESA.createEnergyCreditsFirebaseRepository',
    bootstrapSrc.includes('createEnergyCreditsFirebaseRepository'));

  assert('DA9 cria provider persistente via createPersistentUiProvider',
    bootstrapSrc.includes('createPersistentUiProvider'));

  assert('DA10 sem PII em logs',
    !bootstrapSrc.match(/console\.(log|info)\s*\([^)]*\b(uid|email|cpf|document|pixKey)\b/));

  assert('DA11 sem dados financeiros em logs',
    !bootstrapSrc.match(/console\.(log|info)\s*\([^)]*\b(price|value|amount|balance)\b/));

  assert('DA12 sem Firebase SDK diretamente',
    !bootstrapSrc.match(/from\s+['"`]firebase/) &&
    !bootstrapSrc.includes('firebase-admin'));

  assert('DA13 bundle provider-bootstrap.js inclui loadEnergyCreditsSnapshot',
    bundleSrc.includes('loadEnergyCreditsSnapshot') ||
    bundleSrc.includes('/.netlify/functions/energy-credits-data'));

  // calculationMemory must not be returned in provider outputs (it may exist as internal engine state)
  assert('DA14 bootstrap não retorna calculationMemory para a UI',
    !bootstrapSrc.includes('calculationMemory') &&
    !persistProvSrc.includes('calculationMemory') &&
    !httpClientSrc.includes('calculationMemory'));
}

// ============================================================
// Suite DB — esaRuntimeProvider: await + UUID em creates
// ============================================================
async function suiteDB() {
  console.log('\nSuite DB — esaRuntimeProvider.ts: await + crypto.randomUUID()');

  assert('DB1 createGeneratingUnit usa await antes da chamada ao uiProvider',
    rtProvSrc.includes('await uiProvider.createGeneratingUnit'));

  assert('DB2 createGeneratingUnit injeta id via crypto.randomUUID()',
    rtProvSrc.includes('crypto.randomUUID()') &&
    !!rtProvSrc.match(/createGeneratingUnit[\s\S]{0,200}crypto\.randomUUID\(\)/));

  assert('DB3 createBeneficiaryUnit usa await antes da chamada ao uiProvider',
    rtProvSrc.includes('await uiProvider.createBeneficiaryUnit'));

  assert('DB4 createBeneficiaryUnit injeta id via crypto.randomUUID()',
    rtProvSrc.includes('createBeneficiaryUnit') &&
    !!rtProvSrc.match(/createBeneficiaryUnit[\s\S]{0,200}crypto\.randomUUID\(\)/));

  assert('DB5 updateGeneratingUnit usa await',
    rtProvSrc.includes('await uiProvider.updateGeneratingUnit'));

  assert('DB6 updateBeneficiaryUnit usa await',
    rtProvSrc.includes('await uiProvider.updateBeneficiaryUnit'));

  assert('DB7 { ok: false } propagado para o chamador (não swallowed por ?? ok())',
    rtProvSrc.includes('result.ok === false') || rtProvSrc.includes('result?.ok === false'));
}

// ============================================================
// Execução
// ============================================================
(async () => {
  console.log('='.repeat(60));
  console.log('Gate 7 — Persistência Real no Runtime de Créditos');
  console.log('='.repeat(60));

  await suiteCW();
  await suiteCX();
  await suiteCY();
  await suiteCZ();
  await suiteDA();
  await suiteDB();

  console.log('\n' + '='.repeat(60));
  console.log(`Gate 7 Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
