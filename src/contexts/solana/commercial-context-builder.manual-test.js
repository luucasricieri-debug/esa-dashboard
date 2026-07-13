/**
 * ESA OS — Contexts / Solana
 * SolanaCommercialContextBuilder — Teste manual
 *
 * Cobre:
 *   - Contrato completo (contextVersion, contextType, scope, snapshots, entities)
 *   - Capabilities e restrictions declarativas
 *   - Metadata completo
 *   - Data minimization (campos proibidos ausentes)
 *   - Sanitização (sem undefined, NaN, [object Object])
 *   - Tipos preservados e null consistente
 *   - Determinismo
 *   - API pública via ESAApplication (delegação, filters, options, read-only declarativo)
 */

import {
  SolanaCommercialContextBuilder,
  CONTEXT_VERSION,
  CONTEXT_TYPE,
  CONTEXT_DOMAIN,
  ORGANIZATION_ID,
  CAPABILITIES,
  RESTRICTIONS,
} from './commercial-context-builder.js';

// ── Runner ────────────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
let _section = '';

function section(label) {
  _section = label;
  console.log(`\n${label}`);
}

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    _passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${e.message}`);
    _failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion falhou');
}

function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      msg || `Esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`,
    );
  }
}

function deepEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(msg || `Esperado ${b}, recebido ${a}`);
}

function assertAbsent(obj, key, msg) {
  const json = JSON.stringify(obj);
  assert(!json.includes(`"${key}"`), msg || `Chave "${key}" não deveria existir no contexto`);
}

function assertNoValue(json, token, msg) {
  assert(!json.includes(token), msg || `Valor "${token}" não deveria existir no contexto`);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_BRIEF = {
  generatedAt:   1700000000000,
  referenceDate: 1700000000000,
  filters:       { funil: 'uft' },
  executive: {
    totalDeals: 10, conversionRate: 0.5, winRate: 0.4,
    lossRate: 0.2, pausedRate: 0.1, pipelineValue: 2_000_000, weightedForecast: 1_200_000,
  },
  pipelineHealth: {
    totalDeals: 10, freshDeals: 5, attentionDeals: 2, riskDeals: 2, criticalDeals: 1,
    dealsWithoutNextAction: 3, valueAtRisk: 800_000, criticalValue: 500_000,
    agingDistribution: { fresh: 5, attention: 2, risk: 2, critical: 1 },
  },
  risk: {
    totalSignals: 5, criticalSignals: 2, riskSignals: 3, affectedDeals: 4,
    valueExposed: 1_500_000,
    byType:     { CRITICAL_NO_NEXT_ACTION: 1, HIGH_VALUE_STALE: 1, STALE_DEAL: 3 },
    bySeverity: { critical: 2, risk: 3 },
    topSignals: [
      {
        type: 'CRITICAL_NO_NEXT_ACTION', severity: 'critical',
        title: 'Deal crítico sem próxima ação',
        description: 'Deal parado há 45 dias sem próxima ação.',
        dealId: 'deal-001', dealName: 'Empresa A',
        responsible: 'João Silva', pipeline: 'UFV Residencial', stage: 'Proposta',
        value: 500_000, agingDays: 45,
        metadata: { agingLevel: 'critical' },
      },
      {
        type: 'HIGH_VALUE_STALE', severity: 'critical',
        title: 'Deal de alto valor parado',
        description: 'Deal com valor superior a R$ 500 mil parado há 35 dias.',
        dealId: 'deal-002', dealName: 'Empresa B',
        responsible: 'Maria Santos', pipeline: 'UFV Comercial', stage: 'Negociação',
        value: 700_000, agingDays: 35,
        metadata: { agingLevel: 'critical', threshold: 500_000 },
      },
    ],
  },
  actionPriority: {
    totalPriorities: 10, urgentDeals: 2, highPriorityDeals: 3,
    mediumPriorityDeals: 3, lowPriorityDeals: 2,
    prioritizedValue: 3_000_000, urgentValue: 1_200_000, averagePriorityScore: 55,
    byPriorityLevel: { urgent: 2, high: 3, medium: 3, low: 2 },
    topPriorities: [
      {
        id: 'priority::deal-001', dealId: 'deal-001', dealName: 'Empresa A',
        company: 'Empresa A SA', responsible: 'João Silva',
        pipeline: 'UFV Residencial', stage: 'Proposta', status: 'ativo',
        value: 500_000, agingDays: 45, agingLevel: 'critical',
        priorityScore: 95, priorityLevel: 'urgent',
        reasons: [{ code: 'CRITICAL_AGING', label: 'Aging crítico', weight: 60 }],
        signalTypes: ['CRITICAL_NO_NEXT_ACTION'],
        nextActionAt: null, lastRelevantAt: 1_696_000_000_000,
        metadata: { hasNextAction: false },
      },
      {
        id: 'priority::deal-003', dealId: 'deal-003', dealName: 'Empresa C',
        company: 'Empresa C LTDA', responsible: 'Pedro Lima',
        pipeline: 'UFV Residencial', stage: 'Contato', status: 'ativo',
        value: 300_000, agingDays: 20, agingLevel: 'risk',
        priorityScore: 70, priorityLevel: 'high',
        reasons: [{ code: 'RISK_AGING', label: 'Aging em risco', weight: 35 }],
        signalTypes: [],
        nextActionAt: null, lastRelevantAt: 1_698_000_000_000,
        metadata: { hasNextAction: false },
      },
    ],
  },
  highlights: [
    {
      code: 'CRITICAL_PIPELINE', severity: 'critical',
      title: 'Deals críticos no pipeline',
      description: '1 deal com aging superior a 30 dias exige ação imediata.',
      value: 500_000, count: 1, dealId: 'deal-001',
      metadata: { criticalDeals: 1, criticalValue: 500_000 },
    },
    {
      code: 'URGENT_ACTIONS', severity: 'critical',
      title: 'Ações urgentes pendentes',
      description: '2 deals com prioridade urgente exigem ação imediata.',
      value: 1_200_000, count: 2, dealId: null,
      metadata: { urgentDeals: 2, urgentValue: 1_200_000 },
    },
  ],
  managementNarrative: 'O pipeline possui 1 deal crítico e R$ 800.000 em valor sob risco.',
  metadata: {
    filtersApplied: true, referenceDate: 1_700_000_000_000,
    sections: {
      executive: 'available', pipelineHealth: 'available',
      risk: 'available', actionPriority: 'available',
    },
    availableSections:   ['executive', 'pipelineHealth', 'risk', 'actionPriority'],
    unavailableSections: [],
    highlightCount: 2, topRiskSignalCount: 2, topPriorityCount: 2,
  },
};

function makeMock(brief = SAMPLE_BRIEF, captureArgs = null) {
  return {
    getManagementBrief(filters, options) {
      if (captureArgs) { captureArgs.filters = filters; captureArgs.options = options; }
      return {
        toJSON: () => ({
          data: brief,
          metadata: { query: 'crm.getManagementBrief' },
          generatedAt: brief.generatedAt,
        }),
      };
    },
  };
}

const builder = new SolanaCommercialContextBuilder(makeMock());
const ctx     = builder.generateContext({ funil: 'uft' }, { referenceDate: 1_700_000_000_000 });

// ── 1. CONSTANTES ─────────────────────────────────────────────────────────────

section('[1/24] CONSTANTES EXPORTADAS');

test('CONTEXT_VERSION é "1.0"',              () => eq(CONTEXT_VERSION, '1.0'));
test('CONTEXT_TYPE é "commercial-management"', () => eq(CONTEXT_TYPE, 'commercial-management'));
test('CONTEXT_DOMAIN é "crm"',               () => eq(CONTEXT_DOMAIN, 'crm'));
test('ORGANIZATION_ID é "esa"',              () => eq(ORGANIZATION_ID, 'esa'));

// ── 2. CAPABILITIES ───────────────────────────────────────────────────────────

section('[2/24] CAPABILITIES');

test('capabilities é array com 4 itens', () => {
  assert(Array.isArray(ctx.capabilities) && ctx.capabilities.length === 4);
});
test('summarize presente',               () => assert(ctx.capabilities.includes('summarize')));
test('explain-risk presente',            () => assert(ctx.capabilities.includes('explain-risk')));
test('compare-priorities presente',      () => assert(ctx.capabilities.includes('compare-priorities')));
test('identify-attention-points presente', () => assert(ctx.capabilities.includes('identify-attention-points')));

// ── 3. RESTRICTIONS ───────────────────────────────────────────────────────────

section('[3/24] RESTRICTIONS');

test('restrictions é array com 7 itens', () => {
  assert(Array.isArray(ctx.restrictions) && ctx.restrictions.length === 7);
});
test('read-only presente',              () => assert(ctx.restrictions.includes('read-only')));
test('no-deal-mutation presente',       () => assert(ctx.restrictions.includes('no-deal-mutation')));
test('no-followup-creation presente',   () => assert(ctx.restrictions.includes('no-followup-creation')));
test('no-stage-move presente',          () => assert(ctx.restrictions.includes('no-stage-move')));
test('no-user-management presente',     () => assert(ctx.restrictions.includes('no-user-management')));
test('no-file-access presente',         () => assert(ctx.restrictions.includes('no-file-access')));
test('no-secret-access presente',       () => assert(ctx.restrictions.includes('no-secret-access')));

// ── 4. CONTRATO BASE ──────────────────────────────────────────────────────────

section('[4/24] CONTRATO BASE');

test('contextVersion é "1.0"',                () => eq(ctx.contextVersion, '1.0'));
test('contextType é "commercial-management"',  () => eq(ctx.contextType, 'commercial-management'));
test('generatedAt reutiliza brief.generatedAt', () => eq(ctx.generatedAt, 1_700_000_000_000));
test('referenceDate reutiliza brief.referenceDate', () => eq(ctx.referenceDate, 1_700_000_000_000));

// ── 5. SCOPE ─────────────────────────────────────────────────────────────────

section('[5/24] SCOPE');

test('scope existe e é objeto',          () => assert(ctx.scope && typeof ctx.scope === 'object'));
test('scope.organization é "esa"',       () => eq(ctx.scope.organization, 'esa'));
test('scope.domain é "crm"',             () => eq(ctx.scope.domain, 'crm'));
test('scope.filtersApplied é objeto',    () => assert(ctx.scope.filtersApplied && typeof ctx.scope.filtersApplied === 'object'));
test('scope.filtersApplied contém funil', () => eq(ctx.scope.filtersApplied.funil, 'uft'));

// ── 6. EXECUTIVE SNAPSHOT ─────────────────────────────────────────────────────

section('[6/24] EXECUTIVE SNAPSHOT');

test('executiveSnapshot existe',          () => assert(ctx.executiveSnapshot !== null));
test('totalDeals correto',                () => eq(ctx.executiveSnapshot.totalDeals, 10));
test('conversionRate correto',            () => eq(ctx.executiveSnapshot.conversionRate, 0.5));
test('winRate correto',                   () => eq(ctx.executiveSnapshot.winRate, 0.4));
test('lossRate correto',                  () => eq(ctx.executiveSnapshot.lossRate, 0.2));
test('pausedRate correto',                () => eq(ctx.executiveSnapshot.pausedRate, 0.1));
test('pipelineValue correto',             () => eq(ctx.executiveSnapshot.pipelineValue, 2_000_000));
test('weightedForecast correto',          () => eq(ctx.executiveSnapshot.weightedForecast, 1_200_000));

// ── 7. PIPELINE SNAPSHOT ──────────────────────────────────────────────────────

section('[7/24] PIPELINE SNAPSHOT');

test('pipelineSnapshot existe',               () => assert(ctx.pipelineSnapshot !== null));
test('totalDeals correto',                    () => eq(ctx.pipelineSnapshot.totalDeals, 10));
test('freshDeals correto',                    () => eq(ctx.pipelineSnapshot.freshDeals, 5));
test('attentionDeals correto',                () => eq(ctx.pipelineSnapshot.attentionDeals, 2));
test('riskDeals correto',                     () => eq(ctx.pipelineSnapshot.riskDeals, 2));
test('criticalDeals correto',                 () => eq(ctx.pipelineSnapshot.criticalDeals, 1));
test('dealsWithoutNextAction correto',        () => eq(ctx.pipelineSnapshot.dealsWithoutNextAction, 3));
test('valueAtRisk correto',                   () => eq(ctx.pipelineSnapshot.valueAtRisk, 800_000));
test('criticalValue correto',                 () => eq(ctx.pipelineSnapshot.criticalValue, 500_000));
test('agingDistribution existe e tem fresh',  () => eq(ctx.pipelineSnapshot.agingDistribution.fresh, 5));
test('agingDistribution tem critical',        () => eq(ctx.pipelineSnapshot.agingDistribution.critical, 1));

// ── 8. RISK SNAPSHOT ──────────────────────────────────────────────────────────

section('[8/24] RISK SNAPSHOT');

test('riskSnapshot existe',                       () => assert(ctx.riskSnapshot !== null));
test('totalSignals correto',                      () => eq(ctx.riskSnapshot.totalSignals, 5));
test('criticalSignals correto',                   () => eq(ctx.riskSnapshot.criticalSignals, 2));
test('riskSignals correto',                       () => eq(ctx.riskSnapshot.riskSignals, 3));
test('affectedDeals correto',                     () => eq(ctx.riskSnapshot.affectedDeals, 4));
test('valueExposed correto',                      () => eq(ctx.riskSnapshot.valueExposed, 1_500_000));
test('byType.CRITICAL_NO_NEXT_ACTION correto',    () => eq(ctx.riskSnapshot.byType.CRITICAL_NO_NEXT_ACTION, 1));
test('bySeverity.critical correto',               () => eq(ctx.riskSnapshot.bySeverity.critical, 2));
test('topSignals é array com 2 itens',            () => eq(ctx.riskSnapshot.topSignals.length, 2));

test('topSignal[0] — type normalizado',           () => eq(ctx.riskSnapshot.topSignals[0].type, 'CRITICAL_NO_NEXT_ACTION'));
test('topSignal[0] — dealId normalizado',         () => eq(ctx.riskSnapshot.topSignals[0].dealId, 'deal-001'));
test('topSignal[0] — dealName normalizado',       () => eq(ctx.riskSnapshot.topSignals[0].dealName, 'Empresa A'));
test('topSignal[0] — sem description longa',      () => {
  const s = ctx.riskSnapshot.topSignals[0];
  assert(!('stage' in s), 'stage não deveria estar em topSignal normalizado');
});
test('topSignal[0] — sem metadata interno',       () => {
  const s = ctx.riskSnapshot.topSignals[0];
  assert(!('metadata' in s), 'metadata interno não deveria estar em topSignal');
});

// ── 9. ACTION SNAPSHOT ───────────────────────────────────────────────────────

section('[9/24] ACTION SNAPSHOT');

test('actionSnapshot existe',                       () => assert(ctx.actionSnapshot !== null));
test('totalPriorities correto',                     () => eq(ctx.actionSnapshot.totalPriorities, 10));
test('urgentDeals correto',                         () => eq(ctx.actionSnapshot.urgentDeals, 2));
test('highPriorityDeals correto',                   () => eq(ctx.actionSnapshot.highPriorityDeals, 3));
test('mediumPriorityDeals correto',                 () => eq(ctx.actionSnapshot.mediumPriorityDeals, 3));
test('lowPriorityDeals correto',                    () => eq(ctx.actionSnapshot.lowPriorityDeals, 2));
test('prioritizedValue correto',                    () => eq(ctx.actionSnapshot.prioritizedValue, 3_000_000));
test('urgentValue correto',                         () => eq(ctx.actionSnapshot.urgentValue, 1_200_000));
test('averagePriorityScore correto',                () => eq(ctx.actionSnapshot.averagePriorityScore, 55));
test('byPriorityLevel.urgent correto',              () => eq(ctx.actionSnapshot.byPriorityLevel.urgent, 2));
test('topPriorities é array com 2 itens',           () => eq(ctx.actionSnapshot.topPriorities.length, 2));

test('topPriority[0] — dealId normalizado',         () => eq(ctx.actionSnapshot.topPriorities[0].dealId, 'deal-001'));
test('topPriority[0] — priorityLevel normalizado',  () => eq(ctx.actionSnapshot.topPriorities[0].priorityLevel, 'urgent'));
test('topPriority[0] — sem id interno (prefix::)',  () => assert(!('id' in ctx.actionSnapshot.topPriorities[0])));
test('topPriority[0] — sem reasons internos',       () => assert(!('reasons' in ctx.actionSnapshot.topPriorities[0])));
test('topPriority[0] — sem signalTypes internos',   () => assert(!('signalTypes' in ctx.actionSnapshot.topPriorities[0])));
test('topPriority[0] — agingDays válido (>=0)',     () => {
  const ap = ctx.actionSnapshot.topPriorities[0].agingDays;
  assert(ap === null || (typeof ap === 'number' && ap >= 0), `agingDays inválido: ${ap}`);
});

// ── 10. HIGHLIGHTS ────────────────────────────────────────────────────────────

section('[10/24] HIGHLIGHTS');

test('highlights é array com 2 itens',      () => eq(ctx.highlights.length, 2));
test('highlight[0].code correto',           () => eq(ctx.highlights[0].code, 'CRITICAL_PIPELINE'));
test('highlight[0].severity correto',       () => eq(ctx.highlights[0].severity, 'critical'));
test('highlight[0].title correto',          () => assert(typeof ctx.highlights[0].title === 'string' && ctx.highlights[0].title.length > 0));
test('highlight[0].description correto',    () => assert(typeof ctx.highlights[0].description === 'string'));
test('highlight[0].value correto',          () => eq(ctx.highlights[0].value, 500_000));
test('highlight[0].count correto',          () => eq(ctx.highlights[0].count, 1));
test('highlight[0].dealId correto',         () => eq(ctx.highlights[0].dealId, 'deal-001'));
test('highlight[1].dealId null (ausente)',  () => assert(ctx.highlights[1].dealId === null));
test('highlight[0] — sem metadata interno', () => assert(!('metadata' in ctx.highlights[0])));

// ── 11. NARRATIVE ─────────────────────────────────────────────────────────────

section('[11/24] NARRATIVE');

test('narrative é string',       () => assert(typeof ctx.narrative === 'string'));
test('narrative reutilizada',    () => eq(ctx.narrative, SAMPLE_BRIEF.managementNarrative));

// ── 12. ENTITIES — RISCO ─────────────────────────────────────────────────────

section('[12/24] ENTITIES — RISCO');

const deal001 = ctx.entities.find(e => e.id === 'deal-001');
const deal002 = ctx.entities.find(e => e.id === 'deal-002');

test('entity de deal-001 existe (risk + priority + highlight)', () => assert(!!deal001));
test('entity de deal-002 existe (risk only)',                   () => assert(!!deal002));
test('deal-002 entityType é "deal"',                           () => eq(deal002.entityType, 'deal'));
test('deal-002 dealName preservado',                           () => eq(deal002.name, 'Empresa B'));
test('deal-002 role inclui "risk"',                            () => assert(deal002.role.includes('risk')));
test('deal-002 references inclui sinal',                       () => assert(deal002.references.includes('HIGH_VALUE_STALE')));

// ── 13. ENTITIES — PRIORIDADE ─────────────────────────────────────────────────

section('[13/24] ENTITIES — PRIORIDADE');

const deal003 = ctx.entities.find(e => e.id === 'deal-003');

test('entity de deal-003 existe (priority only)',   () => assert(!!deal003));
test('deal-003 role inclui "priority"',             () => assert(deal003.role.includes('priority')));
test('deal-003 references inclui priorityLevel',    () => assert(deal003.references.includes('high')));
test('deal-003 name preservado',                    () => eq(deal003.name, 'Empresa C'));

// ── 14. ENTITIES — HIGHLIGHT ─────────────────────────────────────────────────

section('[14/24] ENTITIES — HIGHLIGHT');

test('deal-001 role inclui "highlight"', () => assert(deal001 && deal001.role.includes('highlight')));
test('highlight com dealId null não gera entity extra', () => {
  const byRole = ctx.entities.filter(e => e.role.includes('highlight'));
  eq(byRole.length, 1);
});

// ── 15. DEDUPLICAÇÃO E MÚLTIPLOS ROLES ───────────────────────────────────────

section('[15/24] DEDUPLICAÇÃO E MÚLTIPLOS ROLES');

test('deal-001 aparece uma única vez em entities', () => {
  eq(ctx.entities.filter(e => e.id === 'deal-001').length, 1);
});
test('deal-001 tem 3 roles distintos', () => eq(deal001.role.length, 3));
test('deal-001 roles: highlight, priority, risk', () => {
  deepEq(deal001.role, ['highlight', 'priority', 'risk']);
});
test('deal-001 references tem 3 entradas distintas', () => eq(deal001.references.length, 3));
test('total de entities é 3 (001, 002, 003)', () => eq(ctx.entities.length, 3));

// ── 16. REFERENCES DETERMINÍSTICAS ───────────────────────────────────────────

section('[16/24] REFERENCES DETERMINÍSTICAS');

test('deal-001 references ordenadas alfabeticamente', () => {
  const sorted = deal001.references.slice().sort();
  deepEq(deal001.references, sorted);
});
test('deal-001 references contém CRITICAL_NO_NEXT_ACTION', () => assert(deal001.references.includes('CRITICAL_NO_NEXT_ACTION')));
test('deal-001 references contém CRITICAL_PIPELINE',        () => assert(deal001.references.includes('CRITICAL_PIPELINE')));
test('deal-001 references contém urgent',                   () => assert(deal001.references.includes('urgent')));
test('entities ordenadas por id (deal-001 < deal-002 < deal-003)', () => {
  deepEq(ctx.entities.map(e => e.id), ['deal-001', 'deal-002', 'deal-003']);
});

// ── 17. METADATA ─────────────────────────────────────────────────────────────

section('[17/24] METADATA');

test('metadata existe',                          () => assert(ctx.metadata && typeof ctx.metadata === 'object'));
test('source é "crm-management-brief"',          () => eq(ctx.metadata.source, 'crm-management-brief'));
test('sourceVersion é "1.0"',                    () => eq(ctx.metadata.sourceVersion, '1.0'));
test('sectionsAvailable é array',                () => assert(Array.isArray(ctx.metadata.sectionsAvailable)));
test('sectionsAvailable contém executive',       () => assert(ctx.metadata.sectionsAvailable.includes('executive')));
test('sectionsUnavailable é array',              () => assert(Array.isArray(ctx.metadata.sectionsUnavailable)));
test('entityCount é 3',                          () => eq(ctx.metadata.entityCount, 3));
test('highlightCount é 2',                       () => eq(ctx.metadata.highlightCount, 2));
test('riskSignalCount é 2',                      () => eq(ctx.metadata.riskSignalCount, 2));
test('priorityCount é 2',                        () => eq(ctx.metadata.priorityCount, 2));
test('minimized é true',                         () => eq(ctx.metadata.minimized, true));
test('readOnly é true',                          () => eq(ctx.metadata.readOnly, true));

// ── 18. SEÇÃO UNAVAILABLE ─────────────────────────────────────────────────────

section('[18/24] SEÇÃO UNAVAILABLE');

const BRIEF_PARTIAL = {
  ...SAMPLE_BRIEF,
  executive: null,
  pipelineHealth: null,
  metadata: {
    ...SAMPLE_BRIEF.metadata,
    availableSections:   ['risk', 'actionPriority'],
    unavailableSections: ['executive', 'pipelineHealth'],
  },
};

const ctxPartial = new SolanaCommercialContextBuilder(makeMock(BRIEF_PARTIAL))
  .generateContext();

test('executiveSnapshot é null quando seção indisponível',   () => assert(ctxPartial.executiveSnapshot === null));
test('pipelineSnapshot é null quando seção indisponível',    () => assert(ctxPartial.pipelineSnapshot === null));
test('sectionsUnavailable lista executive',  () => assert(ctxPartial.metadata.sectionsUnavailable.includes('executive')));
test('sectionsUnavailable lista pipelineHealth', () => assert(ctxPartial.metadata.sectionsUnavailable.includes('pipelineHealth')));
test('riskSnapshot ainda disponível',        () => assert(ctxPartial.riskSnapshot !== null));
test('actionSnapshot ainda disponível',      () => assert(ctxPartial.actionSnapshot !== null));

// ── 19. DATA MINIMIZATION ─────────────────────────────────────────────────────

section('[19/24] DATA MINIMIZATION');

const BRIEF_POISONED = {
  ...SAMPLE_BRIEF,
  password:         'senha123',
  passHash:         'abc123hash',
  sessionToken:     'tok_secret',
  sessionExpiresAt: 9999999,
  serviceAccount:   { key: 'secret' },
  apiKey:           'AIzaSy...',
  auditEntries:     [{ action: 'login', ts: 1 }],
  internalLog:      ['linha 1', 'linha 2'],
  stack:            'Error at line 1\n  at ...',
  executive: {
    ...SAMPLE_BRIEF.executive,
    arquivos:   [{ url: 'https://storage.googleapis.com/secret' }],
    attachments: ['attachment1'],
  },
};

const ctxPoisoned = new SolanaCommercialContextBuilder(makeMock(BRIEF_POISONED))
  .generateContext();

const jsonPoisoned = JSON.stringify(ctxPoisoned);

test('ausência de "password"',         () => assertNoValue(jsonPoisoned, '"password"'));
test('ausência de "passHash"',         () => assertNoValue(jsonPoisoned, '"passHash"'));
test('ausência de "sessionToken"',     () => assertNoValue(jsonPoisoned, '"sessionToken"'));
test('ausência de "sessionExpiresAt"', () => assertNoValue(jsonPoisoned, '"sessionExpiresAt"'));
test('ausência de "serviceAccount"',   () => assertNoValue(jsonPoisoned, '"serviceAccount"'));
test('ausência de "auditEntries"',     () => assertNoValue(jsonPoisoned, '"auditEntries"'));
test('ausência de "internalLog"',      () => assertNoValue(jsonPoisoned, '"internalLog"'));
test('ausência de "stack"',            () => assertNoValue(jsonPoisoned, '"stack"'));
test('ausência de "arquivos"',         () => assertNoValue(jsonPoisoned, '"arquivos"'));
test('ausência de "attachments"',      () => assertNoValue(jsonPoisoned, '"attachments"'));

// ── 20. SANITIZAÇÃO ───────────────────────────────────────────────────────────

section('[20/24] SANITIZAÇÃO');

const BRIEF_DIRTY = {
  ...SAMPLE_BRIEF,
  risk: {
    ...SAMPLE_BRIEF.risk,
    totalSignals: NaN,
    topSignals: [
      {
        type: {}, severity: 'critical', title: undefined,
        dealId: 'deal-dirty', dealName: null,
        responsible: undefined, pipeline: 'X',
        value: NaN, agingDays: undefined,
        metadata: {},
      },
    ],
  },
};

const ctxDirty = new SolanaCommercialContextBuilder(makeMock(BRIEF_DIRTY))
  .generateContext();

const jsonDirty = JSON.stringify(ctxDirty);

test('sem undefined no output',         () => assertNoValue(jsonDirty, ':undefined'));
test('sem NaN no output',               () => assertNoValue(jsonDirty, ':NaN'));
test('sem [object Object] no output',   () => assertNoValue(jsonDirty, '[object Object]'));
test('totalSignals NaN vira null',      () => assert(ctxDirty.riskSnapshot.totalSignals === null));
test('signal.type objeto vira null',    () => assert(ctxDirty.riskSnapshot.topSignals[0].type === null));
test('signal.value NaN vira null',      () => assert(ctxDirty.riskSnapshot.topSignals[0].value === null));
test('signal.agingDays undefined vira null', () => assert(ctxDirty.riskSnapshot.topSignals[0].agingDays === null));

// ── 21. TIPOS PRESERVADOS ─────────────────────────────────────────────────────

section('[21/24] TIPOS PRESERVADOS');

test('totalDeals permanece number',    () => eq(typeof ctx.executiveSnapshot.totalDeals, 'number'));
test('conversionRate permanece number',() => eq(typeof ctx.executiveSnapshot.conversionRate, 'number'));
test('narrative permanece string',     () => eq(typeof ctx.narrative, 'string'));
test('minimized permanece boolean',    () => eq(typeof ctx.metadata.minimized, 'boolean'));
test('capabilities permanece array',   () => assert(Array.isArray(ctx.capabilities)));
test('entities permanece array',       () => assert(Array.isArray(ctx.entities)));
test('scope permanece object',         () => assert(ctx.scope && typeof ctx.scope === 'object' && !Array.isArray(ctx.scope)));
test('null é null, não string',        () => assert(ctx.highlights[1].dealId === null));

// ── 22. DETERMINISMO ──────────────────────────────────────────────────────────

section('[22/24] DETERMINISMO');

test('mesmo input produz mesmo contextVersion',   () => {
  const b2 = new SolanaCommercialContextBuilder(makeMock()).generateContext({ funil: 'uft' }, { referenceDate: 1_700_000_000_000 });
  eq(b2.contextVersion, ctx.contextVersion);
});
test('mesmo input produz mesmo generatedAt',      () => {
  const b2 = new SolanaCommercialContextBuilder(makeMock()).generateContext({ funil: 'uft' }, { referenceDate: 1_700_000_000_000 });
  eq(b2.generatedAt, ctx.generatedAt);
});
test('mesmo input produz mesmas entities',        () => {
  const b2 = new SolanaCommercialContextBuilder(makeMock()).generateContext({ funil: 'uft' }, { referenceDate: 1_700_000_000_000 });
  deepEq(b2.entities.map(e => e.id), ctx.entities.map(e => e.id));
});
test('generatedAt reutiliza brief.generatedAt sem novo Date.now()', () => {
  const fixedBrief = { ...SAMPLE_BRIEF, generatedAt: 1234567890000 };
  const c2 = new SolanaCommercialContextBuilder(makeMock(fixedBrief)).generateContext();
  eq(c2.generatedAt, 1234567890000);
});

// ── 23. API PÚBLICA — DELEGAÇÃO VIA ESAApplication ───────────────────────────

section('[23/24] API PÚBLICA — DELEGAÇÃO VIA ESAApplication');

class MockESAApplication {
  constructor(queryProvider) {
    this._qp = queryProvider;
    this._solanaContextBuilder = null;
  }
  getSolanaCommercialContext(filters = {}, options = {}) {
    if (!this._solanaContextBuilder) {
      this._solanaContextBuilder = new SolanaCommercialContextBuilder(this._qp);
    }
    return this._solanaContextBuilder.generateContext(filters, options);
  }
}

test('getSolanaCommercialContext existe na aplicação',  () => {
  const app = new MockESAApplication(makeMock());
  assert(typeof app.getSolanaCommercialContext === 'function');
});

test('retorna contextVersion correto',   () => {
  const app = new MockESAApplication(makeMock());
  const c   = app.getSolanaCommercialContext();
  eq(c.contextVersion, '1.0');
});

const capturedArgs = {};
const appWithCapture = new MockESAApplication(makeMock(SAMPLE_BRIEF, capturedArgs));

test('propagação de filters',  () => {
  appWithCapture.getSolanaCommercialContext({ funil: 'eletromobilidade' });
  eq(capturedArgs.filters.funil, 'eletromobilidade');
});

const capturedArgs2 = {};
const appWithCapture2 = new MockESAApplication(makeMock(SAMPLE_BRIEF, capturedArgs2));

test('propagação de options.referenceDate', () => {
  appWithCapture2.getSolanaCommercialContext({}, { referenceDate: 1_700_000_000_000 });
  eq(capturedArgs2.options.referenceDate, 1_700_000_000_000);
});

test('contexto é read-only por contrato declarativo (restrictions)',  () => {
  const app = new MockESAApplication(makeMock());
  const c   = app.getSolanaCommercialContext();
  assert(c.restrictions.includes('read-only'));
  assert(c.metadata.readOnly === true);
});

test('consumidor não recebe instância de analyzer diretamente', () => {
  const app = new MockESAApplication(makeMock());
  const c   = app.getSolanaCommercialContext();
  assert(!('_pipelineAnalyzer' in c), 'analyzer interno não deve vazar');
  assert(!('_readModel'        in c), 'readModel não deve vazar');
  assert(!('_qp'               in c), 'queryProvider não deve vazar');
});

// ── 24. ISOLAMENTO DO CONSUMIDOR ─────────────────────────────────────────────

section('[24/24] ISOLAMENTO DO CONSUMIDOR');

test('builder não expõe readModel diretamente', () => {
  const b = new SolanaCommercialContextBuilder(makeMock());
  assert(!b.readModel && !b._readModel, 'readModel não deveria ser público');
});

test('builder não expõe analyzers diretamente', () => {
  const b = new SolanaCommercialContextBuilder(makeMock());
  assert(
    !b._pipelineAnalyzer && !b._riskAnalyzer && !b._actionPriorityAnalyzer,
    'analyzers não deveriam ser acessíveis no builder',
  );
});

test('contexto final não contém chave _qp ou _readModel', () => {
  const c = new SolanaCommercialContextBuilder(makeMock()).generateContext();
  const json = JSON.stringify(c);
  assertNoValue(json, '"_qp"');
  assertNoValue(json, '"_readModel"');
});

test('capabilities não inclui ações de escrita',  () => {
  const c = new SolanaCommercialContextBuilder(makeMock()).generateContext();
  const writes = ['write', 'create', 'delete', 'update', 'move', 'mutate'];
  for (const w of writes) {
    assert(!c.capabilities.some(cap => cap.includes(w)), `capability de escrita "${w}" não deve existir`);
  }
});

// ── Resultado ─────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`SolanaCommercialContextBuilder — ${_passed + _failed}/${_passed + _failed} cenários`);
console.log(`  Passou: ${_passed}   Falhou: ${_failed}`);
if (_failed === 0) {
  console.log('\nTodos os cenários passaram.');
} else {
  console.error(`\n${_failed} cenário(s) falharam.`);
  process.exitCode = 1;
}
