'use strict';

// ── ESA OS — Permissão do indicador "Percentual médio da meta" ─────────────
// Controle SEMPRE aplicado no backend (nunca apenas ocultado no frontend).
// A autorização nunca confia no uid enviado pelo cliente — o chamador desta
// função deve sempre passar o uid já extraído de um sessionToken verificado
// (verifyToken()/upload-session.js), nunca de um campo do body.

const PERMISSION_KEY = 'reports.performanceGoalAverage.read';

// Concedida inicialmente apenas a estes dois uids (auditados no código, não
// apenas pelo nome exibido — ver docs/DAILY-MONTHLY-GOALS-PERFORMANCE.md).
// Extensível sem novo deploy via users/{uid}/capabilities['reports.performanceGoalAverage.read'] === true no Firebase.
const AUTHORIZED_UIDS = ['lucas_vizentin', 'fernando_fadel_mphd4rj6'];

function hasPerformanceGoalAveragePermission(uid, user) {
  if (typeof uid === 'string' && AUTHORIZED_UIDS.indexOf(uid) !== -1) return true;
  if (user && user.capabilities && user.capabilities[PERMISSION_KEY] === true) return true;
  return false;
}

module.exports = {
  PERMISSION_KEY,
  AUTHORIZED_UIDS,
  hasPerformanceGoalAveragePermission,
};
