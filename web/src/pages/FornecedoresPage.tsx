import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { RankingFornecedor } from '@server/types';
import FornecedorDetalhe from '../components/FornecedorDetalhe';
import Modal from '../components/Modal';
import { Busca, Card, Grafico, Kpi, Kpis, linhaClicavel, MostrarMais, NomeLink, paraBusca } from '../components/ui';
import { RegraGrafico, ValorStatus } from '../components/Status';
import { useDados } from '../hooks/useDashboard';
import { LIMITES, statusAtraso, statusConcentracao, textoStatus } from '../lib/status';
import { useDetalheNaUrl } from '../hooks/useDetalheNaUrl';
import { brl, brlCurto, celular, COR, corStatus, dataBR, listaCurta, pct, rotuloEixo } from '../lib/format';

type Ordem = 'valor' | 'pedidos';
const PASSO = listaCurta() ? 15 : 30;
const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Nome do fornecedor + identificação do cadastro de credores do Sienge. */
function Identificacao({ f }: { f: RankingFornecedor }) {
  const c = f.cadastro;
  return (
    <>
      <NomeLink><b>{f.fornecedor}</b></NomeLink>
      {c ? (
        <>
          {c.fantasia && c.fantasia !== c.nome && <small className="muted bloco">{c.fantasia}</small>}
          <small className="muted bloco">{[c.cnpj && `CNPJ/CPF ${c.cnpj}`, c.cidade].filter(Boolean).join(' · ') || `código ${f.fornecedorId}`}</small>
          {(c.telefone || c.email) && <small className="muted bloco">{[c.telefone, c.email].filter(Boolean).join(' · ')}</small>}
          {!c.ativo && <small className="neg bloco">credor inativo no Sienge</small>}
        </>
      ) : <small className="muted bloco">código {f.fornecedorId} · cadastro ainda não buscado</small>}
    </>
  );
}

