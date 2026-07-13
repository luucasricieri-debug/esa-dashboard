/**
 * ESA OS — Importers / Energy Credits
 * Mapper: linhas tabulares → entidades internas.
 *
 * Aliases em PT e EN.
 * Normalização de números BR/US/moeda/kWh.
 * Normalização de mês (YYYY-MM, MM/YYYY, jan/YYYY, janeiro/YYYY).
 * Geração de IDs determinísticos.
 * Remoção de campos sensíveis.
 * NÃO usa Date.now(), Math.random(), crypto.randomUUID().
 */

import { EnergyCreditsImportResult } from './energy-credits-import-result.js';
import { ENERGY_CREDITS_IMPORT_TYPE } from './import-types.js';

// ── Constantes ─────────────────────────────────────────────────────────────────

const FORBIDDEN_ID_CHARS = ['/', '..', '#', '$', '[', ']'];

const FORBIDDEN_KEYS = new Set([
  'password', 'passHash', 'sessionToken', 'sessionExpiresAt',
  'serviceAccount', 'firebaseConfig', 'apiKey', 'secret',
  'downloadUrl', 'stack', 'stackTrace', 'internalLog',
]);

const MONTH_ABR = { jan:'01', fev:'02', mar:'03', abr:'04', mai:'05', jun:'06', jul:'07', ago:'08', set:'09', out:'10', nov:'11', dez:'12' };
const MONTH_FULL = { janeiro:'01', fevereiro:'02', março:'03', abril:'04', maio:'05', junho:'06', julho:'07', agosto:'08', setembro:'09', outubro:'10', novembro:'11', dezembro:'12' };

const T = ENERGY_CREDITS_IMPORT_TYPE;

// ── Helpers de módulo ─────────────────────────────────────────────────────────

