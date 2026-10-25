import type { ReactNode } from 'react';

export const Card = ({ titulo, children }: { titulo?: string; children: ReactNode }) => (
  <div className="card">{titulo && <h2>{titulo}</h2>}{children}</div>
);

export const Kpi = ({ titulo, valor, sub, cor }: { titulo: string; valor: ReactNode; sub?: ReactNode; cor?: string }) => (
  <div className="kpi" style={cor ? ({ '--accent': cor } as React.CSSProperties) : undefined}>
    <small>{titulo}</small><b>{valor}</b><small>{sub ?? ' '}</small>
  </div>
);

export const Kpis = ({ children }: { children: ReactNode }) => <div className="kpis">{children}</div>;

export const Grafico = ({ children }: { children: ReactNode }) => <div className="cv">{children}</div>;

export const Barra = ({ v, max }: { v: number; max: number }) => (
  <div className="bar"><i style={{ width: `${Math.min(100, (v / (max || 1)) * 100)}%` }} /></div>
);

export interface Coluna<T> { t: string; f: (r: T) => ReactNode }

export function Tabela<T>({ colunas, linhas }: { colunas: Coluna<T>[]; linhas: T[] }) {
  return (
    <table>
      <thead><tr>{colunas.map(c => <th key={c.t}>{c.t}</th>)}</tr></thead>
      <tbody>
        {linhas.map((r, i) => <tr key={i}>{colunas.map(c => <td key={c.t}>{c.f(r)}</td>)}</tr>)}
      </tbody>
    </table>
  );
}
