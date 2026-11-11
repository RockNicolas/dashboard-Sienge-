import { useEffect, useState, type FormEvent } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ConfigSync, PlanoSienge, TesteConexao } from '@server/types';
import { api } from '../api/client';
import SincronizacaoDialog from '../components/SincronizacaoDialog';
import { Card, Grafico, Kpi, Kpis, Tabela } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { COR, corStatus, dataBR } from '../lib/format';
import { nomePeriodoSync } from '../lib/periodo';
import { statusCota } from '../lib/status';

interface Form {
  usarMock: boolean; subdominio: string; usuario: string; senha: string;
  endpointConsumo: string; plano: string;
}

const n = (v: number) => v.toLocaleString('pt-BR');
const simNao = (v: boolean) => (v ? 'Sim' : <span className="muted">Não (desligado)</span>);

export default function ConfigPage() {
  const { dados, filtros, aplicar } = useDashboard();
  const [f, setF] = useState<Form | null>(null);
  const [planos, setPlanos] = useState<PlanoSienge[]>([]);
  const [senhaDefinida, setSenhaDefinida] = useState(false);
  const [salvo, setSalvo] = useState({ subdominio: '', usuario: '' }); // credenciais gravadas (para saber se mudaram)
  const [escolha, setEscolha] = useState<ConfigSync | null>(null);  // o que puxar do Sienge
  const [sync, setSync] = useState({ aberto: false, cadastro: false });
  const [teste, setTeste] = useState<TesteConexao | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void api.config().then(c => {
      setSenhaDefinida(c.senhaDefinida);
      setPlanos(c.planos);
      setSalvo({ subdominio: c.subdominio, usuario: c.usuario });
      setEscolha(c.sincronizacao);
      setF({
        usarMock: c.usarMock, subdominio: c.subdominio, usuario: c.usuario, senha: '',
        endpointConsumo: c.endpointConsumo, plano: c.plano,
      });
    });
  }, []);

  if (!f || !dados) return null;
  const q = dados.quota;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const entrada = () => f;

  const testar = async () => {
    setOcupado(true); setTeste(null);
    try { setTeste(await api.testarConfig(entrada())); }
    catch (e) { setTeste({ ok: false, mensagem: (e as Error).message }); }
    finally { setOcupado(false); setTimeout(() => aplicar({ ...filtros }), 0); }
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setOcupado(true); setMsg(null);
    // usuário de API novo ou trocado: pergunta o que puxar antes de gastar a cota
    const credenciaisMudaram = f.subdominio.trim().toLowerCase() !== salvo.subdominio || f.usuario.trim() !== salvo.usuario || !!f.senha;
    try {
      const c = await api.salvarConfig(entrada());
      setSenhaDefinida(c.senhaDefinida);
      setSalvo({ subdominio: c.subdominio, usuario: c.usuario });
      setEscolha(c.sincronizacao);
      setF({ ...f, senha: '' });
      const abrir = !c.mockEfetivo && c.senhaDefinida && (credenciaisMudaram || !c.sincronizacao);
      setMsg({ ok: true, texto: c.mockEfetivo ? 'Salvo. Painel em modo demonstração.' : 'Salvo. Painel usando dados do Sienge.' });
      if (abrir) setSync({ aberto: true, cadastro: true });
      else aplicar({ ...filtros }); // recarrega com a nova configuração
    } catch (err) {
      setMsg({ ok: false, texto: (err as Error).message });
    } finally { setOcupado(false); }
  };

  /** Escolha salva na modal: volta o filtro para o período escolhido (padrão) e já busca no Sienge. */
  const escolhaSalva = (c: ConfigSync) => {
    setEscolha(c);
    setMsg({ ok: true, texto: 'Pronto: o painel vai puxar do Sienge o período e as obras escolhidos.' });
    aplicar({ from: '', to: '', obra: '' });
  };

  const desconectar = async () => {
    if (!confirm('Desconectar do Sienge? Subdomínio, usuário, senha, plano e a contagem de cota serão apagados deste servidor. '
      + 'Compras e consumos já sincronizados continuam salvos.')) return;
    setOcupado(true); setMsg(null); setTeste(null);
    try {
      await api.desconectarSienge();
      setSenhaDefinida(false);
      setF({ ...f, subdominio: '', usuario: '', senha: '', plano: '' });
      setMsg({ ok: true, texto: 'Desconectado do Sienge.' });
      aplicar({ ...filtros });
    } catch (err) {
      setMsg({ ok: false, texto: (err as Error).message });
    } finally { setOcupado(false); }
  };

  const nivel = q.limite && q.pct >= 90 ? 'neg' : q.limite && q.pct >= 70 ? 'warn' : '';
  const headers = q.headers ? Object.entries(q.headers).map(([chave, valor]) => ({ chave, valor })) : [];
  // nomes das obras escolhidas (o filtro de obra do topo já vem só com elas)
  const nomesObras = escolha?.obras?.map(id => dados.obrasDisponiveis.find(o => o.id === id)?.nome ?? `Obra ${id}`) ?? [];

  return (
    <>
    <SincronizacaoDialog aberto={sync.aberto} cadastro={sync.cadastro}
      fechar={() => setSync({ aberto: false, cadastro: false })} aoSalvar={escolhaSalva} />
    <div className="cols">
      <div className="coluna">
      <Card titulo="Conexão com o Sienge">
        <form onSubmit={salvar}>
          <div className="form">
            <label className="full check">
              <input type="checkbox" checked={f.usarMock} onChange={e => set('usarMock', e.target.checked)} />
              Usar dados de demonstração (não chama o Sienge)
            </label>
            <label>Subdomínio da empresa
              <input value={f.subdominio} onChange={e => set('subdominio', e.target.value)} placeholder="suaempresa" autoComplete="off" />
              <span className="hint">O que vem antes de .sienge.com.br no endereço do seu Sienge.</span>
            </label>
            <label>Usuário da API
              <input value={f.usuario} onChange={e => set('usuario', e.target.value)} placeholder="suaempresa-api" autoComplete="off" />
            </label>
            <label>Senha da API
              <input type="password" value={f.senha} onChange={e => set('senha', e.target.value)} autoComplete="new-password"
                placeholder={senhaDefinida ? '•••••••• (salva — deixe vazio para manter)' : 'senha do usuário de API'} />
              <span className="hint">Guardada criptografada neste servidor; nunca volta para o navegador.</span>
            </label>
            <label>Endpoint de consumo (saídas de estoque)
              <input value={f.endpointConsumo} onChange={e => set('endpointConsumo', e.target.value)} placeholder="/stock-movements" />
            </label>
            <label>Plano da API contratado
              <select value={f.plano} onChange={e => set('plano', e.target.value)}>
                <option value="">Selecione o plano</option>
                {planos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome} — {n(p.rest)} req/dia (bulk {n(p.bulk)})</option>
                ))}
              </select>
              <span className="hint">
                Define o limite diário. Ao atingir, o painel para de chamar o Sienge e usa os dados já salvos.
                O plano é conferido com o limite que o próprio Sienge informa.
              </span>
            </label>
          </div>
          <div className="acoes">
            <button disabled={ocupado}>Salvar</button>
            <button type="button" className="sec" disabled={ocupado} onClick={testar}>Testar conexão</button>
            {senhaDefinida && <button type="button" className="sec perigo" disabled={ocupado} onClick={desconectar}>Desconectar</button>}
            {teste && <span className={`msg ${teste.ok ? 'ok' : 'err'}`}>{teste.mensagem}</span>}
            {msg && <span className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.texto}</span>}
          </div>
        </form>
      </Card>

      <Card titulo="O que puxar do Sienge">
        {escolha ? (
          <dl className="ficha">
            <div>
              <dt>Obras</dt>
              <dd title={nomesObras.join(', ')}>
                {escolha.obras ? (nomesObras.length <= 3 ? nomesObras.join(', ') : `${nomesObras.length} obras escolhidas`) : 'Todas'}
              </dd>
            </div>
            <div>
              <dt>Período</dt>
              <dd>
                {nomePeriodoSync(escolha.periodo)}
                {escolha.periodo === 'personalizado' && ` (${dataBR(escolha.de)} a ${escolha.ate ? dataBR(escolha.ate) : 'hoje'})`}
                {dados.janela && escolha.periodo !== 'personalizado' && <small className="muted bloco">{dataBR(dados.janela.de)} a {dataBR(dados.janela.ate)}</small>}
              </dd>
            </div>
            <div><dt>Cadastro dos fornecedores</dt><dd>{simNao(escolha.fornecedores)}</dd></div>
            <div><dt>Insumos da Obra</dt><dd>{simNao(escolha.insumosObra)}</dd></div>
            <div><dt>Financeiro</dt><dd>{simNao(escolha.financeiro)}</dd></div>
          </dl>
        ) : (
          <p className="muted">
            Ainda não escolhido: o painel busca no Sienge o período do filtro de cada tela, em todas as obras.
            Escolha as obras e o período para controlar quanto da cota diária isso gasta.
          </p>
        )}
        <div className="acoes">
          <button type="button" className="sec" disabled={ocupado} onClick={() => setSync({ aberto: true, cadastro: false })}>
            {escolha ? 'Alterar obras, período e informações' : 'Escolher obras, período e informações'}
          </button>
          {dados.mock && <span className="hint">Em demonstração dá para simular; vale quando o usuário de API for cadastrado.</span>}
        </div>
      </Card>
      </div>

      {!q.conectado ? (
        <Card titulo="Cota diária da API">
          <p className="muted">
            Nenhum usuário de API conectado. Cada chamada ao Sienge conta 1 requisição e a contagem zera todo dia;
            REST e bulk-data são cotas separadas, conforme o plano contratado:
          </p>
          <Tabela cartoes={false} linhas={planos} colunas={[
            { t: 'Plano', f: p => (p.id === f.plano ? <b>{p.nome} (escolhido)</b> : p.nome) },
            { t: 'REST por dia', f: p => n(p.rest) },
            { t: 'Bulk por dia', f: p => n(p.bulk) },
          ]} />
          <p className="muted">
            Ao salvar a conexão, o painel pergunta quais obras acompanhar e depois o período e as informações,
            mostrando quanto isso gasta da cota antes de buscar.
          </p>
        </Card>
      ) : <div className="stack">
        <Card titulo="Cota diária da API">
          <p className="muted">
            Cada chamada ao Sienge conta 1 requisição (a contagem zera todo dia). O botão "↻ Sienge" e a atualização automática consomem a cota.
          </p>
          <p className={`msg ${q.plano.confere === true ? 'ok' : q.plano.confere === false ? 'err' : ''}`}>{q.plano.mensagem}</p>
          <div className={`meter ${nivel}`}><i style={{ width: `${q.limite ? q.pct : 0}%` }} /></div>
          <Kpis>
            <Kpi titulo="Usadas hoje" valor={q.usadas} sub={q.limite ? `de ${q.limite}` : 'limite não definido'} status={statusCota(q.pct, q.limite)} />
            <Kpi titulo="Restantes" valor={q.restante ?? '—'} sub={q.limite ? `${q.pct}% consumido` : 'selecione o plano ao lado'} />
            <Kpi titulo="Erros hoje" valor={q.erros} sub="respostas com falha" />
            <Kpi titulo="Bulk-data hoje" valor={q.bulkUsadas} sub={q.bulkLimite ? `de ${q.bulkLimite} (cota separada, financeiro)` : 'cota separada, financeiro'} />
          </Kpis>
          <Grafico>
            <Bar
              data={{
                labels: q.serie.map(s => s.dia.slice(5).split('-').reverse().join('/')),
                datasets: [
                  // cada dia com a cor de quanto da cota foi usado
                  { label: 'Requisições', data: q.serie.map(s => s.requisicoes), backgroundColor: q.serie.map(s => corStatus(q.limite ? statusCota((s.requisicoes / q.limite) * 100, q.limite) : null)) },
                  { label: 'Erros', data: q.serie.map(s => s.erros), backgroundColor: COR.ruim },
                ],
              }}
              options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }}
            />
          </Grafico>
        </Card>

        {headers.length > 0 && (
          <Card titulo="Limites informados pela API">
            <p className="muted">Cabeçalhos de rate limit devolvidos pelo Sienge na última chamada de hoje.</p>
            <Tabela linhas={headers} colunas={[{ t: 'Cabeçalho', f: r => r.chave }, { t: 'Valor', f: r => r.valor }]} />
          </Card>
        )}
      </div>}
    </div>
    </>
  );
}
