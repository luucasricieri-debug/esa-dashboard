export type EsaView =
  | 'dashboard'
  | 'ug'
  | 'ub'
  | 'apuracao'
  | 'csv'
  | 'relatorios'
  | 'financeiro'
  | 'alertas';

export function navigateTo(view: EsaView, params?: Record<string, string>): void {
  window.dispatchEvent(new CustomEvent('esa:navigate', { detail: { view, params } }));
}

export function onNavigate(cb: (view: EsaView, params?: Record<string, string>) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    cb(detail.view, detail.params);
  };
  window.addEventListener('esa:navigate', handler);
  return () => window.removeEventListener('esa:navigate', handler);
}
