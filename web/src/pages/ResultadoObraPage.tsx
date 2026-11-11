import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { FinanceiroObra } from '@server/types';
import { GraficoEvolucao } from '../components/GraficoEvolucao';
import { Sinal, ValorStatus } from '../components/Status';
import { Card, Grafico, Kpi, Kpis, MostrarMais, Tabela } from '../components/ui';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { diaLocal } from '../lib/periodo';
import { brl, brlCurto, COR, corStatus, dataBR, dataHora, eixoBRL, PALETA, pct, rotuloEixo, rotuloPeriodo } from '../lib/format';
import { mesAtual, statusMargem, statusVencido } from '../lib/status';

const N_PLANOS = 6;
const N_OBRAS_GRAFICO = 12;   // com centenas de obras/centros de custo, o gráfico só fica legível com as maiores
const PASSO = 20;
/** Resultado pintado pela margem (resultado ÷ base): prejuízo, margem apertada, ok… (ver lib/status.ts). */
const valorCor = (v: number, base: number) => <ValorStatus s={statusMargem(v, base)}>{brl(v)}</ValorStatus>;
const vencido = (v: number, total: number, oQue: 'a receber' | 'a pagar') => <ValorStatus s={v ? statusVencido(v, total, oQue) : null}>{brl(v)}</ValorStatus>;
const margem = (resultado: number, receitas: number) => (receitas > 0 ? pct(Math.round((resultado / receitas) * 1000) / 10) : '—');

interface Linha extends FinanceiroObra { previsto: number; realizado: number }

