'use strict';

// ── ESA OS — Relatórios: "Percentual médio da meta" ──────────────────────────
// Endpoint dedicado ao novo indicador, visível apenas para usuários autorizados
// (reports.performanceGoalAverage.read). O controle de acesso é feito AQUI,
// no backend — nunca apenas ocultado na interface. O uid usado na checagem de
// permissão vem exclusivamente do sessionToken verificado, nunca do body.
//
// O cliente já tem os dados de CRM carregados (agenda, deals, prospecções) e
// pré-agrega "realizado"/"meta" por indicador e por dia — este endpoint não
// duplica a lógica ad-hoc de contagem do CRM; sua responsabilidade é: (1)
// autorizar apenas quem tem permissão e (2) aplicar, de forma autoritativa e
// testada, as fórmulas oficiais de percentual/teto/média (assets/performance-goals.js).

const crypto = require('crypto');
const { getDatabase } = require('./_shared/firebase-admin');
const { verifyToken } = require('./_shared/upload-session');
const { hasPerformanceGoalAveragePermission } = require('./_shared/reports-permissions');
const goals = require('../../assets/performance-goals.js');
const attendance = require('../../assets/attendance-performance.js');
const { isReportAttendanceDiagnosticsEnabled, buildAttendanceDiagnostics } = require('./_shared/report-attendance-diagnostics');

const MAX_DAYS_PER_REQUEST = 366;

