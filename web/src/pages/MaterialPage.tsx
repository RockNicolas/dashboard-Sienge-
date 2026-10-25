import { Bar } from 'react-chartjs-2';
import { Barra, Card, Grafico, Tabela } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, num, PALETA } from '../lib/format';

export default function MaterialPage() {
  const d = useDados();
  if (!d) return null;
  const l = d.consumoMaterial;
  const top = l.slice(0, 12);
  return (
    <div className="cols">
      <Card titulo="Valor consumido por insumo (Top 12)">
        <Grafico>
          <Bar
            data={{ labels: top.map(x => x.insumo), datasets: [{ label: 'Valor consumido', data: top.map(x => x.valor), backgroundColor: PALETA[2] }] }}
            options={{
              indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
              scales: { x: { ticks: { callback: v => brl(Number(v)) } } },
            }}
          />
        </Grafico>
      </Card>
      <Card titulo="Detalhe">
        <Tabela linhas={l} colunas={[
          { t: 'Insumo', f: r => r.insumo },
          { t: 'Qtd.', f: r => `${num(r.qtd)} ${r.un}` },
          { t: 'Valor', f: r => brl(r.valor) },
          { t: '', f: r => <Barra v={r.valor} max={l[0]?.valor ?? 1} /> },
        ]} />
      </Card>
    </div>
  );
}
