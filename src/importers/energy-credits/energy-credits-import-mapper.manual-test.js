/**
 * ESA OS — Manual Test: Energy Credits Import Mapper
 * node src/importers/energy-credits/energy-credits-import-mapper.manual-test.js
 */

import { EnergyCreditsImportMapper } from './energy-credits-import-mapper.js';
import { ENERGY_CREDITS_IMPORT_TYPE } from './import-types.js';

const T = ENERGY_CREDITS_IMPORT_TYPE;
const mapper = new EnergyCreditsImportMapper();

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

// ── 1. Invalid inputs ─────────────────────────────────────────────────────────
group('1. Invalid inputs');
assert('1.1 null row → ok=false', mapper.mapRow(T.GENERATING_UNITS, null).ok === false);
assert('1.2 string row → ok=false', mapper.mapRow(T.GENERATING_UNITS, 'text').ok === false);
assert('1.3 unknown type → ok=false', mapper.mapRow('unknown-type', {}).ok === false);
assert('1.4 error code UNKNOWN_TYPE', mapper.mapRow('unknown', {}).errors[0]?.code === 'UNKNOWN_TYPE');
assert('1.5 INVALID_ROW code for null', mapper.mapRow(T.GENERATING_UNITS, null).errors[0]?.code === 'INVALID_ROW');

// ── 2. Generating Unit — EN aliases ──────────────────────────────────────────
group('2. Generating Unit — EN aliases');
const gu1 = mapper.mapRow(T.GENERATING_UNITS, { id: 'gu-001', name: 'Solar Norte', ownerName: 'Empresa A', ownerDocument: '12.345.678/0001-90', uc: 'UC001', utilityCompany: 'CEMIG', status: 'active' });
assert('2.1 ok=true', gu1.ok === true);
assert('2.2 id=gu-001', gu1.entity.id === 'gu-001');
assert('2.3 name=Solar Norte', gu1.entity.name === 'Solar Norte');
assert('2.4 ownerName', gu1.entity.ownerName === 'Empresa A');
assert('2.5 uc=UC001', gu1.entity.uc === 'UC001');
assert('2.6 status=active', gu1.entity.status === 'active');

// ── 3. Generating Unit — PT aliases ──────────────────────────────────────────
group('3. Generating Unit — PT aliases');
const gu2 = mapper.mapRow(T.GENERATING_UNITS, { codigo: 'gu-002', nome: 'Parque Eólico', proprietário: 'Sócio B', cpfCnpj: '987.654.321-00', unidadeConsumidora: 'UC999', distribuidora: 'CELPE' });
assert('3.1 ok=true', gu2.ok === true);
assert('3.2 id from codigo', gu2.entity.id === 'gu-002');
assert('3.3 name from nome', gu2.entity.name === 'Parque Eólico');
assert('3.4 ownerName from proprietário', gu2.entity.ownerName === 'Sócio B');
assert('3.5 uc from unidadeConsumidora', gu2.entity.uc === 'UC999');
assert('3.6 utilityCompany from distribuidora', gu2.entity.utilityCompany === 'CELPE');

// ── 4. Generating Unit — auto ID from uc ─────────────────────────────────────
group('4. Generating Unit — auto ID from uc');
const gu3 = mapper.mapRow(T.GENERATING_UNITS, { uc: 'UC-123' });
assert('4.1 ok=true', gu3.ok === true);
assert('4.2 id=ug-UC-123', gu3.entity.id === 'ug-UC-123');

// ── 5. Beneficiary Unit ───────────────────────────────────────────────────────
group('5. Beneficiary Unit');
const bu1 = mapper.mapRow(T.BENEFICIARY_UNITS, { id: 'bu-01', generatingUnitId: 'gu-001', name: 'Beneficiário X', uc: 'UC200', utilityCompany: 'COELBA', status: 'active' });
assert('5.1 ok=true', bu1.ok === true);
assert('5.2 id=bu-01', bu1.entity.id === 'bu-01');
assert('5.3 generatingUnitId=gu-001', bu1.entity.generatingUnitId === 'gu-001');

const bu2 = mapper.mapRow(T.BENEFICIARY_UNITS, { unidade_beneficiaria_id: 'bu-02', unidadeGeradoraId: 'gu-002', unidadeConsumidora: 'UC300' });
assert('5.4 PT alias unidadeGeradoraId', bu2.entity.generatingUnitId === 'gu-002');