function _resolve(row, ...aliases) {
  for (const a of aliases) {
    const v = row[a];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function _normalizeNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let str = String(raw).replace(/^R\$\s*/, '').replace(/kWh$/i, '').replace(/\s+/g, '').trim();
  if (!str) return null;
  const dotIdx   = str.lastIndexOf('.');
  const commaIdx = str.lastIndexOf(',');
  let normalized;
  if (dotIdx !== -1 && commaIdx !== -1) {
    normalized = dotIdx > commaIdx ? str.replace(/,/g, '') : str.replace(/\./g, '').replace(',', '.');
  } else if (commaIdx !== -1) {
    normalized = str.replace(',', '.');
  } else if (dotIdx !== -1) {
    const afterDot = str.slice(dotIdx + 1);
    normalized = afterDot.length === 3 ? str.replace(/\./g, '') : str;
  } else {
    normalized = str;
  }
  const num = Number(normalized);
  return isNaN(num) ? null : num;
}

function _normalizeMonth(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s     = raw.trim();
  const lower = s.toLowerCase();
  if (/^\d{4}-\d{2}$/.test(s))            return s;
  if (/^\d{1,2}\/\d{4}$/.test(s))         { const [m,y]=s.split('/'); return `${y}-${m.padStart(2,'0')}`; }
  if (/^\d{4}\/\d{1,2}$/.test(s))         { const [y,m]=s.split('/'); return `${y}-${m.padStart(2,'0')}`; }
  for (const [a,n] of Object.entries(MONTH_ABR))  { if (lower.startsWith(a+'/'))    { const y=lower.slice(a.length+1);    if (/^\d{4}$/.test(y)) return `${y}-${n}`; } }
  for (const [f,n] of Object.entries(MONTH_FULL)) { if (lower.startsWith(f+'/'))    { const y=lower.slice(f.length+1);    if (/^\d{4}$/.test(y)) return `${y}-${n}`; } }
  return null;
}

function _removeAccents(str) {
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function _safeId(raw) {
  if (!raw) return null;
  const id = String(raw).trim().replace(/\s+/g, '-');
  for (const c of FORBIDDEN_ID_CHARS) { if (id.includes(c)) return null; }
  return id || null;
}

function _generateId(prefix, ...parts) {
  const segs = parts.filter(p => p != null && String(p).trim()).map(p => _removeAccents(String(p)).trim().replace(/\s+/g, '-'));
  return `${prefix}-${segs.join('-')}`;
}

function _makeErr(code, message, row, field) {
  return EnergyCreditsImportResult.makeError(code, message, row, field);
}

// ── Classe ────────────────────────────────────────────────────────────────────

export class EnergyCreditsImportMapper {

  mapRow(importType, row, rowIndex = null) {
    if (!row || typeof row !== 'object') {
      return { ok: false, entity: null, errors: [_makeErr('INVALID_ROW', 'row deve ser objeto', rowIndex)], warnings: [] };
    }
    if (!FORBIDDEN_KEYS) { /* safety */ }
    const clean = {};
    for (const [k, v] of Object.entries(row)) { if (!FORBIDDEN_KEYS.has(k)) clean[k] = v; }
    switch (importType) {
      case T.GENERATING_UNITS:                return this._mapGeneratingUnit(clean, rowIndex);
      case T.BENEFICIARY_UNITS:               return this._mapBeneficiaryUnit(clean, rowIndex);
      case T.GENERATING_UNIT_MONTHLY_RECORDS: return this._mapGeneratingUnitMonthlyRecord(clean, rowIndex);
      case T.BENEFICIARY_MONTHLY_RECORDS:     return this._mapBeneficiaryMonthlyRecord(clean, rowIndex);
      default:
        return { ok: false, entity: null, errors: [_makeErr('UNKNOWN_TYPE', `Tipo desconhecido: ${importType}`, rowIndex)], warnings: [] };
    }
  }

  _mapGeneratingUnit(row, rowIndex) {
    const rawId         = _resolve(row, 'id', 'codigo', 'código');
    const name          = _resolve(row, 'name', 'nome');
    const ownerName     = _resolve(row, 'ownerName', 'proprietario', 'proprietário', 'dono');
    const ownerDocument = _resolve(row, 'ownerDocument', 'cpfCnpj', 'cpf_cnpj', 'documento');
    const uc            = _resolve(row, 'uc', 'unidadeConsumidora', 'unidade_consumidora');
    const utilityCompany= _resolve(row, 'utilityCompany', 'distribuidora', 'concessionaria', 'concessionária');
    const status        = _resolve(row, 'status');
    const id = rawId ? _safeId(rawId) : (uc ? _generateId('ug', uc) : null);
    const entity = { id, name: name||null, ownerName: ownerName||null, ownerDocument: ownerDocument||null, uc: uc||null, utilityCompany: utilityCompany||null, status: status||null };
    return { ok: true, entity, errors: [], warnings: [] };
  }

  _mapBeneficiaryUnit(row, rowIndex) {
    const rawId          = _resolve(row, 'id', 'codigo', 'código');
    const generatingUnitId = _resolve(row, 'generatingUnitId', 'unidadeGeradoraId', 'unidade_geradora_id', 'ugId');
    const name           = _resolve(row, 'name', 'nome');
    const document       = _resolve(row, 'document', 'cpfCnpj', 'cpf_cnpj', 'documento');
    const uc             = _resolve(row, 'uc', 'unidadeConsumidora', 'unidade_consumidora');
    const utilityCompany = _resolve(row, 'utilityCompany', 'distribuidora', 'concessionaria', 'concessionária');
    const status         = _resolve(row, 'status');
    const id = rawId ? _safeId(rawId) : (uc ? _generateId('ub', uc) : null);
    const entity = { id, generatingUnitId: generatingUnitId||null, name: name||null, document: document||null, uc: uc||null, utilityCompany: utilityCompany||null, status: status||null };
    return { ok: true, entity, errors: [], warnings: [] };
  }

  _mapGeneratingUnitMonthlyRecord(row, rowIndex) {
    const rawId          = _resolve(row, 'id', 'codigo', 'código');
    const generatingUnitId = _resolve(row, 'generatingUnitId', 'unidadeGeradoraId', 'unidade_geradora_id', 'ugId');
    const rawMonth       = _resolve(row, 'referenceMonth', 'mesReferencia', 'mêsReferência', 'mes_referencia');
    const referenceMonth = _normalizeMonth(rawMonth);
    const prevBalance    = _normalizeNumber(_resolve(row, 'previousBalanceKwh', 'saldoAnteriorKwh', 'saldo_anterior_kwh'));
    const monthlyGen     = _normalizeNumber(_resolve(row, 'monthlyGenerationKwh', 'geracaoMensalKwh', 'geraçãoMensalKwh', 'geracao_mensal_kwh'));
    const purchasePrice  = _normalizeNumber(_resolve(row, 'purchasePricePerKwh', 'precoCompraKwh', 'preçoCompraKwh', 'preco_compra_kwh'));
    const status         = _resolve(row, 'status');
    const id = rawId ? _safeId(rawId) : (generatingUnitId && referenceMonth ? _generateId('ugm', generatingUnitId, referenceMonth) : null);
    const entity = { id, generatingUnitId: generatingUnitId||null, referenceMonth: referenceMonth||null, previousBalanceKwh: prevBalance, monthlyGenerationKwh: monthlyGen, purchasePricePerKwh: purchasePrice, status: status||null };
    return { ok: true, entity, errors: [], warnings: [] };
  }

  _mapBeneficiaryMonthlyRecord(row, rowIndex) {
    const rawId            = _resolve(row, 'id', 'codigo', 'código');
    const beneficiaryUnitId = _resolve(row, 'beneficiaryUnitId', 'unidadeBeneficiariaId', 'unidade_beneficiaria_id', 'ubId');
    const generatingUnitId = _resolve(row, 'generatingUnitId', 'unidadeGeradoraId', 'unidade_geradora_id', 'ugId');
    const rawMonth         = _resolve(row, 'referenceMonth', 'mesReferencia', 'mêsReferência', 'mes_referencia');
    const referenceMonth   = _normalizeMonth(rawMonth);
    const consumption      = _normalizeNumber(_resolve(row, 'monthlyConsumptionKwh', 'consumoMensalKwh', 'consumo_mensal_kwh'));
    const allocated        = _normalizeNumber(_resolve(row, 'allocatedKwh', 'creditosAlocadosKwh', 'créditosAlocadosKwh', 'creditos_alocados_kwh'));
    const compensated      = _normalizeNumber(_resolve(row, 'compensatedKwh', 'creditosCompensadosKwh', 'créditosCompensadosKwh', 'creditos_compensados_kwh'));
    const esaPrice         = _normalizeNumber(_resolve(row, 'esaPricePerKwh', 'precoEsaKwh', 'preçoEsaKwh', 'preco_esa_kwh'));
    const utilityTariff    = _normalizeNumber(_resolve(row, 'utilityTariffPerKwh', 'tarifaDistribuidoraKwh', 'tarifa_distribuidora_kwh'));
    const paymentStatus    = _resolve(row, 'paymentStatus', 'statusPagamento', 'status_pagamento');
    const status           = _resolve(row, 'status');
    const id = rawId ? _safeId(rawId) : (beneficiaryUnitId && referenceMonth ? _generateId('ubm', beneficiaryUnitId, referenceMonth) : null);
    const entity = { id, beneficiaryUnitId: beneficiaryUnitId||null, generatingUnitId: generatingUnitId||null, referenceMonth: referenceMonth||null, monthlyConsumptionKwh: consumption, allocatedKwh: allocated, compensatedKwh: compensated, esaPricePerKwh: esaPrice, utilityTariffPerKwh: utilityTariff, paymentStatus: paymentStatus||null, status: status||null };
    return { ok: true, entity, errors: [], warnings: [] };
  }
}
