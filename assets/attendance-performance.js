/**
 * ESA OS — Fonte única de contagem de "Atendimentos Realizados".
 *
 * Usado pelo backend (netlify/functions/reports-performance-goal-average.js,
 * via require() Node) para contar atendimentos direto do nó Firebase
 * events/{YYYY-MM-DD}/{eventId}, sem depender de agEvs (memória do frontend),
 * cache de página ou visita prévia à Agenda.
 *
 * A regra de negócio replica EXATAMENTE a usada por countMeta('atendimentos'/
 * 'atend_mensal') em index.html (tela "Minhas Metas", já corrigida e validada
 * em produção): mesmo critério de autor/convidado confirmado, mesmo critério
 * de resultado='sucesso', mesma exclusão de retomada e de tipo_atendimento
 * diferente de 'cliente'. Ver docs/DAILY-MONTHLY-GOALS-PERFORMANCE.md.
 *
 * Mesmo padrão UMD de assets/performance-goals.js e assets/lead-origin.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./performance-business-days.js'));
  } else {
    root.ESAAttendancePerformance = factory(root.ESAPerformanceBusinessDays);
  }
})(typeof self !== 'undefined' ? self : this, function (businessDays) {
  'use strict';

  // Mesmo bloco Unicode de acentos combinantes usado em performance-goals.js
  // e lead-origin.js — remove diacríticos após normalize('NFD').
  var COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;

  // Normalização controlada: trim, minúsculas, remoção de acentos, colapso de
  // espaços internos. NUNCA faz correspondência por substring/prefixo — duas
  // strings só são consideradas a mesma pessoa se, após esta normalização,
  // forem EXATAMENTE iguais. "Felipe dos Santos" casa com "felipe dos santos"
  // mas NÃO com "Felipe Santos Junior".
  function normalizePersonName(name) {
    if (!name || typeof name !== 'string') return '';
    return name
      .normalize('NFD')
      .replace(COMBINING_DIACRITICS_RE, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Réplica exata da regra usada por countMeta('atendimentos'/'atend_mensal')
  // em index.html: exclui retomada (tanto ev.type quanto ev.tipo_atendimento
  // podem carregar esse valor, historicamente) e exige resultado 'sucesso' +
  // tipo_atendimento ausente ou igual a 'cliente'.
  function isAttendanceSuccessfullyCompleted(event) {
    if (!event) return false;
    if (event.type === 'retomada') return false;
    if (event.tipo_atendimento === 'retomada') return false;
    if (event.resultado !== 'sucesso') return false;
    var isCliente = !event.tipo_atendimento || event.tipo_atendimento === 'cliente';
    return isCliente;
  }

  // Participação: autor OU convidado com status 'confirmed'. Convidado com
  // status pending/declined/invited/cancelado/ausente NUNCA conta. Um mesmo
  // evento nunca é contado mais de uma vez para a mesma pessoa, mesmo que ela
  // apareça simultaneamente como autor e como convidado confirmado (esta
  // função retorna um único boolean por evento).
  function isPersonParticipantInAttendance(event, personName) {
    if (!event || !personName) return false;
    var normalizedTarget = normalizePersonName(personName);
    if (!normalizedTarget) return false;
    if (event.author && normalizePersonName(event.author) === normalizedTarget) return true;
    if (Array.isArray(event.guests)) {
      return event.guests.some(function (g) {
        return g && g.status === 'confirmed' && normalizePersonName(g.name) === normalizedTarget;
      });
    }
    return false;
  }

  // Conta atendimentos válidos de uma pessoa em um único dia. eventsForDate é
  // o objeto bruto lido de events/{YYYY-MM-DD} (mapa eventId -> evento).
  //
  // dateKey (opcional, "YYYY-MM-DD") é a data desse conjunto de eventos —
  // quando informado e cair em sábado/domingo, retorna 0 IMEDIATAMENTE, sem
  // sequer iterar os eventos (regra de dia válido: apenas segunda a sexta
  // contam no realizado, ver assets/performance-business-days.js). Os
  // eventos do próprio dia NUNCA são apagados/alterados — só não entram
  // nesta contagem. Omitir dateKey preserva o comportamento anterior (sem
  // filtro de dia), para chamadores que já apliquem o filtro externamente.
  function countAttendancesForPersonOnDate(eventsForDate, personName, dateKey) {
    if (dateKey !== undefined && !businessDays.isPerformanceBusinessDay(dateKey)) return 0;
    if (!eventsForDate) return 0;
    var count = 0;
    Object.values(eventsForDate).forEach(function (ev) {
      if (!ev) return;
      if (!isAttendanceSuccessfullyCompleted(ev)) return;
      if (!isPersonParticipantInAttendance(ev, personName)) return;
      count++;
    });
    return count;
  }

  // Conta atendimentos válidos de uma pessoa num período [startDate, endDate]
  // inclusivo em ambas as pontas. eventsByDate é um mapa "YYYY-MM-DD" ->
  // eventsForDate. As chaves já são datas civis (sem componente de hora), e a
  // comparação é feita por string (formato zero-padded ISO), nunca via Date/
  // fuso horário — isso evita qualquer deslocamento de dia por conversão UTC.
  //
  // Sábados e domingos dentro do período são automaticamente excluídos (via
  // countAttendancesForPersonOnDate(..., dateKey)) — os eventos permanecem
  // intactos em events/{data}, apenas não entram nesta soma.
  function countAttendancesForPersonInPeriod(eventsByDate, personName, startDate, endDate) {
    if (!eventsByDate) return 0;
    var total = 0;
    Object.keys(eventsByDate).forEach(function (dateKey) {
      if (dateKey < startDate || dateKey > endDate) return;
      total += countAttendancesForPersonOnDate(eventsByDate[dateKey], personName, dateKey);
    });
    return total;
  }

  return {
    normalizePersonName: normalizePersonName,
    isAttendanceSuccessfullyCompleted: isAttendanceSuccessfullyCompleted,
    isPersonParticipantInAttendance: isPersonParticipantInAttendance,
    countAttendancesForPersonOnDate: countAttendancesForPersonOnDate,
    countAttendancesForPersonInPeriod: countAttendancesForPersonInPeriod,
  };
});