/** Fornecedores: quem são (cadastro de credores) e ranking de quanto compramos de cada um. */
export default function FornecedoresPage() {
  const d = useDados();
  const [ordem, setOrdem] = useState<Ordem>('valor');
  const [busca, setBusca] = useState('');
  const [visiveis, setVisiveis] = useState(PASSO);
  // fornecedor aberto na modal fica no endereço (?fornecedor=id): Voltar fecha, F5 mantém, dá para mandar o link
  const { id: aberto, abrir, fechar } = useDetalheNaUrl('fornecedor');

  const lista = useMemo(() => {
    const t = paraBusca(busca.trim());
    const base = (d?.fornecedores ?? []).map((f, i) => ({ ...f, posicao: i + 1 }));
    const ordenada = ordem === 'valor' ? base : [...base].sort((a, b) => b.pedidos - a.pedidos || b.valor - a.valor);
    return ordenada.filter(f => !t || [f.fornecedor, f.cadastro?.fantasia ?? '', f.cadastro?.cnpj ?? '', f.cadastro?.cidade ?? '', f.fornecedorId]
      .some(v => paraBusca(v).includes(t)));
  }, [d, ordem, busca]);

  if (!d) return null;
  const todos = d.fornecedores;
  const top5 = todos.slice(0, 5).reduce((s, f) => s + f.participacao, 0);
  const classeA = todos.filter(f => f.classe === 'A').length;
  const atrasados = todos.reduce((s, f) => s + f.atrasados, 0);
  const pedidos = todos.reduce((s, f) => s + f.pedidos, 0);
  const semCadastro = todos.filter(f => !f.cadastro).length;
  const grafico = (ordem === 'valor' ? todos : [...todos].sort((a, b) => b.pedidos - a.pedidos)).slice(0, 15);
  const entrega = grafico.map(f => statusAtraso(f.atrasados, f.pedidos));
  const fornecedor = aberto ? todos.find(f => f.fornecedorId === aberto) : undefined;
  const posicao = fornecedor ? todos.indexOf(fornecedor) + 1 : 0;

  return (
    <>
      <Kpis>
        <Kpi titulo="Fornecedores" valor={fmt(todos.length)} sub="com pedido no período" />
        <Kpi titulo="Maior fornecedor" valor={todos[0] ? pct(todos[0].participacao) : '—'} sub={todos[0]?.fornecedor ?? 'sem compras'}
          status={todos[0] ? statusConcentracao(todos[0].participacao) : null} />
        <Kpi titulo="Top 5 concentram" valor={pct(Math.round(top5 * 10) / 10)} sub="do valor comprado" />
        <Kpi titulo="Classe A" valor={fmt(classeA)} sub="fornecedores = 80% das compras" />
        <Kpi titulo="Pedidos com entrega em atraso" valor={fmt(atrasados)} sub={pedidos ? `${pct(Math.round((atrasados / pedidos) * 1000) / 10)} dos pedidos` : '—'}
          status={statusAtraso(atrasados, pedidos)} />
      </Kpis>

      <div className="barra-fin">
        <div className="seg" role="group" aria-label="Ordenar ranking por">
          <button className={ordem === 'valor' ? '' : 'sec'} onClick={() => setOrdem('valor')}>Por valor comprado</button>
          <button className={ordem === 'pedidos' ? '' : 'sec'} onClick={() => setOrdem('pedidos')}>Por nº de pedidos</button>
        </div>
        {semCadastro > 0 && <span className="muted">{semCadastro} fornecedor(es) ainda sem cadastro: vêm do Sienge nas próximas sincronizações.</span>}
      </div>

      <Card titulo={ordem === 'valor' ? 'Ranking — valor comprado (top 15)' : 'Ranking — nº de pedidos (top 15)'}>
        <Grafico alto>
          <Bar
            data={{
              labels: grafico.map(f => f.fornecedor),
              datasets: [{
                label: ordem === 'valor' ? 'Valor comprado' : 'Pedidos',
                data: grafico.map(f => (ordem === 'valor' ? f.valor : f.pedidos)),
                // cada fornecedor com a cor do desempenho de entrega: em dia (verde) até muitos pedidos atrasados (vermelho)
                backgroundColor: entrega.map(s => corStatus(s)),
              }],
            }}
            options={{
              indexAxis: 'y', responsive: true, maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { afterLabel: c => textoStatus(entrega[c.dataIndex]) } },
              },
              scales: {
                x: { ticks: { callback: v => (ordem === 'valor' ? brlCurto(Number(v)) : String(v)), maxTicksLimit: celular() ? 3 : 5 } },
                y: { ticks: { callback: rotuloEixo } },
              },
            }}
          />
        </Grafico>
        <RegraGrafico
          regras={{
            bom: 'entregas em dia', melhorar: `até ${LIMITES.atraso[1]}% dos pedidos com atraso`,
            atencao: `até ${LIMITES.atraso[2]}%`, ruim: `mais de ${LIMITES.atraso[2]}% com atraso`,
          }}
          extra="· cor = desempenho de entrega do fornecedor (pedidos com entrega atrasada no Sienge)"
        />
      </Card>

      <Card titulo="Fornecedores">
        <Busca valor={busca} onChange={setBusca} placeholder="Buscar por nome, nome fantasia, CNPJ, cidade ou código…" info={`${fmt(lista.length)} fornecedores`} />
        {lista.length ? (
          <div className="tabela-rolagem">
            <table className="titulos resp">
              <thead>
                <tr>
                  <th>Fornecedor</th><th>Valor comprado</th><th>Part.</th><th className="col-sec">Acum.</th><th>Classe</th><th>Pedidos</th>
                  <th className="col-sec">Ticket médio</th><th className="col-sec">Materiais</th><th className="col-sec">Obras</th><th>Em atraso</th>
                  <th className="col-sec">Última compra</th><th className="col-sec">Principais materiais</th>
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, visiveis).map(f => (
                  <tr key={f.fornecedorId} {...linhaClicavel(() => abrir(f.fornecedorId), `Ver detalhe de ${f.fornecedor}`)}>
                    <td data-label="Fornecedor"><span className="muted">{f.posicao}º </span><Identificacao f={f} /></td>
                    <td data-label="Valor comprado"><b>{brl(f.valor)}</b></td>
                    <td data-label="Participação">{pct(f.participacao)}</td>
                    <td data-label="Acumulado" className="col-sec">{pct(f.acumulado)}</td>
                    <td data-label="Classe"><span className={`tag ${f.classe}`}>{f.classe}</span></td>
                    <td data-label="Pedidos">{f.pedidos}</td>
                    <td data-label="Ticket médio" className="col-sec">{brl(f.ticketMedio)}</td>
                    <td data-label="Materiais" className="col-sec">{f.itens}</td>
                    <td data-label="Obras" className="col-sec">{f.obras}</td>
                    <td data-label="Em atraso"><ValorStatus s={f.atrasados ? statusAtraso(f.atrasados, f.pedidos) : null}>{f.atrasados}</ValorStatus></td>
                    <td data-label="Última compra" className="col-sec">{f.ultimaCompra ? dataBR(f.ultimaCompra) : '—'}</td>
                    <td data-label="Principais materiais" className="col-sec">
                      {f.topInsumos.map(t => <small key={t.insumo} className="bloco">{t.insumo} · {brl(t.valor)}</small>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <MostrarMais visiveis={visiveis} total={lista.length} passo={PASSO} onMais={() => setVisiveis(n => n + PASSO)} />
          </div>
        ) : <p className="muted">Nenhum fornecedor.</p>}
      </Card>
      <p className="muted">
        Fonte: pedidos de compra do Sienge; nome, CNPJ e contato vêm do cadastro de credores (/creditors). Classe pela curva ABC
        (A = até 80% do valor acumulado, B = até 95%, C = o resto). "Em atraso": pedidos com alguma entrega atrasada no Sienge.
      </p>

      <Modal aberto={!!fornecedor} fechar={fechar} titulo={fornecedor?.fornecedor ?? ''}
        subtitulo={fornecedor && `${posicao}º no ranking · classe ${fornecedor.classe} · ${pct(fornecedor.participacao)} das compras`
          + `${fornecedor.cadastro?.cnpj ? ` · CNPJ/CPF ${fornecedor.cadastro.cnpj}` : ''}`}>
        {fornecedor && (
          <FornecedorDetalhe key={fornecedor.fornecedorId} f={fornecedor} historico={d.historico}
            compras={d.compras.filter(c => c.fornecedorId === fornecedor.fornecedorId)} cortado={d.comprasTotal > d.compras.length} />
        )}
      </Modal>
    </>
  );
}
