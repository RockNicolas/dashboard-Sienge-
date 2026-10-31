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

/** Área do gráfico. `alto`: para rankings com muitas barras (ex.: top 15 fornecedores). */
export const Grafico = ({ children, alto }: { children: ReactNode; alto?: boolean }) =>
  <div className={alto ? 'cv alto' : 'cv'}>{children}</div>;

/** Botão para listas longas: mostra mais `passo` linhas por clique. */
export const MostrarMais = ({ visiveis, total, passo, onMais }: { visiveis: number; total: number; passo: number; onMais: () => void }) =>
  (visiveis < total
    ? <button className="sec mais" onClick={onMais}>Mostrar mais {Math.min(passo, total - visiveis)} (de {total.toLocaleString('pt-BR')})</button>
    : null);

export const Barra = ({ v, max }: { v: number; max: number }) => (
  <div className="bar"><i style={{ width: `${Math.min(100, (v / (max || 1)) * 100)}%` }} /></div>
);

/** Campo de busca com um texto ao lado (ex.: "mostrando 200 de 1.500"). */
export const Busca = ({ valor, onChange, placeholder, info }: {
  valor: string; onChange: (v: string) => void; placeholder: string; info?: ReactNode;
}) => (
  <div className="busca">
    <input type="search" placeholder={placeholder} value={valor} onChange={e => onChange(e.target.value)} />
    {info != null && <span className="muted">{info}</span>}
  </div>
);

/** Texto normalizado para busca (sem acento, minúsculo). */
export const paraBusca = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** `sec`: coluna secundária — some em telas médias; no celular volta dentro do cartão. */
export interface Coluna<T> { t: string; f: (r: T) => ReactNode; sec?: boolean }

/** Tabela que vira cartões no celular (classe `resp` + rótulo de cada célula em data-label). */
export function Tabela<T>({ colunas, linhas }: { colunas: Coluna<T>[]; linhas: T[] }) {
  return (
    <table className="resp">
      <thead><tr>{colunas.map(c => <th key={c.t} className={c.sec ? 'col-sec' : undefined}>{c.t}</th>)}</tr></thead>
      <tbody>
        {linhas.map((r, i) => (
          <tr key={i}>
            {colunas.map(c => <td key={c.t} data-label={c.t} className={c.sec ? 'col-sec' : undefined}>{c.f(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