const bu3 = mapper.mapRow(T.BENEFICIARY_UNITS, { uc: 'UC-AUTO' });
assert('5.5 auto ID ub-UC-AUTO', bu3.entity.id === 'ub-UC-AUTO');

// ── 6. Generating Unit Monthly Record ─────────────────────────────────────────
group('6. Generating Unit Monthly Record');
const gum1 = mapper.mapRow(T.GENERATING_UNIT_MONTHLY_RECORDS, { generatingUnitId: 'gu-001', referenceMonth: '2025-06', previousBalanceKwh: 1000, monthlyGenerationKwh: 5000, purchasePricePerKwh: 0.45 });
assert('6.1 ok=true', gum1.ok === true);
assert('6.2 id auto ugm-gu-001-2025-06', gum1.entity.id === 'ugm-gu-001-2025-06');
assert('6.3 referenceMonth=2025-06', gum1.entity.referenceMonth === '2025-06');
assert('6.4 previousBalanceKwh=1000', gum1.entity.previousBalanceKwh === 1000);
assert('6.5 monthlyGenerationKwh=5000', gum1.entity.monthlyGenerationKwh === 5000);

const gum2 = mapper.mapRow(T.GENERATING_UNIT_MONTHLY_RECORDS, { ugId: 'gu-002', mesReferencia: '06/2025', saldoAnteriorKwh: '1.000', geracaoMensalKwh: '5.000', precoCompraKwh: '0,45' });
assert('6.6 PT alias ugId, mesReferencia', gum2.entity.generatingUnitId === 'gu-002');
assert('6.7 month from MM/YYYY', gum2.entity.referenceMonth === '2025-06');
assert('6.8 BR number 1.000→1000', gum2.entity.previousBalanceKwh === 1000);
assert('6.9 BR number 0,45→0.45', gum2.entity.purchasePricePerKwh === 0.45);

// ── 7. Beneficiary Monthly Record ────────────────────────────────────────────
group('7. Beneficiary Monthly Record');
const bm1 = mapper.mapRow(T.BENEFICIARY_MONTHLY_RECORDS, { beneficiaryUnitId: 'bu-01', generatingUnitId: 'gu-001', referenceMonth: '2025-06', monthlyConsumptionKwh: 800, allocatedKwh: 700, compensatedKwh: 700, esaPricePerKwh: 0.40, utilityTariffPerKwh: 0.85, paymentStatus: 'paid', status: 'active' });
assert('7.1 ok=true', bm1.ok === true);
assert('7.2 id auto ubm-bu-01-2025-06', bm1.entity.id === 'ubm-bu-01-2025-06');
assert('7.3 allocatedKwh=700', bm1.entity.allocatedKwh === 700);
assert('7.4 paymentStatus=paid', bm1.entity.paymentStatus === 'paid');

const bm2 = mapper.mapRow(T.BENEFICIARY_MONTHLY_RECORDS, { ubId: 'bu-02', mes_referencia: 'jan/2025', consumoMensalKwh: '800', creditosAlocadosKwh: '700', creditosCompensadosKwh: '700', precoEsaKwh: '0,40', tarifa_distribuidora_kwh: '0,85' });
assert('7.5 PT alias ubId, mes_referencia', bm2.entity.beneficiaryUnitId === 'bu-02');
assert('7.6 month from jan/2025', bm2.entity.referenceMonth === '2025-01');
assert('7.7 consumo from consumoMensalKwh', bm2.entity.monthlyConsumptionKwh === 800);

// ── 8. Number normalization ───────────────────────────────────────────────────
group('8. Number normalization');
const nm = (raw) => mapper.mapRow(T.GENERATING_UNIT_MONTHLY_RECORDS, { ugId: 'x', referenceMonth: '2025-01', previousBalanceKwh: raw }).entity.previousBalanceKwh;
assert('8.1 BR 1.234,56 → 1234.56', nm('1.234,56') === 1234.56);
assert('8.2 US 1,234.56 → 1234.56', nm('1,234.56') === 1234.56);
assert('8.3 currency R$ 1.234,56', nm('R$ 1.234,56') === 1234.56);
assert('8.4 kWh suffix 13.000 kWh → 13000', nm('13.000 kWh') === 13000);
assert('8.5 plain 500 → 500', nm('500') === 500);
assert('8.6 decimal 0.5 → 0.5', nm('0.5') === 0.5);
assert('8.7 BR decimal 0,5 → 0.5', nm('0,5') === 0.5);
assert('8.8 null → null', nm(null) === null);
assert('8.9 empty → null', nm('') === null);
assert('8.10 non-number → null', nm('abc') === null);

