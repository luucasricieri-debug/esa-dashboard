/**
 * ESA OS — Legacy / Hotfix
 * Suite de testes estáticos — Carregamento CRM para Engenharia
 * 10 cenários obrigatórios
 *
 * Execução: node src/legacy/crm-engineering-load.manual-test.js
 *
 * Lê index.html real via fs e valida estaticamente:
 * - loadAllData() carrega crm/deals para engenharia
 * - crmIsAdmin NÃO inclui engenharia
 * - crmFilteredDeals NÃO exclui engenharia por nível
 *
 * Deve FALHAR se engenharia for removida da condição de carregamento.
 * Deve FALHAR se crmIsAdmin passar a incluir engenharia.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

// ── Runner ────────────────────────────────────────────────────────────────────

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
  console.log(`\n[${n}/10] ${title}`);
}

// ── Extrações ──────────────────────────────────────────────────────────────────

// Bloco _lvlCrm dentro de loadAllData: do primeiro _lvlCrm até o comentário de Migração
const crmLoadBlockMatch = HTML.match(/_lvlCrm[\s\S]*?(?=\/\/ Migração)/);
const crmLoadBlock      = crmLoadBlockMatch ? crmLoadBlockMatch[0] : '';
const crmLoadLines      = crmLoadBlock.split('\n');

// Função crmIsAdmin
const crmIsAdminMatch = HTML.match(/function crmIsAdmin\(\)\s*\{[^}]+\}/);
const crmIsAdminStr   = crmIsAdminMatch ? crmIsAdminMatch[0] : '';

// Função crmFilteredDeals
const crmFilteredDealsMatch = HTML.match(/function crmFilteredDeals\(\)\s*\{[\s\S]*?return list;\s*\}/);
const crmFilteredDealsStr   = crmFilteredDealsMatch ? crmFilteredDealsMatch[0] : '';

// Utilitário: busca linha com if(...) contendo token e verifica se o bloco seguinte
// atribui crmDeals = await — retorna true se encontrar
function guardHasCrmDealsLoad(token) {
  for (var i = 0; i < crmLoadLines.length; i++) {
    var line = crmLoadLines[i];
    if (/if\s*\(/.test(line) && line.indexOf(token) !== -1) {
      var following = crmLoadLines.slice(i + 1, i + 4).join('\n');
      if (/crmDeals\s*=\s*await/.test(following)) {
        return true;
      }
    }
  }
  return false;
}

// ── 1. loadAllData contém carregamento de crm/deals ──────────────────────────

section(1, 'loadAllData contém carregamento de crm/deals');

assert(crmLoadBlock.length > 0,
  '1.1 bloco _lvlCrm encontrado dentro de loadAllData');
assert(/fbGet\('crm\/deals'\)/.test(crmLoadBlock),
  '1.2 fbGet(crm/deals) presente no bloco de carregamento CRM');

// ── 2. resultado de crm/deals é atribuído a crmDeals ─────────────────────────

section(2, 'resultado de fbGet(crm/deals) é atribuído diretamente a crmDeals');

assert(/crmDeals\s*=\s*await\s+fbGet\('crm\/deals'\)/.test(crmLoadBlock),
  '2.1 crmDeals = await fbGet(crm/deals) presente no bloco');

// ── 3. nível normalizado com toLowerCase e trim ───────────────────────────────

section(3, 'nível normalizado com toLowerCase e trim no fluxo de carregamento');

assert(/\(CU\.level\|\|''\)\.toLowerCase\(\)\.trim\(\)/.test(crmLoadBlock),
  '3.1 (CU.level||"").toLowerCase().trim() presente antes das condições');

// ── 4. engenharia entra na condição de carregamento CRM ──────────────────────

section(4, 'engenharia está em condição if/else if que guarda crmDeals = await fbGet');

assert(guardHasCrmDealsLoad("'engenharia'"),
  "4.1 'engenharia' em condição que guarda atribuição de crmDeals — FALHA SE REMOVIDA");

// ── 5. diretor continua carregando CRM ───────────────────────────────────────

section(5, 'diretor continua em condição de carregamento CRM');

assert(guardHasCrmDealsLoad("'diretor'"),
  "5.1 'diretor' em condição que guarda crmDeals = await fbGet");

// ── 6. gestor continua carregando CRM ────────────────────────────────────────

section(6, 'gestor continua em condição de carregamento CRM');

assert(guardHasCrmDealsLoad("'gestor'"),
  "6.1 'gestor' em condição que guarda crmDeals = await fbGet");

// ── 7. trafego continua carregando CRM ───────────────────────────────────────

section(7, 'trafego continua em condição de carregamento CRM');

assert(guardHasCrmDealsLoad("'trafego'"),
  "7.1 'trafego' em condição que guarda crmDeals = await fbGet");

// ── 8. níveis anteriores permanecem sem regressão ────────────────────────────

section(8, 'executivo, sdr e jackeline permanecem na condição de carregamento CRM');

assert(guardHasCrmDealsLoad("'executivo'"),
  "8.1 'executivo' em condição que guarda crmDeals = await fbGet");
assert(guardHasCrmDealsLoad("'sdr'"),
  "8.2 'sdr' em condição que guarda crmDeals = await fbGet");
assert(guardHasCrmDealsLoad("'jackeline'"),
  "8.3 'jackeline' em condição que guarda crmDeals = await fbGet");

// ── 9. crmIsAdmin continua sem engenharia ────────────────────────────────────

section(9, 'crmIsAdmin não inclui engenharia — NÃO transformar engenharia em admin');

assert(crmIsAdminStr.length > 0,
  '9.1 função crmIsAdmin encontrada no HTML');
assert(!crmIsAdminStr.includes("'engenharia'"),
  "9.2 crmIsAdmin NÃO contém 'engenharia' — FALHA SE ADICIONADA");
assert(crmIsAdminStr.includes("'diretor'"),
  '9.3 crmIsAdmin ainda inclui diretor (sem regressão)');
assert(crmIsAdminStr.includes("'gestor'"),
  '9.4 crmIsAdmin ainda inclui gestor (sem regressão)');

// ── 10. crmFilteredDeals não exclui engenharia por nível ─────────────────────

section(10, 'crmFilteredDeals não filtra por CU.level — engenharia tem visão completa');

assert(crmFilteredDealsStr.length > 0,
  '10.1 função crmFilteredDeals encontrada no HTML');
assert(!crmFilteredDealsStr.includes('CU.level'),
  '10.2 crmFilteredDeals não filtra por CU.level — sem exclusão de nível');
assert(crmFilteredDealsStr.includes('crmFunilAtual'),
  '10.3 crmFilteredDeals filtra por funil (lógica correta intacta)');

// ── Resultado final ───────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log('Resultado: ' + (total - failed) + '/' + total + ' assertions passaram');

if (failed === 0) {
  console.log('✓ TODOS OS 10 CENÁRIOS PASSARAM\n');
} else {
  console.error('✗ ' + failed + ' assertion(s) falharam\n');
  process.exit(1);
}
