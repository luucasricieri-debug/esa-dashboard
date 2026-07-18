/**
 * ESA OS — Manual Test: CSV Parser
 * node src/importers/energy-credits/csv-parser.manual-test.js
 */

import { parseCsv } from './csv-parser.js';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}
function group(name) { console.log(`\n${name}`); }

// ── 1. Input validation ───────────────────────────────────────────────────────
group('1. Input validation');
assert('1.1 null → fail', parseCsv(null).ok === false);
assert('1.2 number → fail', parseCsv(42).ok === false);
assert('1.3 empty string → fail', parseCsv('').ok === false);
assert('1.4 error code INVALID_CSV', parseCsv(null).errors[0]?.code === 'INVALID_CSV');
assert('1.5 whitespace-only → EMPTY_CSV', parseCsv('   \n ').errors[0]?.code === 'EMPTY_CSV');

// ── 2. Header only ────────────────────────────────────────────────────────────
group('2. Header only');
const headerOnly = parseCsv('name,value');
assert('2.1 ok=true', headerOnly.ok === true);
assert('2.2 data=[]', Array.isArray(headerOnly.data) && headerOnly.data.length === 0);
assert('2.3 headers=[name,value]', JSON.stringify(headerOnly.metadata.headers) === '["name","value"]');
assert('2.4 totalRows=0', headerOnly.metadata.totalRows === 0);

// ── 3. Comma-delimited ────────────────────────────────────────────────────────
group('3. Comma-delimited');
const csv3 = parseCsv('id,name\n001,Alpha\n002,Beta');
assert('3.1 ok=true', csv3.ok === true);
assert('3.2 2 rows', csv3.data.length === 2);
assert('3.3 first row id=001', csv3.data[0].id === '001');
assert('3.4 first row name=Alpha', csv3.data[0].name === 'Alpha');
assert('3.5 second row id=002', csv3.data[1].id === '002');
assert('3.6 delimiter=,', csv3.metadata.delimiter === ',');

// ── 4. Semicolon-delimited ────────────────────────────────────────────────────
group('4. Semicolon-delimited');
const csv4 = parseCsv('id;nome\n001;Solar\n002;Eólica');
assert('4.1 ok=true', csv4.ok === true);
assert('4.2 2 rows', csv4.data.length === 2);
assert('4.3 delimiter=;', csv4.metadata.delimiter === ';');
assert('4.4 row 0 nome=Solar', csv4.data[0].nome === 'Solar');

// ── 5. Autodetect ─────────────────────────────────────────────────────────────
group('5. Autodetect delimiter');
const csv5a = parseCsv('a;b;c\n1;2;3');
assert('5.1 semicolon detected', csv5a.metadata.delimiter === ';');
const csv5b = parseCsv('a,b,c\n1,2,3');
assert('5.2 comma detected', csv5b.metadata.delimiter === ',');

// ── 6. BOM removal ────────────────────────────────────────────────────────────
group('6. BOM removal');
const withBom = parseCsv('﻿id,name\n1,Test');
assert('6.1 ok=true', withBom.ok === true);
assert('6.2 header id (no BOM)', withBom.metadata.headers[0] === 'id');
assert('6.3 row id=1', withBom.data[0].id === '1');

// ── 7. CRLF and CR line endings ───────────────────────────────────────────────
group('7. Line ending normalization');
const crlf = parseCsv('id,val\r\n1,a\r\n2,b');
assert('7.1 CRLF: 2 rows', crlf.data.length === 2);
const cr = parseCsv('id,val\r1,a\r2,b');
assert('7.2 CR: 2 rows', cr.data.length === 2);

// ── 8. Skip empty lines ───────────────────────────────────────────────────────
group('8. Skip empty lines');
const skipEmpty = parseCsv('id,val\n1,a\n\n2,b\n\n');
assert('8.1 default: skips empty', skipEmpty.data.length === 2);
const keepEmpty = parseCsv('id,val\n1,a\n\n2,b', { skipEmptyLines: false });
assert('8.2 skipEmptyLines=false: keeps them', keepEmpty.data.length === 3);

// ── 9. Quoted fields ──────────────────────────────────────────────────────────
group('9. Quoted fields');
const q = parseCsv('id,desc\n1,"hello world"\n2,"foo,bar"');
assert('9.1 quoted value with space', q.data[0].desc === 'hello world');
assert('9.2 quoted value with comma', q.data[1].desc === 'foo,bar');

// ── 10. Escaped quotes inside quotes ──────────────────────────────────────────
group('10. Escaped quotes ("")');
const esc = parseCsv('id,desc\n1,"say ""hello"""\n2,plain');
assert('10.1 escaped quotes unescaped', esc.data[0].desc === 'say "hello"');
assert('10.2 plain value unaffected', esc.data[1].desc === 'plain');

// ── 11. Trim ──────────────────────────────────────────────────────────────────
group('11. Trim');
const trimOn = parseCsv(' id , name \n 001 , Alpha ');
assert('11.1 trim=true (default): headers trimmed', trimOn.metadata.headers[0] === 'id');
assert('11.2 trim=true: values trimmed', trimOn.data[0].id === '001');
const trimOff = parseCsv(' id , name \n 001 , Alpha ', { trim: false });
assert('11.3 trim=false: header has space', trimOff.metadata.headers[0] === ' id ');

// ── 12. Empty fields ──────────────────────────────────────────────────────────
group('12. Empty fields');
const empty = parseCsv('a,b,c\n1,,3');
assert('12.1 middle field empty string', empty.data[0].b === '');
assert('12.2 other fields intact', empty.data[0].a === '1' && empty.data[0].c === '3');

// ── 13. Force delimiter ────────────────────────────────────────────────────────
group('13. Force delimiter');
const forced = parseCsv('a;b;c\n1;2;3', { delimiter: ';', autoDetectDelimiter: false });
assert('13.1 forced semicolon', forced.metadata.delimiter === ';' && forced.data[0].a === '1');
const forcedComma = parseCsv('a,b\n1,2', { delimiter: ',' });
assert('13.2 forced comma', forcedComma.metadata.delimiter === ',');

// ── 14. Metadata completeness ─────────────────────────────────────────────────
group('14. Metadata');
const meta = parseCsv('x,y\n1,2\n3,4\n5,6');
assert('14.1 totalRows=3', meta.metadata.totalRows === 3);
assert('14.2 totalLines includes data lines', meta.metadata.totalLines >= 3);
assert('14.3 headers array', Array.isArray(meta.metadata.headers));
assert('14.4 delimiter present', meta.metadata.delimiter !== undefined);

// ── 15. Multiline CSV ─────────────────────────────────────────────────────────
group('15. Extra columns silently ignored');
const extra = parseCsv('a,b\n1,2,3,4');
assert('15.1 row has a and b only', extra.data[0].a === '1' && extra.data[0].b === '2');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
