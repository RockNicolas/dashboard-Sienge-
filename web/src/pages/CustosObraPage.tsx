import { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { CompraObra, CustoObra, TotaisCusto } from '@server/types';
import Modal from '../components/Modal';
import { Card, CodInsumo, Grafico, Kpi, Kpis, NomeLink, Tabela, type Coluna } from '../components/ui';
import { useCustosObra } from '../hooks/useCustosObra';
import { useDados } from '../hooks/useDashboard';
import { useDetalheNaUrl } from '../hooks/useDetalheNaUrl';
import { brl, brlCurto, dataHora, eixoBRL, num, PALETA, pct, rotuloEixo } from '../lib/format';

const LIMITE = 25;
// tipos de insumo do Sienge (campo `category`)
const TIPOS: Record<string, string> = {
  MATERIAL: 'Material', LABOR: 'Mão de obra', EQUIPMENT: 'Equipamento', OTHER: 'Outros', OFFICE_SUPPLY: 'Material de escritório',
  FUELS_AND_LUBRICANTS: 'Combustíveis e lubrificantes', MAINTENANCE_MATERIAL: 'Material de manutenção',
};
const realizado = (t: TotaisCusto) => (t.orcado > 0 ? pct(Math.round((t.atendido / t.orcado) * 1000) / 10) : '—');
const saldo = (v: number) => <span className={v < 0 ? 'neg' : ''}>{brl(v)}</span>;
const opcoes = { responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL, x: { grid: { display: false } } } } as const;
// por obra: barras deitadas (o nome da obra cabe no eixo; encurta no celular e aparece inteiro no tooltip).
// Ao lado da tabela, o gráfico cresce junto com ela: cada obra a mais é uma barra a mais.
const opcoesObras = {
  indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false,
  scales: {
    x: { ticks: { callback: (v: string | number) => brlCurto(Number(v)), maxTicksLimit: 5 } },
    y: { grid: { display: false }, ticks: { callback: rotuloEixo } },
  },
};

/** Colunas orçado × pendente × atendido, comuns às tabelas. */
const colunasCusto = <T extends TotaisCusto>(): Coluna<T>[] => [
  { t: 'Orçado', f: r => brl(r.orcado) },
  { t: 'Pendente', f: r => brl(r.pendente) },
  { t: 'Atendido', f: r => <b>{brl(r.atendido)}</b> },
  { t: '% do orçado', f: r => realizado(r) },
  { t: 'No período', f: r => brl(r.atendidoPeriodo), sec: true },
  { t: 'Saldo', f: r => saldo(r.saldo) },
];

