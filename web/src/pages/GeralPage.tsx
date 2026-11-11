import { Link } from 'react-router-dom';
import { GraficoPorPeriodo } from '../components/GraficoPorPeriodo';
import { RegraGrafico } from '../components/Status';
import { Barra, Card, CodInsumo, Kpi, Kpis } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { Variacao } from '../components/Variacao';
import { mesAtual, statusAtraso, statusConcentracao, statusVariacaoPreco, type Status } from '../lib/status';
import { brl, dataBR, pct, rotuloPeriodo } from '../lib/format';

/** Top 5 com barra; cada item leva à tela de detalhe já com a modal aberta (`para`). `cod`: número do insumo. */
const Ranking = ({ itens }: { itens: { k: string; nome: string; valor: number; para?: string; cod?: string; status?: Status | null }[] }) => (
  itens.length ? (
    <ul className="rank">
      {itens.map(i => {
        const conteudo = <><span>{i.cod && <CodInsumo id={i.cod} />}{i.nome}</span><span>{brl(i.valor)}</span><Barra v={i.valor} max={itens[0]?.valor ?? 1} status={i.status} /></>;
        return <li key={i.k}>{i.para ? <Link to={i.para} className="rank-link" title={`Ver detalhe de ${i.nome}`}>{conteudo}</Link> : conteudo}</li>;
      })}
    </ul>
  ) : <p className="muted">Sem compras no período.</p>
);

/** Valor do card + variação contra o período anterior de mesmo tamanho (leva à tela de Comparativos). */
function ComVariacao({ valor, atual, anterior }: { valor: string | number; atual: number; anterior: { valor: number; de: string; ate: string; semDados: boolean } | null }) {
  return (
    <>
      {valor}
      {/* sem o período anterior sincronizado não há com o que comparar: não mostra nada (em vez de um "—") */}
      {anterior && !anterior.semDados && (
        <Link to="/comparativos" className="var-link" title={`Comparado com ${dataBR(anterior.de)} a ${dataBR(anterior.ate)} — ver comparativos`}>
          <Variacao atual={atual} anterior={anterior.valor} semDados={anterior.semDados} />
        </Link>
      )}
    </>
  );
}

/** Visão geral de suprimentos: compras, fornecedores, materiais e obras no período. */
export default function GeralPage() {
  const d = useDados();
  if (!d) return null;
  const r = d.resumo;
  const forn = d.fornecedores.slice(0, 5);
  const materiais = d.historico.slice(0, 5);
  const obras = d.comprasObra.slice(0, 5);
  const maior = d.fornecedores[0];
  const a = d.anterior;
  const ant = (valor: number) => (a ? { valor, de: a.de, ate: a.ate, semDados: a.semDados } : null);

  return (
    <div className="geral">
      <Kpis>
        <Kpi titulo="Total comprado" valor={<ComVariacao valor={brl(r.comprado)} atual={r.comprado} anterior={ant(a?.comprado ?? 0)} />} sub={`${r.pedidos} pedidos de compra`} />
        <Kpi titulo="Ticket médio por pedido" valor={<ComVariacao valor={brl(r.ticketMedio)} atual={r.ticketMedio} anterior={ant(a?.ticketMedio ?? 0)} />} sub="valor médio de cada pedido" />
        <Kpi titulo="Fornecedores" valor={<ComVariacao valor={r.fornecedores} atual={r.fornecedores} anterior={ant(a?.fornecedores ?? 0)} />} sub="com pedido no período" />
        <Kpi titulo="Materiais diferentes" valor={<ComVariacao valor={r.insumos} atual={r.insumos} anterior={ant(a?.insumos ?? 0)} />} sub="insumos comprados" />
        <Kpi titulo="Obras atendidas" valor={<ComVariacao valor={r.obrasComCompra} atual={r.obrasComCompra} anterior={ant(a?.obrasComCompra ?? 0)} />} sub="com pedido de compra" />
        <Kpi titulo="Maior fornecedor" valor={maior ? pct(maior.participacao) : '—'} sub={maior?.fornecedor ?? 'sem compras'}
          status={maior ? statusConcentracao(maior.participacao) : null} />
      </Kpis>

      <Card titulo="Compras por mês (pedidos de compra)">
        <GraficoPorPeriodo pontos={r.compradoMensal.map(p => ({ periodo: p.mes, rotulo: rotuloPeriodo(p.mes), valor: p.valor }))} emAndamento={mesAtual()} />
      </Card>

      <div className="stack">
        <Card titulo="Top 5 fornecedores">
          {/* cor = entrega do fornecedor (em dia / atrasos), como no ranking de Fornecedores */}
          <Ranking itens={forn.map(f => ({
            k: f.fornecedorId, nome: f.fornecedor, valor: f.valor, para: `/fornecedores?fornecedor=${encodeURIComponent(f.fornecedorId)}`,
            status: statusAtraso(f.atrasados, f.pedidos),
          }))} />
          <RegraGrafico regras={{ bom: 'entrega em dia', melhorar: 'poucos atrasos', atencao: 'atrasos frequentes', ruim: 'muitos atrasos' }} />
        </Card>
        <Card titulo="Top 5 materiais por valor comprado">
          {/* cor = quanto o preço pago variou (muita variação = dá para negociar melhor) */}
          <Ranking itens={materiais.map(m => ({
            k: m.insumoId, cod: m.insumoId, nome: m.insumo, valor: m.valor, para: `/compras?material=${encodeURIComponent(m.insumoId)}`,
            status: m.compras > 1 ? statusVariacaoPreco(m.variacao) : null,
          }))} />
          <RegraGrafico regras={{ bom: 'preço estável', melhorar: 'variou um pouco', atencao: 'variou bastante', ruim: 'variou muito' }} />
        </Card>
        <Card titulo="Compras por obra">
          <Ranking itens={obras.map(o => ({ k: o.obraId || '-', nome: o.obra, valor: o.valor, para: o.obraId ? `/custos-obra?obra=${encodeURIComponent(o.obraId)}` : undefined }))} />
        </Card>
      </div>
    </div>
  );
}
