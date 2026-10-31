import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { CustoObra, TotaisCusto } from '@server/types';
import { Card, Grafico, Tabela, type Coluna } from '../components/ui';
import { useCustosObra } from '../hooks/useCustosObra';
import { useDados } from '../hooks/useDashboard';
import { brl, dataHora, eixoBRL, num, PALETA, pct, rotuloEixo } from '../lib/format';

const LIMITE = 25;
// tipos de insumo do Sienge (campo `category`)
const TIPOS: Record<string, string> = {
  MATERIAL: 'Material', LABOR: 'Mão de obra', EQUIPMENT: 'Equipamento', OTHER: 'Outros', OFFICE_SUPPLY: 'Material de escritório',
  FUELS_AND_LUBRICANTS: 'Combustíveis e lubrificantes', MAINTENANCE_MATERIAL: 'Material de manutenção',
};
const realizado = (t: TotaisCusto) => (t.orcado > 0 ? pct(Math.round((t.atendido / t.orcado) * 1000) / 10) : '—');
const saldo = (v: number) => <span className={v < 0 ? 'neg' : ''}>{brl(v)}</span>;
const opcoes = { responsive: true, maintainAspectRatio: false, scales: { y: eixoBRL, x: { grid: { display: false } } } } as const;
// eixo com nomes de obra: encurta no celular (o nome inteiro aparece no tooltip)
const opcoesObras = { ...opcoes, scales: { ...opcoes.scales, x: { grid: { display: false }, ticks: { callback: rotuloEixo } } } };

/** Colunas orçado × pendente × atendido, comuns às tabelas. */
const colunasCusto = <T extends TotaisCusto>(): Coluna<T>[] => [
  { t: 'Orçado', f: r => brl(r.orcado) },
  { t: 'Pendente', f: r => brl(r.pendente) },
  { t: 'Atendido', f: r => <b>{brl(r.atendido)}</b> },
  { t: '% do orçado', f: r => realizado(r) },
  { t: 'No período', f: r => brl(r.atendidoPeriodo), sec: true },
  { t: 'Saldo', f: r => saldo(r.saldo) },
];

function Detalhe({ o }: { o: CustoObra }) {
  const [todosServ, setTodosServ] = useState(false);
  const [todosIns, setTodosIns] = useState(false);
  const servicos = todosServ ? o.servicos : o.servicos.slice(0, LIMITE);
  const insumos = todosIns ? o.insumos : o.insumos.slice(0, LIMITE);
  return (
    <>
      <div className="cols">
        <Card titulo={`${o.obra} — por tipo de insumo`}>
          <Tabela linhas={o.categorias} colunas={[{ t: 'Tipo', f: r => r.nome }, ...colunasCusto<(typeof o.categorias)[number]>()]} />
        </Card>
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
      </div>

      <Card titulo={`${o.obra} — por serviço (item do orçamento)`}>
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

      <Card titulo={`${o.obra} — por insumo`}>
        <Tabela linhas={insumos} colunas={[
          { t: 'Insumo', f: r => r.insumo },
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
  const [obraSel, setObraSel] = useState('');
  if (!d) return null;
  const compras = d.comprasObra;
  const obras = c?.obras ?? [];
  const atual = obras.find(o => o.obraId === obraSel) ?? obras[0];

  return (
    <>
      <div className="cols">
        <Card titulo="Material comprado por obra (pedidos de compra)">
          {compras.length ? (
            <Grafico>
              <Bar
                data={{ labels: compras.map(o => o.obra), datasets: [{ label: 'Comprado', data: compras.map(o => o.valor), backgroundColor: compras.map((_, i) => PALETA[i % PALETA.length]) }] }}
                options={{ ...opcoesObras, plugins: { legend: { display: false } } }}
              />
            </Grafico>
          ) : <p className="muted">Sem pedidos de compra no período.</p>}
        </Card>
        <Card titulo="Compras por obra">
          <Tabela linhas={compras} colunas={[
            { t: 'Obra', f: o => o.obra },
            { t: 'Comprado', f: o => <b>{brl(o.valor)}</b> },
            { t: '%', f: o => pct(o.participacao) },
            { t: 'Pedidos', f: o => o.pedidos },
            { t: 'Fornecedores', f: o => o.fornecedores, sec: true },
            { t: 'Materiais', f: o => o.insumos, sec: true },
            { t: 'Principais materiais', f: o => o.topInsumos.slice(0, 3).map(t => t.insumo).join(', '), sec: true },
          ]} />
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

      {obras.length > 0 && (
        <>
          <div className="cols">
            <Card titulo="Por obra">
              <Tabela linhas={obras} colunas={[
                { t: 'Obra', f: o => <>{o.obra}{o.atualizado && <small className="muted bloco">Sienge: {dataHora(o.atualizado)}</small>}</> },
                ...colunasCusto<CustoObra>(),
              ]} />
            </Card>
            <Card titulo="Orçado × atendido × pendente">
              <Grafico>
                <Bar
                  data={{
                    labels: obras.map(o => o.obra),
                    datasets: [
                      { label: 'Orçado', data: obras.map(o => o.orcado), backgroundColor: PALETA[6] },
                      { label: 'Atendido', data: obras.map(o => o.atendido), backgroundColor: PALETA[0] },
                      { label: 'Pendente', data: obras.map(o => o.pendente), backgroundColor: PALETA[3] },
                    ],
                  }}
                  options={opcoesObras}
                />
              </Grafico>
            </Card>
          </div>

          {obras.length > 1 && (
            <div className="barra-fin">
              <label>Detalhar a obra
                <select value={atual?.obraId ?? ''} onChange={e => setObraSel(e.target.value)}>
                  {obras.map(o => <option key={o.obraId} value={o.obraId}>{o.obra}</option>)}
                </select>
              </label>
            </div>
          )}
          {atual && <Detalhe key={atual.obraId} o={atual} />}
        </>
      )}

      <p className="muted">
        Fonte: Insumos da Obra do Sienge (bulk-data building/resources), a mesma regra do Relatório de Apropriações de Insumos.
        Orçado = itens do orçamento (sem BDI e sem encargos sociais) · Pendente = saldos de pedidos de compra e de contratos (demanda já
        comprometida) · Atendido = notas fiscais de compra e medições (custo realizado, acumulado) · No período = atendido com data dentro do
        filtro · Saldo = orçado − atendido − pendente (negativo: passou do orçamento).
      </p>
    </>
  );
}
