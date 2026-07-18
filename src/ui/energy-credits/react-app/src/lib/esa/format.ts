export function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function kwh(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kWh';
}

export function num(v: number, digits = 2): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}
