/**
 * ESA OS — Manual Test: CSV Template Service
 * node src/importers/energy-credits/csv-template-service.manual-test.js
 */

import { EnergyCreditsCsvTemplateService,
         energyCreditsCsvTemplateService } from './csv-template-service.js';
import { parseCsv } from './csv-parser.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

// ── 1. Tipos suportados ────────────────────────────────────────────────────────

group('1. getSupportedTypes');
{
  const svc   = new EnergyCreditsCsvTemplateService();
  const types = svc.getSupportedTypes();
  assert('1.1 retorna array', Array.isArray(types));
  assert('1.2 generating-units presente', types.includes('generating-units'));
  assert('1.3 beneficiary-units presente', types.includes('beneficiary-units'));
  assert('1.4 generating-unit-monthly-records presente', types.includes('generating-unit-monthly-records'));
  assert('1.5 beneficiary-monthly-records presente', types.includes('beneficiary-monthly-records'));
  assert('1.6 exatamente 4 tipos', types.length === 4);
}

// ── 2. Tipo inválido ──────────────────────────────────────────────────────────

group('2. Tipo inválido');
{
  const svc = new EnergyCreditsCsvTemplateService();
  const r   = svc.getTemplate('tipo-inexistente');
  assert('2.1 ok=false', r.ok === false);
  assert('2.2 data=null', r.data === null);
  assert('2.3 erro UNKNOWN_IMPORT_TYPE', r.errors[0]?.code === 'UNKNOWN_IMPORT_TYPE');
  assert('2.4 field=importType', r.errors[0]?.field === 'importType');
}

// ── 3. generating-units ───────────────────────────────────────────────────────

group('3. generating-units');
{
  const svc = new EnergyCreditsCsvTemplateService();
  const r   = svc.getTemplate('generating-units');
  assert('3.1 ok=true', r.ok === true);
  assert('3.2 data.importType correto', r.data?.importType === 'generating-units');
  assert('3.3 delimiter=;', r.data?.delimiter === ';');
  assert('3.4 headers é array', Array.isArray(r.data?.headers));
  assert('3.5 headers contém id', r.data?.headers.includes('id'));
  assert('3.6 headers contém name', r.data?.headers.includes('name'));
  assert('3.7 headers contém uc', r.data?.headers.includes('uc'));
  assert('3.8 exampleRows é array', Array.isArray(r.data?.exampleRows));
  assert('3.9 csvText é string', typeof r.data?.csvText === 'string');
  assert('3.10 csvText começa com headers', r.data?.csvText.startsWith('id;name'));
  assert('3.11 aliases presente', typeof r.data?.aliases === 'object');
  assert('3.12 aliases.uc é array', Array.isArray(r.data?.aliases?.uc));
  assert('3.13 metadata.headerCount correto', r.metadata?.headerCount === r.data?.headers.length);
}

// ── 4. beneficiary-units ──────────────────────────────────────────────────────

group('4. beneficiary-units');
{
  const svc = new EnergyCreditsCsvTemplateService();
  const r   = svc.getTemplate('beneficiary-units');
  assert('4.1 ok=true', r.ok === true);
  assert('4.2 headers contém generatingUnitId', r.data?.headers.includes('generatingUnitId'));
  assert('4.3 headers contém document', r.data?.headers.includes('document'));
}

// ── 5. generating-unit-monthly-records ───────────────────────────────────────

group('5. generating-unit-monthly-records');
{
  const svc = new EnergyCreditsCsvTemplateService();
  const r   = svc.getTemplate('generating-unit-monthly-records');
  assert('5.1 ok=true', r.ok === true);
  assert('5.2 headers contém referenceMonth', r.data?.headers.includes('referenceMonth'));
  assert('5.3 headers contém monthlyGenerationKwh', r.data?.headers.includes('monthlyGenerationKwh'));
  assert('5.4 headers contém purchasePricePerKwh', r.data?.headers.includes('purchasePricePerKwh'));
}

// ── 6. beneficiary-monthly-records ────────────────────────────────────────────

group('6. beneficiary-monthly-records');
{
  const svc = new EnergyCreditsCsvTemplateService();
  const r   = svc.getTemplate('beneficiary-monthly-records');
  assert('6.1 ok=true', r.ok === true);
  assert('6.2 headers contém monthlyConsumptionKwh', r.data?.headers.includes('monthlyConsumptionKwh'));
  assert('6.3 headers contém esaPricePerKwh', r.data?.headers.includes('esaPricePerKwh'));
  assert('6.4 headers contém paymentStatus', r.data?.headers.includes('paymentStatus'));
}

// ── 7. csvText parsável pelo CsvParser ────────────────────────────────────────

group('7. csvText parsável pelo CsvParser real');
{
  const svc = new EnergyCreditsCsvTemplateService();

  for (const type of svc.getSupportedTypes()) {
    const r       = svc.getTemplate(type);
    const parsed  = parseCsv(r.data.csvText);
    assert(`7.${svc.getSupportedTypes().indexOf(type) + 1} ${type}: CSV parseável`, parsed.ok === true);
  }
}

// ── 8. Delimiter customizado ──────────────────────────────────────────────────

group('8. Delimiter customizado');
{
  const svc = new EnergyCreditsCsvTemplateService();
  const r   = svc.getTemplate('generating-units', { delimiter: ',' });
  assert('8.1 ok=true', r.ok === true);
  assert('8.2 delimiter=,', r.data?.delimiter === ',');
  assert('8.3 csvText usa ,', r.data?.csvText.startsWith('id,name'));
}

// ── 9. Singleton energyCreditsCsvTemplateService ──────────────────────────────

group('9. Singleton');
{
  const r = energyCreditsCsvTemplateService.getTemplate('beneficiary-units');
  assert('9.1 singleton funciona', r.ok === true);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`csv-template-service: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
