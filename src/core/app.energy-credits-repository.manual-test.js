/**
 * ESA OS — Core
 * Suite de testes — ESAApplication + Energy Credits Repository
 * 25 cenários
 *
 * Execução: node src/core/app.energy-credits-repository.manual-test.js
 *
 * Sem Firebase (repository padrão é MemoryRepository).
 * Sem Jest. Sem browser. ES Modules nativos.
 */

import { ESA }                           from './app.js';
import { EnergyCreditsMemoryRepository } from '../repositories/energy-credits/energy-credits-memory-repository.js';
import { energyCreditsReadModel }        from '../read-models/energy-credits/index.js';

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

// ── 1. getEnergyCreditsRepository ─────────────────────────────────────────

section(1, 'getEnergyCreditsRepository');

const repoRef = ESA.getEnergyCreditsRepository();
assert(repoRef instanceof EnergyCreditsMemoryRepository, '1.1 retorna EnergyCreditsMemoryRepository');
assert(typeof repoRef.saveGeneratingUnit === 'function',  '1.2 possui saveGeneratingUnit');
assert(typeof repoRef.getSnapshot === 'function',         '1.3 possui getSnapshot');
assert(typeof repoRef.getStats === 'function',            '1.4 possui getStats');

// Singleton — mesma referência
const repoRef2 = ESA.getEnergyCreditsRepository();
assert(repoRef === repoRef2,                              '1.5 singleton — mesma referência');

// ── 2. getEnergyCreditsRepositoryStats ────────────────────────────────────

section(2, 'getEnergyCreditsRepositoryStats');

repoRef.clear();
const stats0 = ESA.getEnergyCreditsRepositoryStats();

assert(typeof stats0 === 'object' && stats0 !== null,    '2.1 retorna objeto');
assert(stats0.type === 'memory',                         '2.2 type = memory');
assert(stats0.generatingUnitCount === 0,                 '2.3 inicia vazio');

// Após save
repoRef.saveGeneratingUnit({ id: 'g-test-001', name: 'Usina Teste' });
const stats1 = ESA.getEnergyCreditsRepositoryStats();
assert(stats1.generatingUnitCount === 1,                 '2.4 count atualizado após save');

// ── 3. hydrateEnergyCreditsFromRepository ─────────────────────────────────

section(3, 'hydrateEnergyCreditsFromRepository');

repoRef.clear();
energyCreditsReadModel.clear();

repoRef.saveGeneratingUnit({ id: 'g-001', name: 'Usina App', utilityCompany: 'ENEL', status: 'active' });
repoRef.saveBeneficiaryUnit({ id: 'b-001', generatingUnitId: 'g-001', subscriptionStatus: 'active' });
repoRef.saveEsaInvoice({ id: 'inv-001', beneficiaryUnitId: 'b-001', referenceMonth: '2024-06', invoiceAmount: 200 });

const hResult = ESA.hydrateEnergyCreditsFromRepository({ replace: true });
assert(hResult.ok === true,                              '3.1 ok = true');
assert(typeof hResult.data === 'object',                 '3.2 data é objeto');
assert(hResult.metadata.source === 'memory-repository', '3.3 metadata.source = memory-repository');

// Verificar que o ReadModel foi hidratado
const rmGen = ESA.queryEnergyCreditsGeneratingUnit('g-001');
assert(rmGen.data !== null,                              '3.4 gen-001 acessível após hydrate');
assert(rmGen.data.name === 'Usina App',                  '3.5 nome correto');

const rmBen = ESA.searchEnergyCreditsBeneficiaryUnits({ generatingUnitId: 'g-001' });
assert(rmBen.data.length >= 1,                           '3.6 beneficiary acessível após hydrate');

// ── 4. APIs anteriores não quebram ────────────────────────────────────────

section(4, 'APIs anteriores continuam funcionando');

const rmStats = ESA.getEnergyCreditsReadModelStats();
assert(typeof rmStats === 'object',                      '4.1 getEnergyCreditsReadModelStats ok');

const execSummary = ESA.getEnergyCreditsExecutiveSummary({}, { referenceDate: '2024-06' });
assert(typeof execSummary === 'object',                  '4.2 getEnergyCreditsExecutiveSummary ok');

// Reports ainda funcionam após hydrate via repository
const ownerReport = ESA.buildEnergyCreditsOwnerMonthlyReport('g-001', '2024-06', { referenceDate: '2024-06' });
assert(typeof ownerReport === 'object',                  '4.3 buildEnergyCreditsOwnerMonthlyReport ok');

// ── 5. hydrateEnergyCreditsFromRepository — repositório vazio ─────────────

section(5, 'hydrateEnergyCreditsFromRepository com repositório vazio');

repoRef.clear();
energyCreditsReadModel.clear();

const hEmpty = ESA.hydrateEnergyCreditsFromRepository({ replace: true });
assert(hEmpty.ok === true,                               '5.1 repositório vazio → ok');

const rmGens = ESA.searchEnergyCreditsGeneratingUnits({});
assert(rmGens.data.length === 0,                         '5.2 readModel vazio após hydrate de repo vazio');

// ── 6. Idempotência ────────────────────────────────────────────────────────

section(6, 'Idempotência — múltiplos hydrates');

repoRef.clear();
energyCreditsReadModel.clear();

repoRef.saveGeneratingUnit({ id: 'gi-001', name: 'Idempotente', status: 'active' });

ESA.hydrateEnergyCreditsFromRepository({ replace: true });
ESA.hydrateEnergyCreditsFromRepository({ replace: true });
ESA.hydrateEnergyCreditsFromRepository({ replace: true });

const rmGens2 = ESA.searchEnergyCreditsGeneratingUnits({});
assert(rmGens2.data.length === 1,                        '6.1 hydrate idempotente — 1 item após 3 hydrates com replace=true');

// ── Resultado ─────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