function newRequestId() {
  try { return crypto.randomUUID(); } catch { return `rid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
}

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

function logDiag(requestId, fields) {
  try { console.info('[reports-performance-goal-average][diag]', JSON.stringify({ requestId, ...fields })); } catch { /* nunca derruba a request */ }
}

function respond(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidIndicatorEntry(e) {
  if (e === undefined || e === null) return true; // ausente é permitido — vira missing_goal
  if (typeof e !== 'object') return false;
  const okRealizado = e.realizado === undefined || (typeof e.realizado === 'number' && isFinite(e.realizado));
  const okMeta = e.meta === undefined || (typeof e.meta === 'number' && isFinite(e.meta));
  return okRealizado && okMeta;
}

exports.handler = async function (event) {
  const requestId = newRequestId();

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const secret = process.env.UPLOAD_SESSION_SECRET;
  if (!secret) {
    logDiag(requestId, { fatal: 'missing_secret' });
    return respond(500, { ok: false, code: 'upload_failed', message: 'Erro de configuração do servidor.', requestId });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return respond(400, { ok: false, code: 'invalid_body', message: 'Body inválido.', requestId });
  }

  const { sessionToken, days, targetUid } = body;

  let tokenPayload;
  try {
    tokenPayload = verifyToken(sessionToken, secret);
  } catch (e) {
    const code = e.code === 'token_expired' ? 'token_expired' : 'invalid_session';
    logDiag(requestId, { code });
    const message = code === 'token_expired' ? 'Sessão expirada.' : 'Sessão inválida.';
    return respond(401, { ok: false, code, message, requestId });
  }

  const uid = tokenPayload.uid;

  let db;
  try {
    db = getDatabase();
  } catch (e) {
    logDiag(requestId, { fatal: 'firebase_init_failed' });
    return respond(500, { ok: false, code: 'upload_failed', message: 'Erro de configuração do servidor.', requestId });
  }

  let user;
  try {
    const snap = await db.ref('users/' + uid).once('value');
    user = snap.val();
  } catch (e) {
    logDiag(requestId, { uidMasked: maskUid(uid), fatal: 'user_read_failed' });
    return respond(500, { ok: false, code: 'upload_failed', message: 'Erro ao verificar usuário.', requestId });
  }

  if (!hasPerformanceGoalAveragePermission(uid, user)) {
    logDiag(requestId, { uidMasked: maskUid(uid), code: 'no_permission' });
    return respond(403, { ok: false, code: 'no_permission', message: 'Usuário sem permissão para este indicador.', requestId });
  }

  if (!Array.isArray(days)) {
    return respond(400, { ok: false, code: 'invalid_days', message: 'days deve ser uma lista.', requestId });
  }
  if (days.length > MAX_DAYS_PER_REQUEST) {
    return respond(400, { ok: false, code: 'invalid_days', message: `days excede o máximo de ${MAX_DAYS_PER_REQUEST}.`, requestId });
  }
  for (const d of days) {
    if (!d || !isValidDateStr(d.date)) {
      return respond(400, { ok: false, code: 'invalid_days', message: 'Cada dia precisa de date no formato YYYY-MM-DD.', requestId });
    }
    for (const key of goals.INDICATOR_KEYS) {
      if (!isValidIndicatorEntry(d[key])) {
        return respond(400, { ok: false, code: 'invalid_days', message: `Indicador inválido em ${d.date}: ${key}.`, requestId });
      }
    }
  }

  // ── Atendimentos Realizados — contagem autoritativa no backend ────────────
  // O relatório não confia mais no realizado pré-computado pelo cliente para
  // este indicador (que dependia de agEvs, memória do frontend, populada só
  // se o usuário tivesse visitado Agenda/Minhas Metas na mesma sessão — causa
  // raiz do indicador aparecer sempre 0/48). Em vez disso, quando targetUid é
  // informado, este endpoint lê events/{date} diretamente via Firebase Admin,
  // apenas para as datas do período solicitado, e substitui o realizado por um
  // valor calculado aqui, usando a mesma regra de negócio de countMeta('atendimentos')
  // (ver assets/attendance-performance.js). A meta continua vindo do cliente
  // (configuração de metas, não é responsabilidade deste indicador recalcular).
  let attendanceByDate = null;
  let attendanceDiagnostics = null;

  if (typeof targetUid === 'string' && targetUid.trim()) {
    let targetUser;
    try {
      const targetSnap = await db.ref('users/' + targetUid).once('value');
      targetUser = targetSnap.val();
    } catch (e) {
      logDiag(requestId, { uidMasked: maskUid(uid), fatal: 'target_user_read_failed' });
      return respond(500, { ok: false, code: 'upload_failed', message: 'Erro ao resolver colaborador do relatório.', requestId });
    }
    const personName = (targetUser && (targetUser.name || targetUser.displayName)) || '';

    const uniqueDates = Array.from(new Set(days.map((d) => d.date))).sort();
    const eventsByDate = {};
    try {
      await Promise.all(uniqueDates.map(async (date) => {
        const snap = await db.ref('events/' + date).once('value');
        eventsByDate[date] = snap.val() || {};
      }));
    } catch (e) {
      logDiag(requestId, { uidMasked: maskUid(uid), fatal: 'events_read_failed' });
      return respond(500, { ok: false, code: 'upload_failed', message: 'Erro ao ler eventos do período.', requestId });
    }

    attendanceByDate = {};
    uniqueDates.forEach((date) => {
      attendanceByDate[date] = attendance.countAttendancesForPersonOnDate(eventsByDate[date], personName);
    });

    if (isReportAttendanceDiagnosticsEnabled()) {
      attendanceDiagnostics = buildAttendanceDiagnostics(eventsByDate, personName, attendance);
    }
  }

  const computedDays = days.map((d) => {
    let completedAttendances = d.completedAttendances;
    if (attendanceByDate && completedAttendances !== undefined && completedAttendances !== null) {
      completedAttendances = { meta: completedAttendances.meta, realizado: attendanceByDate[d.date] || 0 };
    }
    const daily = goals.computeDailyGoalAveragePercentage({
      newClients: d.newClients,
      qualifiedLeads: d.qualifiedLeads,
      completedAttendances,
    });
    return {
      date: d.date,
      indicators: daily.indicators,
      dailyGoalAveragePercentage: daily.average,
      status: daily.status,
      missingIndicators: daily.missingIndicators,
      // Valor bruto (realizado/meta) de Atendimentos Realizados efetivamente
      // usado neste dia — sempre o autoritativo do backend quando targetUid
      // foi informado. O cliente usa este campo (não o que ele mesmo enviou)
      // para exibir a coluna "Atendimentos Realizados (realizado/meta)".
      completedAttendances: completedAttendances || null,
    };
  });

  const period = goals.computePeriodGoalAveragePercentage(
    computedDays.map((d) => ({ date: d.date, dailyGoalAveragePercentage: d.dailyGoalAveragePercentage })),
  );

  logDiag(requestId, { uidMasked: maskUid(uid), code: 'ok', daysReceived: days.length, validDaysCount: period.validDaysCount });

  const response = {
    ok: true,
    requestId,
    days: computedDays,
    periodGoalAveragePercentage: period.average,
    validDaysCount: period.validDaysCount,
    status: period.status,
  };
  if (attendanceDiagnostics) response.attendanceDiagnostics = attendanceDiagnostics;
  return respond(200, response);
};
