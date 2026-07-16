export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const kwh = (v: number) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh`;

export const num = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
