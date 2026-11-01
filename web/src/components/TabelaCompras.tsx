import type { Compra } from '@server/types';
import { brl, brlPreco, dataBR, num, SITUACAO_PEDIDO } from '../lib/format';
import { CodInsumo } from './ui';

/** Situação do pedido (status do Sienge) + avisos de autorização e atraso. */
export function SituacaoPedido({ c }: { c: Compra }) {
  return (
    <>
      {c.situacao ? <span className={`tag st-${c.situacao}`}>{SITUACAO_PEDIDO[c.situacao] ?? c.situacao}</span> : '—'}
      {!c.autorizado && <small className="muted bloco">não autorizado</small>}
      {c.atrasado && <small className="neg bloco">entrega em atraso</small>}
    </>
  );
}

/**
 * Itens de pedido de compra com os campos do Sienge. Em espaço estreito cada item vira um cartão.
 * `semMaterial` / `semFornecedor`: na modal do material (ou do fornecedor) a coluna seria igual em todas as linhas.
 */
export function TabelaItens({ linhas, limite, semMaterial, semFornecedor }: {
  linhas: Compra[]; limite: number; semMaterial?: boolean; semFornecedor?: boolean;
}) {
  if (!linhas.length) return <p className="muted">Nenhuma compra.</p>;
  return (
    <div className="tabela-rolagem">
      <table className="titulos resp resp-largo">
        <thead>
          <tr>
            {!semMaterial && <th>Material</th>}
            <th>Data</th><th>Pedido</th><th>Situação</th><th>Obra</th>{!semFornecedor && <th>Fornecedor</th>}
            <th>Quantidade</th><th className="col-sec">Preço unitário</th><th>Preço líquido</th><th>Valor</th><th className="col-sec">Comprador</th>
          </tr>
        </thead>
        <tbody>
          {linhas.slice(0, limite).map((c, i) => (
            <tr key={`${c.pedido}-${c.item}-${i}`}>
              {!semMaterial && (
                <td data-label="Material">
                  <CodInsumo id={c.insumoId} />{c.insumo}
                  {(c.codigo || c.detalhe || c.marca) && (
                    <small className="muted bloco">{[c.codigo && `cód. aux. ${c.codigo}`, c.detalhe, c.marca].filter(Boolean).join(' · ')}</small>
                  )}
                </td>
              )}
              <td data-label="Data">{dataBR(c.data)}</td>
              <td data-label="Pedido"><b>{c.pedido}</b>{c.item > 0 && <small className="muted bloco">item {c.item}</small>}</td>
              <td data-label="Situação"><SituacaoPedido c={c} /></td>
              <td data-label="Obra" className="txt">{c.obra || <span className="muted">Sem obra</span>}</td>
              {!semFornecedor && <td data-label="Fornecedor" className="txt">{c.fornecedor}</td>}
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
