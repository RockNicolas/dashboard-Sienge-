import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { Compra } from '@server/types';
import { Busca, Card, Grafico, Kpi, Kpis, MostrarMais, paraBusca } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, brlPreco, celular, dataBR, num, PALETA, pct, rotuloPeriodo, SITUACAO_PEDIDO } from '../lib/format';

const PASSO_ITENS = celular() ? 20 : 50;
const PASSO_MATERIAIS = celular() ? 20 : 60;
const fmt = (n: number) => n.toLocaleString('pt-BR');

function SituacaoPedido({ c }: { c: Compra }) {
  return (
    <>
      {c.situacao ? <span className={`tag st-${c.situacao}`}>{SITUACAO_PEDIDO[c.situacao] ?? c.situacao}</span> : '—'}
      {!c.autorizado && <small className="muted bloco">não autorizado</small>}
      {c.atrasado && <small className="neg bloco">entrega em atraso</small>}
    </>
  );
}

/** Itens de pedido de compra com os campos do Sienge. No celular cada item vira um cartão. */
function TabelaItens({ linhas, limite, semMaterial }: { linhas: Compra[]; limite: number; semMaterial?: boolean }) {
  if (!linhas.length) return <p className="muted">Nenhuma compra.</p>;
  return (
    <div className="tabela-rolagem">
      <table className="titulos resp resp-largo">
        <thead>
          <tr>
            {!semMaterial && <th>Material</th>}
            <th>Data</th><th>Pedido</th><th>Situação</th><th>Obra</th><th>Fornecedor</th>
            <th>Quantidade</th><th className="col-sec">Preço unitário</th><th>Preço líquido</th><th>Valor</th><th className="col-sec">Comprador</th>
          </tr>
        </thead>
        <tbody>
          {linhas.slice(0, limite).map((c, i) => (
            <tr key={`${c.pedido}-${c.item}-${i}`}>
              {!semMaterial && (
                <td data-label="Material">
                  {c.codigo && <span className="muted">{c.codigo} – </span>}{c.insumo}
                  {(c.detalhe || c.marca) && <small className="muted bloco">{[c.detalhe, c.marca].filter(Boolean).join(' · ')}</small>}
                </td>
              )}
              <td data-label="Data">{dataBR(c.data)}</td>
              <td data-label="Pedido"><b>{c.pedido}</b>{c.item > 0 && <small className="muted bloco">item {c.item}</small>}</td>
              <td data-label="Situação"><SituacaoPedido c={c} /></td>
              <td data-label="Obra" className="txt">{c.obra || <span className="muted">Sem obra</span>}</td>
              <td data-label="Fornecedor" className="txt">{c.fornecedor}</td>
              <td data-label="Quantidade">{num(c.qtd)} {c.un}</td>
              <td data-label="Preço unitário" className="col-sec">{brlPreco(c.precoUnitario)}</td>
              <td data-label="Preço líquido">{brlPreco(c.preco)}</td>
              <td data-label="Valor"><b>{brl(c.valor)}</b></td>
              <td data-label="Comprador" className="col-sec txt">{c.comprador || '—'}{c.condicaoPagamento && <small className="muted bloco">{c.condicaoPagamento}</small>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Histórico de compras de materiais: itens dos pedidos de compra do Sienge no período. */
export default function ComprasPage() {
  const d = useDados();
  const [buscaMat, setBuscaMat] = useState('');
  const [buscaItens, setBuscaItens] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [nMateriais, setNMateriais] = useState(PASSO_MATERIAIS);
  const [nItens, setNItens] = useState(PASSO_ITENS);
  const [nDoMaterial, setNDoMaterial] = useState(PASSO_ITENS);

  const materiais = useMemo(() => {
    const t = paraBusca(buscaMat.trim());
    return (d?.historico ?? []).filter(m => !t || paraBusca(m.insumo).includes(t));
  }, [d, buscaMat]);

  const itens = useMemo(() => {
    const t = paraBusca(buscaItens.trim());
    return (d?.compras ?? []).filter(c => !t || [c.pedido, c.fornecedor, c.obra, c.insumo, c.codigo, c.marca, c.detalhe, c.comprador]
      .some(v => paraBusca(v).includes(t)));
  }, [d, buscaItens]);

  if (!d) return null;
  const r = d.resumo;
  const material = sel ? d.historico.find(m => m.insumoId === sel) : undefined;
  const comprasMaterial = material ? d.compras.filter(c => c.insumoId === material.insumoId) : [];
  const cortado = d.comprasTotal > d.compras.length;
  const escolher = (id: string) => { setSel(sel === id ? null : id); setNDoMaterial(PASSO_ITENS); };

  return (
    <>
      <Kpis>
        <Kpi cor={PALETA[0]} titulo="Total comprado" valor={brl(r.comprado)} sub="pedidos de compra no período" />
        <Kpi cor={PALETA[6]} titulo="Pedidos" valor={fmt(r.pedidos)} sub={`ticket médio ${brl(r.ticketMedio)}`} />
        <Kpi cor={PALETA[1]} titulo="Itens de pedido" valor={fmt(d.comprasTotal)} sub="linhas compradas" />
        <Kpi cor={PALETA[3]} titulo="Materiais diferentes" valor={fmt(r.insumos)} sub={`de ${r.fornecedores} fornecedores`} />
      </Kpis>

      <Card titulo="Materiais comprados">
        <p className="muted">Toque em um material para ver a evolução do preço e cada compra. Preço = preço unitário líquido do pedido.</p>
        <Busca valor={buscaMat} onChange={setBuscaMat} placeholder="Buscar material…" info={`${fmt(materiais.length)} materiais`} />
        {materiais.length ? (
          <div className="tabela-rolagem">
            <table className="resp">
              <thead>
                <tr>
                  <th>Material</th><th className="col-sec">Compras</th><th>Quantidade</th><th>Valor</th><th>Último preço</th>
                  <th className="col-sec">Menor</th><th>Médio</th><th className="col-sec">Maior</th><th>Variação</th>
                </tr>
              </thead>
              <tbody>
                {materiais.slice(0, nMateriais).map(m => (
                  <tr key={m.insumoId} className={`clicavel ${sel === m.insumoId ? 'sel' : ''}`} onClick={() => escolher(m.insumoId)}>
                    <td data-label="Material">{m.insumo}</td>
                    <td data-label="Compras" className="col-sec">{m.compras}</td>
                    <td data-label="Quantidade">{num(m.qtd)} {m.un}</td>
                    <td data-label="Valor">{brl(m.valor)}</td>
                    <td data-label="Último preço" title={`${dataBR(m.ultimaData)} · ${m.ultimoFornecedor}`}>
                      {brlPreco(m.ultimoPreco)} <small className="muted">{dataBR(m.ultimaData)}</small>
                    </td>
                    <td data-label="Menor" className="col-sec">{brlPreco(m.precoMin)}</td>
                    <td data-label="Médio">{brlPreco(m.precoMedio)}</td>
                    <td data-label="Maior" className="col-sec">{brlPreco(m.precoMax)}</td>
                    <td data-label="Variação" className={m.variacao >= 15 ? 'neg' : ''}>{pct(m.variacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <MostrarMais visiveis={nMateriais} total={materiais.length} passo={PASSO_MATERIAIS} onMais={() => setNMateriais(n => n + PASSO_MATERIAIS)} />
          </div>
        ) : <p className="muted">Nenhum material.</p>}
      </Card>

      {material && (
        <div className="cols">
          <Card titulo={`Preço médio por mês — ${material.insumo}`}>
            <p className="muted">
              Último: {brlPreco(material.ultimoPreco)} em {dataBR(material.ultimaData)} ({material.ultimoFornecedor}) ·
              menor {brlPreco(material.precoMin)} · médio {brlPreco(material.precoMedio)} · maior {brlPreco(material.precoMax)} por {material.un}
            </p>
            <Grafico>
              <Line
                data={{
                  labels: material.precoMensal.map(p => rotuloPeriodo(p.mes)),
                  datasets: [{ label: `Preço médio (R$/${material.un})`, data: material.precoMensal.map(p => p.valor), borderColor: PALETA[0], backgroundColor: PALETA[0], tension: 0.25 }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                  scales: { y: { ticks: { callback: v => brlPreco(Number(v)) } }, x: { grid: { display: false } } },
                }}
              />
            </Grafico>
          </Card>
          <Card titulo={`Compras de ${material.insumo}`}>
            <TabelaItens linhas={comprasMaterial} limite={nDoMaterial} semMaterial />
            <MostrarMais visiveis={nDoMaterial} total={comprasMaterial.length} passo={PASSO_ITENS} onMais={() => setNDoMaterial(n => n + PASSO_ITENS)} />
          </Card>
        </div>
      )}

      <Card titulo="Itens dos pedidos de compra">
        <Busca
          valor={buscaItens} onChange={setBuscaItens}
          placeholder="Buscar por pedido, fornecedor, obra, material, marca, comprador…"
          info={itens.length > nItens ? `mostrando ${fmt(nItens)} de ${fmt(itens.length)}` : `${fmt(itens.length)} itens`}
        />
        {cortado && <p className="muted">O período tem {fmt(d.comprasTotal)} itens: aqui aparecem os {fmt(d.compras.length)} mais recentes (os totais acima consideram todos).</p>}
        <TabelaItens linhas={itens} limite={nItens} />
        <MostrarMais visiveis={nItens} total={itens.length} passo={PASSO_ITENS} onMais={() => setNItens(n => n + PASSO_ITENS)} />
      </Card>
      <p className="muted">Fonte: pedidos de compra do Sienge (/purchase-orders e itens). Pedidos cancelados e reprovados ficam de fora.</p>
    </>
  );
}
