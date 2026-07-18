export type EsaView =
  | "dashboard"
  | "ug"
  | "ub"
  | "apuracao"
  | "csv"
  | "relatorios"
  | "financeiro"
  | "alertas";

export interface EsaNavigateDetail {
  view: EsaView;
  params?: Record<string, string>;
}

const EVENT = "esa:navigate";

export function navigateTo(view: EsaView, params?: Record<string, string>) {
  window.dispatchEvent(
    new CustomEvent<EsaNavigateDetail>(EVENT, { detail: { view, params } }),
  );
}

export function onNavigate(cb: (detail: EsaNavigateDetail) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<EsaNavigateDetail>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
