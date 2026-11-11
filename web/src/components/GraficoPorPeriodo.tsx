import { useState } from 'react';
import type { ChartData } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { brl, COR, corStatus, eixoBRL, falaPeriodo } from '../lib/format';
import { LIMITES, statusPorPeriodo, textoStatus } from '../lib/status';
import { RegraGrafico } from './Status';
import { Grafico } from './ui';

export interface PontoPeriodo { periodo: string; rotulo: string; valor: number }

export type TipoGrafico = 'barra' | 'linha';
const CHAVE = 'painel.tipoGrafico';
const lerTipo = (): TipoGrafico => {
  try { return localStorage.getItem(CHAVE) === 'linha' ? 'linha' : 'barra'; } catch { return 'barra'; }
};

/** Botões Barras | Linha (a escolha fica guardada e vale para todos os gráficos por período). */
export function useTipoGrafico(): [TipoGrafico, (t: TipoGrafico) => void] {
  const [tipo, setTipo] = useState<TipoGrafico>(lerTipo);
  return [tipo, t => { setTipo(t); try { localStorage.setItem(CHAVE, t); } catch { /* sem storage: só não lembra */ } }];
}

export const EscolhaTipo = ({ tipo, setTipo }: { tipo: TipoGrafico; setTipo: (t: TipoGrafico) => void }) => (
  <div className="seg seg-mini" role="group" aria-label="Tipo de gráfico">
    <button className={tipo === 'barra' ? '' : 'sec'} onClick={() => setTipo('barra')} title="Barras: comparar o tamanho de cada período">▮▮ Barras</button>
    <button className={tipo === 'linha' ? '' : 'sec'} onClick={() => setTipo('linha')} title="Linha: ver a subida e a descida de um período para o outro">⟋ Linha</button>
  </div>
);

/**
 * Gasto por período (mês, semana, ano) com a cor de cada barra/ponto dizendo se o período foi bom ou ruim:
 * cada um comparado com a média dos períodos completos (linha tracejada). O período em andamento fica em anil claro.
 * Em barras compara tamanhos; em linha mostra a subida e a descida de um período para o outro.
 * `referencia`: série de comparação, em anil claro (ex.: mesmo mês do ano anterior).
 */
export function GraficoPorPeriodo({ pontos, emAndamento, rotulo = 'Comprado', nomePeriodo = 'mês', referencia }: {
  pontos: PontoPeriodo[]; emAndamento?: string; rotulo?: string; nomePeriodo?: string;
  referencia?: { rotulo: string; valores: (number | null)[] };
}) {
  const [tipo, setTipo] = useTipoGrafico();
  const f = falaPeriodo(nomePeriodo);
  const { media, status } = statusPorPeriodo(pontos, emAndamento);
  const [, ate25, ate50] = LIMITES.acimaDaMedia;
  const cores = status.map(s => corStatus(s, `${COR.principal}66`));
  const linha = tipo === 'linha';
  const data: ChartData<'bar' | 'line', (number | null)[], string> = {
    labels: pontos.map(p => p.rotulo),
    datasets: [
      { type: 'line', label: `Média por ${nomePeriodo}`, data: pontos.map(() => media), borderColor: COR.neutroMedio, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, order: 0 },
      ...(referencia ? [linha
        ? { type: 'line' as const, label: referencia.rotulo, data: referencia.valores, borderColor: COR.referencia, borderWidth: 2, pointRadius: 3, pointBackgroundColor: COR.referencia, tension: 0.3, spanGaps: true, order: 2 }
        : { type: 'bar' as const, label: referencia.rotulo, data: referencia.valores, backgroundColor: COR.referencia, order: 2 }] : []),
      linha
        ? {
          type: 'line', label: rotulo, data: pontos.map(p => p.valor), borderColor: COR.principal, borderWidth: 2.5, tension: 0.3,
          pointRadius: 6, pointHoverRadius: 8, pointBackgroundColor: cores, pointBorderColor: cores, order: 1,
        }
        // período em andamento: cor da série, clara (ainda incompleto, sem nota)
        : { type: 'bar', label: rotulo, data: pontos.map(p => p.valor), backgroundColor: cores, order: 1 },
    ],
  };
  const iRotulo = data.datasets.length - 1;
  return (
    <>
      <div className="grafico-topo"><EscolhaTipo tipo={tipo} setTipo={setTipo} /></div>
      <Grafico>
        <Chart type="bar" data={data} options={{
          responsive: true, maintainAspectRatio: false, interaction: linha ? { mode: 'index', intersect: false } : undefined,
          plugins: {
            legend: { display: !!referencia },
            tooltip: {
              callbacks: {
                label: c => `${c.dataset.label}: ${brl(Number(c.parsed.y))}`,
                afterLabel: c => {
                  if (c.datasetIndex !== iRotulo) return '';
                  const i = c.dataIndex;
                  const andamento = pontos[i].periodo === emAndamento;
                  const linhas = [textoStatus(status[i], andamento ? `${nomePeriodo} em andamento (ainda incompleto)` : '')];
                  // em linha, quanto subiu ou desceu em relação ao período anterior
                  if (i > 0 && !andamento) {
                    const dif = pontos[i].valor - pontos[i - 1].valor;
                    linhas.push(dif === 0 ? `${f.igual} ${nomePeriodo} anterior` : `${dif > 0 ? '↗ subiu' : '↘ desceu'} ${brl(Math.abs(dif))} em relação ${f.ao} ${nomePeriodo} anterior`);
                  }
                  return linhas.filter(Boolean);
                },
              },
            },
          },
          scales: { y: eixoBRL, x: { grid: { display: false } } },
        }} />
      </Grafico>
      <RegraGrafico
        regras={{ bom: 'na média ou abaixo', melhorar: `até ${ate25}% acima`, atencao: `até ${ate50}% acima`, ruim: `mais de ${ate50}% acima` }}
        extra={`· cada ${nomePeriodo} ${f.comparado} com a média ${f.dos} que tiveram compra (${brl(media)}, linha tracejada)${emAndamento && pontos.some(p => p.periodo === emAndamento) ? ` · ${nomePeriodo} em andamento em anil claro` : ''}`}
      />
    </>
  );
}
