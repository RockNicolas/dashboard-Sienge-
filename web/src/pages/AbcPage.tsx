import type { ChartData } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { Card, Grafico, Tabela } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, num, PALETA, pct } from '../lib/format';

export default function AbcPage() {
  const d = useDados();
  if (!d) return null;
  const l = d.abc;
  const data: ChartData<'bar' | 'line'> = {
    labels: l.map(x => x.insumo),
    datasets: [
      { type: 'bar', label: 'Valor comprado', data: l.map(x => x.valor), backgroundColor: PALETA[0], yAxisID: 'y' },
      { type: 'line', label: '% acumulado', data: l.map(x => x.acumulado), borderColor: PALETA[3], yAxisID: 'y1', tension: 0.2 },
    ],
  };
  return (
    <div className="cols">
      <Card titulo="Curva ABC — valor comprado por insumo">
        <Grafico>
          <Chart
            type="bar"
            data={data}
            options={{
              responsive: true, maintainAspectRatio: false,
              scales: {
                y: { ticks: { callback: v => brl(Number(v)) } },
                y1: { position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: v => `${v}%` } },
              },
            }}
          />
        </Grafico>
      </Card>
      <Card titulo="Detalhe">
        <Tabela linhas={l} colunas={[
          { t: 'Insumo', f: r => r.insumo },
          { t: 'Qtd.', f: r => `${num(r.qtd)} ${r.un}` },
          { t: 'Valor', f: r => brl(r.valor) },
          { t: '%', f: r => pct(r.participacao) },
          { t: 'Acum.', f: r => pct(r.acumulado) },
          { t: 'Classe', f: r => <span className={`tag ${r.classe}`}>{r.classe}</span> },
        ]} />
      </Card>
    </div>
  );
}
