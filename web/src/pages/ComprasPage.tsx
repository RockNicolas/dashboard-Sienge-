import { useMemo, useState } from 'react';
import MaterialDetalhe from '../components/MaterialDetalhe';
import Modal from '../components/Modal';
import { TabelaItens } from '../components/TabelaCompras';
import { Busca, Card, CodInsumo, Kpi, Kpis, MostrarMais, NomeLink, paraBusca } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { useDetalheNaUrl } from '../hooks/useDetalheNaUrl';
import { brl, brlPreco, dataBR, listaCurta, num, PALETA, pct } from '../lib/format';

const PASSO_ITENS = listaCurta() ? 20 : 50;
const PASSO_MATERIAIS = listaCurta() ? 20 : 60;
const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Histórico de compras de materiais: itens dos pedidos de compra do Sienge no período. */
export default function ComprasPage() {
  const d = useDados();
  const [buscaMat, setBuscaMat] = useState('');
  const [buscaItens, setBuscaItens] = useState('');
  const [nMateriais, setNMateriais] = useState(PASSO_MATERIAIS);
  const [nItens, setNItens] = useState(PASSO_ITENS);

  // material aberto na modal fica no endereço (?material=id): Voltar fecha, F5 mantém, dá para mandar o link
  const { id: sel, abrir, fechar } = useDetalheNaUrl('material');

  const materiais = useMemo(() => {
    const t = paraBusca(buscaMat.trim());
    // busca pelo nome, pelo número do insumo no Sienge ou pelo código auxiliar
    return (d?.historico ?? []).filter(m => !t || [m.insumo, m.insumoId, m.codigo].some(v => paraBusca(v).includes(t)));
  }, [d, buscaMat]);

  const itens = useMemo(() => {
    const t = paraBusca(buscaItens.trim());
    return (d?.compras ?? []).filter(c => !t || [c.pedido, c.fornecedor, c.obra, c.insumo, c.insumoId, c.codigo, c.marca, c.detalhe, c.comprador]
      .some(v => paraBusca(v).includes(t)));
  }, [d, buscaItens]);

  if (!d) return null;
  const r = d.resumo;
  const material = sel ? d.historico.find(m => m.insumoId === sel) : undefined;
  const comprasMaterial = material ? d.compras.filter(c => c.insumoId === material.insumoId) : [];
  const cortado = d.comprasTotal > d.compras.length;

  return (
    <>
      <Kpis>
        <Kpi cor={PALETA[0]} titulo="Total comprado" valor={brl(r.comprado)} sub="pedidos de compra no período" />
        <Kpi cor={PALETA[6]} titulo="Pedidos" valor={fmt(r.pedidos)} sub={`ticket médio ${brl(r.ticketMedio)}`} />
        <Kpi cor={PALETA[1]} titulo="Itens de pedido" valor={fmt(d.comprasTotal)} sub="linhas compradas" />
        <Kpi cor={PALETA[3]} titulo="Materiais diferentes" valor={fmt(r.insumos)} sub={`de ${r.fornecedores} fornecedores`} />
      </Kpis>

      <Card titulo="Materiais comprados">
        <p className="muted">Clique em um material para ver o detalhe: preço em cada compra, preço por fornecedor e todas as compras. Preço = preço unitário líquido do pedido.</p>
        <Busca valor={buscaMat} onChange={setBuscaMat} placeholder="Buscar material ou nº do insumo…" info={`${fmt(materiais.length)} materiais`} />
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
                  <tr key={m.insumoId} className={`clicavel ${sel === m.insumoId ? 'sel' : ''}`} onClick={() => abrir(m.insumoId)}
                    tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(m.insumoId); } }}
                    title={`Ver detalhe de ${m.insumo}`}>
                    <td data-label="Material"><CodInsumo id={m.insumoId} /><NomeLink>{m.insumo}</NomeLink></td>
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

      <Card titulo="Itens dos pedidos de compra">
        <Busca
          valor={buscaItens} onChange={setBuscaItens}
          placeholder="Buscar por pedido, fornecedor, obra, material, nº do insumo, marca, comprador…"
          info={itens.length > nItens ? `mostrando ${fmt(nItens)} de ${fmt(itens.length)}` : `${fmt(itens.length)} itens`}
        />
        {cortado && <p className="muted">O período tem {fmt(d.comprasTotal)} itens: aqui aparecem os {fmt(d.compras.length)} mais recentes (os totais acima consideram todos).</p>}
        <TabelaItens linhas={itens} limite={nItens} />
        <MostrarMais visiveis={nItens} total={itens.length} passo={PASSO_ITENS} onMais={() => setNItens(n => n + PASSO_ITENS)} />
      </Card>
      <p className="muted">Fonte: pedidos de compra do Sienge (/purchase-orders e itens). Pedidos cancelados e reprovados ficam de fora.</p>

      <Modal aberto={!!material} fechar={fechar} titulo={material && <><CodInsumo id={material.insumoId} />{material.insumo}</>}
        subtitulo={material && [/^\d+$/.test(material.insumoId) && `insumo ${material.insumoId} no Sienge`, material.codigo && `cód. auxiliar ${material.codigo}`,
          `${material.compras} compras`, `${material.fornecedores} fornecedores`, `${material.pedidos} pedidos`, `unidade ${material.un}`]
          .filter(Boolean).join(' · ')}>
        {material && <MaterialDetalhe key={material.insumoId} m={material} compras={comprasMaterial} cortado={cortado} />}
      </Modal>
    </>
  );
}
