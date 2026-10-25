import { useCallback, useEffect, useState, type DragEvent } from 'react';
import type { ImportListagem, ImportPreview } from '@server/types';
import { api } from '../api/client';
import { Card, Kpi, Kpis, Tabela } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { brl, dataBR, dataHora, num, pct } from '../lib/format';

const NOVA = '__nova__';

export default function ImportPage() {
  const { filtros, aplicar } = useDashboard();
  const [lista, setLista] = useState<ImportListagem>({ importacoes: [], obras: [] });
  const [prev, setPrev] = useState<ImportPreview | null>(null);
  const [obra, setObra] = useState('');
  const [obraNova, setObraNova] = useState('');
  const [distribuir, setDistribuir] = useState(true);
  const [sobre, setSobre] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const carregar = useCallback(() => { void api.importacoes().then(setLista); }, []);
  useEffect(carregar, [carregar]);

  const enviar = async (arq: File | undefined) => {
    if (!arq) return;
    setOcupado(true); setMsg(null); setPrev(null);
    try {
      const p = await api.importarPreview(arq);
      setPrev(p);
      setObra(lista.obras[0]?.id ?? NOVA);
      setObraNova('');
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally { setOcupado(false); }
  };

  const soltar = (e: DragEvent) => { e.preventDefault(); setSobre(false); void enviar(e.dataTransfer.files[0]); };

  const confirmar = async () => {
    if (!prev) return;
    setOcupado(true); setMsg(null);
    try {
      const r = await api.importarConfirmar({
        token: prev.token, distribuir,
        ...(obra === NOVA ? { obraNova } : { obraId: obra }),
      });
      setPrev(null);
      setMsg({
        ok: true,
        texto: `${r.importacao.linhas} insumos importados para "${r.importacao.obra}".`
          + (r.substituiu ? ' A importação anterior da mesma obra e período foi substituída.' : '')
          + (r.demoDesativado ? ' O modo demonstração foi desligado.' : ''),
      });
      carregar();
      aplicar({ ...filtros }); // atualiza o painel com os novos dados
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally { setOcupado(false); }
  };

  const excluir = async (id: number, nome: string) => {
    if (!window.confirm(`Excluir a importação "${nome}" e o consumo que ela trouxe?`)) return;
    await api.importarExcluir(id);
    carregar();
    aplicar({ ...filtros });
  };

  return (
    <div className="cols">
      <div className="stack">
        <Card titulo="Importar relatório do Sienge (PDF)">
          <p className="muted">
            Relatório aceito hoje: <b>Curva ABC de Apropriações</b> (consumo por insumo no período). Ele não traz a obra nem as datas dos lançamentos,
            então você escolhe a obra ao importar; o consumo pode ser distribuído pelos meses do período.
          </p>
          <label className={`drop ${sobre ? 'sobre' : ''}`}
            onDragOver={e => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={soltar}>
            <b>{ocupado && !prev ? 'Lendo o PDF…' : 'Arraste o PDF aqui ou clique para escolher'}</b>
            <span>Apenas PDFs exportados do Sienge</span>
            <input type="file" accept="application/pdf,.pdf" disabled={ocupado}
              onChange={e => { void enviar(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {msg && <p><span className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.texto}</span></p>}
        </Card>

        {prev && (
          <Card titulo="Conferir antes de importar">
            <p className="muted">{prev.arquivo} · {prev.tituloTipo}</p>
            <Kpis>
              <Kpi titulo="Período" valor={dataBR(prev.de)} sub={`até ${dataBR(prev.ate)}`} />
              <Kpi titulo="Insumos" valor={prev.linhas} />
              <Kpi titulo="Total apropriado" valor={brl(prev.somaItens)} sub={prev.totalGeral != null ? `total do relatório: ${brl(prev.totalGeral)}` : undefined} />
            </Kpis>
            <p>
              <span className={`confere ${prev.confere ? 'ok' : 'aviso'}`}>
                {prev.confere ? '✓ A soma dos itens confere com o total do relatório' : '⚠ Confira os avisos abaixo antes de importar'}
              </span>
            </p>
            {prev.avisos.map(a => <p key={a}><span className="msg err">{a}</span></p>)}
            <Tabela linhas={prev.amostra} colunas={[
              { t: 'Insumo', f: r => `${r.insumoId} · ${r.insumo}` },
              { t: 'Qtd.', f: r => `${num(r.qtd)} ${r.un}` },
              { t: 'Preço médio', f: r => `R$ ${num(r.precoMedio)}` },
              { t: 'Total', f: r => brl(r.total) },
              { t: '%', f: r => pct(r.participacao) },
            ]} />
            <p className="muted">Mostrando {prev.amostra.length} de {prev.linhas} insumos.</p>

            <div className="form">
              <label>Obra deste relatório
                <select value={obra} onChange={e => setObra(e.target.value)}>
                  {lista.obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  <option value={NOVA}>+ Nova obra…</option>
                </select>
              </label>
              {obra === NOVA && (
                <label>Nome da obra
                  <input value={obraNova} onChange={e => setObraNova(e.target.value)} placeholder="Ex.: Residencial Aurora" autoFocus />
                </label>
              )}
              <label className="full check">
                <input type="checkbox" checked={distribuir} onChange={e => setDistribuir(e.target.checked)} />
                Distribuir o consumo pelos meses do período (proporcional aos dias)
              </label>
              <span className="hint full">
                {distribuir
                  ? 'Os gráficos mensais mostram o consumo repartido por mês. É uma estimativa: o relatório não informa em que dia cada material foi apropriado.'
                  : `Todo o consumo será lançado em ${dataBR(prev.ate)} (fim do período).`}
              </span>
            </div>
            <div className="acoes">
              <button disabled={ocupado || (obra === NOVA && !obraNova.trim())} onClick={confirmar}>Importar</button>
              <button className="sec" disabled={ocupado} onClick={() => setPrev(null)}>Cancelar</button>
            </div>
          </Card>
        )}
      </div>

      <Card titulo="Relatórios importados">
        {lista.importacoes.length === 0
          ? <div className="vazio">Nenhum relatório importado ainda.</div>
          : (
            <Tabela linhas={lista.importacoes} colunas={[
              { t: 'Arquivo', f: r => r.arquivo },
              { t: 'Obra', f: r => r.obra },
              { t: 'Período', f: r => `${dataBR(r.de)} a ${dataBR(r.ate)}` },
              { t: 'Insumos', f: r => r.linhas },
              { t: 'Total', f: r => brl(r.total) },
              { t: 'Importado em', f: r => dataHora(r.criado) },
              { t: '', f: r => <button className="btn-perigo sec" onClick={() => void excluir(r.id, r.arquivo)}>Excluir</button> },
            ]} />
          )}
      </Card>
    </div>
  );
}
