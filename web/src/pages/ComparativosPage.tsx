import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import type { ComparativoResponse, GrupoComparativo, Metrica } from '@server/types';
import { api, NaoAutenticado } from '../api/client';
import { Card, CodInsumo, Grafico, Kpi, Kpis, MostrarMais, Tabela } from '../components/ui';
import { GraficoPorPeriodo } from '../components/GraficoPorPeriodo';
import { RegraGrafico } from '../components/Status';
import { Variacao } from '../components/Variacao';
import { useDashboard } from '../hooks/useDashboard';
import { brl, brlPreco, COR, corStatus, eixoBRL, num } from '../lib/format';
import { LIMITES, statusMargem } from '../lib/status';
import { diaLocal } from '../lib/periodo';

const GRUPOS: { id: GrupoComparativo; nome: string; por: string }[] = [
  { id: 'semana', nome: 'Semanal', por: 'semana' },
  { id: 'mes', nome: 'Mensal', por: 'mês' },
  { id: 'ano', nome: 'Anual', por: 'ano' },
];
const CHAVE = 'painel.comparativo';
const lerGrupo = (): GrupoComparativo => {
  try { const g = localStorage.getItem(CHAVE); return g === 'semana' || g === 'ano' ? g : 'mes'; } catch { return 'mes'; }
};
const PASSO = 10;
const proximoDia = (s: string) => diaLocal(new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)) + 1));

type Bom = 'subir' | 'descer' | 'neutro';
interface LinhaResumo { nome: string; m: Metrica; fmt: (n: number) => string; bom: Bom }

