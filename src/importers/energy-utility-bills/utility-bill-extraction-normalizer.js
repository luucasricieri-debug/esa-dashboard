/**
 * ESA OS — Importers / Energy Utility Bills
 * UtilityBillExtractionNormalizer
 *
 * Normaliza extrações de fatura já estruturadas (sem OCR real).
 * Sem Date.now(), Math.random(), crypto.randomUUID().
 */

import { UtilityBillResult }     from './utility-bill-result.js';
import { UTILITY_BILL_ERROR_CODE } from './utility-bill-types.js';

// ── Campos proibidos ──────────────────────────────────────────────────────────

const FORBIDDEN_KEYS = new Set([
  'password', 'passHash', 'sessionToken', 'sessionExpiresAt',
  'serviceAccount', 'firebaseConfig', 'apiKey', 'secret',
  'stack', 'stackTrace', 'internalLog',
  'fileBase64', 'binary', 'pdfContent', 'imageContent',
]);

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// ── Helpers primitivos ────────────────────────────────────────────────────────

function _str(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return (s === '' || s === '[object Object]') ? null : s;
}

function _parseNum(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return isNaN(raw) ? null : raw;
  let s = String(raw).replace(/^R\$\s*/, '').replace(/kWh$/i, '').replace(/\s+/g, '').trim();
  if (!s) return null;
  const dotIdx   = s.lastIndexOf('.');
  const commaIdx = s.lastIndexOf(',');
  let normalized;
  if (dotIdx !== -1 && commaIdx !== -1) {
    normalized = dotIdx > commaIdx ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (commaIdx !== -1) {
    normalized = s.replace(',', '.');
  } else if (dotIdx !== -1) {
    normalized = s.slice(dotIdx + 1).length === 3 ? s.replace(/\./g, '') : s;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return isNaN(n) ? null : n;
}

function _normalizeMonth(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (MONTH_RE.test(s)) return s;
  if (/^\d{1,2}\/\d{4}$/.test(s)) { const [m, y] = s.split('/'); return `${y}-${m.padStart(2, '0')}`; }
  if (/^\d{4}\/\d{1,2}$/.test(s)) { const [y, m] = s.split('/'); return `${y}-${m.padStart(2, '0')}`; }
  return null;
}

function _normalizeUc(raw) {
  if (!raw) return null;
  return String(raw).trim().replace(/[\s\-\.\/]/g, '').toUpperCase();
}

function _normalizeDocDigits(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

// ── Helpers de estrutura ──────────────────────────────────────────────────────

function _normSafe(v) {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'string') {
    const t = v.trim();
    return (t === '' || t === '[object Object]') ? null : t;
  }
  if (Array.isArray(v)) return v.map(_normSafe);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (!FORBIDDEN_KEYS.has(k)) out[k] = _normSafe(val);
    }
    return out;
  }
  return v;
}

function _normalizeComponents(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    te:           _parseNum(raw.te)           ?? null,
    tusd:         _parseNum(raw.tusd)         ?? null,
    fioB:         _parseNum(raw.fioB)         ?? null,
    bandeira:     _parseNum(raw.bandeira)     ?? null,
    cip:          _parseNum(raw.cip)          ?? null,
    taxes:        _parseNum(raw.taxes)        ?? null,
    otherCharges: _parseNum(raw.otherCharges) ?? null,
  };
}

function _slugPart(raw) {
  if (!raw) return null;
  return String(raw).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function _generateId(utilityCompany, uc, referenceMonth) {
  const p1 = _slugPart(utilityCompany);
  const p2 = _slugPart(uc ? String(uc).toLowerCase() : null);
  const p3 = _slugPart(referenceMonth);
  if (!p1 || !p2 || !p3) return null;
  return `utility-bill-${p1}-${p2}-${p3}`;
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class UtilityBillExtractionNormalizer {

  normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return UtilityBillResult.fail([
        UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.INVALID_UTILITY_BILL_EXTRACTION, 'Extraction deve ser um objeto'),
      ]);
    }
    return UtilityBillResult.ok(this._build(raw));
  }

  _build(raw) {
    const uc             = _normalizeUc(raw.uc);
    const referenceMonth = _normalizeMonth(raw.referenceMonth);
    const utilityCompany = _str(raw.utilityCompany);
    const providedId     = _str(raw.id);
    const generatedId    = providedId || _generateId(utilityCompany, uc, referenceMonth);

    return {
      id:                     generatedId,
      extractionSource:       _str(raw.extractionSource),
      fileName:               _str(raw.fileName),
      mimeType:               _str(raw.mimeType),
      referenceMonth,
      uc,
      ucOriginal:             _str(raw.uc),
      customerName:           _str(raw.customerName),
      customerDocument:       _str(raw.customerDocument),
      customerDocumentDigits: _normalizeDocDigits(raw.customerDocument),
      utilityCompany,
      monthlyConsumptionKwh:  _parseNum(raw.monthlyConsumptionKwh) ?? null,
      components:             _normalizeComponents(raw.components),
      minimumBillableKwh:     _parseNum(raw.minimumBillableKwh)    ?? null,
      totalUtilityBillAmount: _parseNum(raw.totalUtilityBillAmount) ?? null,
      confidence:             _str(raw.confidence),
      extractedAt:            _str(raw.extractedAt),
      metadata:               _normSafe(raw.metadata) || {},
    };
  }
}
