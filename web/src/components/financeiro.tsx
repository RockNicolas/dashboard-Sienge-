// Peças compartilhadas pelas telas do módulo financeiro.
import type { ChartData } from 'chart.js';
import { Bar, Chart } from 'react-chartjs-2';
import type { Agrupamento, FinanceiroResponse, ParcelaResumo, PontoFinanceiro, SituacaoParcela } from '@server/types';
import { brl, dataBR, dataHora, eixoBRL, PALETA, rotuloPeriodo } from '../lib/format';
import { Grafico, Tabela } from './ui';

export const nomeAgrupar = (a: Agrupamento) => (a === 'mes' ? 'mês' : 'semana');

/** Seletor Mês/Semana + aviso da sincronização + quando foi atualizado. */
export function BarraFinanceiro({ d, agrupar, setAgrupar }: {
  d: FinanceiroResponse; agrupar: Agrupamento; setAgrupar: (a: Agrupamento) => void;
}) {
  return (
    <>
      {d.aviso && <div className="aviso-sync">{d.aviso}</div>}
      <div className="barra-fin">
        <div className="seg" role="group" aria-label="Agrupar por">
          <button className={agrupar === 'mes' ? '' : 'sec'} onClick={() => setAgrupar('mes')}>Mensal</button>
          <button className={agrupar === 'semana' ? '' : 'sec'} onClick={() => setAgrupar('semana')}>Semanal</button>
        </div>
        <span className="muted">
          {dataBR(d.de)} a {dataBR(d.ate)}
          {!d.mock && (d.atualizado ? ` · financeiro sincronizado ${dataHora(d.atualizado)}` : ' · financeiro ainda não sincronizado')}
        </span>
      </div>
    </>
  );
}

const opcoes = { responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL, x: { grid: { display: false } } } } as const;

/** Barras de duas séries por período (ex.: a pagar × a receber). */
export function GraficoSeries({ serie, series }: {
  serie: PontoFinanceiro[];
  series: { rotulo: string; campo: keyof Omit<PontoFinanceiro, 'periodo'>; cor: string }[];
}) {
  return (
    <Grafico>
      <Bar
        data={{
          labels: serie.map(s => rotuloPeriodo(s.periodo)),
          datasets: series.map(x => ({ label: x.rotulo, data: serie.map(s => s[x.campo]), backgroundColor: x.cor })),
        }}
        options={opcoes}
      />
    </Grafico>
  );
}

/** Entradas × saídas (barras) com o saldo acumulado (linha). */
export function GraficoCaixa({ serie }: { serie: PontoFinanceiro[] }) {
  const data: ChartData<'bar' | 'line', number[], string> = {
    labels: serie.map(s => rotuloPeriodo(s.periodo)),
    datasets: [
      { type: 'line', label: 'Saldo acumulado', data: serie.map(s => s.saldoAcumulado), borderColor: PALETA[6], backgroundColor: PALETA[6], tension: 0.25, order: 0 },
      { type: 'bar', label: 'Entradas', data: serie.map(s => s.entradas), backgroundColor: PALETA[2], order: 1 },
      { type: 'bar', label: 'Saídas', data: serie.map(s => s.saidas), backgroundColor: PALETA[7], order: 1 },
    ],
  };
  return <Grafico><Chart type="bar" data={data} options={opcoes} /></Grafico>;
}

const NOME_SITUACAO: Record<SituacaoParcela, string> = { aberta: 'Em aberto', vencida: 'Vencida', quitada: 'Quitada' };
export const Situacao = ({ s }: { s: SituacaoParcela }) => <span className={`tag ${s}`}>{NOME_SITUACAO[s]}</span>;

/** Lista de parcelas. Com `parceiro`, é de um tipo só (a coluna Tipo some e o parceiro ganha esse nome). */
export function TabelaParcelas({ linhas, parceiro }: { linhas: ParcelaResumo[]; parceiro?: string }) {
  if (!linhas.length) return <p className="muted">Nenhuma parcela.</p>;
  return (
    <Tabela linhas={linhas} colunas={[
      ...(parceiro ? [] : [{ t: 'Tipo', f: (r: ParcelaResumo) => (r.tipo === 'pagar' ? 'A pagar' : 'A receber') }]),
      { t: 'Vencimento', f: r => dataBR(r.vencimento) },
      { t: parceiro ?? 'Credor / cliente', f: r => r.parceiro },
      { t: 'Documento', f: r => r.documento },
      { t: 'Obra', f: r => r.obra },
      { t: 'Saldo', f: r => brl(r.saldo) },
      { t: 'Situação', f: r => <Situacao s={r.situacao} /> },
    ]} />
  );
}
