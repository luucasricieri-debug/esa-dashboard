/**
 * ESA OS — Repositories / Energy Credits
 * Suite de testes — EnergyCreditsRepositoryHydrator
 * 20 cenários
 *
 * Execução: node src/repositories/energy-credits/energy-credits-repository-hydrator.manual-test.js
 */

import { EnergyCreditsRepositoryHydrator } from './energy-credits-repository-hydrator.js';
import { EnergyCreditsMemoryRepository }   from './energy-credits-memory-repository.js';
import { EnergyCreditsReadModel }          from '../../read-models/energy-credits/energy-credits-read-model.js';

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

// ── 1. Inicialização ───────────────────────────────────────────────────────

section(1, 'Inicialização');

const hydrator0 = new EnergyCreditsRepositoryHydrator();
assert(hydrator0 instanceof EnergyCreditsRepositoryHydrator, '1.1 instancia sem args');

const repo = new EnergyCreditsMemoryRepository();
const rm   = new EnergyCreditsReadModel();
const hydrator = new EnergyCreditsRepositoryHydrator(repo, rm);
assert(hydrator instanceof EnergyCreditsRepositoryHydrator, '1.2 instancia com args');

// ── 2. Falha sem repository ────────────────────────────────────────────────

section(2, 'Falha quando repository inválido');

const hy_no_repo = new EnergyCreditsRepositoryHydrator(null, rm);
const r_no_repo  = hy_no_repo.hydrateReadModel();
assert(r_no_repo.ok === false,                               '2.1 ok = false sem repository');
assert(r_no_repo.errors.length > 0,                          '2.2 errors não vazio');
assert(r_no_repo.errors[0].code === 'INVALID_REPOSITORY',    '2.3 code INVALID_REPOSITORY');

const hy_bad_repo = new EnergyCreditsRepositoryHydrator({ notAFunction: true }, rm);
const r_bad_repo  = hy_bad_repo.hydrateReadModel();
assert(r_bad_repo.ok === false,                              '2.4 ok = false repository sem getSnapshot');

// ── 3. Falha sem readModel ─────────────────────────────────────────────────

section(3, 'Falha quando readModel inválido');

const hy_no_rm = new EnergyCreditsRepositoryHydrator(repo, null);
const r_no_rm  = hy_no_rm.hydrateReadModel();
assert(r_no_rm.ok === false,                                 '3.1 ok = false sem readModel');
assert(r_no_rm.errors[0].code === 'INVALID_READ_MODEL',      '3.2 code INVALID_READ_MODEL');

// ── 4. hydrateReadModel — fluxo normal ────────────────────────────────────

section(4, 'hydrateReadModel — fluxo normal');

repo.clear();
rm.clear();

repo.saveGeneratingUnit({ id: 'gen-001', name: 'Usina Hydrator', utilityCompany: 'ENEL', status: 'active' });
repo.saveBeneficiaryUnit({ id: 'ben-001', generatingUnitId: 'gen-001' });

const result = hydrator.hydrateReadModel({ replace: true });
assert(result.ok === true,                                   '4.1 ok = true');
assert(typeof result.data === 'object' && result.data !== null, '4.2 data é objeto');
assert(result.metadata.source === 'memory-repository',       '4.3 metadata.source correto');
assert(typeof result.metadata.hydrateStats === 'object',     '4.4 metadata.hydrateStats existe');

// Read Model deve conter os dados do repositório
const listGens = rm.listGeneratingUnits({});
assert(listGens.some(u => u.id === 'gen-001'),               '4.5 gen-001 no readModel após hydrate');
const listBens = rm.listBeneficiaryUnits({});
assert(listBens.some(u => u.id === 'ben-001'),               '4.6 ben-001 no readModel após hydrate');

// ── 5. Não acessa Firebase, window, localStorage ───────────────────────────

section(5, 'Sem side-effects externos');

// O hydrator não deve criar vars globais, não usa Math.random, não usa Date.now
assert(typeof global.firebase === 'undefined',               '5.1 sem global firebase');
assert(typeof global.localStorage === 'undefined',           '5.2 sem localStorage');

// ── 6. Propaga options para hydrate ───────────────────────────────────────

section(6, 'Propaga options para hydrate');

repo.clear();
rm.clear();

repo.saveGeneratingUnit({ id: 'gen-opt', name: 'Usina Opts' });
const resultOpts = hydrator.hydrateReadModel({ replace: true, referenceDate: '2024-06' });
assert(resultOpts.ok === true,                               '6.1 ok com options');

const listGens2 = rm.listGeneratingUnits({});
assert(listGens2.some(u => u.id === 'gen-opt'),              '6.2 dados propagados com options');

// ── 7. Repositório vazio ────────────────────────────────────────────────────

section(7, 'Repositório vazio — hydrate produz readModel vazio');

const repo_empty = new EnergyCreditsMemoryRepository();
const rm_empty   = new EnergyCreditsReadModel();
const hy_empty   = new EnergyCreditsRepositoryHydrator(repo_empty, rm_empty);

const r_empty = hy_empty.hydrateReadModel();
assert(r_empty.ok === true,                                  '7.1 repositório vazio → ok');
const listEmpty = rm_empty.listGeneratingUnits({});
assert(listEmpty.length === 0,                               '7.2 readModel vazio');

// ── Resultado ──────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
if (failed === 0) {
  console.log(`✓ TODOS OS ${total} TESTES PASSARAM`);
} else {
  console.log(`✗ ${failed}/${total} TESTES FALHARAM`);
  process.exit(1);
}
