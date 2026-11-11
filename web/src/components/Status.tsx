import type { ReactNode } from 'react';
import { infoNivel, NIVEIS, type Status } from '../lib/status';

/** Selo do nível ("✓ Bom", "! Perto de dar problema"); o motivo aparece ao passar o mouse. `curto`: só ícone + cor. */
export function Sinal({ s, curto }: { s: Status | null | undefined; curto?: boolean }) {
  if (!s) return <span className="muted">—</span>;
  const n = infoNivel(s.nivel);
  return (
    <span className={`sinal ${s.nivel}`} title={`${n.nome}: ${s.motivo}`}>
      <i aria-hidden="true">{n.icone}</i>{curto ? <span className="sr">{n.nome}</span> : n.nome}
    </span>
  );
}

/** Valor pintado com a cor do nível (ex.: saldo do orçamento), com o motivo no mouse. */
export const ValorStatus = ({ s, children }: { s: Status | null | undefined; children: ReactNode }) =>
  (s ? <span className={`txt-${s.nivel}`} title={`${infoNivel(s.nivel).nome}: ${s.motivo}`}>{children}</span> : <>{children}</>);

/** Como ler as cores (aparece no topo das telas). */
export const LegendaCores = () => (
  <div className="legenda-cores" aria-label="Como ler as cores">
    <span className="muted">Cores:</span>
    {NIVEIS.map(n => <span key={n.nivel} className={`sinal ${n.nivel}`}><i aria-hidden="true">{n.icone}</i>{n.nome}</span>)}
    <span className="muted">· anil, roxo e azul = só informação (sem bom ou ruim)</span>
  </div>
);

/** Regra das cores de um gráfico, embaixo dele: o que cada cor quer dizer naquele gráfico. */
export function RegraGrafico({ regras, extra }: { regras: Partial<Record<Status['nivel'], string>>; extra?: string }) {
  return (
    <div className="regra-grafico">
      {NIVEIS.filter(n => regras[n.nivel]).map(n => (
        <span key={n.nivel} className={`sinal ${n.nivel}`}><i aria-hidden="true">{n.icone}</i>{regras[n.nivel]}</span>
      ))}
      {extra && <span className="muted">{extra}</span>}
    </div>
  );
}
