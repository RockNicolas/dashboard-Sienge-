import { Bar } from 'react-chartjs-2';
import { Barra, Card, Grafico, Kpi, Kpis } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, eixoBRL, PALETA, pct, rotuloPeriodo } from '../lib/format';

const Ranking = ({ itens }: { itens: { k: string; nome: string; valor: number }[] }) => (
  itens.length ? (
    <ul className="rank">
      {itens.map(i => (
        <li key={i.k}>
          <span>{i.nome}</span><span>{brl(i.valor)}</span>
          <Barra v={i.valor} max={itens[0]?.valor ?? 1} />
        </li>
      ))}
    </ul>
  ) : <p className="muted">Sem compras no período.</p>
);

/** Visão geral de suprimentos: compras, fornecedores, materiais e obras no período. */
export default function GeralPage() {
  const d = useDados();
  if (!d) return null;
  const r = d.resumo;
  const forn = d.fornecedores.slice(0, 5);
  const materiais = d.historico.slice(0, 5);
  const obras = d.comprasObra.slice(0, 5);
  const maior = d.fornecedores[0];

  return (
    <div className="geral">
      <Kpis>
        <Kpi cor={PALETA[0]} titulo="Total comprado" valor={brl(r.comprado)} sub={`${r.pedidos} pedidos de compra`} />
        <Kpi cor={PALETA[6]} titulo="Ticket médio por pedido" valor={brl(r.ticketMedio)} sub="valor médio de cada pedido" />
        <Kpi cor={PALETA[1]} titulo="Fornecedores" valor={r.fornecedores} sub="com pedido no período" />
        <Kpi cor={PALETA[3]} titulo="Materiais diferentes" valor={r.insumos} sub="insumos comprados" />
        <Kpi cor={PALETA[2]} titulo="Obras atendidas" valor={r.obrasComCompra} sub="com pedido de compra" />
        <Kpi cor={PALETA[4]} titulo="Maior fornecedor" valor={maior ? pct(maior.participacao) : '—'} sub={maior?.fornecedor ?? 'sem compras'} />
      </Kpis>

      <Card titulo="Compras por mês (pedidos de compra)">
        <Grafico>
          <Bar
            data={{
              labels: r.compradoMensal.map(p => rotuloPeriodo(p.mes)),
              datasets: [{ label: 'Comprado', data: r.compradoMensal.map(p => p.valor), backgroundColor: PALETA[0] }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: eixoBRL, x: { grid: { display: false } } } }}
          />
        </Grafico>
      </Card>

      <div className="stack">
        <Card titulo="Top 5 fornecedores">
          <Ranking itens={forn.map(f => ({ k: f.fornecedorId, nome: f.fornecedor, valor: f.valor }))} />
        </Card>
        <Card titulo="Top 5 materiais por valor comprado">
          <Ranking itens={materiais.map(m => ({ k: m.insumoId, nome: m.insumo, valor: m.valor }))} />
        </Card>
        <Card titulo="Compras por obra">
          <Ranking itens={obras.map(o => ({ k: o.obraId || '-', nome: o.obra, valor: o.valor }))} />
        </Card>
      </div>
    </div>
  );
}
