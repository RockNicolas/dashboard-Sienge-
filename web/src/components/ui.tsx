import { Children, type ReactNode } from 'react';
import type { Status } from '../lib/status';
import { Sinal } from './Status';

/** `largo`: lado a lado com outro cartão, pede mais largura (tabela com muitas colunas). */
export const Card = ({ titulo, children, largo }: { titulo?: string; children: ReactNode; largo?: boolean }) => (
  <div className={largo ? 'card largo' : 'card'}>{titulo && <h2>{titulo}</h2>}{children}</div>
);

/**
 * Indicador. Sem `status` é só informação (neutro). Com `status`, a faixa lateral e o selo mostram se está
 * bom, pode melhorar, perto de dar problema ou ruim (ver lib/status.ts).
 */
export const Kpi = ({ titulo, valor, sub, status }: { titulo: string; valor: ReactNode; sub?: ReactNode; status?: Status | null }) => (
  <div className={status ? `kpi st-${status.nivel}` : 'kpi'}>
    <small>{titulo}{status && <Sinal s={status} curto />}</small><b>{valor}</b><small>{sub ?? ' '}</small>
  </div>
);

/** A quantidade (data-n) decide as colunas no CSS: as linhas saem sempre completas (6 → 3+3, 5 → 3+2, 4 → 2+2). */
export const Kpis = ({ children }: { children: ReactNode }) => {
  const n = Children.toArray(children).length;
  return <div className="kpis" data-n={n} style={{ '--n': n } as React.CSSProperties}>{children}</div>;
};

/**
 * Área do gráfico. `alto`: para rankings com muitas barras (ex.: top 15 fornecedores).
 * `linhas`: gráfico de barras deitadas com essa quantidade de categorias — a altura acompanha a quantidade
 * (`porLinha` rem por categoria), como a tabela ao lado; lado a lado, ele ainda cresce até a altura do vizinho.
 */
export const Grafico = ({ children, alto, linhas, porLinha = 2 }: { children: ReactNode; alto?: boolean; linhas?: number; porLinha?: number }) => (
  <div className={alto ? 'cv alto' : 'cv'}
    style={linhas ? ({ '--cv-h': `clamp(9rem, ${2.5 + linhas * porLinha}rem, 40rem)` } as React.CSSProperties) : undefined}>
    {children}
  </div>
);

/** Botão para listas longas: mostra mais `passo` linhas por clique. */
export const MostrarMais = ({ visiveis, total, passo, onMais }: { visiveis: number; total: number; passo: number; onMais: () => void }) =>
  (visiveis < total
    ? <button className="sec mais" onClick={onMais}>Mostrar mais {Math.min(passo, total - visiveis)} (de {total.toLocaleString('pt-BR')})</button>
    : null);

/** Barrinha de ranking: cinza (só informação); com `status`, ganha a cor do nível. */
export const Barra = ({ v, max, status }: { v: number; max: number; status?: Status | null }) => (
  <div className={status ? `bar st-${status.nivel}` : 'bar'} title={status?.motivo}><i style={{ width: `${Math.min(100, (v / (max || 1)) * 100)}%` }} /></div>
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

/** Propriedades de uma linha que abre detalhe: clique, Enter/Espaço no teclado e foco visível. */
export function linhaClicavel(abrir: () => void, titulo?: string) {
  return {
    className: 'clicavel',
    tabIndex: 0,
    title: titulo,
    onClick: abrir,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } },
  };
}

/**
 * Número do insumo no Sienge (resourceId nos pedidos, id nos Insumos da Obra), antes do nome do material.
 * Só aparece quando é mesmo um número (relatórios importados sem código usam o nome como id).
 */
export const CodInsumo = ({ id }: { id: string }) =>
  (/^\d+$/.test(id) ? <span className="cod-insumo" title={`Insumo ${id} no Sienge`}>{id}</span> : null);

/** Nome que abre detalhe: nome em destaque + botãozinho de seta (acende ao passar o mouse na linha). */
export const NomeLink = ({ children }: { children: ReactNode }) => (
  <>
    <span className="link">{children}</span>
    <span className="seta" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg></span>
  </>
);

/**
 * Tabela que vira cartões em espaço estreito (classe `resp` + rótulo de cada célula em data-label).
 * `cartoes={false}`: tabela pequena (poucas colunas) que cabe em qualquer tela e fica sempre como tabela.
 * `aoClicar`: cada linha abre um detalhe (modal).
 */
export function Tabela<T>({ colunas, linhas, cartoes = true, aoClicar, podeClicar, tituloLinha }: {
  colunas: Coluna<T>[]; linhas: T[]; cartoes?: boolean;
  aoClicar?: (r: T) => void; podeClicar?: (r: T) => boolean; tituloLinha?: (r: T) => string;
}) {
  return (
    <table className={cartoes ? 'resp' : 'compacta'}>
      <thead><tr>{colunas.map(c => <th key={c.t} className={c.sec ? 'col-sec' : undefined}>{c.t}</th>)}</tr></thead>
      <tbody>
        {linhas.map((r, i) => (
          <tr key={i} {...(aoClicar && (podeClicar?.(r) ?? true) ? linhaClicavel(() => aoClicar(r), tituloLinha?.(r)) : {})}>
            {colunas.map(c => <td key={c.t} data-label={c.t} className={c.sec ? 'col-sec' : undefined}>{c.f(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
