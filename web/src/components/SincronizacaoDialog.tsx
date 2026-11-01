import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConfigSync, EstimativaSync, JanelaSync, OpcoesSync } from '@server/types';
import { api } from '../api/client';
import { cliqueFora } from '../lib/dialogo';
import { dataBR } from '../lib/format';
import { diaLocal, PERIODOS_SYNC } from '../lib/periodo';
import { paraBusca } from './ui';

const n = (v: number) => v.toLocaleString('pt-BR');
const PADRAO: ConfigSync = { periodo: 'ano', de: '', ate: '', obras: null, fornecedores: true, insumosObra: true, financeiro: true };

type Modulo = 'fornecedores' | 'insumosObra' | 'financeiro';
const MODULOS: { k: Modulo | null; nome: string; desc: string; api: string }[] = [
  { k: null, nome: 'Compras (pedidos e itens)', desc: 'Histórico de compras, Fornecedores (ranking) e Visão geral', api: '/purchase-orders e os itens de cada pedido' },
  { k: 'fornecedores', nome: 'Cadastro dos fornecedores', desc: 'Nome, CNPJ/CPF, cidade, telefone e e-mail', api: '/creditors' },
  { k: 'insumosObra', nome: 'Insumos da Obra', desc: 'Orçado × pendente × atendido — tela Custos por obra', api: 'bulk-data building/resources (1 por obra)' },
  { k: 'financeiro', nome: 'Financeiro', desc: 'Contas a pagar e a receber, caixa — tela Resultado da obra', api: 'bulk-data outcome, income e bank-movement' },
];

/**
 * O que puxar do Sienge: abre sozinho ao cadastrar o usuário de API (e em Configurações, para mudar).
 * 1º as obras (só elas vêm do Sienge); depois o período e as informações dessas obras, com a cota que isso gasta.
 */
