/**
 * ESA OS — Fonte única de "dia válido" para metas e indicadores comerciais.
 *
 * Regra oficial (única regra desta missão): segunda a sexta-feira contam;
 * sábado e domingo NUNCA contam em meta, realizado, denominador, média ou
 * quantidade de dias considerados. A regra atual exclui APENAS sábados e
 * domingos — feriados de segunda a sexta continuam válidos (nenhum
 * calendário de feriados é implementado ou consultado aqui).
 *
 * Usado por: assets/performance-goals.js, assets/attendance-performance.js,
 * netlify/functions/reports-performance-goal-average.js (backend, via
 * require()) e index.html (client, via
 * <script src="/assets/performance-business-days.js">, ANTES de
 * performance-goals.js e attendance-performance.js). Nenhum outro lugar deve
 * reimplementar esta regra — ver docs/DAILY-MONTHLY-GOALS-PERFORMANCE.md.
 *
 * Segurança de fuso horário: NUNCA usar `new Date('YYYY-MM-DD')` (data-only,
 * interpretada como UTC-meia-noite pelo ECMAScript) — em fusos com offset
 * negativo (ex.: Brasil, UTC-3), isso pode deslocar para o dia civil
 * ANTERIOR ao converter para hora local, corrompendo o dia da semana. Este
 * módulo SEMPRE decompõe ano/mês/dia manualmente e constrói a data via
 * `new Date(year, month-1, day)` — o construtor de 3+ argumentos do
 * ECMAScript é SEMPRE interpretado em hora LOCAL, nunca UTC, garantindo que
 * o dia da semana retornado corresponda exatamente à data civil pedida,
 * independente do fuso horário do navegador/servidor.
 *
 * UMD: funciona como CommonJS (require) e como script global no browser
 * (window.ESAPerformanceBusinessDays).
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ESAPerformanceBusinessDays = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // Decompõe "YYYY-MM-DD" em {year, month, day} (números). Retorna null para
  // qualquer entrada que não seja uma string nesse formato EXATO — nunca
  // tenta "adivinhar" outros formatos.
  function parseDateKey(dateKey) {
    if (typeof dateKey !== 'string') return null;
    var m = DATE_KEY_RE.exec(dateKey.trim());
    if (!m) return null;
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  }

  // Constrói um Date LOCAL (nunca UTC) a partir de {year, month, day}, e
  // confirma que a data é real (rejeita "2026-02-30", que o construtor do JS
  // silenciosamente "rolaria" para março).
  function toLocalDate(parts) {
    var d = new Date(parts.year, parts.month - 1, parts.day);
    if (d.getFullYear() !== parts.year || d.getMonth() !== parts.month - 1 || d.getDate() !== parts.day) {
      return null;
    }
    return d;
  }

  // Formata um Date local de volta para "YYYY-MM-DD" usando getters locais
  // (getFullYear/getMonth/getDate) — nunca toISOString(), que converte para
  // UTC e pode deslocar o dia civil dependendo do fuso horário.
  function formatDateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // Único ponto de verdade: segunda(1) a sexta(5) → true; sábado(6)/domingo(0) → false.
  // Entrada inválida (não é "YYYY-MM-DD" ou não é uma data real) → false,
  // nunca lança exceção — dia inválido nunca é tratado como dia válido.
  function isPerformanceBusinessDay(dateKey) {
    var parts = parseDateKey(dateKey);
    if (!parts) return false;
    var d = toLocalDate(parts);
    if (!d) return false;
    var dow = d.getDay(); // sempre local: 0=domingo ... 6=sábado
    return dow !== 0 && dow !== 6;
  }

  // Lista, em ordem, todas as datas (strings "YYYY-MM-DD") de segunda a
  // sexta entre startDate e endDate — AMBOS INCLUSIVOS. startDate > endDate
  // ou entradas inválidas retornam lista vazia (nunca lança).
  function listPerformanceBusinessDays(startDate, endDate) {
    var startParts = parseDateKey(startDate);
    var endParts = parseDateKey(endDate);
    if (!startParts || !endParts) return [];
    var cur = toLocalDate(startParts);
    var end = toLocalDate(endParts);
    if (!cur || !end || cur.getTime() > end.getTime()) return [];

    var result = [];
    while (cur.getTime() <= end.getTime()) {
      var key = formatDateKey(cur);
      if (isPerformanceBusinessDay(key)) result.push(key);
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  // Quantidade de dias de segunda a sexta em [startDate, endDate] inclusivo.
  function countPerformanceBusinessDays(startDate, endDate) {
    return listPerformanceBusinessDays(startDate, endDate).length;
  }

  // Filtra uma lista de registros arbitrários, mantendo apenas os cuja data
  // (extraída via getDateKey(record), que deve devolver "YYYY-MM-DD") caia
  // em um dia de segunda a sexta. getDateKey nunca é chamado com o registro
  // ausente; registros cuja data não possa ser determinada (getDateKey
  // retorna algo inválido) são excluídos, nunca incluídos "por segurança".
  function filterRecordsByPerformanceBusinessDay(records, getDateKey) {
    var list = Array.isArray(records) ? records : [];
    if (typeof getDateKey !== 'function') return [];
    return list.filter(function (record) {
      return isPerformanceBusinessDay(getDateKey(record));
    });
  }

  return {
    isPerformanceBusinessDay: isPerformanceBusinessDay,
    listPerformanceBusinessDays: listPerformanceBusinessDays,
    countPerformanceBusinessDays: countPerformanceBusinessDays,
    filterRecordsByPerformanceBusinessDay: filterRecordsByPerformanceBusinessDay,
  };
});