/** Resultado da obra: receitas (contas a receber) − despesas (contas a pagar) apropriadas por obra no Sienge. */
export default function ResultadoObraPage() {
  const { dados: d, erro, agrupar, setAgrupar } = useFinanceiro();
  // evolução do resultado: pelas parcelas (vencimento) ou pelo dinheiro que entrou e saiu (caixa)
  const [base, setBase] = useState<'vencimento' | 'caixa'>('vencimento');
  const [verObras, setVerObras] = useState(PASSO);
  if (erro) return <div className="erro">Erro: {erro}</div>;
  if (!d) return <p className="muted">Carregando resultado das obras…</p>;
  const r = d.resumo;
  const previsto = r.aReceber - r.aPagar;
  const realizado = r.recebido - r.pago;
  const linhas: Linha[] = d.porObra
    .map(o => ({ ...o, previsto: o.aReceber - o.aPagar, realizado: o.recebido - o.pago }))
    .sort((a, b) => b.aReceber + b.aPagar - (a.aReceber + a.aPagar));

  const linhasGrafico = linhas.slice(0, N_OBRAS_GRAFICO);
  const despesasGrafico = [...d.despesasObra].sort((a, b) => b.total - a.total).slice(0, N_OBRAS_GRAFICO);
  const maiores = (n: number) => (n > N_OBRAS_GRAFICO ? ` (as ${N_OBRAS_GRAFICO} maiores de ${n})` : '');
  // evolução: períodos depois do atual são previsão (parcelas que ainda vão vencer)
  const hoje = new Date();
  const segunda = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - ((hoje.getDay() + 6) % 7));
  const periodoAtual = agrupar === 'mes' ? mesAtual() : diaLocal(segunda);
  const iPrevisao = d.serie.findIndex(p => p.periodo > periodoAtual);

  // despesas por plano financeiro: os maiores planos + "Outros"
  const totalPlano = new Map<string, number>();
  d.despesasObra.forEach(o => o.planos.forEach(p => totalPlano.set(p.plano, (totalPlano.get(p.plano) ?? 0) + p.valor)));
  const principais = [...totalPlano].sort((a, b) => b[1] - a[1]).slice(0, N_PLANOS).map(([p]) => p);
  const temOutros = totalPlano.size > N_PLANOS;
  const datasets = [...principais, ...(temOutros ? ['Outros'] : [])].map((plano, i) => ({
    label: plano,
    backgroundColor: PALETA[i % PALETA.length],
    data: despesasGrafico.map(o => (plano === 'Outros'
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
        <Kpi titulo="Receitas" valor={brl(r.aReceber)} sub="contas a receber no período" />
        <Kpi titulo="Despesas" valor={brl(r.aPagar)} sub="contas a pagar no período" />
        <Kpi titulo="Resultado" valor={valorCor(previsto, r.aReceber)} sub={`margem ${margem(previsto, r.aReceber)}`} status={statusMargem(previsto, r.aReceber)} />
        <Kpi titulo="Recebido" valor={brl(r.recebido)} sub={`já baixado · ${brl(r.receberVencido)} vencido`}
          status={statusVencido(r.receberVencido, r.aReceber, 'a receber')} />
        <Kpi titulo="Pago" valor={brl(r.pago)} sub={`já baixado · ${brl(r.pagarVencido)} vencido`}
          status={statusVencido(r.pagarVencido, r.aPagar, 'a pagar')} />
        <Kpi titulo="Resultado realizado" valor={valorCor(realizado, r.recebido)} sub="recebido − pago" status={statusMargem(realizado, r.recebido)} />
      </Kpis>

      <Card titulo="Evolução do resultado: lucro × prejuízo">
        <div className="barra-fin">
          <div className="seg seg-mini" role="group" aria-label="Agrupar por">
            <button className={agrupar === 'mes' ? '' : 'sec'} onClick={() => setAgrupar('mes')}>Mensal</button>
            <button className={agrupar === 'semana' ? '' : 'sec'} onClick={() => setAgrupar('semana')}>Semanal</button>
          </div>
          <div className="seg seg-mini" role="group" aria-label="Base do resultado">
            <button className={base === 'vencimento' ? '' : 'sec'} onClick={() => setBase('vencimento')}
              title="Receitas e despesas pelas parcelas que vencem no período (contas a receber − contas a pagar)">Pelo vencimento</button>
            <button className={base === 'caixa' ? '' : 'sec'} onClick={() => setBase('caixa')}
              title="O que de fato entrou e saiu das contas (movimentos de caixa e bancos)">Pelo caixa</button>
          </div>
        </div>
        <GraficoEvolucao
          inicioPrevisao={base === 'vencimento' && iPrevisao >= 0 ? iPrevisao : undefined}
          nomePeriodo={agrupar === 'mes' ? 'mês' : 'semana'}
          pontos={d.serie.map(p => ({
            rotulo: rotuloPeriodo(p.periodo),
            receitas: base === 'vencimento' ? p.aReceber : p.entradas,
            despesas: base === 'vencimento' ? p.aPagar : p.saidas,
          }))}
        />
      </Card>

      <div className="cols">
        <Card titulo={`Receitas × despesas por obra${maiores(linhas.length)}`}>
          {linhas.length ? (
            <Grafico>
              <Bar
                data={{
                  labels: linhasGrafico.map(o => o.obra),
                  datasets: [
                    { label: 'Receitas', data: linhasGrafico.map(o => o.aReceber), backgroundColor: COR.terciaria },
                    { label: 'Despesas', data: linhasGrafico.map(o => o.aPagar), backgroundColor: COR.secundaria },
                    // resultado com a cor da margem de cada obra (prejuízo, margem apertada, ok…)
                    { label: 'Resultado', data: linhas.map(o => o.previsto), backgroundColor: linhasGrafico.map(o => corStatus(statusMargem(o.previsto, o.aReceber))) },
                  ],
                }}
                options={{ responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL, x: { grid: { display: false }, ticks: { callback: rotuloEixo } } } }}
              />
            </Grafico>
          ) : <p className="muted">Sem lançamentos no período.</p>}
        </Card>
        <Card titulo={`Despesas por obra e plano financeiro${maiores(d.despesasObra.length)}`}>
          {d.despesasObra.length ? (
            <Grafico>
              <Bar
                data={{ labels: despesasGrafico.map(o => o.obra), datasets }}
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
          <Tabela linhas={linhas.slice(0, verObras)} colunas={[
            { t: 'Obra', f: o => o.obra || 'Sem obra' },
            { t: 'Receitas', f: o => brl(o.aReceber) },
            { t: 'Despesas', f: o => brl(o.aPagar) },
            { t: 'Resultado', f: o => <b>{valorCor(o.previsto, o.aReceber)}</b> },
            { t: 'Margem', f: o => <>{margem(o.previsto, o.aReceber)} <Sinal s={statusMargem(o.previsto, o.aReceber)} curto /></> },
            { t: 'Recebido', f: o => brl(o.recebido) },
            { t: 'Pago', f: o => brl(o.pago) },
            { t: 'Realizado', f: o => valorCor(o.realizado, o.recebido) },
            { t: 'A receber vencido', f: o => vencido(o.receberVencido, o.aReceber, 'a receber'), sec: true },
            { t: 'A pagar vencido', f: o => vencido(o.pagarVencido, o.aPagar, 'a pagar'), sec: true },
          ]} />
        ) : <p className="muted">Sem lançamentos no período.</p>}
        <MostrarMais visiveis={verObras} total={linhas.length} passo={PASSO} onMais={() => setVerObras(v => v + PASSO)} />
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
