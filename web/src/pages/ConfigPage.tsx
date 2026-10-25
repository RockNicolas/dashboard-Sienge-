import { useEffect, useState, type FormEvent } from 'react';
import { Bar } from 'react-chartjs-2';
import type { PlanoSienge, TesteConexao } from '@server/types';
import { api } from '../api/client';
import { Card, Grafico, Kpi, Kpis, Tabela } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { PALETA } from '../lib/format';

interface Form {
  usarMock: boolean; subdominio: string; usuario: string; senha: string;
  endpointConsumo: string; plano: string;
}

const n = (v: number) => v.toLocaleString('pt-BR');

export default function ConfigPage() {
  const { dados, filtros, aplicar } = useDashboard();
  const [f, setF] = useState<Form | null>(null);
  const [planos, setPlanos] = useState<PlanoSienge[]>([]);
  const [senhaDefinida, setSenhaDefinida] = useState(false);
  const [teste, setTeste] = useState<TesteConexao | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void api.config().then(c => {
      setSenhaDefinida(c.senhaDefinida);
      setPlanos(c.planos);
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
    try {
      const c = await api.salvarConfig(entrada());
      setSenhaDefinida(c.senhaDefinida);
      setF({ ...f, senha: '' });
      setMsg({ ok: true, texto: c.mockEfetivo ? 'Salvo. Painel em modo demonstração.' : 'Salvo. Painel usando dados do Sienge.' });
      aplicar({ ...filtros }); // recarrega com a nova configuração
    } catch (err) {
      setMsg({ ok: false, texto: (err as Error).message });
    } finally { setOcupado(false); }
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

  return (
    <div className="cols">
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

      {!q.conectado ? (
        <Card titulo="Cota diária da API">
          <p className="muted">Nenhum usuário de API conectado. Preencha a conexão ao lado e salve para acompanhar a cota e conferir o plano.</p>
        </Card>
      ) : <div className="stack">
        <Card titulo="Cota diária da API">
          <p className="muted">
            Cada chamada ao Sienge conta 1 requisição (a contagem zera todo dia). O botão "↻ Sienge" e a atualização automática consomem a cota.
          </p>
          <p className={`msg ${q.plano.confere === true ? 'ok' : q.plano.confere === false ? 'err' : ''}`}>{q.plano.mensagem}</p>
          <div className={`meter ${nivel}`}><i style={{ width: `${q.limite ? q.pct : 0}%` }} /></div>
          <Kpis>
            <Kpi cor={PALETA[0]} titulo="Usadas hoje" valor={q.usadas} sub={q.limite ? `de ${q.limite}` : 'limite não definido'} />
            <Kpi cor={PALETA[2]} titulo="Restantes" valor={q.restante ?? '—'} sub={q.limite ? `${q.pct}% consumido` : 'selecione o plano ao lado'} />
            <Kpi cor={PALETA[7]} titulo="Erros hoje" valor={q.erros} sub="respostas com falha" />
            <Kpi cor={PALETA[6]} titulo="Bulk-data hoje" valor={q.bulkUsadas} sub={q.bulkLimite ? `de ${q.bulkLimite} (cota separada, financeiro)` : 'cota separada, financeiro'} />
          </Kpis>
          <Grafico>
            <Bar
              data={{
                labels: q.serie.map(s => s.dia.slice(5).split('-').reverse().join('/')),
                datasets: [
                  { label: 'Requisições', data: q.serie.map(s => s.requisicoes), backgroundColor: PALETA[0] },
                  { label: 'Erros', data: q.serie.map(s => s.erros), backgroundColor: PALETA[7] },
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
  );
}
