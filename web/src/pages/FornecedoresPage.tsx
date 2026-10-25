import { Bar } from 'react-chartjs-2';
import { Card, Grafico, Tabela } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, num, PALETA, pct } from '../lib/format';

export default function FornecedoresPage() {
  const d = useDados();
  if (!d) return null;
  const l = d.fornecedores;
  return (
    <div className="cols">
      <Card titulo="Ranking de fornecedores por valor comprado">
        <Grafico>
          <Bar
            data={{ labels: l.map(x => x.fornecedor), datasets: [{ label: 'Valor comprado', data: l.map(x => x.valor), backgroundColor: PALETA[0] }] }}
            options={{
              indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
              scales: { x: { ticks: { callback: v => brl(Number(v)) } } },
            }}
          />
        </Grafico>
      </Card>
      <Card titulo="Detalhe">
        <Tabela linhas={l} colunas={[
          { t: 'Fornecedor', f: r => `${l.indexOf(r) + 1}. ${r.fornecedor}` },
          { t: 'Valor', f: r => brl(r.valor) },
          { t: 'Participação', f: r => pct(r.participacao) },
          { t: 'Pedidos', f: r => r.pedidos },
          { t: 'Insumos', f: r => r.itens },
          { t: 'Prazo médio', f: r => (r.prazoMedio == null ? '—' : `${num(r.prazoMedio)} dias`) },
        ]} />
      </Card>
    </div>
  );
}
