import { BarraFinanceiro, GraficoSeries, nomeAgrupar, TabelaParcelas } from '../components/financeiro';
import { Barra, Card, Kpi, Kpis, Tabela } from '../components/ui';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { brl, PALETA, pct } from '../lib/format';

export default function ContasReceberPage() {
  const { dados: d, erro, agrupar, setAgrupar } = useFinanceiro();
  if (erro) return <div className="erro">Erro: {erro}</div>;
  if (!d) return <p className="muted">Carregando financeiro…</p>;
  const r = d.resumo;
  const inadimplencia = r.aReceber ? Math.round((r.receberVencido / r.aReceber) * 1000) / 10 : 0;
  const maior = d.clientes[0]?.aberto || 1;
  return (
    <>
      <BarraFinanceiro d={d} agrupar={agrupar} setAgrupar={setAgrupar} />
      <Kpis>
        <Kpi cor={PALETA[2]} titulo="Total a receber" valor={brl(r.aReceber)} sub={`${r.parcelasReceber} parcelas no período`} />
        <Kpi cor={PALETA[0]} titulo="Já recebido" valor={brl(r.recebido)} sub={r.aReceber ? `${pct(Math.round((r.recebido / r.aReceber) * 1000) / 10)} do total` : ' '} />
        <Kpi cor={PALETA[6]} titulo="Em aberto" valor={brl(r.receberAberto)} sub="a vencer + vencido" />
        <Kpi cor={PALETA[7]} titulo="Inadimplência" valor={brl(r.receberVencido)} sub={`${pct(inadimplencia)} do período`} />
      </Kpis>

      <div className="cols">
        <Card titulo={`A receber × Recebido por ${nomeAgrupar(agrupar)} (vencimento)`}>
          <GraficoSeries serie={d.serie} series={[
            { rotulo: 'A receber', campo: 'aReceber', cor: PALETA[2] },
            { rotulo: 'Recebido', campo: 'recebido', cor: PALETA[0] },
          ]} />
        </Card>
        <Card titulo="Clientes com mais em aberto">
          <ul className="rank">
            {d.clientes.map(c => (
              <li key={c.nome}>
                <span>{c.nome}{c.vencido > 0 && <small className="neg"> · {brl(c.vencido)} vencido</small>}</span>
                <span>{brl(c.aberto)}</span>
                <Barra v={c.aberto} max={maior} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card titulo="A receber por obra">
        <Tabela linhas={d.porObra.filter(o => o.aReceber)} colunas={[
          { t: 'Obra', f: o => o.obra },
          { t: 'Total', f: o => brl(o.aReceber) },
          { t: 'Em aberto', f: o => brl(o.receberAberto) },
          { t: 'Vencido', f: o => <span className={o.receberVencido ? 'neg' : ''}>{brl(o.receberVencido)}</span> },
          { t: 'Inadimplência', f: o => pct(o.aReceber ? Math.round((o.receberVencido / o.aReceber) * 1000) / 10 : 0) },
        ]} />
      </Card>

      <div className="cols">
        <Card titulo="Próximos recebimentos (30 dias)">
          <TabelaParcelas linhas={d.proximos.filter(p => p.tipo === 'receber')} parceiro="Cliente" />
        </Card>
        <Card titulo="Recebimentos vencidos">
          <TabelaParcelas linhas={d.vencidas.filter(p => p.tipo === 'receber')} parceiro="Cliente" />
        </Card>
      </div>
    </>
  );
}
