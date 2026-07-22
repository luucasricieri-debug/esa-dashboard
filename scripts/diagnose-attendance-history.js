'use strict';

/**
 * ESA OS — Diagnóstico somente leitura do histórico de Atendimentos
 *
 * Investiga onde realmente estão os registros de "atendimento" no Firebase,
 * para confirmar (ou refutar) hipóteses sobre por que o indicador
 * "Atendimentos Realizados" aparece zerado em produção. NUNCA escreve nada.
 *
 * Fonte já confirmada por auditoria de código (index.html):
 *   - countMeta('atendimentos') e countMeta('atend_mensal') leem a variável
 *     em memória `agEvs`, que é populada a partir do nó Firebase `events`
 *     (fetch DB+'/events.json'), NÃO de um nó chamado "agEvs".
 *   - O evento é considerado "atendimento realizado" quando:
 *       ev.tipo_atendimento !== 'retomada' (não é retomada)
 *       ev.resultado === 'sucesso'
 *       (!ev.tipo_atendimento || ev.tipo_atendimento === 'cliente')
 *       autor OU convidado confirmado é o usuário — por NOME (ev.author /
 *       ev.guests[].name), não por uid.
 *   - `agEvs` só era carregado ao visitar a página Agenda (agInit/agPoll);
 *     "Minhas Metas" nunca disparava esse carregamento — corrigido nesta
 *     mesma missão com ensureAgEvsLoaded().
 *
 * Este script confirma, contra o Firebase real, se há de fato registros em
 * events/{data}/{eventId} referenciando o usuário, e resume a estrutura
 * encontrada — sem nunca imprimir conteúdo sensível ou secrets.
 *
 * Uso:
 *   node scripts/diagnose-attendance-history.js --uid <uid> [--month YYYY-MM]
 *
 * Variáveis de ambiente obrigatórias:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — JSON da conta de serviço Firebase
 *   DATABASE_URL — URL do Firebase RTDB (opcional; cai no fallback do projeto)
 */

const DEFAULT_DATABASE_URL = 'https://agenda-executiva-esa-default-rtdb.firebaseio.com';

// Nós candidatos citados na tarefa, além de "events" (já confirmado por
// auditoria de código como a fonte real). Verificados apenas por existência/
// estrutura resumida — nunca temos certeza a priori de que existem.
const CANDIDATE_NODES = ['agEvs', 'agenda', 'dailyGoals', 'dailyResults', 'metas'];

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function maskUid(uid) {
  if (!uid) return '(vazio)';
  if (uid.length <= 4) return '*'.repeat(uid.length);
  return `${uid.slice(0, 2)}***${uid.slice(-2)}`;
}

function maskName(name) {
  if (!name || typeof name !== 'string') return '(vazio)';
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => (p.length <= 2 ? p[0] + '*' : p[0] + '*'.repeat(p.length - 2) + p[p.length - 1])).join(' ');
}

function summarizeFields(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj).sort();
}

// Detecta campos que "parecem" representar um atendimento/status, sem
// assumir um schema fixo — apenas relata o que existe.
const ATTENDANCE_LIKE_FIELD_HINTS = [
  'resultado', 'status', 'concluido', 'concluído', 'realizado', 'tipo', 'tipo_atendimento', 'type',
];
const USER_FIELD_HINTS = ['author', 'autor', 'uid', 'userId', 'login', 'responsavel', 'responsavelNome', 'guests', 'convidados'];
const DATE_FIELD_HINTS = ['ts', 'data', 'date', 'createdAt', 'etapaTs'];

function detectHints(sampleKeys, hints) {
  return sampleKeys.filter((k) => hints.some((h) => k.toLowerCase() === h.toLowerCase()));
}

// ── Núcleo (testável sem Firebase — recebe um `db` com .ref(path).once('value')) ──

