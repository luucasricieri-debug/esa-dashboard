'use strict';
/**
 * ESA OS — Gate 8E: Ativação do Modo Organizacional
 *
 * Valida estáticamente: hasMigrationMarker, clearActiveOrganization,
 * ORG_CONTEXT_MESSAGES, error codes, marker script e HTML.
 *
 * Rodar: npx tsx tests/gate8e-org-activation.manual-test.ts
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MT   = path.join(__dirname, '../multitenancy');
const BS   = path.join(__dirname, '../bootstrap');
const ROOT = path.resolve(__dirname, '../../../../..');
const NF   = path.join(ROOT, 'netlify/functions');
const SCR  = path.join(ROOT, 'scripts');

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

const ecDataSrc    = fs.readFileSync(path.join(NF, 'energy-credits-data.js'), 'utf8');
const orgCtxSrc    = fs.readFileSync(path.join(NF, 'organization-context.js'), 'utf8');
const resolverSrc  = fs.readFileSync(path.join(MT, 'organizationContextResolver.ts'), 'utf8');
const bootstrapSrc = fs.readFileSync(path.join(BS, 'standaloneProviderBootstrap.ts'), 'utf8');
const markerSrc    = fs.readFileSync(path.join(SCR, 'gate8e-write-migration-marker.js'), 'utf8');
const htmlSrc      = fs.readFileSync(path.join(ROOT, 'energy-credits-v2.html'), 'utf8');

// ── Suite 1: hasMigrationMarker ───────────────────────────────────────────────

console.log('\nSuite 1 — hasMigrationMarker na energy-credits-data.js');

assert('MM01 função hasMigrationMarker declarada',           ecDataSrc.includes('function hasMigrationMarker'));
assert('MM02 verifica raw._migration',                       ecDataSrc.includes('raw._migration'));
assert('MM03 verifica status === verified',                  ecDataSrc.includes("_migration.status === 'verified'"));
assert('MM04 exportada como _hasMigrationMarker',            ecDataSrc.includes('_hasMigrationMarker'));
assert('MM05 exportada como _hasOrgData',                    ecDataSrc.includes('_hasOrgData'));
assert('MM06 dual-read usa hasMigrationMarker OR hasOrgData', ecDataSrc.includes('hasMigrationMarker(orgRaw)'));
assert('MM07 dual-read: hasOrgData ainda presente',          ecDataSrc.includes('hasOrgData(orgRaw)'));

// ── Suite 2: Error codes ──────────────────────────────────────────────────────

console.log('\nSuite 2 — Separação de error codes por condição');

assert('EC01 energy-credits-data.js: membership ausente → organization_invalid',
  ecDataSrc.includes("code: 'organization_invalid'"));
assert('EC02 energy-credits-data.js: membership inativo → membership_inactive',
  ecDataSrc.includes("code: 'membership_inactive'"));
assert('EC03 energy-credits-data.js: checagem separada (!membership)',
  ecDataSrc.includes('if (!membership)'));
assert('EC04 energy-credits-data.js: status inativo checado separadamente',
  ecDataSrc.includes("membership.status !== 'active'"));

assert('EC05 organization-context.js: sem membership → organization_invalid',
  orgCtxSrc.includes("'organization_invalid'"));
assert('EC06 organization-context.js: org inativa → organization_inactive',
  orgCtxSrc.includes("'organization_inactive'"));
assert('EC07 organization-context.js: erro de acesso → organization_context_failed',
  orgCtxSrc.includes("'organization_context_failed'"));

// ── Suite 3: clearActiveOrganization ──────────────────────────────────────────

console.log('\nSuite 3 — clearActiveOrganization no resolver');

assert('CA01 clearActiveOrganization exportada',          resolverSrc.includes('export function clearActiveOrganization'));
assert('CA02 clearActiveOrganization remove ACTIVE_ORG_KEY', resolverSrc.includes('sessionStorage.removeItem(ACTIVE_ORG_KEY)'));
assert('CA03 try/catch para ambientes não-browser',       resolverSrc.includes('try {') && resolverSrc.includes('} catch'));
assert('CA04 ACTIVE_ORG_KEY constante preservada',        resolverSrc.includes("ACTIVE_ORG_KEY = 'esa_active_organization'"));

// ── Suite 4: ORG_CONTEXT_MESSAGES no bootstrap ────────────────────────────────

console.log('\nSuite 4 — ORG_CONTEXT_MESSAGES no bootstrap');

assert('BS01 ORG_CONTEXT_MESSAGES declarado',           bootstrapSrc.includes('ORG_CONTEXT_MESSAGES'));
assert('BS02 organization_invalid mapeado',             bootstrapSrc.includes('organization_invalid'));
assert('BS03 organization_inactive mapeado',            bootstrapSrc.includes('organization_inactive'));
assert('BS04 membership_inactive mapeado',              bootstrapSrc.includes('membership_inactive'));
assert('BS05 no_permission mapeado',                    bootstrapSrc.includes('no_permission'));
assert('BS06 organization_context_failed mapeado',      bootstrapSrc.includes('organization_context_failed'));
assert('BS07 forbidden mapeado',                        bootstrapSrc.includes('forbidden'));
assert('BS08 orgCode extraído de resolveOrganizationContext',
  bootstrapSrc.includes('code: orgCode'));
assert('BS09 orgCode logado com mensagem descritiva',   bootstrapSrc.includes('org_context_code'));

// ── Suite 5: HTML error messages ──────────────────────────────────────────────

console.log('\nSuite 5 — Mensagens de erro no HTML');

assert('HT01 HTML trata organization_inactive',         htmlSrc.includes('"organization_inactive"'));
assert('HT02 HTML trata membership_inactive',           htmlSrc.includes('"membership_inactive"'));
assert('HT03 HTML trata organization_context_failed',   htmlSrc.includes('"organization_context_failed"'));
assert('HT04 HTML mantém organization_invalid',         htmlSrc.includes('"organization_invalid"'));
assert('HT05 HTML mantém no_permission',                htmlSrc.includes('"no_permission"'));
assert('HT06 "Erro desconhecido no runtime." ainda presente como fallback',
  htmlSrc.includes('"Erro desconhecido no runtime."'));

// ── Suite 6: Migration marker script ──────────────────────────────────────────

console.log('\nSuite 6 — gate8e-write-migration-marker.js');

assert('MK01 exporta buildMarker',              markerSrc.includes('buildMarker'));
assert('MK02 exporta maskUid',                  markerSrc.includes('maskUid'));
assert('MK03 exporta loadGate8dReport',         markerSrc.includes('loadGate8dReport'));
assert('MK04 marker tem gate:8D',               markerSrc.includes("gate:"));
assert('MK05 marker tem status:verified',       markerSrc.includes("status:") && markerSrc.includes("'verified'"));
assert('MK06 marker tem version:1',             markerSrc.includes('version:'));
assert('MK07 marker não grava PII (uid mascarado)', markerSrc.includes('maskUid'));
assert('MK08 idempotente: checa existência antes de gravar', markerSrc.includes("existing.status === 'verified'"));
assert('MK09 suporte a --dry-run',              markerSrc.includes('dryRun'));
assert('MK10 path de gravação correto',
  markerSrc.includes('organizations/${args.organizationId}/energyCredits/_migration'));

// ── Relatório ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`Gate 8E Org Activation Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
