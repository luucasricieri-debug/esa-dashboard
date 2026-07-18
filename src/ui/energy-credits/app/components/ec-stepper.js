/**
 * ESA OS — UI / Energy Credits / App / Components
 * Stepper progress indicator HTML snippet.
 */

/**
 * @param {Array<{label: string}>} steps
 * @param {number} activeIndex  0-based
 */
export function ecStepper(steps, activeIndex) {
  const items = steps.map((step, i) => {
    let cls = '';
    if (i < activeIndex)  cls = 'ec-step-done';
    if (i === activeIndex) cls = 'ec-step-active';
    const dot = i < activeIndex ? '✓' : String(i + 1);
    return `
      <div class="ec-step ${cls}">
        <div class="ec-step-dot">${dot}</div>
        <div class="ec-step-label">${step.label}</div>
      </div>
    `;
  });
  return `<div class="ec-stepper">${items.join('')}</div>`;
}
