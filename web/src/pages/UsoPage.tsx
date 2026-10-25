import { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Barra, Card, Grafico, Kpi, Kpis, Tabela } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, num, PALETA, pct } from '../lib/format';

export default function UsoPage() {
  const d = useDados();
  const [sel, setSel] = useState('');
  if (!d) return null;
  const lista = d.compradoVsConsumido;
  const i = lista.find(x => x.insumoId === sel) ?? lista[0];

  return (
    <>
      <Card titulo="Quanto do que foi comprado foi usado em cada obra?">
        <label>Insumo
          <select value={i?.insumoId ?? ''} onChange={e => setSel(e.target.value)}>
            {lista.map(x => <option key={x.insumoId} value={x.insumoId}>{x.insumo}</option>)}
          </select>
        </label>
        {i && (
          <>
            <Kpis>
              <Kpi titulo="Comprado" valor={`${num(i.comprado)} ${i.un}`} sub={brl(i.valorComprado)} />
              <Kpi titulo="Consumido nas obras" valor={`${num(i.consumido)} ${i.un}`} sub={pct(i.pctUso)} />
              <Kpi titulo="Saldo" valor={`${num(i.saldo)} ${i.un}`} />
            </Kpis>
            <div className="grid2">
              <Grafico>
                <Bar
                  data={{ labels: i.porObra.map(o => o.obra), datasets: [{ label: `Qtd. consumida (${i.un})`, data: i.porObra.map(o => o.qtd), backgroundColor: PALETA[0] }] }}
                  options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </Grafico>
              <Grafico>
                <Doughnut
                  data={{
                    labels: [...i.porObra.map(o => o.obra), 'Saldo (não consumido)'],
                    datasets: [{ data: [...i.porObra.map(o => o.qtd), Math.max(0, i.saldo)], backgroundColor: [...PALETA.slice(0, i.porObra.length), '#b8c0cc'] }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
                />
              </Grafico>
            </div>
            <Tabela linhas={i.porObra} colunas={[
              { t: 'Obra', f: r => r.obra },
              { t: 'Qtd. consumida', f: r => `${num(r.qtd)} ${i.un}` },
              { t: '% do comprado', f: r => pct(r.pctDoComprado) },
              { t: 'Valor', f: r => brl(r.valor) },
            ]} />
          </>
        )}
      </Card>

      <Card titulo="Todos os insumos — saldo (comprado − consumido)">
        <Tabela linhas={lista} colunas={[
          { t: 'Insumo', f: r => r.insumo },
          { t: 'Comprado', f: r => `${num(r.comprado)} ${r.un}` },
          { t: 'Consumido', f: r => `${num(r.consumido)} ${r.un}` },
          { t: 'Saldo', f: r => <span className={r.saldo < 0 ? 'neg' : ''}>{num(r.saldo)} {r.un}</span> },
          { t: '% usado', f: r => pct(r.pctUso) },
          { t: '', f: r => <Barra v={r.pctUso} max={100} /> },
        ]} />
      </Card>
    </>
  );
}
