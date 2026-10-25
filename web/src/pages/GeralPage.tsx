import { Bar } from 'react-chartjs-2';
import { Barra, Card, Grafico, Kpi, Kpis } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, eixoBRL, meses, PALETA, pct, porMes } from '../lib/format';

export default function GeralPage() {
  const d = useDados();
  if (!d) return null;
  const r = d.resumo;
  const ms = meses(r.compradoMensal, r.consumidoMensal);
  const forn = d.fornecedores.slice(0, 5);
  const insumos = d.abc.slice(0, 5);
  return (
    <div className="geral">
      <Kpis>
        <Kpi cor={PALETA[0]} titulo="Total comprado" valor={brl(r.comprado)} sub={`${r.pedidos} pedidos`} />
        <Kpi cor={PALETA[1]} titulo="Consumido nas obras" valor={brl(r.consumido)} sub={`${pct(r.pctConsumido)} do comprado`} />
        <Kpi cor={PALETA[2]} titulo="Saldo (comprado − consumido)" valor={brl(r.saldo)} sub="estoque / a apropriar" />
        <Kpi cor={PALETA[6]} titulo="Fornecedores ativos" valor={r.fornecedores} sub="no período" />
        <Kpi cor={PALETA[3]} titulo="Insumos diferentes" valor={r.insumos} sub="comprados no período" />
        <Kpi cor={PALETA[4]} titulo="Obras com consumo" valor={r.obras} sub="com saídas de estoque" />
      </Kpis>

      <Card titulo="Comprado × Consumido por mês">
        <Grafico>
          <Bar
            data={{
              labels: ms,
              datasets: [
                { label: 'Comprado', data: porMes(r.compradoMensal, ms), backgroundColor: PALETA[0] },
                { label: 'Consumido', data: porMes(r.consumidoMensal, ms), backgroundColor: PALETA[1] },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL, x: { grid: { display: false } } } }}
          />
        </Grafico>
      </Card>

      <div className="stack">
        <Card titulo="Top 5 fornecedores">
          <ul className="rank">
            {forn.map(f => (
              <li key={f.fornecedorId}>
                <span>{f.fornecedor}</span><span>{brl(f.valor)}</span>
                <Barra v={f.valor} max={forn[0]?.valor ?? 1} />
              </li>
            ))}
          </ul>
        </Card>
        <Card titulo="Top 5 insumos por valor comprado">
          <ul className="rank">
            {insumos.map(i => (
              <li key={i.insumoId}>
                <span>{i.insumo}</span><span>{brl(i.valor)}</span>
                <Barra v={i.valor} max={insumos[0]?.valor ?? 1} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
