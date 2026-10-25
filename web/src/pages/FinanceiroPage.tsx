import type { FinanceiroObra } from '@server/types';
import { BarraFinanceiro, GraficoCaixa, GraficoSeries, nomeAgrupar, TabelaParcelas } from '../components/financeiro';
import { Card, Kpi, Kpis, Tabela } from '../components/ui';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { brl, PALETA } from '../lib/format';

const negrito = (v: number, cls = '') => <span className={cls}>{brl(v)}</span>;

export default function FinanceiroPage() {
  const { dados: d, erro, agrupar, setAgrupar } = useFinanceiro();
  if (erro) return <div className="erro">Erro: {erro}</div>;
  if (!d) return <p className="muted">Carregando financeiro…</p>;
  const r = d.resumo;
  const por = nomeAgrupar(agrupar);
  const total = d.porObra.reduce<FinanceiroObra>((t, o) => ({
    ...t, aPagar: t.aPagar + o.aPagar, pagarVencido: t.pagarVencido + o.pagarVencido, aReceber: t.aReceber + o.aReceber,
    receberVencido: t.receberVencido + o.receberVencido, entradas: t.entradas + o.entradas, saidas: t.saidas + o.saidas,
    resultado: t.resultado + o.resultado,
  }), { obraId: '*', obra: 'Total', aPagar: 0, pagarAberto: 0, pagarVencido: 0, aReceber: 0, receberAberto: 0, receberVencido: 0, entradas: 0, saidas: 0, resultado: 0 });

  return (
    <>
      <BarraFinanceiro d={d} agrupar={agrupar} setAgrupar={setAgrupar} />
      <Kpis>
        <Kpi cor={PALETA[7]} titulo="A pagar no período" valor={brl(r.aPagar)} sub={`${brl(r.pagarAberto)} em aberto`} />
        <Kpi cor={PALETA[2]} titulo="A receber no período" valor={brl(r.aReceber)} sub={`${brl(r.receberAberto)} em aberto`} />
        <Kpi cor={PALETA[3]} titulo="Vencido a pagar" valor={brl(r.pagarVencido)} sub="parcelas atrasadas" />
        <Kpi cor={PALETA[1]} titulo="Vencido a receber" valor={brl(r.receberVencido)} sub="inadimplência" />
        <Kpi cor={PALETA[6]} titulo="Resultado do caixa" valor={brl(r.resultadoCaixa)} sub={`${brl(r.entradas)} entradas − ${brl(r.saidas)} saídas`} />
        <Kpi cor={PALETA[0]} titulo="Saldo em bancos" valor={r.saldoBancos == null ? '—' : brl(r.saldoBancos)}
          sub={r.saldoBancos == null ? 'saldo de conta não é por obra' : 'hoje, todas as contas'} />
      </Kpis>

      <div className="cols">
        <Card titulo={`A pagar × A receber por ${por} (vencimento)`}>
          <GraficoSeries serie={d.serie} series={[
            { rotulo: 'A pagar', campo: 'aPagar', cor: PALETA[7] },
            { rotulo: 'A receber', campo: 'aReceber', cor: PALETA[2] },
          ]} />
        </Card>
        <Card titulo={`Caixa e bancos por ${por}`}>
          <GraficoCaixa serie={d.serie} />
        </Card>
      </div>

      <Card titulo="Geral por obra">
        {d.porObra.length ? (
          <Tabela linhas={[...d.porObra, ...(d.porObra.length > 1 ? [total] : [])]} colunas={[
            { t: 'Obra', f: o => (o.obraId === '*' ? <b>Total</b> : o.obra) },
            { t: 'A pagar', f: o => brl(o.aPagar) },
            { t: 'Vencido a pagar', f: o => negrito(o.pagarVencido, o.pagarVencido ? 'neg' : '') },
            { t: 'A receber', f: o => brl(o.aReceber) },
            { t: 'Vencido a receber', f: o => negrito(o.receberVencido, o.receberVencido ? 'neg' : '') },
            { t: 'Entradas', f: o => brl(o.entradas) },
            { t: 'Saídas', f: o => brl(o.saidas) },
            { t: 'Resultado', f: o => negrito(o.resultado, o.resultado < 0 ? 'neg' : 'pos') },
          ]} />
        ) : <p className="muted">Sem lançamentos no período.</p>}
      </Card>

      <div className="cols">
        <Card titulo="Próximos vencimentos (30 dias)"><TabelaParcelas linhas={d.proximos} /></Card>
        <Card titulo="Maiores parcelas vencidas"><TabelaParcelas linhas={d.vencidas} /></Card>
      </div>
    </>
  );
}
