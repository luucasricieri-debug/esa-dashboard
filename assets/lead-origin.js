/**
 * ESA OS — Fonte única do campo "Origem do Lead" no CRM.
 *
 * Usado por index.html (client, via <script src="/assets/lead-origin.js">) e
 * por todos os testes automatizados. Mesmo padrão UMD de assets/performance-goals.js.
 *
 * Origens oficiais (4, sempre):
 *   active_prospecting  ("Prospecção Ativa")
 *   sdr                 ("SDR")
 *   paid_traffic        ("Tráfego Pago")
 *   ambassadors         ("Embaixadores")
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ESALeadOrigin = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEAD_ORIGINS = {
    active_prospecting: { label: 'Prospecção Ativa' },
    sdr: { label: 'SDR' },
    paid_traffic: { label: 'Tráfego Pago' },
    ambassadors: { label: 'Embaixadores' },
  };

  var LEAD_ORIGIN_KEYS = ['active_prospecting', 'sdr', 'paid_traffic', 'ambassadors'];

  // Mesmo bloco Unicode de acentos combinantes usado em performance-goals.js.
  var COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;
  function stripKey(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(COMBINING_DIACRITICS_RE, '')
      .replace(/[^a-z0-9]/g, '');
  }

  // Aliases históricos EXPLICITAMENTE equivalentes (nunca inferidos por
  // heurística/prefixo — valores livres como "Prospecção João" NÃO normalizam
  // para nenhuma origem oficial; permanecem como pendência, nunca classificados
  // silenciosamente).
  var ALIAS_PAIRS = [
    ['prospeccao', 'active_prospecting'],
    ['prospeccaoativa', 'active_prospecting'],
    ['sdr', 'sdr'],
    ['trafego', 'paid_traffic'],
    ['trafegopago', 'paid_traffic'],
    ['embaixador', 'ambassadors'],
    ['embaixadores', 'ambassadors'],
    ['indicacaoembaixador', 'ambassadors'],
  ];
  var LEAD_ORIGIN_ALIASES = {};
  ALIAS_PAIRS.forEach(function (pair) {
    LEAD_ORIGIN_ALIASES[stripKey(pair[0])] = pair[1];
  });

  // Resolve um valor histórico/atual para a origem canônica oficial.
  // Retorna null quando não reconhecido — NUNCA lança, nunca adivinha.
  function normalizeLeadOrigin(raw) {
    if (!raw || typeof raw !== 'string') return null;
    if (Object.prototype.hasOwnProperty.call(LEAD_ORIGINS, raw)) return raw;
    var stripped = stripKey(raw);
    return Object.prototype.hasOwnProperty.call(LEAD_ORIGIN_ALIASES, stripped)
      ? LEAD_ORIGIN_ALIASES[stripped]
      : null;
  }

  function isValidLeadOriginId(id) {
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(LEAD_ORIGINS, id);
  }

  // Validação central usada tanto na criação quanto na edição — rejeita
  // ausência e valores fora da lista oficial. Nunca confia apenas em required
  // do HTML: esta função deve ser chamada explicitamente antes de qualquer
  // escrita (fbSet/fbPatch).
  function validateLeadOriginForSave(raw) {
    if (raw === undefined || raw === null || raw === '') {
      return { valid: false, id: null, reason: 'missing' };
    }
    if (isValidLeadOriginId(raw)) {
      return { valid: true, id: raw, reason: null };
    }
    var normalized = normalizeLeadOrigin(raw);
    if (normalized) {
      return { valid: true, id: normalized, reason: null };
    }
    return { valid: false, id: null, reason: 'invalid' };
  }

  return {
    LEAD_ORIGINS: LEAD_ORIGINS,
    LEAD_ORIGIN_KEYS: LEAD_ORIGIN_KEYS,
    normalizeLeadOrigin: normalizeLeadOrigin,
    isValidLeadOriginId: isValidLeadOriginId,
    validateLeadOriginForSave: validateLeadOriginForSave,
  };
});