// ── 9. Month normalization ────────────────────────────────────────────────────
group('9. Month normalization');
const mm = (raw) => mapper.mapRow(T.GENERATING_UNIT_MONTHLY_RECORDS, { ugId: 'x', referenceMonth: raw }).entity.referenceMonth;
assert('9.1 YYYY-MM passthrough', mm('2025-06') === '2025-06');
assert('9.2 MM/YYYY', mm('06/2025') === '2025-06');
assert('9.3 YYYY/MM', mm('2025/06') === '2025-06');
assert('9.4 jan/YYYY', mm('jan/2025') === '2025-01');
assert('9.5 fev/YYYY', mm('fev/2025') === '2025-02');
assert('9.6 dez/YYYY', mm('dez/2025') === '2025-12');
assert('9.7 janeiro/YYYY', mm('janeiro/2025') === '2025-01');
assert('9.8 dezembro/YYYY', mm('dezembro/2025') === '2025-12');
assert('9.9 invalid → null', mm('blah') === null);
assert('9.10 null → null', mm(null) === null);
assert('9.11 case insensitive JAN/2025', mm('JAN/2025') === '2025-01');

// ── 10. Security — forbidden keys stripped ────────────────────────────────────
group('10. Security: forbidden keys stripped');
const sec = mapper.mapRow(T.GENERATING_UNITS, { id: 'gu-sec', nome: 'Test', password: 'pw', apiKey: 'ak', sessionToken: 'st', serviceAccount: 'sa', passHash: 'ph', firebaseConfig: 'fc', secret: 'sec', downloadUrl: 'du', stack: 'st2', stackTrace: 'str', internalLog: 'il' });
assert('10.1 ok=true', sec.ok === true);
const ent = sec.entity;
assert('10.2 password stripped', ent.password === undefined);
assert('10.3 apiKey stripped', ent.apiKey === undefined);
assert('10.4 sessionToken stripped', ent.sessionToken === undefined);
assert('10.5 serviceAccount stripped', ent.serviceAccount === undefined);
assert('10.6 passHash stripped', ent.passHash === undefined);
assert('10.7 secret stripped', ent.secret === undefined);
assert('10.8 firebaseConfig stripped', ent.firebaseConfig === undefined);
assert('10.9 downloadUrl stripped', ent.downloadUrl === undefined);
assert('10.10 stack stripped', ent.stack === undefined);
assert('10.11 stackTrace stripped', ent.stackTrace === undefined);
assert('10.12 internalLog stripped', ent.internalLog === undefined);

// ── 11. Safe ID validation ─────────────────────────────────────────────────────
group('11. Safe ID — forbidden chars');
const badId = (id) => mapper.mapRow(T.GENERATING_UNITS, { id, uc: 'FALLBACK' }).entity.id;
assert('11.1 id with / → null (falls back to auto)', badId('a/b') === null || badId('a/b') === 'ug-FALLBACK');
assert('11.2 id with # → null (forbidden char rejected)', badId('a#b') === null || badId('a#b') === 'ug-FALLBACK');
assert('11.3 valid id passes', badId('valid-id-123') === 'valid-id-123');

// ── 12. Deterministic ID — no Date.now/random ─────────────────────────────────
group('12. Deterministic IDs');
const r1 = mapper.mapRow(T.GENERATING_UNIT_MONTHLY_RECORDS, { generatingUnitId: 'gu-001', referenceMonth: '2025-06' });
const r2 = mapper.mapRow(T.GENERATING_UNIT_MONTHLY_RECORDS, { generatingUnitId: 'gu-001', referenceMonth: '2025-06' });
assert('12.1 same input → same ID', r1.entity.id === r2.entity.id);
const r3 = mapper.mapRow(T.BENEFICIARY_MONTHLY_RECORDS, { beneficiaryUnitId: 'bu-01', referenceMonth: '2025-06' });
const r4 = mapper.mapRow(T.BENEFICIARY_MONTHLY_RECORDS, { beneficiaryUnitId: 'bu-01', referenceMonth: '2025-06' });
assert('12.2 beneficiary same input → same ID', r3.entity.id === r4.entity.id);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
