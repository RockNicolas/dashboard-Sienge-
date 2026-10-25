import { Bar, Line } from 'react-chartjs-2';
import { Card, Grafico } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, eixoBRL, meses, PALETA, pct, porMes } from '../lib/format';

export default function ObrasPage() {
  const d = useDados();
  if (!d) return null;
  const l = d.obras;
  const ms = meses(...l.map(o => o.mensal));
  const opcoes = { responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL } } as const;
  return (
    <>
      <div className="cols">
      <Card titulo="Consumo por obra (R$)">
        <Grafico>
          <Bar
            data={{ labels: l.map(x => x.obra), datasets: [{ label: 'Consumo', data: l.map(x => x.valor), backgroundColor: l.map((_, i) => PALETA[i % PALETA.length]) }] }}
            options={{ ...opcoes, plugins: { legend: { display: false } } }}
          />
        </Grafico>
      </Card>
      <Card titulo="Evolução mensal por obra">
        <Grafico>
          <Line
            data={{ labels: ms, datasets: l.map((o, i) => ({ label: o.obra, data: porMes(o.mensal, ms), borderColor: PALETA[i % PALETA.length], tension: 0.25 })) }}
            options={opcoes}
          />
        </Grafico>
      </Card>
      </div>
      <Card titulo="Principais insumos de cada obra">
        <div className="grid2">
          {l.map(o => (
            <div key={o.obraId}>
              <b>{o.obra}</b> <span className="muted">{brl(o.valor)} · {pct(o.participacao)}</span>
              <table><tbody>
                {o.topInsumos.map(t => <tr key={t.insumo}><td>{t.insumo}</td><td>{brl(t.valor)}</td></tr>)}
              </tbody></table>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
