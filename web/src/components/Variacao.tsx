import { pct } from '../lib/format';

/** Variação % de `anterior` para `atual` (null quando não dá para calcular: anterior zero). */
export const variacao = (atual: number, anterior: number) => (anterior ? ((atual - anterior) / Math.abs(anterior)) * 100 : null);

/**
 * ▲ 12% / ▼ 5% com cor conforme o que é bom: `subir` (receita, resultado), `descer` (despesa) ou `neutro` (compras).
 * Sem base de comparação: "novo" (antes era zero) ou "—".
 */
export function Variacao({ atual, anterior, bom = 'neutro', semDados }: {
  atual: number; anterior: number | null | undefined; bom?: 'subir' | 'descer' | 'neutro'; semDados?: boolean;
}) {
  if (semDados || anterior == null) return <span className="var nd" title="Sem dados sincronizados para comparar">—</span>;
  const v = variacao(atual, anterior);
  if (v == null) return atual ? <span className="var nd">novo</span> : <span className="var nd">—</span>;
  const r = Math.round(v * 10) / 10;
  if (r === 0) return <span className="var zero">= 0%</span>;
  const cor = bom === 'neutro' ? 'neutro' : (r > 0) === (bom === 'subir') ? 'pos' : 'neg';
  return <span className={`var ${cor}`}>{r > 0 ? '▲' : '▼'} {pct(Math.abs(r))}</span>;
}
