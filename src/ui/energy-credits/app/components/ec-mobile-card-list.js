/**
 * ESA OS — UI / Energy Credits / App / Components
 * Mobile card list HTML snippet (fallback for narrow screens).
 */

/**
 * @param {Array<{title: string, badge?: string, fields: Array<{label: string, value: string}>, actions?: string}>} cards
 */
export function ecMobileCardList(cards) {
  if (!cards.length) {
    return `<div class="ec-card-list"><div class="ec-empty-text" style="padding:24px;text-align:center;color:var(--ec-medium);">Nenhum registro encontrado.</div></div>`;
  }

  const items = cards.map(({ title, badge = '', fields = [], actions = '' }) => `
    <div class="ec-mobile-card">
      <div class="ec-mobile-card-header">
        <div class="ec-mobile-card-title">${title}</div>
        ${badge}
      </div>
      <div class="ec-mobile-card-body">
        ${fields.map((f) => `
          <div class="ec-mobile-card-row">
            <span class="ec-mobile-card-label">${f.label}</span>
            <span class="ec-mobile-card-value">${f.value}</span>
          </div>`).join('')}
      </div>
      ${actions ? `<div class="ec-mt-2 ec-flex ec-gap-2">${actions}</div>` : ''}
    </div>
  `).join('');

  return `<div class="ec-card-list">${items}</div>`;
}
