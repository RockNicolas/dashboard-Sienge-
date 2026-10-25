import { BarraFinanceiro, GraficoSeries, nomeAgrupar, TabelaParcelas } from '../components/financeiro';
import { Barra, Card, Kpi, Kpis, Tabela } from '../components/ui';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { brl, PALETA, pct } from '../lib/format';

export default function ContasPagarPage() {
  const { dados: d, erro, agrupar, setAgrupar } = useFinanceiro();
  if (erro) return <div className="erro">Erro: {erro}</div>;
  if (!d) return <p className="muted">Carregando financeiro…</p>;
  const r = d.resumo;
  const maior = d.credores[0]?.aberto || 1;
  return (
    <>
      <BarraFinanceiro d={d} agrupar={agrupar} setAgrupar={setAgrupar} />
      <Kpis>
        <Kpi cor={PALETA[7]} titulo="Total a pagar" valor={brl(r.aPagar)} sub={`${r.parcelasPagar} parcelas no período`} />
        <Kpi cor={PALETA[2]} titulo="Já pago" valor={brl(r.pago)} sub={r.aPagar ? `${pct(Math.round((r.pago / r.aPagar) * 1000) / 10)} do total` : ' '} />
        <Kpi cor={PALETA[0]} titulo="Em aberto" valor={brl(r.pagarAberto)} sub="a vencer + vencido" />
        <Kpi cor={PALETA[3]} titulo="Vencido" valor={brl(r.pagarVencido)} sub="atrasado, sem baixa" />
      </Kpis>

      <div className="cols">
        <Card titulo={`A pagar × Pago por ${nomeAgrupar(agrupar)} (vencimento)`}>
          <GraficoSeries serie={d.serie} series={[
            { rotulo: 'A pagar', campo: 'aPagar', cor: PALETA[7] },
            { rotulo: 'Pago', campo: 'pago', cor: PALETA[2] },
          ]} />
        </Card>
        <Card titulo="Credores com mais em aberto">
          <ul className="rank">
            {d.credores.map(c => (
              <li key={c.nome}>
                <span>{c.nome}{c.vencido > 0 && <small className="neg"> · {brl(c.vencido)} vencido</small>}</span>
                <span>{brl(c.aberto)}</span>
                <Barra v={c.aberto} max={maior} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card titulo="A pagar por obra">
        <Tabela linhas={d.porObra.filter(o => o.aPagar)} colunas={[
          { t: 'Obra', f: o => o.obra },
          { t: 'Total', f: o => brl(o.aPagar) },
          { t: 'Em aberto', f: o => brl(o.pagarAberto) },
          { t: 'Vencido', f: o => <span className={o.pagarVencido ? 'neg' : ''}>{brl(o.pagarVencido)}</span> },
        ]} />
      </Card>

      <div className="cols">
        <Card titulo="Próximos pagamentos (30 dias)">
          <TabelaParcelas linhas={d.proximos.filter(p => p.tipo === 'pagar')} parceiro="Credor" />
        </Card>
        <Card titulo="Pagamentos vencidos">
          <TabelaParcelas linhas={d.vencidas.filter(p => p.tipo === 'pagar')} parceiro="Credor" />
        </Card>
      </div>
    </>
  );
}