async function diagnoseAttendanceHistory(db, args) {
  const report = {
    uidMasked: maskUid(args.uid),
    month: args.month || null,
    userFound: false,
    userNameMasked: null,
    nodes: {},
    eventsMonth: null,
  };

  // 1. Perfil do usuário — necessário porque o matching de eventos é por NOME, não uid.
  const userSnap = await db.ref(`users/${args.uid}`).once('value');
  const user = userSnap.val();
  report.userFound = !!user;
  report.userNameMasked = user && user.name ? maskName(user.name) : null;
  const userName = user && user.name ? user.name : null;

  // 2. Nó "events" — já confirmado por auditoria de código como a fonte real
  //    do contador de Atendimentos (agEvs em memória vem daqui).
  const eventsSnap = await db.ref('events').once('value');
  const eventsRoot = eventsSnap.val();
  const allDateKeys = eventsRoot ? Object.keys(eventsRoot) : [];
  report.nodes.events = {
    exists: !!eventsRoot,
    totalDateKeysFound: allDateKeys.length,
    sampleDateKeys: allDateKeys.slice(0, 5),
  };

  if (eventsRoot && args.month) {
    const monthKeys = allDateKeys.filter((k) => k.startsWith(args.month));
    let totalEvents = 0;
    let matchedByName = 0;
    let matchedButExcluded = { retomada: 0, naoSucesso: 0, naoCliente: 0 };
    const structureFieldsSeen = new Set();

    monthKeys.forEach((dateKey) => {
      const dayEvents = eventsRoot[dateKey] || {};
      Object.values(dayEvents).forEach((ev) => {
        if (!ev || typeof ev !== 'object') return;
        totalEvents++;
        summarizeFields(ev).forEach((f) => structureFieldsSeen.add(f));

        const isAuthor = userName && ev.author === userName;
        const isGuest = userName && Array.isArray(ev.guests) && ev.guests.some((g) => g && g.name === userName && g.status === 'confirmed');
        if (!isAuthor && !isGuest) return;

        matchedByName++;
        if (ev.type === 'retomada' || ev.tipo_atendimento === 'retomada') matchedButExcluded.retomada++;
        if (ev.resultado !== 'sucesso') matchedButExcluded.naoSucesso++;
        if (ev.tipo_atendimento && ev.tipo_atendimento !== 'cliente') matchedButExcluded.naoCliente++;
      });
    });

    report.eventsMonth = {
      month: args.month,
      dateKeysInMonth: monthKeys.length,
      totalEventsInMonth: totalEvents,
      eventsReferencingUserByName: matchedByName,
      excludedBreakdown: matchedButExcluded,
      structureFieldsSeenAcrossEvents: Array.from(structureFieldsSeen).sort(),
      attendanceLikeFieldsDetected: detectHints(Array.from(structureFieldsSeen), ATTENDANCE_LIKE_FIELD_HINTS),
      userFieldsDetected: detectHints(Array.from(structureFieldsSeen), USER_FIELD_HINTS),
      dateFieldsDetected: detectHints(Array.from(structureFieldsSeen), DATE_FIELD_HINTS),
    };
  }

  // 3. Demais nós candidatos citados na tarefa — só relatamos existência/estrutura.
  for (const nodeName of CANDIDATE_NODES) {
    try {
      const snap = await db.ref(nodeName).once('value');
      const val = snap.val();
      report.nodes[nodeName] = {
        exists: !!val,
        topLevelKeyCount: val && typeof val === 'object' ? Object.keys(val).length : 0,
        sampleTopLevelKeys: val && typeof val === 'object' ? Object.keys(val).slice(0, 5) : [],
      };
    } catch (e) {
      report.nodes[nodeName] = { exists: false, error: 'read_failed' };
    }
  }

  // 4. users/{uid} — resumo de campos (sem PII completa).
  report.nodes[`users/${maskUid(args.uid)}`] = {
    exists: !!user,
    fieldsPresent: summarizeFields(user),
  };

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
    report = await diagnoseAttendanceHistory(db, args);
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
    if (argv[i] === '--uid') { args.uid = argv[++i]; }
    else if (argv[i] === '--month') { args.month = argv[++i]; }
  }

  if (!args.uid) {
    console.error('Uso: node scripts/diagnose-attendance-history.js --uid <uid> [--month YYYY-MM]');
    process.exit(1);
  }
  if (args.month && !/^\d{4}-\d{2}$/.test(args.month)) {
    console.error('--month deve estar no formato YYYY-MM');
    process.exit(1);
  }

  runAgainstRealFirebase(args).then((report) => {
    console.log('\n═'.repeat(60));
    console.log('DIAGNÓSTICO DE ATENDIMENTOS (somente leitura):');
    console.log(JSON.stringify(report, null, 2));
    console.log('═'.repeat(60));
    process.exit(report.blocked ? 1 : 0);
  }).catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { diagnoseAttendanceHistory, maskUid, maskName, resolveDatabaseUrl, CANDIDATE_NODES };
