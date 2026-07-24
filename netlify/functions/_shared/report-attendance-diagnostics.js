'use strict';

// ── ESA OS — Diagnóstico seguro e temporário da contagem de atendimentos no
// relatório "Percentual médio da meta". Habilitado só com
// REPORT_ATTENDANCE_DIAGNOSTICS=true. Nunca inclui descrição do evento, dados
// pessoais além do nome já resolvido, tokens, secrets ou conteúdo privado —
// apenas contadores e a lista de datas/nomes envolvidos na contagem. Não deve
// permanecer permanentemente habilitado após a validação em produção.

function isReportAttendanceDiagnosticsEnabled() {
  return process.env.REPORT_ATTENDANCE_DIAGNOSTICS === 'true';
}

// eventsByDate: mapa "YYYY-MM-DD" -> eventsForDate (mapa eventId -> evento).
// personName: nome canônico já resolvido para o uid-alvo.
function buildAttendanceDiagnostics(eventsByDate, personName, attendance) {
  var datesRead = Object.keys(eventsByDate || {}).sort();
  var eventsRead = 0;
  var successfulEvents = 0;
  var excludedRetomada = 0;
  var matchedAsAuthor = 0;
  var matchedAsConfirmedGuest = 0;

  datesRead.forEach(function (dateKey) {
    Object.values((eventsByDate || {})[dateKey] || {}).forEach(function (ev) {
      if (!ev) return;
      eventsRead++;
      if (ev.type === 'retomada' || ev.tipo_atendimento === 'retomada') {
        excludedRetomada++;
        return;
      }
      if (attendance.isAttendanceSuccessfullyCompleted(ev)) {
        successfulEvents++;
        if (ev.author && attendance.normalizePersonName(ev.author) === attendance.normalizePersonName(personName)) {
          matchedAsAuthor++;
        } else if (Array.isArray(ev.guests) && ev.guests.some(function (g) {
          return g && g.status === 'confirmed' && attendance.normalizePersonName(g.name) === attendance.normalizePersonName(personName);
        })) {
          matchedAsConfirmedGuest++;
        }
      }
    });
  });

  return {
    sourceNode: 'events',
    datesRead: datesRead,
    eventsRead: eventsRead,
    successfulEvents: successfulEvents,
    excludedRetomada: excludedRetomada,
    matchedAsAuthor: matchedAsAuthor,
    matchedAsConfirmedGuest: matchedAsConfirmedGuest,
    uniqueMatchedEvents: matchedAsAuthor + matchedAsConfirmedGuest,
    resolvedPersonName: personName || null,
  };
}

module.exports = { isReportAttendanceDiagnosticsEnabled, buildAttendanceDiagnostics };