/** Detalhe da obra (abre na modal): indicadores, por tipo de insumo, por serviço e por insumo. */
function Detalhe({ o, comprado }: { o: CustoObra; comprado: CompraObra | undefined }) {
  const [todosServ, setTodosServ] = useState(false);
  const [todosIns, setTodosIns] = useState(false);
  const servicos = todosServ ? o.servicos : o.servicos.slice(0, LIMITE);
  const insumos = todosIns ? o.insumos : o.insumos.slice(0, LIMITE);
  return (
    <>
      <Kpis>
        <Kpi cor={PALETA[6]} titulo="Orçado" valor={brl(o.orcado)} sub="itens do orçamento" />
        <Kpi cor={PALETA[0]} titulo="Atendido (realizado)" valor={brl(o.atendido)} sub={`${realizado(o)} do orçado`} />
        <Kpi cor={PALETA[3]} titulo="Pendente (comprometido)" valor={brl(o.pendente)} sub="pedidos e contratos em aberto" />
        <Kpi cor={o.saldo < 0 ? PALETA[7] : PALETA[2]} titulo="Saldo do orçamento" valor={saldo(o.saldo)} sub="orçado − atendido − pendente" />
        <Kpi cor={PALETA[5]} titulo="Atendido no período" valor={brl(o.atendidoPeriodo)} sub="NFs e medições do filtro" />
        <Kpi cor={PALETA[1]} titulo="Comprado (pedidos)" valor={comprado ? brl(comprado.valor) : '—'}
          sub={comprado ? `${comprado.pedidos} pedidos · ${comprado.fornecedores} fornecedores` : 'sem pedido no período'} />
      </Kpis>

      <Card titulo="Por tipo de insumo">
        <Tabela linhas={o.categorias} colunas={[{ t: 'Tipo', f: r => r.nome }, ...colunasCusto<(typeof o.categorias)[number]>()]} />
      </Card>

      <div className="cols">
        <Card titulo="Orçado × atendido por tipo">
          <Grafico>
            <Bar
              data={{
                labels: o.categorias.map(c => c.nome),
                datasets: [
                  { label: 'Orçado', data: o.categorias.map(c => c.orcado), backgroundColor: PALETA[6] },
                  { label: 'Atendido', data: o.categorias.map(c => c.atendido), backgroundColor: PALETA[0] },
                  { label: 'Pendente', data: o.categorias.map(c => c.pendente), backgroundColor: PALETA[3] },
                ],
              }}
              options={opcoes}
            />
          </Grafico>
        </Card>
        <Card titulo="Composição do custo realizado">
          <p className="muted">Quanto do atendido (NFs e medições) é material, mão de obra, equipamento…</p>
          <Grafico>
            <Doughnut
              data={{
                labels: o.categorias.map(c => c.nome),
                datasets: [{ data: o.categorias.map(c => c.atendido), backgroundColor: o.categorias.map((_, i) => PALETA[i % PALETA.length]) }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '58%',
                plugins: {
                  legend: { position: 'right', align: 'center' },
                  tooltip: { callbacks: { label: ctx => `${ctx.label}: ${brl(Number(ctx.parsed))} (${pct(o.atendido ? Math.round((Number(ctx.parsed) / o.atendido) * 1000) / 10 : 0)})` } },
                },
              }}
            />
          </Grafico>
        </Card>
      </div>

      <Card titulo="Por serviço (item do orçamento)">
        <Tabela linhas={servicos} colunas={[
          { t: 'Serviço', f: r => <>{r.edt && <span className="muted">{r.edt} </span>}{r.servico}</> },
          ...colunasCusto<(typeof servicos)[number]>(),
        ]} />
        {o.servicos.length > LIMITE && (
          <button className="sec mais" onClick={() => setTodosServ(!todosServ)}>
            {todosServ ? 'Mostrar só os principais' : `Mostrar todos os ${o.servicos.length} serviços`}
          </button>
        )}
      </Card>

      <Card titulo="Por insumo">
        <Tabela linhas={insumos} colunas={[
          { t: 'Insumo', f: r => <><CodInsumo id={r.insumoId} />{r.insumo}{r.codigo && <small className="muted bloco">cód. aux. {r.codigo}</small>}</> },
          { t: 'Tipo', f: r => TIPOS[r.categoria] ?? r.categoria, sec: true },
          { t: 'Qtd. orçada', f: r => `${num(r.qtdOrcada)} ${r.un}`, sec: true },
          { t: 'Qtd. pendente', f: r => `${num(r.qtdPendente)} ${r.un}`, sec: true },
          { t: 'Qtd. atendida', f: r => `${num(r.qtdAtendida)} ${r.un}` },
          ...colunasCusto<(typeof insumos)[number]>(),
        ]} />
        {o.insumos.length > LIMITE && (
          <button className="sec mais" onClick={() => setTodosIns(!todosIns)}>
            {todosIns ? 'Mostrar só os principais' : `Mostrar todos os ${o.insumos.length} insumos`}
          </button>
        )}
      </Card>
    </>
  );
}

/** Demandas, custos e despesas de material por obra e serviço. */
export default function CustosObraPage() {
  const d = useDados();
  const { dados: c, erro, carregando } = useCustosObra();
  // obra aberta na modal fica no endereço (?obra=id): Voltar fecha, F5 mantém, dá para mandar o link
  const { id: obraAberta, abrir, fechar } = useDetalheNaUrl('obra');
  if (!d) return null;
  const compras = d.comprasObra;
  const obras = c?.obras ?? [];
  const atual = obraAberta ? obras.find(o => o.obraId === obraAberta) : undefined;
  const custoDe = (obraId: string) => obras.some(o => o.obraId === obraId);

  return (
    <>
      <div className="cols">
        {/* com uma obra só (ex.: filtro por obra) o gráfico de uma barra não diz nada: fica só a tabela */}
        {compras.length > 1 && (
          <Card titulo="Material comprado por obra (pedidos de compra)">
            <Grafico linhas={compras.length}>
              <Bar
                data={{
                  labels: compras.map(o => o.obra),
                  datasets: [{ label: 'Comprado', data: compras.map(o => o.valor), backgroundColor: compras.map((_, i) => PALETA[i % PALETA.length]), maxBarThickness: 34 }],
                }}
                options={{ ...opcoesObras, plugins: { legend: { display: false } } }}
              />
            </Grafico>
          </Card>
        )}
        <Card titulo="Compras por obra">
          {compras.length ? (
            <Tabela cartoes={false} linhas={compras}
              aoClicar={o => abrir(o.obraId)} podeClicar={o => custoDe(o.obraId)} tituloLinha={o => `Ver custos de ${o.obra}`}
              colunas={[
                { t: 'Obra', f: o => (custoDe(o.obraId) ? <NomeLink>{o.obra}</NomeLink> : o.obra) },
                { t: 'Comprado', f: o => <b>{brl(o.valor)}</b> },
                { t: '%', f: o => pct(o.participacao) },
                { t: 'Pedidos', f: o => o.pedidos },
                { t: 'Fornecedores', f: o => o.fornecedores, sec: true },
                { t: 'Materiais', f: o => o.insumos, sec: true },
                { t: 'Principais materiais', f: o => o.topInsumos.slice(0, 3).map(t => t.insumo).join(', '), sec: true },
              ]} />
          ) : <p className="muted">Sem pedidos de compra no período.</p>}
        </Card>
      </div>

      <h2 className="secao-pagina">Orçado × pendente × atendido (Insumos da Obra do Sienge)</h2>
      {erro && <div className="erro">Erro: {erro}</div>}
      {c?.aviso && <div className="aviso-sync">{c.aviso}</div>}
      {!!c?.aguardando.length && (
        <p className="muted">Aguardando sincronização: {c.aguardando.map(o => o.nome).join(', ')}.</p>
      )}
      {!c && !erro && <p className="muted">Carregando custos das obras…</p>}
      {c && !obras.length && !carregando && (
        <p className="muted">
          {c.aguardando.length ? 'Os insumos das obras ainda não vieram do Sienge.'
            : 'Nenhuma obra com pedido de compra no período: escolha a obra no filtro do topo para ver os custos dela.'}
        </p>
      )}

      {/* tabela larga (7 colunas): fica ao lado do gráfico só quando cabe como tabela; senão, um embaixo do outro */}
      {obras.length > 0 && (
        <div className="cols">
          <Card titulo="Por obra" largo>
            <p className="muted">Clique em uma obra para ver o detalhe por tipo de insumo, serviço e insumo.</p>
            <Tabela linhas={obras} aoClicar={o => abrir(o.obraId)} tituloLinha={o => `Ver detalhe de ${o.obra}`} colunas={[
              { t: 'Obra', f: o => <><NomeLink>{o.obra}</NomeLink>{o.atualizado && <small className="muted bloco">Sienge: {dataHora(o.atualizado)}</small>}</> },
              ...colunasCusto<CustoObra>(),
            ]} />
          </Card>
          <Card titulo="Orçado × atendido × pendente">
            <Grafico linhas={obras.length} porLinha={2.75}>
              <Bar
                data={{
                  labels: obras.map(o => o.obra),
                  datasets: [
                    { label: 'Orçado', data: obras.map(o => o.orcado), backgroundColor: PALETA[6], maxBarThickness: 16 },
                    { label: 'Atendido', data: obras.map(o => o.atendido), backgroundColor: PALETA[0], maxBarThickness: 16 },
                    { label: 'Pendente', data: obras.map(o => o.pendente), backgroundColor: PALETA[3], maxBarThickness: 16 },
                  ],
                }}
                options={opcoesObras}
              />
            </Grafico>
          </Card>
        </div>
      )}

      <Modal aberto={!!atual} fechar={fechar} titulo={atual?.obra ?? ''}
        subtitulo={atual && `Orçado × pendente × atendido · Insumos da Obra do Sienge${atual.atualizado ? ` · atualizado ${dataHora(atual.atualizado)}` : ''}`}>
        {atual && <Detalhe key={atual.obraId} o={atual} comprado={compras.find(x => x.obraId === atual.obraId)} />}
      </Modal>

      <p className="muted">
        Fonte: Insumos da Obra do Sienge (bulk-data building/resources), a mesma regra do Relatório de Apropriações de Insumos.
        Orçado = itens do orçamento (sem BDI e sem encargos sociais) · Pendente = saldos de pedidos de compra e de contratos (demanda já
        comprometida) · Atendido = notas fiscais de compra e medições (custo realizado, acumulado) · No período = atendido com data dentro do
        filtro · Saldo = orçado − atendido − pendente (negativo: passou do orçamento).
      </p>
    </>
  );
}