export default function SincronizacaoDialog({ aberto, fechar, aoSalvar, cadastro = false }: {
  aberto: boolean; fechar: () => void; aoSalvar: (c: ConfigSync, janela: JanelaSync) => void; cadastro?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [passo, setPasso] = useState<1 | 2>(1);
  const [opcoes, setOpcoes] = useState<OpcoesSync | null>(null);
  const [c, setC] = useState<ConfigSync>(PADRAO);
  const [est, setEst] = useState<EstimativaSync | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  // ao abrir: começa pelas obras (lista do Sienge: 1 requisição, guardada 30 min) com a escolha salva marcada
  useEffect(() => {
    if (!aberto) return;
    setPasso(1); setOpcoes(null); setEst(null); setErro(''); setBusca('');
    api.sincronizacao()
      .then(o => { setOpcoes(o); setC(o.config ?? PADRAO); })
      .catch(e => setErro((e as Error).message));
  }, [aberto]);

  const obras = useMemo(() => [...(opcoes?.obras ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [opcoes]);
  const visiveis = useMemo(() => {
    const t = paraBusca(busca.trim());
    return obras.filter(o => !t || paraBusca(o.nome).includes(t) || o.id.includes(t));
  }, [obras, busca]);
  const todas = c.obras === null;
  const escolhidas = todas ? obras.length : c.obras!.length;
  const marcada = (id: string) => todas || c.obras!.includes(id);
  const alternarObra = (id: string) => setC(x => {
    const atual = x.obras ?? obras.map(o => o.id); // saindo de "todas": começa com todas marcadas
    return { ...x, obras: atual.includes(id) ? atual.filter(i => i !== id) : [...atual, id] };
  });
  const nomeObra = (id: string) => obras.find(o => o.id === id)?.nome ?? `Obra ${id}`;
  const semObra = !!c.obras && !c.obras.length;
  const datasOk = c.periodo !== 'personalizado' || !!c.de;

  // 2º passo: estimativa a cada mudança; espera um pouco (mudar o período lista os pedidos de novo no Sienge)
  useEffect(() => {
    if (!aberto || !opcoes || passo !== 2) return;
    if (!datasOk || semObra) { setCalculando(false); return; }
    let vivo = true;
    setCalculando(true);
    const t = setTimeout(() => {
      api.estimarSincronizacao(c)
        .then(e => { if (vivo) { setEst(e); setErro(''); } })
        .catch(e => { if (vivo) setErro((e as Error).message); })
        .finally(() => { if (vivo) setCalculando(false); });
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [c, aberto, opcoes, passo, datasOk, semObra]);

  const salvar = async () => {
    setSalvando(true); setErro('');
    try {
      const r = await api.salvarSincronizacao(c);
      aoSalvar(r.config, r.janela);
      fechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally { setSalvando(false); }
  };

  const custo: Record<string, string> = est ? {
    pedidos: `${n(est.rest.listagem + est.rest.itens)} REST`,
    fornecedores: c.fornecedores ? `até ${n(est.rest.fornecedores)} REST` : 'desligado',
    insumosObra: c.insumosObra ? `${n(est.bulk.insumosObra)} bulk` : 'desligado',
    financeiro: c.financeiro ? `${n(est.bulk.financeiro)} bulk + ${n(est.rest.financeiro)} REST` : 'desligado',
  } : {};
  const pctRest = est?.hoje.rest ? Math.min(100, Math.round((est.rest.total / Math.max(1, est.hoje.rest)) * 100)) : 0;
  const passa = !!est && est.hoje.rest != null && est.rest.total > est.hoje.rest;
  const prazo = !est ? '' : !est.plano ? 'escolha o plano da API para comparar com a cota'
    : est.dias <= 1 ? 'cabe na cota de hoje' : `a 1ª carga leva cerca de ${est.dias} dias`;
  const resumoObras = todas ? `todas as ${n(obras.length)} obras`
    : escolhidas <= 3 ? c.obras!.map(nomeObra).join(', ') : `${n(escolhidas)} obras`;

  return (
    <dialog ref={ref} className="dialogo sync" aria-labelledby="sync-titulo"
      onClose={fechar} onClick={e => { if (cliqueFora(e) && !salvando) fechar(); }}>
      <div className="dialogo-caixa">
        <header className="dialogo-topo">
          <div>
            <h2 id="sync-titulo">O que puxar do Sienge</h2>
            <ol className="passos" aria-label="Etapas">
              <li className={passo === 1 ? 'on' : 'feito'} aria-current={passo === 1 ? 'step' : undefined}>1 · Obras</li>
              <li className={passo === 2 ? 'on' : ''} aria-current={passo === 2 ? 'step' : undefined}>2 · Período e informações</li>
            </ol>
          </div>
          <button type="button" className="sec fechar" onClick={fechar} aria-label="Fechar" disabled={salvando}>✕</button>
        </header>

        <div className="dialogo-corpo">
          {opcoes?.mock && <p className="aviso-filtro">Demonstração: obras e estimativa usam os dados de demonstração. Vale de verdade quando o usuário de API estiver cadastrado.</p>}
          {opcoes?.aviso && <div className="aviso-sync">{opcoes.aviso}</div>}
          {erro && <div className="erro">{erro}</div>}
          {!opcoes && !erro && <p className="muted">Buscando as obras no Sienge…</p>}

          {opcoes && passo === 1 && (
            <section className="sync-passo1">
              <p className="sync-pergunta">
                <b>{cadastro ? 'Usuário de API cadastrado. ' : ''}Quais obras você quer acompanhar?</b>
                <span className="muted bloco">Só as obras escolhidas vêm do Sienge (compras, insumos, financeiro). Obra fora da escolha não gasta cota.</span>
              </p>
              <div className="sync-obras-topo">
                <label className="check">
                  <input type="checkbox" checked={todas} onChange={e => setC({ ...c, obras: e.target.checked ? null : [] })} />
                  Todas as obras ({n(obras.length)})
                </label>
                {obras.length > 6 && <input type="search" placeholder="Buscar obra pelo nome ou código…" value={busca} onChange={e => setBusca(e.target.value)} />}
              </div>
              <ul className="lista-obras">
                {visiveis.map(o => (
                  <li key={o.id}>
                    <label className="check">
                      <input type="checkbox" checked={marcada(o.id)} onChange={() => alternarObra(o.id)} />
                      <span className="nome">{o.nome}</span>
                      <small className="muted">cód. {o.id}</small>
                    </label>
                  </li>
                ))}
                {!visiveis.length && <li className="muted vazio">{obras.length ? 'Nenhuma obra com esse nome.' : 'O Sienge não devolveu obras para este usuário de API.'}</li>}
              </ul>
              {semObra && <p className="neg">Marque ao menos uma obra (ou "Todas as obras").</p>}
            </section>
          )}

          {opcoes && passo === 2 && (
            <>
              <p className="sync-escolhidas">
                <span><span className="muted">Obras:</span> <b>{resumoObras}</b></span>
                <button type="button" className="sec mini" onClick={() => setPasso(1)}>Trocar obras</button>
              </p>
              <div className="sync-grade">
                {/* esquerda empilhada (período + informações) e a cota na direita: uma coluna não estica a outra */}
                <div className="sync-col">
                <fieldset className="sync-periodo">
                  <legend>Período</legend>
                  <div className="chips" role="radiogroup" aria-label="Período a puxar do Sienge">
                    {PERIODOS_SYNC.map(p => (
                      <button key={p.id} type="button" role="radio" aria-checked={c.periodo === p.id}
                        className={`chip ${c.periodo === p.id ? 'on' : ''}`} onClick={() => setC({ ...c, periodo: p.id })}>
                        {p.nome}
                      </button>
                    ))}
                  </div>
                  {c.periodo === 'personalizado' && (
                    <div className="campos">
                      <label>De <input type="date" value={c.de} max={diaLocal(new Date())} onChange={e => setC({ ...c, de: e.target.value })} /></label>
                      <label>Até <input type="date" value={c.ate} onChange={e => setC({ ...c, ate: e.target.value })} />
                        <span className="hint">vazio = até hoje</span>
                      </label>
                    </div>
                  )}
                  <p className="muted">
                    {est ? <>Pedidos de compra com data de <b>{dataBR(est.janela.de)}</b> a <b>{dataBR(est.janela.ate)}</b>. </> : null}
                    Os atalhos andam com o calendário ("Este mês" vira o mês seguinte quando ele começar).
                  </p>
                </fieldset>

                <fieldset className="sync-info">
                  <legend>O que vem do Sienge</legend>
                  <ul className="modulos">
                    {MODULOS.map(m => {
                      const ligado = m.k ? c[m.k] : true;
                      return (
                        <li key={m.nome} className={ligado ? 'on' : ''}>
                          <input type="checkbox" checked={ligado} disabled={!m.k} aria-label={m.nome}
                            onChange={e => m.k && setC({ ...c, [m.k]: e.target.checked })} />
                          <div>
                            <b>{m.nome}</b>
                            <small className="bloco">{m.desc}</small>
                            <small className="muted bloco">{m.api}{!m.k ? ' · sempre vem' : ''}</small>
                          </div>
                          <span className="custo">{est ? custo[m.k ?? 'pedidos'] : '…'}</span>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
                </div>

                <fieldset className="sync-cota">
                  <legend>Cota estimada (1ª carga)</legend>
                  {est ? (
                    <>
                      <table className="compacta">
                        <thead><tr><th>Requisições</th><th>REST</th><th>Bulk</th></tr></thead>
                        <tbody>
                          <tr><td>Listar as obras</td><td>{n(est.rest.obras)}</td><td>—</td></tr>
                          <tr>
                            <td>Listar os pedidos do período{est.rest.listagem === 0 && <small className="muted bloco">já listados para esta estimativa (usou {n(est.gastoNaEstimativa)})</small>}</td>
                            <td>{n(est.rest.listagem)}</td><td>—</td>
                          </tr>
                          <tr>
                            <td>Itens dos pedidos<small className="muted bloco">1 por pedido; os já baixados não contam ({n(est.pedidos)} pedidos)</small></td>
                            <td>{n(est.rest.itens)}</td><td>—</td>
                          </tr>
                          {c.fornecedores && <tr><td>Cadastro dos fornecedores<small className="muted bloco">só os que ainda não vieram</small></td><td>até {n(est.rest.fornecedores)}</td><td>—</td></tr>}
                          {c.insumosObra && <tr><td>Insumos da Obra<small className="muted bloco">1 por obra, atualiza a cada 12h</small></td><td>—</td><td>{n(est.bulk.insumosObra)}</td></tr>}
                          {c.financeiro && <tr><td>Financeiro<small className="muted bloco">contas e saldos (REST); pagar, receber e caixa (bulk)</small></td><td>{n(est.rest.financeiro)}</td><td>{n(est.bulk.financeiro)}</td></tr>}
                          <tr className="total"><td>Total</td><td>{n(est.rest.total)}</td><td>{n(est.bulk.total)}</td></tr>
                        </tbody>
                      </table>
                      {est.plano ? (
                        <>
                          <div className={`meter ${passa ? 'neg' : pctRest >= 70 ? 'warn' : ''}`}><i style={{ width: `${pctRest}%` }} /></div>
                          <p className="muted">
                            Plano {est.plano.nome}: {n(est.plano.rest)} REST e {n(est.plano.bulk)} bulk por dia ·
                            hoje ainda dá para usar {n(est.hoje.rest ?? 0)} REST e {n(est.hoje.bulk ?? 0)} bulk.
                            {' '}{est.dias <= 1 ? 'Cabe na cota de hoje.'
                              : `A 1ª carga leva cerca de ${est.dias} dias: o painel baixa o que cabe por dia e continua sozinho no dia seguinte (o que já veio fica salvo).`}
                          </p>
                        </>
                      ) : <p className="muted">Escolha o plano da API em Configurações para comparar com a cota diária.</p>}
                      {est.porObra.length > 0 && (
                        <table className="compacta sync-por-obra">
                          <thead><tr><th>Obra</th><th>Pedidos</th><th>Itens a baixar</th></tr></thead>
                          <tbody>
                            {est.porObra.slice(0, 8).map(o => <tr key={o.id}><td>{o.nome}</td><td>{n(o.pedidos)}</td><td>{n(o.pendentes)}</td></tr>)}
                            {est.porObra.length > 8 && <tr><td className="muted" colSpan={3}>+ {n(est.porObra.length - 8)} obras</td></tr>}
                          </tbody>
                        </table>
                      )}
                      <p className="muted">
                        {todas && est.semObra ? `Inclui ${n(est.semObra)} pedidos sem obra. ` : ''}
                        Depois da 1ª carga, cada atualização (a cada 15 min de uso ou no "↻ Sienge") gasta cerca de {n(est.porAtualizacao.rest)} REST
                        para listar obras e pedidos; só os pedidos novos baixam itens.
                      </p>
                    </>
                  ) : <p className="muted">{calculando ? 'Calculando…' : 'A estimativa aparece aqui.'}</p>}
                </fieldset>
              </div>
            </>
          )}
        </div>

        <footer className="dialogo-acoes">
          {passo === 1 ? (
            <>
              <span className="muted">{opcoes ? (todas ? `Todas as ${n(obras.length)} obras` : `${n(escolhidas)} de ${n(obras.length)} obras`) : ''}</span>
              <button type="button" className="sec" onClick={fechar}>{cadastro ? 'Escolher depois' : 'Cancelar'}</button>
              <button type="button" onClick={() => { setEst(null); setPasso(2); }} disabled={!opcoes || semObra || !obras.length}>Continuar →</button>
            </>
          ) : (
            <>
              <span className={`muted sync-resumo ${passa ? 'neg' : ''}`} aria-live="polite">
                {calculando ? 'Calculando a cota…' : est ? `REST ${n(est.rest.total)} · bulk ${n(est.bulk.total)} · ${prazo}` : ''}
              </span>
              <button type="button" className="sec" onClick={() => setPasso(1)} disabled={salvando}>← Obras</button>
              <button type="button" onClick={salvar} disabled={!est || calculando || salvando || semObra || !datasOk}>
                {salvando ? <><span className="girando" aria-hidden="true" />Salvando…</> : 'Salvar e puxar do Sienge'}
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}
