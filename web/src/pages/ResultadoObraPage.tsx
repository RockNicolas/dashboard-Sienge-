import { Bar } from 'react-chartjs-2';
import type { FinanceiroObra } from '@server/types';
import { Card, Grafico, Kpi, Kpis, Tabela } from '../components/ui';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { brl, brlCurto, dataBR, dataHora, eixoBRL, PALETA, pct, rotuloEixo } from '../lib/format';

const N_PLANOS = 6;
const valorCor = (v: number) => <span className={v < 0 ? 'neg' : 'pos'}>{brl(v)}</span>;
const margem = (resultado: number, receitas: number) => (receitas > 0 ? pct(Math.round((resultado / receitas) * 1000) / 10) : '—');

interface Linha extends FinanceiroObra { previsto: number; realizado: number }

/** Resultado da obra: receitas (contas a receber) − despesas (contas a pagar) apropriadas por obra no Sienge. */
export default function ResultadoObraPage() {
  const { dados: d, erro } = useFinanceiro();
  if (erro) return <div className="erro">Erro: {erro}</div>;
  if (!d) return <p className="muted">Carregando resultado das obras…</p>;
  const r = d.resumo;
  const previsto = r.aReceber - r.aPagar;
  const realizado = r.recebido - r.pago;
  const linhas: Linha[] = d.porObra
    .map(o => ({ ...o, previsto: o.aReceber - o.aPagar, realizado: o.recebido - o.pago }))
    .sort((a, b) => b.aReceber + b.aPagar - (a.aReceber + a.aPagar));

  // despesas por plano financeiro: os maiores planos + "Outros"
  const totalPlano = new Map<string, number>();
  d.despesasObra.forEach(o => o.planos.forEach(p => totalPlano.set(p.plano, (totalPlano.get(p.plano) ?? 0) + p.valor)));
  const principais = [...totalPlano].sort((a, b) => b[1] - a[1]).slice(0, N_PLANOS).map(([p]) => p);
  const temOutros = totalPlano.size > N_PLANOS;
  const datasets = [...principais, ...(temOutros ? ['Outros'] : [])].map((plano, i) => ({
    label: plano,
    backgroundColor: PALETA[i % PALETA.length],
    data: d.despesasObra.map(o => (plano === 'Outros'
      ? o.planos.filter(p => !principais.includes(p.plano)).reduce((s, p) => s + p.valor, 0)
      : o.planos.find(p => p.plano === plano)?.valor ?? 0)),
  }));

  return (
    <>
      {d.aviso && <div className="aviso-sync">{d.aviso}</div>}
      <p className="muted">
        Parcelas com vencimento de {dataBR(d.de)} a {dataBR(d.ate)}
        {!d.mock && (d.atualizado ? ` · financeiro sincronizado ${dataHora(d.atualizado)}` : ' · financeiro ainda não sincronizado')}
      </p>
      <Kpis>
        <Kpi cor={PALETA[2]} titulo="Receitas" valor={brl(r.aReceber)} sub="contas a receber no período" />
        <Kpi cor={PALETA[7]} titulo="Despesas" valor={brl(r.aPagar)} sub="contas a pagar no período" />
        <Kpi cor={PALETA[0]} titulo="Resultado" valor={valorCor(previsto)} sub={`margem ${margem(previsto, r.aReceber)}`} />
        <Kpi cor={PALETA[5]} titulo="Recebido" valor={brl(r.recebido)} sub="já baixado" />
        <Kpi cor={PALETA[1]} titulo="Pago" valor={brl(r.pago)} sub="já baixado" />
        <Kpi cor={PALETA[6]} titulo="Resultado realizado" valor={valorCor(realizado)} sub="recebido − pago" />
      </Kpis>

      <div className="cols">
        <Card titulo="Receitas × despesas por obra">
          {linhas.length ? (
            <Grafico>
              <Bar
                data={{
                  labels: linhas.map(o => o.obra),
                  datasets: [
                    { label: 'Receitas', data: linhas.map(o => o.aReceber), backgroundColor: PALETA[2] },
                    { label: 'Despesas', data: linhas.map(o => o.aPagar), backgroundColor: PALETA[7] },
                    { label: 'Resultado', data: linhas.map(o => o.previsto), backgroundColor: PALETA[0] },
                  ],
                }}
                options={{ responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL, x: { grid: { display: false }, ticks: { callback: rotuloEixo } } } }}
              />
            </Grafico>
          ) : <p className="muted">Sem lançamentos no período.</p>}
        </Card>
        <Card titulo="Despesas por obra e plano financeiro">
          {d.despesasObra.length ? (
            <Grafico>
              <Bar
                data={{ labels: d.despesasObra.map(o => o.obra), datasets }}
                options={{
                  indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                  scales: { x: { stacked: true, ticks: { callback: v => brlCurto(Number(v)), maxTicksLimit: 5 } }, y: { stacked: true, ticks: { callback: rotuloEixo } } },
                }}
              />
            </Grafico>
          ) : <p className="muted">Sem despesas no período.</p>}
        </Card>
      </div>

      <Card titulo="Resultado por obra">
        {linhas.length ? (
          <Tabela linhas={linhas} colunas={[
            { t: 'Obra', f: o => o.obra || 'Sem obra' },
            { t: 'Receitas', f: o => brl(o.aReceber) },
            { t: 'Despesas', f: o => brl(o.aPagar) },
            { t: 'Resultado', f: o => <b>{valorCor(o.previsto)}</b> },
            { t: 'Margem', f: o => margem(o.previsto, o.aReceber) },
            { t: 'Recebido', f: o => brl(o.recebido) },
            { t: 'Pago', f: o => brl(o.pago) },
            { t: 'Realizado', f: o => valorCor(o.realizado) },
            { t: 'A receber vencido', f: o => <span className={o.receberVencido ? 'neg' : ''}>{brl(o.receberVencido)}</span>, sec: true },
            { t: 'A pagar vencido', f: o => <span className={o.pagarVencido ? 'neg' : ''}>{brl(o.pagarVencido)}</span>, sec: true },
          ]} />
        ) : <p className="muted">Sem lançamentos no período.</p>}
      </Card>

      {d.despesasObra.length > 0 && (
        <Card titulo="Despesas por plano financeiro (todas as obras do filtro)">
          <Tabela linhas={[...totalPlano].sort((a, b) => b[1] - a[1])} colunas={[
            { t: 'Plano financeiro', f: ([p]) => p },
            { t: 'Valor', f: ([, v]) => brl(v) },
            { t: '% das despesas', f: ([, v]) => pct(r.aPagar ? Math.round((v / r.aPagar) * 1000) / 10 : 0) },
          ]} />
        </Card>
      )}

      <p className="muted">
        Fonte: contas a receber (receitas) e contas a pagar (despesas) do Sienge, pela apropriação de cada título por obra; título
        rateado entre obras entra proporcional ao rateio. O contas a receber do Sienge não traz a obra: usa o centro de custo do título.
        Resultado = receitas − despesas com vencimento no período; realizado = recebido − pago.
      </p>
    </>
  );
}
