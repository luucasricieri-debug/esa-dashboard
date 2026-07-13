/**
 * ESA OS — Core
 * Suite de testes — ESAApplication.createEnergyCreditsFirebaseRepository (factory)
 * 15 cenários
 *
 * Execução: node src/core/app.energy-credits-firebase-repository.manual-test.js
 *
 * Sem Firebase real. Sem Jest. Sem browser. ES Modules nativos.
 * Usa mock de firebaseClient.
 */

import { ESA }                              from './app.js';
import { EnergyCreditsFirebaseRepository }  from '../repositories/energy-credits/energy-credits-firebase-repository.js';
import { EnergyCreditsMemoryRepository }    from '../repositories/energy-credits/energy-credits-memory-repository.js';

// ── Runner ─────────────────────────────────────────────────────────────────

let total  = 0;
let failed = 0;

function assert(condition, label) {
  total++;
  if (!condition) {
    failed++;
    console.error(`  ✗ FALHOU: ${label}`);
  }
}

function section(n, title) {
  console.log(`\n[${n}] ${title}`);
}

function createMockClient() {
  const store = {};
  return {
    async get(path)        { return store[path] || null; },
    async set(path, value) { store[path] = value; },
    async remove(path)     { delete store[path]; },
  };
}

// ── 1. createEnergyCreditsFirebaseRepository existe ───────────────────────

section(1, 'createEnergyCreditsFirebaseRepository existe e retorna instância correta');

assert(typeof ESA.createEnergyCreditsFirebaseRepository === 'function', '1.1 método existe');

const mockClient = createMockClient();
const fbRepo     = ESA.createEnergyCreditsFirebaseRepository(mockClient);
assert(fbRepo instanceof EnergyCreditsFirebaseRepository, '1.2 retorna EnergyCreditsFirebaseRepository');

const fbRepo2    = ESA.createEnergyCreditsFirebaseRepository(mockClient, { env: 'test' });
assert(fbRepo2 instanceof EnergyCreditsFirebaseRepository, '1.3 aceita options');

// ── 2. Sem client — retorna instância (não falha no constructor) ─────────

section(2, 'Factory funciona sem client — instância retorna erros controlados');

const fbNoClient = ESA.createEnergyCreditsFirebaseRepository(null);
assert(fbNoClient instanceof EnergyCreditsFirebaseRepository, '2.1 instancia sem client');
assert(fbNoClient.getStats().hasClient === false, '2.2 hasClient = false sem client');

// ── 3. Não altera getEnergyCreditsRepository padrão ───────────────────────

section(3, 'Factory não altera o repository padrão da aplicação');

const defaultRepo = ESA.getEnergyCreditsRepository();
assert(defaultRepo instanceof EnergyCreditsMemoryRepository, '3.1 padrão continua MemoryRepository');

ESA.createEnergyCreditsFirebaseRepository(mockClient);
const defaultRepo2 = ESA.getEnergyCreditsRepository();
assert(defaultRepo2 instanceof EnergyCreditsMemoryRepository, '3.2 padrão ainda MemoryRepository após factory');
assert(defaultRepo === defaultRepo2, '3.3 mesma referência singleton');

// ── 4. Factory não hidrata automaticamente ────────────────────────────────

section(4, 'Factory não hidrata readModel automaticamente');

const fbRepoInert = ESA.createEnergyCreditsFirebaseRepository(mockClient);
const stats       = ESA.getEnergyCreditsRepositoryStats();
assert(stats.type === 'memory', '4.1 stats do repository padrão = memory');

// Verificar que o repositório firebase não está no hydrator padrão
const hydrateResult = ESA.hydrateEnergyCreditsFromRepository({ replace: false });
assert(hydrateResult.metadata.source === 'memory-repository', '4.2 hydrate usa MemoryRepository');

// ── 5. Factory não salva dados automaticamente ────────────────────────────

section(5, 'Factory não salva dados automaticamente no Firebase');

const mockTrackClient = { setCalls: [], ...createMockClient() };
let trackSetCalls = 0;
const trackClient = {
  async get(path)        { return null; },
  async set(path, value) { trackSetCalls++; },
  async remove(path)     {},
};

ESA.createEnergyCreditsFirebaseRepository(trackClient);
assert(trackSetCalls === 0, '5.1 nenhum set automático no Firebase ao criar factory');

// ── 6. getStats da instância criada pela factory ──────────────────────────

section(6, 'getStats da instância criada pela factory');

const fbStatRepo = ESA.createEnergyCreditsFirebaseRepository(mockClient);
const fbStats    = fbStatRepo.getStats();
assert(fbStats.type === 'firebase',   '6.1 type = firebase');
assert(fbStats.hasClient === true,    '6.2 hasClient = true com client');
assert(Array.isArray(fbStats.clientMethods), '6.3 clientMethods array');
assert(fbStats.clientMethods.includes('get'), '6.4 get listado');
assert(fbStats.clientMethods.includes('set'), '6.5 set listado');

// ── Resultado ─────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
