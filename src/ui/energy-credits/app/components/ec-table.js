/**
 * ESA OS — UI / Energy Credits / App / Components
 * Data table HTML snippet.
 */

/**
 * @param {string[]} headers
 * @param {string[][]} rows  — each cell is raw HTML
 * @param {string} [emptyMsg]
 */
export function ecTable(headers, rows, emptyMsg = 'Nenhum registro encontrado.') {
  const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = rows.length
    ? `<tbody>${rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
    : `<tbody><tr><td colspan="${headers.length}" style="text-align:center;padding:28px;color:var(--ec-medium);font-size:13px;">${emptyMsg}</td></tr></tbody>`;
  return `<div class="ec-table-wrap"><table class="ec-table">${thead}${tbody}</table></div>`;
}

export function ecActionBtn(label, action, extra = '', cls = 'ec-btn-secondary') {
  return `<button class="ec-btn ${cls} ec-btn-sm" data-action="${action}" ${extra}>${label}</button>`;
}
