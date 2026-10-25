import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { Sincronizacao } from '@server/types';
import { api } from '../api/client';
import { Card, Grafico, Tabela } from '../components/ui';
import { brl, dataHora, eixoBRL, PALETA } from '../lib/format';

export default function HistoricoPage() {
  const [h, setH] = useState<Sincronizacao[]>([]);
  useEffect(() => { void api.historico().then(setH).catch(() => setH([])); }, []);
  const asc = [...h].reverse();
  return (
    <div className="cols">
    <Card titulo="Histórico de sincronizações com o Sienge">
      <p className="muted">Cada sincronização grava os dados no banco local (SQLite), preservando o histórico. Em modo demonstração nada é gravado.</p>
      <Grafico>
        <Line
          data={{
            labels: asc.map(x => dataHora(x.em)),
            datasets: [
              { label: 'Comprado', data: asc.map(x => x.comprado), borderColor: PALETA[0] },
              { label: 'Consumido', data: asc.map(x => x.consumido), borderColor: PALETA[1] },
            ],
          }}
          options={{ responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL } }}
        />
      </Grafico>
    </Card>
    <Card titulo="Detalhe">
      <Tabela linhas={h} colunas={[
        { t: 'Quando', f: r => dataHora(r.em) },
        { t: 'Período', f: r => `${r.de} a ${r.ate}` },
        { t: 'Itens de compra', f: r => r.compras },
        { t: 'Saídas de estoque', f: r => r.consumos },
        { t: 'Comprado', f: r => brl(r.comprado) },
        { t: 'Consumido', f: r => brl(r.consumido) },
      ]} />
    </Card>
    </div>
  );
}
