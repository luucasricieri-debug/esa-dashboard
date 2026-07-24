'use strict';
/**
 * ESA OS — scripts/diagnose-crm-upload-user.js
 *
 * Testa o núcleo do script (diagnoseCrmUploadUser) contra um Firebase fake —
 * execução real, nunca toca no Firebase real. Ajuda a comparar um usuário
 * que funciona com um que falha, sem nunca expor credenciais/tokens.
 *
 * Rodar: npx tsx tests/diagnose-crm-upload-user.manual-test.ts
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const diag = require(path.join(ROOT, 'scripts/diagnose-crm-upload-user.js'));

type Tree = Record<string, unknown>;
function makeFakeDb(tree: Tree) {
  return {
    ref(p: string) {
      return {
        async once(_e: string) {
          const val = Object.prototype.hasOwnProperty.call(tree, p) ? tree[p] : null;
          return { val: () => val };
        },
      };
    },
  };
}

console.log('\nSuite DU1 — máscaras e constantes (execução real)');
assert('DU01 maskUid mascara uid', diag.maskUid('lucas_vizentin') === 'lu***in');
assert('DU02 maskLogin mascara login sem expor por completo', diag.maskLogin('lucas.vizentin').length < 'lucas.vizentin'.length + 5 && !diag.maskLogin('lucas.vizentin').includes('lucas.vizentin'));
assert('DU03 CRM_LEVELS inclui os níveis autorizados conhecidos', ['diretor', 'gestor', 'executivo'].every((l) => diag.CRM_LEVELS.includes(l)));

async function run() {
  console.log('\nSuite DU2 — diagnoseCrmUploadUser(): usuário que FUNCIONA (uid == chave)');
  {
    const db = makeFakeDb({
      'users/lucas_vizentin': { uid: 'lucas_vizentin', login: 'lucas.vizentin', level: 'diretor', name: 'Lucas Vizentin' },
      users: { lucas_vizentin: { uid: 'lucas_vizentin', login: 'lucas.vizentin', level: 'diretor', name: 'Lucas Vizentin' } },
    });
    const report = await diag.diagnoseCrmUploadUser(db, { uid: 'lucas_vizentin', login: 'lucas.vizentin' });
    assert('DU04 usersByUidKeyExists === true', report.usersByUidKeyExists === true);
    assert('DU05 storedUidFieldPresent === true', report.storedUidFieldPresent === true);
    assert('DU06 storedUidFieldMatchesKey === true (usuário que sempre funcionou)', report.storedUidFieldMatchesKey === true);
    assert('DU07 sessionFormatExpected sinaliza "consistente"', report.sessionFormatExpected.includes('consistente'));
    assert('DU08 canRenewViaPathB === true', report.canRenewViaPathB === true);
    assert('DU09 roleAuthorizedForCrmUpload === true (diretor)', report.roleAuthorizedForCrmUpload === true);
    assert('DU10 nenhum login/uid completo aparece no relatório', !JSON.stringify(report).includes('lucas_vizentin') && !JSON.stringify(report).includes('lucas.vizentin'));
  }

  console.log('\nSuite DU3 — diagnoseCrmUploadUser(): usuário que FALHA (sem campo .uid — a causa raiz real)');
  {
    const db = makeFakeDb({
      'users/exec_legado': { login: 'exec.legado', level: 'executivo', name: 'Exec Legado' }, // sem .uid
    });
    const report = await diag.diagnoseCrmUploadUser(db, { uid: 'exec_legado', login: 'exec.legado' });
    assert('DU11 usersByUidKeyExists === true (o registro existe, só falta o campo)', report.usersByUidKeyExists === true);
    assert('DU12 storedUidFieldPresent === false (reproduz a causa raiz)', report.storedUidFieldPresent === false);
    assert('DU13 sessionFormatExpected sinaliza "LEGADO"', report.sessionFormatExpected.includes('LEGADO'));
    assert('DU14 canRenewViaPathB === true (login bate — Path B funcionaria SE o uid da sessão estivesse correto)', report.canRenewViaPathB === true);
  }

  console.log('\nSuite DU4 — diagnoseCrmUploadUser(): uid divergente da chave');
  {
    const db = makeFakeDb({
      'users/exec_divergente': { uid: 'outro_uid_qualquer', login: 'exec.divergente', level: 'executivo' },
    });
    const report = await diag.diagnoseCrmUploadUser(db, { uid: 'exec_divergente', login: 'exec.divergente' });
    assert('DU15 storedUidFieldPresent === true mas storedUidFieldMatchesKey === false', report.storedUidFieldPresent === true && report.storedUidFieldMatchesKey === false);
    assert('DU16 sessionFormatExpected sinaliza "DIVERGENTE"', report.sessionFormatExpected.includes('DIVERGENTE'));
  }

  console.log('\nSuite DU5 — usuário inexistente e aliases duplicados');
  {
    const db = makeFakeDb({ 'users/nao_existe': null });
    const report = await diag.diagnoseCrmUploadUser(db, { uid: 'nao_existe' });
    assert('DU17 usuário inexistente: usersByUidKeyExists === false, sem lançar erro', report.usersByUidKeyExists === false);
  }
  {
    const db = makeFakeDb({
      'users/dup1': { login: 'duplicado.login', level: 'executivo' },
      users: {
        dup1: { login: 'duplicado.login', level: 'executivo' },
        dup2: { login: 'duplicado.login', level: 'sdr' },
      },
    });
    const report = await diag.diagnoseCrmUploadUser(db, { uid: 'dup1', login: 'duplicado.login' });
    assert('DU18 detecta 2 registros com o mesmo login (aliasesFoundForLogin=2)', report.aliasesFoundForLogin === 2);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Diagnose CRM Upload User Tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
}

run();
