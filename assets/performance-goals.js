/**
 * ESA OS — Fonte única de definição dos indicadores de desempenho comercial.
 *
 * Usado por: index.html (client, via <script src="/assets/performance-goals.js">),
 * netlify/functions/reports-performance-goal-average.js (backend, via require()),
 * e por todos os testes automatizados — nenhum outro lugar deve reimplementar
 * estas fórmulas ou o mapeamento de aliases.
 *
 * Indicadores oficiais (3, sempre):
 *   newClients            ("Novos Clientes")
 *   qualifiedLeads         ("Leads Qualificados")
 *   completedAttendances   ("Atendimentos Realizados")
 *
 * UMD: funciona como CommonJS (require) e como script global no browser
 * (window.ESAPerformanceGoals).
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./performance-business-days.js'));
  } else {
    root.ESAPerformanceGoals = factory(root.ESAPerformanceBusinessDays);
  }
})(typeof self !== 'undefined' ? self : this, function (businessDays) {
  'use strict';

  // ── Configuração central dos indicadores oficiais ──────────────────────────

  var PERFORMANCE_INDICATORS = {
    newClients: { label: 'Novos Clientes' },
    qualifiedLeads: { label: 'Leads Qualificados' },
    completedAttendances: { label: 'Atendimentos Realizados' },
  };

  var INDICATOR_KEYS = ['newClients', 'qualifiedLeads', 'completedAttendances'];

  // ── Normalização de aliases históricos (nunca apaga dados antigos — só lê) ──
  // Cobre: prospeccao, prospecção, prospecções, atendimento, atendimentos,
  // novosClientes, leadsQualificados, e os ids legados usados em METAS
  // (novos_clientes, prosp_mensal, atendimentos, atend_mensal, leads_qualificados).

  // U+0300–U+036F = bloco Unicode "Combining Diacritical Marks" (acentos
  // isolados após normalize('NFD')) — usa escape \u para não depender de bytes
  // acentuados literais no arquivo fonte.
  var COMBINING_DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');
  function stripKey(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(COMBINING_DIACRITICS_RE, '') // remove acentos
      .replace(/[^a-z0-9]/g, ''); // remove espaços, underscores, hífens
  }

  var ALIAS_PAIRS = [
    ['prospeccao', 'newClients'],
    ['prospeccoes', 'newClients'],
    ['novosclientes', 'newClients'],
    ['novos_clientes', 'newClients'],
    ['prosp_mensal', 'newClients'],
    ['newclients', 'newClients'],

    ['leadsqualificados', 'qualifiedLeads'],
    ['leads_qualificados', 'qualifiedLeads'],
    ['leads_qualificados_diario', 'qualifiedLeads'],
    ['qualifiedleads', 'qualifiedLeads'],

    ['atendimento', 'completedAttendances'],
    ['atendimentos', 'completedAttendances'],
    ['atendimento_realizado', 'completedAttendances'],
    ['atendimentos_realizados', 'completedAttendances'],
    ['atend_mensal', 'completedAttendances'],
    ['atendimentosrealizados', 'completedAttendances'],
    ['completedattendances', 'completedAttendances'],
  ];

  // Mapeamento canônico → id legado usado em METAS (index.html). Os ids
  // internos NUNCA foram renomeados quando os labels mudaram (Prospecções →
  // Novos Clientes, Atendimentos → Atendimentos Realizados) — isso preserva
  // 100% de compatibilidade com contadores/relatórios que dependem desses ids.
  // Este mapeamento existe para que nenhum código precise hardcodar a string
  // do id legado em múltiplos lugares — usar sempre esta fonte única.
  var CANONICAL_TO_LEGACY_METAS_ID = {
    newClients: { daily: 'novos_clientes', monthly: 'prosp_mensal' },
    qualifiedLeads: { daily: 'leads_qualificados_diario', monthly: 'leads_qualificados' },
    completedAttendances: { daily: 'atendimentos', monthly: 'atend_mensal' },
  };

  var INDICATOR_ALIASES = {};
  ALIAS_PAIRS.forEach(function (pair) {
    INDICATOR_ALIASES[stripKey(pair[0])] = pair[1];
  });

  // Resolve qualquer id/label histórico ou atual para a chave canônica oficial.
  // Retorna null quando não reconhecido (nunca lança — chamador decide o que fazer).
  function normalizeIndicatorKey(raw) {
    if (!raw || typeof raw !== 'string') return null;
    if (Object.prototype.hasOwnProperty.call(PERFORMANCE_INDICATORS, raw)) return raw;
    var stripped = stripKey(raw);
    return Object.prototype.hasOwnProperty.call(INDICATOR_ALIASES, stripped)
      ? INDICATOR_ALIASES[stripped]
      : null;
  }

  // ── Contagem de dias úteis (segunda–sexta) — nunca hardcoded em 22 ─────────
  // Delega inteiramente para assets/performance-business-days.js — fonte
  // única da regra de dia válido (segunda a sexta), usada também por
  // attendance-performance.js e reports-performance-goal-average.js. Mantido
  // aqui como alias de compatibilidade (mesmo nome/assinatura já usado por
  // index.html e pelos testes existentes) — nunca reimplementa a regra.

  function countBusinessDays(startISO, endISO) {
    return businessDays.countPerformanceBusinessDays(startISO, endISO);
  }

  // Meta mensal derivada da meta diária × dias úteis do período (nunca 22 fixo).
  function computeMonthlyGoalFromDaily(dailyGoal, businessDays) {
    var d = typeof dailyGoal === 'number' && isFinite(dailyGoal) && dailyGoal >= 0 ? dailyGoal : 0;
    var b = typeof businessDays === 'number' && isFinite(businessDays) && businessDays >= 0 ? businessDays : 0;
    return d * b;
  }

  // ── Percentual de um indicador individual (realizado / meta), com teto ─────

  function computeIndicatorPercentage(realizado, meta) {
    if (typeof meta !== 'number' || !isFinite(meta) || meta <= 0) {
      return { percentage: null, capped: null, status: 'missing_goal' };
    }
    var r = typeof realizado === 'number' && isFinite(realizado) ? realizado : 0;
    if (r < 0) r = 0;
    var pct = (r / meta) * 100;
    if (!isFinite(pct) || isNaN(pct)) pct = 0;
    var capped = Math.min(pct, 100);
    if (capped < 0) capped = 0;
    return { percentage: pct, capped: capped, status: 'ok' };
  }

  // ── Percentual médio diário da meta — sempre a média dos 3 oficiais ────────
  //
  // indicators = {
  //   newClients:          { realizado, meta },
  //   qualifiedLeads:       { realizado, meta },
  //   completedAttendances: { realizado, meta },
  // }
  //
  // Regra de dias sem configuração: se NENHUM dos 3 indicadores tem meta
  // configurada (meta ausente/<=0 nos três), o dia é 'not_configured' — não
  // vira 0 silenciosamente, deve ser excluído da contagem de dias válidos do
  // período (ver computePeriodGoalAveragePercentage). Se PELO MENOS UM
  // indicador tem meta configurada mas não todos os 3, o dia é
  // 'incomplete_configuration': a média ainda é calculada (sempre dividindo
  // por 3, por instrução explícita), mas o indicador ausente contribui 0 e o
  // status sinaliza a configuração incompleta para a UI exibir o aviso.

  function computeDailyGoalAveragePercentage(indicators) {
    var ind = indicators || {};
    var results = {};
    var missing = [];
    var sum = 0;

    INDICATOR_KEYS.forEach(function (key) {
      var entry = ind[key] || {};
      var r = computeIndicatorPercentage(entry.realizado, entry.meta);
      results[key] = r;
      if (r.status === 'missing_goal') {
        missing.push(key);
      } else {
        sum += r.capped;
      }
    });

    var allMissing = missing.length === INDICATOR_KEYS.length;
    var status = allMissing ? 'not_configured' : (missing.length > 0 ? 'incomplete_configuration' : 'ok');
    var average = allMissing ? null : sum / INDICATOR_KEYS.length;
    if (average !== null) {
      average = Math.round(average * 100) / 100; // até duas casas decimais
      if (average < 0) average = 0;
      if (average > 100) average = 100;
    }

    return {
      indicators: results,
      average: average, // null quando not_configured — nunca 0 silencioso
      status: status,
      missingIndicators: missing,
    };
  }

  // ── Percentual médio do período — média dos percentuais médios diários ────
  //
  // days = [{ date: 'YYYY-MM-DD', dailyGoalAveragePercentage: number|null, status }]
  // Dias com average === null (not_configured) são EXCLUÍDOS do denominador —
  // nunca contam como 0. Datas duplicadas são ignoradas na segunda ocorrência.
  //
  // ATENÇÃO: esta função calcula a MÉDIA DAS MÉDIAS DIÁRIAS — matematicamente
  // diferente da média dos três percentuais CONSOLIDADOS do período (ver
  // computeConsolidatedGoalAveragePercentage abaixo). O relatório "Percentual
  // médio da meta" usa a fórmula consolidada, NUNCA esta, para a coluna
  // principal — usar esta função para esse fim reproduz o incidente de
  // 2026-07-24 (valor exibido divergente das 3 colunas visíveis). Mantida
  // aqui apenas por compatibilidade com quem eventualmente precise de uma
  // média diária de verdade (não é mais usada por reports-performance-goal-average.js).

  function computePeriodGoalAveragePercentage(days) {
    var list = Array.isArray(days) ? days : [];
    var seen = {};
    var sum = 0;
    var validCount = 0;

    list.forEach(function (d) {
      if (!d || !d.date) return;
      if (seen[d.date]) return; // dia duplicado — não conta de novo
      seen[d.date] = true;
      var v = d.dailyGoalAveragePercentage;
      if (v === null || v === undefined || !isFinite(v) || isNaN(v)) return; // not_configured — excluído, não zerado
      sum += v;
      validCount++;
    });

    if (validCount === 0) {
      return { average: null, validDaysCount: 0, status: 'no_valid_days' };
    }
    var average = sum / validCount;
    average = Math.round(average * 100) / 100;
    return { average: average, validDaysCount: validCount, status: 'ok' };
  }

  // ── Percentual médio consolidado do período — FÓRMULA OFICIAL da coluna
  // "Percentual médio da meta" ────────────────────────────────────────────
  //
  // indicators = {
  //   newClients:           { realized, goal },
  //   qualifiedLeads:        { realized, goal },
  //   completedAttendances:  { realized, goal },
  // }
  //
  // Cada `realized`/`goal` já deve vir CONSOLIDADO (somado) para o período
  // inteiro — a mesma soma usada para exibir "realizado/meta" em cada uma
  // das 3 colunas do relatório. Esta função NUNCA deve receber valores
  // diários isolados (isso seria a média das médias diárias, a fórmula
  // incorreta corrigida em 2026-07-24 — ver computePeriodGoalAveragePercentage).
  //
  // Por indicador: percentualConsolidado = min(realized/goal*100, 100),
  // realized negativo tratado como 0, goal ausente/<=0 vira "configuração
  // incompleta" (nunca divide por zero, nunca NaN/Infinity) — reaproveita
  // computeIndicatorPercentage, a mesma função já usada por
  // computeDailyGoalAveragePercentage, garantindo idêntico comportamento de
  // teto/borda em ambas as fórmulas.
  //
  // averagePercentage = média dos 3 cappedPercentage — SEMPRE dividido por 3,
  // mesmo com 1 ou 2 indicadores em falta (contribuem 0, status sinaliza
  // 'incomplete_configuration'). Só quando os 3 estão ausentes o resultado é
  // 'not_configured' e averagePercentage é null (nunca 0 silencioso).
  //
  // cappedPercentage de cada indicador é devolvido SEM arredondamento (mesma
  // convenção de computeIndicatorPercentage.capped) — arredondar é
  // responsabilidade da exibição. Só averagePercentage é arredondado (2
  // casas), e só no final — nunca a partir de valores já arredondados.

  function computeConsolidatedGoalAveragePercentage(indicators) {
    var ind = indicators || {};
    var results = {};
    var missing = [];
    var sum = 0;

    INDICATOR_KEYS.forEach(function (key) {
      var entry = ind[key] || {};
      var r = computeIndicatorPercentage(entry.realized, entry.goal);
      var realizedSafe = typeof entry.realized === 'number' && isFinite(entry.realized) ? entry.realized : 0;
      if (realizedSafe < 0) realizedSafe = 0;
      results[key] = {
        realized: realizedSafe,
        goal: typeof entry.goal === 'number' && isFinite(entry.goal) ? entry.goal : null,
        cappedPercentage: r.capped, // null quando missing_goal — nunca 0 silencioso
      };
      if (r.status === 'missing_goal') {
        missing.push(key);
      } else {
        sum += r.capped;
      }
    });

    var allMissing = missing.length === INDICATOR_KEYS.length;
    var status = allMissing ? 'not_configured' : (missing.length > 0 ? 'incomplete_configuration' : 'ok');
    var averagePercentage = allMissing ? null : sum / INDICATOR_KEYS.length;
    if (averagePercentage !== null) {
      averagePercentage = Math.round(averagePercentage * 100) / 100;
      if (averagePercentage < 0) averagePercentage = 0;
      if (averagePercentage > 100) averagePercentage = 100;
    }

    return {
      indicators: results,
      averagePercentage: averagePercentage,
      status: status,
      missingIndicators: missing,
    };
  }

  return {
    PERFORMANCE_INDICATORS: PERFORMANCE_INDICATORS,
    INDICATOR_KEYS: INDICATOR_KEYS,
    CANONICAL_TO_LEGACY_METAS_ID: CANONICAL_TO_LEGACY_METAS_ID,
    normalizeIndicatorKey: normalizeIndicatorKey,
    countBusinessDays: countBusinessDays,
    computeMonthlyGoalFromDaily: computeMonthlyGoalFromDaily,
    computeIndicatorPercentage: computeIndicatorPercentage,
    computeDailyGoalAveragePercentage: computeDailyGoalAveragePercentage,
    computePeriodGoalAveragePercentage: computePeriodGoalAveragePercentage,
    computeConsolidatedGoalAveragePercentage: computeConsolidatedGoalAveragePercentage,
  };
});
