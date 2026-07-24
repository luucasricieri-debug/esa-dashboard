'use strict';

/**
 * ESA OS — Diagnóstico somente leitura do indicador "Atendimentos Realizados"
 * no relatório "Percentual médio da meta"
 *
 * Reproduz, contra o Firebase real (ou contra um `db` fake em testes), a MESMA
 * leitura e contagem que netlify/functions/reports-performance-goal-average.js
 * faz para o período informado: lê apenas events/{data} dentro do intervalo
 * [--start-date, --end-date] (inclusivo em ambas as pontas, sem carregar o nó
 * inteiro), resolve o nome canônico do colaborador (via users/{uid}.name, ou
 * diretamente via --name) e conta atendimentos usando
 * assets/attendance-performance.js — a mesma fonte usada pelo endpoint. NUNCA
 * escreve nada.
 *
 * Uso:
 *   node scripts/diagnose-report-attendances.js --start-date 2026-07-01 --end-date 2026-07-24 --uid <uid>
 *   node scripts/diagnose-report-attendances.js --start-date 2026-07-01 --end-date 2026-07-24 --name "Felipe dos Santos"
 *
 * Variáveis de ambiente obrigatórias (para rodar contra o Firebase real):
 *   FIREBASE_SERVICE_ACCOUNT_JSON — JSON da conta de serviço Firebase
 *   DATABASE_URL — URL do Firebase RTDB (opcional; cai no fallback do projeto)
 */

const attendance = require('../assets/attendance-performance.js');

const DEFAULT_DATABASE_URL = 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Gera o intervalo de datas [start, end] inclusivo como strings YYYY-MM-DD,
// usando aritmética UTC ancorada ao meio-dia — nunca desloca o dia por fuso
// horário local, e nunca gera datas fora do intervalo pedido.
function generateDateRange(startDate, endDate) {
  const dates = [];
  const cur = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  while (cur.getTime() <= end.getTime()) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// Núcleo testável sem Firebase — recebe um `db` com .ref(path).once('value').
async function diagnoseReportAttendances(db, args) {
  const report = {
    period: { startDate: args.startDate, endDate: args.endDate },
    uidMasked: args.uid ? maskUid(args.uid) : null,
    userFound: null,
    resolvedPersonName: null,
    datesRead: [],
    eventsRead: 0,
    successfulEvents: 0,
    excludedRetomada: 0,
    matchedAsAuthor: 0,
    matchedAsConfirmedGuest: 0,
    excludedByUser: 0,
    finalTotal: 0,
    namesFoundInEvents: [],
  };

  let personName = args.name || null;
  if (!personName && args.uid) {
    const userSnap = await db.ref(`users/${args.uid}`).once('value');
    const user = userSnap.val();
    report.userFound = !!user;
    personName = (user && (user.name || user.displayName)) || null;
  }
  report.resolvedPersonName = personName;

  const dates = generateDateRange(args.startDate, args.endDate);
  report.datesRead = dates;

  const eventsByDate = {};
  const namesSeen = new Set();
  for (const date of dates) {
    const snap = await db.ref(`events/${date}`).once('value');
    const dayEvents = snap.val() || {};
    eventsByDate[date] = dayEvents;

    Object.values(dayEvents).forEach((ev) => {
      if (!ev || typeof ev !== 'object') return;
      report.eventsRead++;
      if (ev.author) namesSeen.add(ev.author);
      if (Array.isArray(ev.guests)) ev.guests.forEach((g) => { if (g && g.name) namesSeen.add(g.name); });

      if (ev.type === 'retomada' || ev.tipo_atendimento === 'retomada') {
        report.excludedRetomada++;
        return;
      }
      if (!attendance.isAttendanceSuccessfullyCompleted(ev)) return;
      report.successfulEvents++;

      if (!personName) return;
      const isAuthor = ev.author && attendance.normalizePersonName(ev.author) === attendance.normalizePersonName(personName);
      const isGuest = Array.isArray(ev.guests) && ev.guests.some((g) => g && g.status === 'confirmed' && attendance.normalizePersonName(g.name) === attendance.normalizePersonName(personName));
      if (isAuthor) report.matchedAsAuthor++;
      else if (isGuest) report.matchedAsConfirmedGuest++;
      else report.excludedByUser++;
    });
  }

  report.namesFoundInEvents = Array.from(namesSeen).sort();
  report.finalTotal = personName
    ? attendance.countAttendancesForPersonInPeriod(eventsByDate, personName, args.startDate, args.endDate)
    : 0;

  return report;
}

// ── Firebase (produção) ──────────────────────────────────────────────────────

async function runAgainstRealFirebase(args) {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.error('[DIAG-BLOCKED] FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
    return { blocked: true, reason: 'missing_credentials' };
  }

  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch {
    console.error('[DIAG-BLOCKED] FIREBASE_SERVICE_ACCOUNT_JSON: JSON malformado.');
    return { blocked: true, reason: 'invalid_credentials_json' };
  }

  const admin = require('firebase-admin');
  const databaseURL = resolveDatabaseUrl();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL });
  }
  const db = admin.database();

  let report;
  try {
    report = await diagnoseReportAttendances(db, args);
  } catch (err) {
    report = { blocked: true, reason: 'unexpected_error', error: err.message };
  }

  try { await admin.app().delete(); } catch (_) { /* best-effort cleanup */ }
  return report;
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--start-date') { args.startDate = argv[++i]; }
    else if (argv[i] === '--end-date') { args.endDate = argv[++i]; }
    else if (argv[i] === '--uid') { args.uid = argv[++i]; }
    else if (argv[i] === '--name') { args.name = argv[++i]; }
  }

  if (!isValidDateStr(args.startDate) || !isValidDateStr(args.endDate)) {
    console.error('Uso: node scripts/diagnose-report-attendances.js --start-date YYYY-MM-DD --end-date YYYY-MM-DD [--uid <uid>] [--name "Nome Completo"]');
    process.exit(1);
  }
  if (args.startDate > args.endDate) {
    console.error('--start-date deve ser <= --end-date');
    process.exit(1);
  }
  if (!args.uid && !args.name) {
    console.error('Informe --uid ou --name para resolver o colaborador.');
    process.exit(1);
  }

  runAgainstRealFirebase(args).then((report) => {
    console.log('\n═'.repeat(60));
    console.log('DIAGNÓSTICO DE ATENDIMENTOS DO RELATÓRIO (somente leitura):');
    console.log(JSON.stringify(report, null, 2));
    console.log('═'.repeat(60));
    process.exit(report.blocked ? 1 : 0);
  }).catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { diagnoseReportAttendances, generateDateRange, maskUid, resolveDatabaseUrl, isValidDateStr };