export default function ComparativosPage() {
  const nav = useNavigate();
  const { filtros } = useDashboard();
  const [grupo, setGrupoEstado] = useState<GrupoComparativo>(lerGrupo);
  const [ref, setRef] = useState(() => diaLocal(new Date()));
  const [d, setD] = useState<ComparativoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verForn, setVerForn] = useState(PASSO);
  const [verMat, setVerMat] = useState(PASSO);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    api.comparativos(grupo, ref, filtros.obra)
      .then(r => { if (vivo) { setD(r); setVerForn(PASSO); setVerMat(PASSO); } })
      .catch(e => {
        if (e instanceof NaoAutenticado) nav('/login', { replace: true });
        else if (vivo) setErro((e as Error).message);
      });
    return () => { vivo = false; };
  }, [grupo, ref, filtros.obra, nav]);

  const setGrupo = (g: GrupoComparativo) => {
    setGrupoEstado(g);
    try { localStorage.setItem(CHAVE, g); } catch { /* sem storage: só não lembra */ }
  };

  if (erro) return <div className="erro">Erro: {erro}</div>;
  if (!d) return <p className="muted">Carregando comparativo…</p>;

  const { atual, anterior, anoAnterior } = d.periodos;
  const por = GRUPOS.find(g => g.id === d.agrupar)!.por;
  const c = d.compras;
  const r = d.resultado;
  const temFinanceiro = [r.receitas, r.despesas].some(m => m.atual || m.anterior || m.anoAnterior);
  const vs = (m: Metrica, bom: Bom) => (
    <>
      <Variacao atual={m.atual} anterior={m.anterior} bom={bom} semDados={anterior.semDados} /> vs {anterior.rotulo}
      {anoAnterior && <> · <Variacao atual={m.atual} anterior={m.anoAnterior} bom={bom} semDados={anoAnterior.semDados} /> vs {anoAnterior.rotulo}</>}
    </>
  );

  const resumo: LinhaResumo[] = [
    { nome: 'Total comprado', m: c.comprado, fmt: brl, bom: 'neutro' },
    { nome: 'Pedidos de compra', m: c.pedidos, fmt: num, bom: 'neutro' },
    { nome: 'Ticket médio por pedido', m: c.ticketMedio, fmt: brl, bom: 'neutro' },
    { nome: 'Itens comprados', m: c.itens, fmt: num, bom: 'neutro' },
    { nome: 'Fornecedores', m: c.fornecedores, fmt: num, bom: 'neutro' },
    { nome: 'Materiais diferentes', m: c.materiais, fmt: num, bom: 'neutro' },
    ...(temFinanceiro ? [
      { nome: 'Receitas (a receber)', m: r.receitas, fmt: brl, bom: 'subir' as Bom },
      { nome: 'Despesas (a pagar)', m: r.despesas, fmt: brl, bom: 'descer' as Bom },
      { nome: 'Resultado (receitas − despesas)', m: r.resultado, fmt: brl, bom: 'subir' as Bom },
      { nome: 'Recebido', m: r.recebido, fmt: brl, bom: 'subir' as Bom },
      { nome: 'Pago', m: r.pago, fmt: brl, bom: 'descer' as Bom },
    ] : []),
  ];

  return (
    <>
      <div className="barra-fin comp-barra">
        <div className="seg" role="group" aria-label="Comparar por">
          {GRUPOS.map(g => <button key={g.id} className={grupo === g.id ? '' : 'sec'} onClick={() => setGrupo(g.id)}>{g.nome}</button>)}
        </div>
        <div className="comp-nav">
          <button className="sec" onClick={() => setRef(anterior.de)} title={`Ir para ${anterior.rotulo}`} aria-label="Período anterior">◀</button>
          <b>{atual.rotulo}</b>
          <button className="sec" onClick={() => setRef(proximoDia(atual.ate))} disabled={d.parcial} title="Próximo período" aria-label="Próximo período">▶</button>
          {d.parcial || <button className="sec" onClick={() => setRef(diaLocal(new Date()))}>Atual</button>}
        </div>
        <span className="muted">
          Comparando com {anterior.rotulo}{anoAnterior && ` e ${anoAnterior.rotulo}`}
          {d.parcial && ` · ${por} em andamento: os anteriores vão até o mesmo dia`}
        </span>
      </div>
      {d.avisos.map(a => <div key={a} className="aviso-sync">{a}</div>)}

      <Kpis>
        <Kpi titulo="Total comprado" valor={brl(c.comprado.atual)} sub={vs(c.comprado, 'neutro')} />
        <Kpi titulo="Pedidos de compra" valor={num(c.pedidos.atual)} sub={vs(c.pedidos, 'neutro')} />
        <Kpi titulo="Ticket médio" valor={brl(c.ticketMedio.atual)} sub={vs(c.ticketMedio, 'neutro')} />
        {temFinanceiro && <>
          <Kpi titulo="Receitas" valor={brl(r.receitas.atual)} sub={vs(r.receitas, 'subir')} />
          <Kpi titulo="Despesas" valor={brl(r.despesas.atual)} sub={vs(r.despesas, 'descer')} />
          <Kpi titulo="Resultado" valor={brl(r.resultado.atual)} sub={vs(r.resultado, 'subir')} status={statusMargem(r.resultado.atual, r.receitas.atual)} />
        </>}
      </Kpis>

      <div className="cols">
        <Card titulo={`Compras por ${por}${d.agrupar === 'ano' ? '' : ' (cinza claro: mesmo período do ano anterior)'}`}>
          <GraficoPorPeriodo
            pontos={d.serie.map(p => ({ periodo: p.periodo, rotulo: p.rotulo, valor: p.comprado }))}
            emAndamento={d.parcial ? d.serie.at(-1)?.periodo : undefined}
            nomePeriodo={por}
            referencia={d.agrupar === 'ano' ? undefined : { rotulo: 'Ano anterior', valores: d.serie.map(p => p.compradoAnoAnterior) }}
          />
        </Card>
        {temFinanceiro ? (
          <Card titulo={`Receitas × despesas por ${por} (vencimento)`}>
            <Grafico>
              <Bar
                data={{
                  labels: d.serie.map(s => s.rotulo),
                  datasets: [
                    { label: 'Receitas', data: d.serie.map(s => s.receitas), backgroundColor: COR.terciaria },
                    { label: 'Despesas', data: d.serie.map(s => s.despesas), backgroundColor: COR.secundaria },
                    // resultado de cada período com a cor da margem: lucro bom, apertado ou prejuízo
                    { label: 'Resultado', data: d.serie.map(s => s.receitas - s.despesas), backgroundColor: d.serie.map(s => corStatus(statusMargem(s.receitas - s.despesas, s.receitas))) },
                  ],
                }}
                options={{ responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL, x: { grid: { display: false } } } }}
              />
            </Grafico>
            <RegraGrafico regras={{
              bom: `margem ${LIMITES.margem[0]}% ou mais`, melhorar: `${LIMITES.margem[1]}% a ${LIMITES.margem[0]}%`,
              atencao: `${LIMITES.margem[2]}% a ${LIMITES.margem[1]}%`, ruim: 'prejuízo',
            }} extra="· cor da barra Resultado de cada período" />
          </Card>
        ) : null}
      </div>

      <Card titulo="Resumo"><TabelaResumo linhas={resumo} d={d} /></Card>

      <Card titulo={`Fornecedores: ${atual.rotulo} × ${anterior.rotulo}`}>
        {d.fornecedores.length ? (
          <>
            <Tabela linhas={d.fornecedores.slice(0, verForn)} colunas={[
              { t: 'Fornecedor', f: x => x.nome },
              { t: atual.rotulo, f: x => brl(x.atual) },
              { t: anterior.rotulo, f: x => brl(x.anterior) },
              { t: 'Diferença', f: x => <span className={x.diferenca > 0 ? 'neg' : x.diferenca < 0 ? 'pos' : ''}>{x.diferenca > 0 ? '+' : ''}{brl(x.diferenca)}</span> },
              { t: 'Variação', f: x => <Variacao atual={x.atual} anterior={x.anterior} semDados={anterior.semDados} /> },
            ]} />
            <MostrarMais visiveis={verForn} total={d.fornecedores.length} passo={PASSO} onMais={() => setVerForn(v => v + PASSO)} />
          </>
        ) : <p className="muted">Sem compras nos dois períodos.</p>}
      </Card>

      <Card titulo={`Materiais: preço e quantidade (${atual.rotulo} × ${anterior.rotulo})`}>
        {d.materiais.length ? (
          <>
            <p className="muted">
              "Efeito do preço" = quanto a compra deste período ficou mais cara (ou mais barata) só pela mudança do preço médio:
              (preço atual − preço anterior) × quantidade atual.
            </p>
            <Tabela linhas={d.materiais.slice(0, verMat)} colunas={[
              { t: 'Material', f: m => <><CodInsumo id={m.insumoId} />{m.insumo}</> },
              { t: 'Qtd atual', f: m => `${num(m.qtdAtual)} ${m.un}` },
              { t: 'Qtd anterior', f: m => `${num(m.qtdAnterior)} ${m.un}`, sec: true },
              { t: 'Variação qtd', f: m => <Variacao atual={m.qtdAtual} anterior={m.qtdAnterior} semDados={anterior.semDados} />, sec: true },
              { t: 'Preço médio atual', f: m => (m.precoAtual == null ? '—' : brlPreco(m.precoAtual)) },
              { t: 'Preço médio anterior', f: m => (m.precoAnterior == null ? '—' : brlPreco(m.precoAnterior)) },
              { t: 'Variação preço', f: m => (m.precoAtual == null || m.precoAnterior == null ? '—' : <Variacao atual={m.precoAtual} anterior={m.precoAnterior} bom="descer" />) },
              { t: 'Efeito do preço', f: m => (m.impactoPreco == null ? '—' : <span className={m.impactoPreco > 0 ? 'neg' : m.impactoPreco < 0 ? 'pos' : ''}>{m.impactoPreco > 0 ? '+' : ''}{brl(m.impactoPreco)}</span>) },
            ]} />
            <MostrarMais visiveis={verMat} total={d.materiais.length} passo={PASSO} onMais={() => setVerMat(v => v + PASSO)} />
          </>
        ) : <p className="muted">Sem compras nos dois períodos.</p>}
      </Card>

      <Card titulo={`Obras: ${atual.rotulo} × ${anterior.rotulo}`}>
        {d.obras.length ? (
          <Tabela linhas={d.obras} colunas={[
            { t: 'Obra', f: o => o.obra },
            { t: 'Comprado', f: o => <>{brl(o.compradoAtual)} <Variacao atual={o.compradoAtual} anterior={o.compradoAnterior} semDados={anterior.semDados} /></> },
            ...(temFinanceiro ? [
              { t: 'Receitas', f: (o: typeof d.obras[number]) => <>{brl(o.receitasAtual)} <Variacao atual={o.receitasAtual} anterior={o.receitasAnterior} bom="subir" semDados={anterior.semDados} /></> },
              { t: 'Despesas', f: (o: typeof d.obras[number]) => <>{brl(o.despesasAtual)} <Variacao atual={o.despesasAtual} anterior={o.despesasAnterior} bom="descer" semDados={anterior.semDados} /></> },
              {
                t: 'Resultado', f: (o: typeof d.obras[number]) => {
                  const a = o.receitasAtual - o.despesasAtual;
                  return <><span className={a < 0 ? 'neg' : ''}>{brl(a)}</span> <Variacao atual={a} anterior={o.receitasAnterior - o.despesasAnterior} bom="subir" semDados={anterior.semDados} /></>;
                },
              },
            ] : []),
          ]} />
        ) : <p className="muted">Sem lançamentos nos dois períodos.</p>}
      </Card>
    </>
  );
}

/** Todos os números lado a lado: atual, anterior e ano anterior, com a variação. */
function TabelaResumo({ linhas, d }: { linhas: LinhaResumo[]; d: ComparativoResponse }) {
  const { atual, anterior, anoAnterior } = d.periodos;
  return (
    <Tabela cartoes={false} linhas={linhas} colunas={[
      { t: 'Indicador', f: l => l.nome },
      { t: atual.rotulo, f: l => <b>{l.fmt(l.m.atual)}</b> },
      { t: anterior.rotulo, f: l => l.fmt(l.m.anterior) },
      { t: 'Var.', f: l => <Variacao atual={l.m.atual} anterior={l.m.anterior} bom={l.bom} semDados={anterior.semDados} /> },
      ...(anoAnterior ? [
        { t: anoAnterior.rotulo, f: (l: LinhaResumo) => l.fmt(l.m.anoAnterior ?? 0) },
        { t: 'Var. ano', f: (l: LinhaResumo) => <Variacao atual={l.m.atual} anterior={l.m.anoAnterior} bom={l.bom} semDados={anoAnterior.semDados} /> },
      ] : []),
    ]} />
  );
}
