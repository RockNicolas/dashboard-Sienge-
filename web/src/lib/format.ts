export const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export const pct = (n: number) => num(n) + '%';
export const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR');

// Preenchida por aplicarTema() (lib/tema.ts) conforme claro/escuro.
export const PALETA: string[] = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

export const eixoBRL = { ticks: { callback: (v: string | number) => brl(Number(v)) } };

export const meses = (...series: { mes: string }[][]) => [...new Set(series.flat().map(x => x.mes))].sort();
export const porMes = (serie: { mes: string; valor: number }[], ms: string[]) =>
  ms.map(m => serie.find(x => x.mes === m)?.valor ?? 0);

export const dataBR = (iso: string) => iso.split('-').reverse().join('/');
