import { useMemo, useState } from 'react';
import type { Compra, HistoricoMaterial, RankingFornecedor } from '@server/types';
import { GraficoPorPeriodo } from './GraficoPorPeriodo';
import { TabelaItens } from './TabelaCompras';
import { Card, CodInsumo, Kpi, Kpis, MostrarMais, Tabela } from './ui';
import { mesAtual, statusAtraso } from '../lib/status';
import { brl, brlPreco, dataBR, listaCurta, num, pct, rotuloPeriodo, SITUACAO_PEDIDO } from '../lib/format';

const PASSO = listaCurta() ? 20 : 50;
const MAX_OBRAS = 8;
const fmt = (n: number) => n.toLocaleString('pt-BR');

function agrupar<T>(l: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of l) { const k = chave(x); const g = m.get(k); if (g) g.push(x); else m.set(k, [x]); }
  return m;
}

/** Detalhe do fornecedor: cadastro de credores, situação dos pedidos, obras, compras por mês, materiais (preço × média) e compras. */
export default function FornecedorDetalhe({ f, compras, historico, cortado }: {
  f: RankingFornecedor; compras: Compra[]; historico: HistoricoMaterial[]; cortado: boolean;
}) {
  const [visiveis, setVisiveis] = useState(PASSO);
  const recentes = useMemo(() => [...compras].sort((a, b) => b.data.localeCompare(a.data)), [compras]);

  const mensal = useMemo(() => [...agrupar(compras, c => c.data.slice(0, 7))]
    .map(([mes, l]) => ({ mes, valor: l.reduce((s, c) => s + c.valor, 0) })).sort((a, b) => a.mes.localeCompare(b.mes)), [compras]);

  // preço que este fornecedor cobra em cada material × preço médio do material no período (todos os fornecedores)
  const materiais = useMemo(() => {
    const geral = new Map(historico.map(h => [h.insumoId, h.precoMedio]));
    return [...agrupar(compras, c => c.insumoId)].map(([id, l]) => {
      const qtd = l.reduce((s, c) => s + c.qtd, 0);
      const valor = l.reduce((s, c) => s + c.valor, 0);
      const preco = qtd ? valor / qtd : 0;
      const media = geral.get(id) ?? 0;
      return { id, insumo: l[0].insumo, un: l[0].un, compras: l.length, qtd, valor, preco, media, dif: media ? ((preco - media) / media) * 100 : 0 };
    }).sort((a, b) => b.valor - a.valor);
  }, [compras, historico]);

  const obras = useMemo(() => [...agrupar(compras, c => c.obraId)]
    .map(([id, l]) => ({ id, obra: l[0].obra || 'Sem obra', valor: l.reduce((s, c) => s + c.valor, 0), pedidos: new Set(l.map(c => c.pedido)).size }))
    .sort((a, b) => b.valor - a.valor), [compras]);

  // situação de cada pedido (um pedido pode ter vários itens)
  const pedidos = useMemo(() => [...agrupar(compras, c => c.pedido).values()].map(l => l[0]), [compras]);
  const situacoes = useMemo(() => [...agrupar(pedidos, p => p.situacao)]
    .map(([s, l]) => ({ s, nome: SITUACAO_PEDIDO[s] ?? (s || '—'), n: l.length })).sort((a, b) => b.n - a.n), [pedidos]);
  const naoAutorizados = pedidos.filter(p => !p.autorizado).length;
  const c = f.cadastro;

  return (
    <>
      <Kpis>
        <Kpi titulo="Valor comprado" valor={brl(f.valor)} sub={`${pct(f.participacao)} das compras · classe ${f.classe}`} />
        <Kpi titulo="Pedidos" valor={fmt(f.pedidos)} sub={`ticket médio ${brl(f.ticketMedio)}`} />
        <Kpi titulo="Materiais" valor={fmt(f.itens)} sub="diferentes comprados" />
        <Kpi titulo="Obras atendidas" valor={fmt(f.obras)} sub="com pedido deste fornecedor" />
        <Kpi titulo="Pedidos em atraso" valor={fmt(f.atrasados)} status={statusAtraso(f.atrasados, f.pedidos)}
          sub={f.pedidos ? `${pct(Math.round((f.atrasados / f.pedidos) * 1000) / 10)} dos pedidos` : '—'} />
        <Kpi titulo="Última compra" valor={f.ultimaCompra ? dataBR(f.ultimaCompra) : '—'} sub="data do pedido" />
      </Kpis>

      <div className="cols">
        <Card titulo="Cadastro no Sienge">
          {c ? (
            <dl className="ficha">
              <div><dt>Razão social / nome</dt><dd>{c.nome || '—'}</dd></div>
              <div><dt>Nome fantasia</dt><dd>{c.fantasia || '—'}</dd></div>
              <div><dt>CNPJ / CPF</dt><dd>{c.cnpj || '—'}</dd></div>
              <div><dt>Cidade</dt><dd>{c.cidade || '—'}</dd></div>
              <div><dt>Telefone</dt><dd>{c.telefone || '—'}</dd></div>
              <div><dt>E-mail</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd></div>
              <div><dt>Código no Sienge</dt><dd>{f.fornecedorId}</dd></div>
              <div><dt>Situação</dt><dd>{c.ativo ? 'Ativo' : <span className="neg">Inativo</span>}</dd></div>
            </dl>
          ) : <p className="muted">Código {f.fornecedorId}: o cadastro deste credor ainda não veio do Sienge (vem nas próximas sincronizações).</p>}
          <h3 className="sub-card">Situação dos pedidos</h3>
          <ul className="contagens">
            {situacoes.map(x => <li key={x.s}><span className={`tag st-${x.s}`}>{x.nome}</span><b>{x.n}</b></li>)}
            {f.atrasados > 0 && <li><span className="tag vencida">Entrega em atraso</span><b>{f.atrasados}</b></li>}
            {naoAutorizados > 0 && <li><span className="tag aberta">Não autorizado</span><b>{naoAutorizados}</b></li>}
          </ul>
          <h3 className="sub-card">Obras atendidas</h3>
          <Tabela cartoes={false} linhas={obras.slice(0, MAX_OBRAS)} colunas={[
            { t: 'Obra', f: x => x.obra },
            { t: 'Pedidos', f: x => x.pedidos },
            { t: 'Comprado', f: x => <b>{brl(x.valor)}</b> },
          ]} />
          {obras.length > MAX_OBRAS && <p className="muted">+ {obras.length - MAX_OBRAS} obras (veja todas nas compras abaixo).</p>}
        </Card>
        {/* o gráfico cresce até a altura do cadastro ao lado */}
        <Card titulo="Compras por mês">
          {mensal.length ? (
            <GraficoPorPeriodo pontos={mensal.map(m => ({ periodo: m.mes, rotulo: rotuloPeriodo(m.mes), valor: m.valor }))} emAndamento={mesAtual()} />
          ) : <p className="muted">Sem compras no período.</p>}
        </Card>
      </div>

      <Card titulo="Materiais comprados deste fornecedor">
        <p className="muted">Preço = preço médio que este fornecedor cobrou; média = preço médio do material entre todos os fornecedores no período.</p>
        <Tabela linhas={materiais} colunas={[
          { t: 'Material', f: x => <><CodInsumo id={x.id} />{x.insumo}</> },
          { t: 'Compras', f: x => x.compras, sec: true },
          { t: 'Quantidade', f: x => `${num(x.qtd)} ${x.un}` },
          { t: 'Valor', f: x => <b>{brl(x.valor)}</b> },
          { t: 'Preço deste fornecedor', f: x => brlPreco(x.preco) },
          { t: 'Média geral', f: x => brlPreco(x.media), sec: true },
          {
            t: 'vs. média', f: x => (Math.abs(x.dif) < 0.05 ? '—'
              : <span className={x.dif > 0 ? 'neg' : 'pos'}>{x.dif > 0 ? '+' : ''}{pct(Math.round(x.dif * 10) / 10)}</span>),
          },
        ]} />
      </Card>

      <Card titulo={`Compras de ${f.fornecedor}`}>
        {cortado && <p className="muted">O período tem muitas compras: aqui entram as que estão entre as mais recentes carregadas na tela. A lista completa sai na exportação em Excel.</p>}
        <TabelaItens linhas={recentes} limite={visiveis} semFornecedor />
        <MostrarMais visiveis={visiveis} total={recentes.length} passo={PASSO} onMais={() => setVisiveis(n => n + PASSO)} />
      </Card>
    </>
  );
}
