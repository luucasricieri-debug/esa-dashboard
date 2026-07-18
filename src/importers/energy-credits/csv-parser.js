/**
 * ESA OS — Importers / Energy Credits
 * Parser CSV determinístico, sem dependências externas.
 *
 * NÃO acessa filesystem.
 * NÃO acessa window.
 * NÃO usa FileReader.
 * Suporta delimitador "," e ";", autodetecção, BOM, aspas, aspas escapadas "".
 */

import { EnergyCreditsImportResult } from './energy-credits-import-result.js';

// ── Helpers de módulo ─────────────────────────────────────────────────────────

function _removeBom(text) {
  return text.replace(/^﻿/, '');
}

function _normalizeEndings(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function _detectDelimiter(firstLine, preferred) {
  if (preferred === ',' || preferred === ';') return preferred;
  const commas     = (firstLine.match(/,/g)  || []).length;
  const semicolons = (firstLine.match(/;/g)  || []).length;
  return semicolons > commas ? ';' : ',';
}

function _parseLine(line, delimiter) {
  const fields = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch   = line[i];
    const next = line[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { current += '"'; i++; }
      else if (ch === '"')            { inQuotes = false; }
      else                             { current += ch; }
    } else {
      if (ch === '"')          { inQuotes = true; }
      else if (ch === delimiter) { fields.push(current); current = ''; }
      else                        { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}

function _parseRows(lines, headers, delimiter, doTrim, skipEmpty) {
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (skipEmpty && (!line || !line.trim())) continue;
    const values = _parseLine(line, delimiter);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      const val = values[j] !== undefined ? values[j] : '';
      row[key]  = doTrim ? val.trim() : val;
    }
    rows.push(row);
  }
  return rows;
}

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Parseia CSV em array de objetos com os headers como chaves.
 *
 * @param {string} csvText
 * @param {object} options
 * @param {string}  [options.delimiter]           - Forçar delimitador ',' ou ';'
 * @param {boolean} [options.autoDetectDelimiter] - Autodetectar delimitador (default: true)
 * @param {boolean} [options.trim]                - Trim em chaves e valores (default: true)
 * @param {boolean} [options.skipEmptyLines]      - Ignorar linhas vazias (default: true)
 * @returns {EnergyCreditsImportResult}
 */
export function parseCsv(csvText, options = {}) {
  if (!csvText || typeof csvText !== 'string') {
    return EnergyCreditsImportResult.fail([EnergyCreditsImportResult.makeError('INVALID_CSV', 'csvText deve ser string não-vazia')]);
  }
  const text      = _normalizeEndings(_removeBom(csvText));
  const lines     = text.split('\n');
  const firstLine = lines[0] || '';
  if (!firstLine.trim()) {
    return EnergyCreditsImportResult.fail([EnergyCreditsImportResult.makeError('EMPTY_CSV', 'CSV não contém header')]);
  }
  const doTrim    = options.trim !== false;
  const skipEmpty = options.skipEmptyLines !== false;
  const delimiter = _detectDelimiter(firstLine, options.delimiter);
  const headers   = _parseLine(firstLine, delimiter).map(h => doTrim ? h.trim() : h);
  if (headers.every(h => !h)) {
    return EnergyCreditsImportResult.fail([EnergyCreditsImportResult.makeError('INVALID_HEADER', 'Header do CSV está vazio')]);
  }
  const rows = _parseRows(lines, headers, delimiter, doTrim, skipEmpty);
  return EnergyCreditsImportResult.ok(rows, [], [], {
    totalLines: lines.length - 1,
    totalRows:  rows.length,
    delimiter,
    headers,
  });
}
