import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { Compra, HistoricoMaterial } from '@server/types';
import { TabelaItens } from './TabelaCompras';
import { Card, Grafico, Kpi, Kpis, MostrarMais, Tabela } from './ui';
import { brl, brlPreco, celular, dataBR, listaCurta, num, PALETA, pct } from '../lib/format';

const PASSO = listaCurta() ? 20 : 50;
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

interface PorFornecedor {
  id: string; fornecedor: string; compras: number; qtd: number; valor: number;
  medio: number; menor: number; ultimo: Compra; acimaDoMelhor: number;
}

/** Detalhe de um material: indicadores de preço, preço em cada compra, preço por fornecedor e todas as compras. */
export default function MaterialDetalhe({ m, compras, cortado }: { m: HistoricoMaterial; compras: Compra[]; cortado: boolean }) {
  const [visiveis, setVisiveis] = useState(PASSO);
  const emOrdem = useMemo(() => [...compras].sort((a, b) => a.data.localeCompare(b.data)), [compras]);

  // preço médio ponderado de cada fornecedor, do mais barato para o mais caro
  const porFornecedor = useMemo(() => {
    const grupos = new Map<string, Compra[]>();
    for (const c of compras) grupos.set(c.fornecedorId, [...(grupos.get(c.fornecedorId) ?? []), c]);
    const lista = [...grupos].map(([id, l]) => {
      const qtd = l.reduce((s, c) => s + c.qtd, 0);
      const valor = l.reduce((s, c) => s + c.valor, 0);
      return {
        id, fornecedor: l[0].fornecedor, compras: l.length, qtd, valor, medio: qtd ? valor / qtd : 0,
        menor: Math.min(...l.map(c => c.preco)), ultimo: [...l].sort((a, b) => b.data.localeCompare(a.data))[0], acimaDoMelhor: 0,
      };
    }).sort((a, b) => a.medio - b.medio);
    const melhor = lista[0]?.medio ?? 0;
    return lista.map((x): PorFornecedor => ({ ...x, acimaDoMelhor: melhor ? ((x.medio - melhor) / melhor) * 100 : 0 }));
  }, [compras]);

  const quemVendeu = (preco: number) => compras.find(c => c.preco === preco)?.fornecedor ?? '';
  const recentes = useMemo(() => [...compras].sort((a, b) => b.data.localeCompare(a.data)), [compras]);

  return (
    <>
      <Kpis>
        <Kpi cor={PALETA[0]} titulo="Último preço" valor={brlPreco(m.ultimoPreco)} sub={`${dataBR(m.ultimaData)} · ${m.ultimoFornecedor}`} />
        <Kpi cor={PALETA[3]} titulo="Preço médio" valor={brlPreco(m.precoMedio)} sub={`por ${m.un} (média ponderada)`} />
        <Kpi cor={PALETA[2]} titulo="Menor preço" valor={brlPreco(m.precoMin)} sub={quemVendeu(m.precoMin) || '—'} />
        <Kpi cor={PALETA[7]} titulo="Maior preço" valor={brlPreco(m.precoMax)} sub={quemVendeu(m.precoMax) || '—'} />
        <Kpi cor={PALETA[6]} titulo="Variação" valor={pct(m.variacao)} sub="do menor ao maior preço" />
        <Kpi cor={PALETA[1]} titulo="Total comprado" valor={brl(m.valor)} sub={`${num(m.qtd)} ${m.un} em ${m.compras} compras`} />
      </Kpis>

      <div className="cols">
        <Card titulo="Preço pago em cada compra">
          <p className="muted">Cada ponto é uma compra (passe o mouse para ver fornecedor e pedido). A linha tracejada é o preço médio.</p>
          <Grafico>
            <Line
              data={{
                labels: emOrdem.map(c => dataCurta(c.data)),
                datasets: [
                  { label: `Preço líquido (R$/${m.un})`, data: emOrdem.map(c => c.preco), borderColor: PALETA[0], backgroundColor: PALETA[0], pointRadius: 3.5, pointHoverRadius: 6, tension: 0.2 },
                  { label: 'Preço médio', data: emOrdem.map(() => m.precoMedio), borderColor: PALETA[3], borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: ctx => `${ctx.dataset.label}: ${brlPreco(Number(ctx.parsed.y))}`,
                      afterLabel: ctx => (ctx.datasetIndex === 0 ? `${emOrdem[ctx.dataIndex].fornecedor} · pedido ${emOrdem[ctx.dataIndex].pedido} · ${num(emOrdem[ctx.dataIndex].qtd)} ${m.un}` : ''),
                    },
                  },
                },
                scales: {
                  y: { ticks: { callback: v => brlPreco(Number(v)) } },
                  x: { grid: { display: false }, ticks: { maxTicksLimit: celular() ? 4 : 8, maxRotation: 0 } },
                },
              }}
            />
          </Grafico>
        </Card>

        <Card titulo="Preço por fornecedor">
          <p className="muted">Preço médio ponderado de cada fornecedor, do mais barato para o mais caro.</p>
          <Tabela cartoes={false} linhas={porFornecedor} colunas={[
            {
              t: 'Fornecedor', f: x => (
                <>
                  {x.fornecedor}{x === porFornecedor[0] && porFornecedor.length > 1 && <span className="tag melhor">melhor preço</span>}
                  <small className="muted bloco">último {brlPreco(x.ultimo.preco)} em {dataBR(x.ultimo.data)} · {num(x.qtd)} {m.un}</small>
                </>
              ),
            },
            { t: 'Compras', f: x => x.compras },
            { t: 'Preço médio', f: x => <b>{brlPreco(x.medio)}</b> },
            { t: 'vs. melhor', f: x => (x.acimaDoMelhor > 0.05 ? <span className="neg">+{pct(Math.round(x.acimaDoMelhor * 10) / 10)}</span> : '—') },
          ]} />
        </Card>
      </div>

      <Card titulo={`Compras de ${m.insumo}`}>
        {cortado && <p className="muted">O período tem muitas compras: aqui entram as que estão entre as mais recentes carregadas na tela. A lista completa sai na exportação em Excel.</p>}
        <TabelaItens linhas={recentes} limite={visiveis} semMaterial />
        <MostrarMais visiveis={visiveis} total={recentes.length} passo={PASSO} onMais={() => setVisiveis(n => n + PASSO)} />
      </Card>
    </>
  );
}
