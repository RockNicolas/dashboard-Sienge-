import { useEffect, useState, type FormEvent } from 'react';
import { Bar } from 'react-chartjs-2';
import type { TesteConexao } from '@server/types';
import { api } from '../api/client';
import { Card, Grafico, Kpi, Kpis, Tabela } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { PALETA } from '../lib/format';

interface Form {
  usarMock: boolean; subdominio: string; usuario: string; senha: string;
  endpointConsumo: string; limiteDiario: string;
}

export default function ConfigPage() {
  const { dados, filtros, aplicar } = useDashboard();
  const [f, setF] = useState<Form | null>(null);
  const [senhaDefinida, setSenhaDefinida] = useState(false);
  const [teste, setTeste] = useState<TesteConexao | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void api.config().then(c => {
      setSenhaDefinida(c.senhaDefinida);
      setF({
        usarMock: c.usarMock, subdominio: c.subdominio, usuario: c.usuario, senha: '',
        endpointConsumo: c.endpointConsumo, limiteDiario: c.limiteDiario ? String(c.limiteDiario) : '',
      });
    });
  }, []);

  if (!f || !dados) return null;
  const q = dados.quota;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const entrada = () => ({ ...f, limiteDiario: Number(f.limiteDiario) || 0 });

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
            <label>Limite diário de requisições
              <input type="number" min={0} value={f.limiteDiario} onChange={e => set('limiteDiario', e.target.value)} placeholder="0 = sem limite" />
              <span className="hint">Quando atingir, o painel para de chamar o Sienge e usa os dados já salvos.</span>
            </label>
          </div>
          <div className="acoes">
            <button disabled={ocupado}>Salvar</button>
            <button type="button" className="sec" disabled={ocupado} onClick={testar}>Testar conexão</button>
            {teste && <span className={`msg ${teste.ok ? 'ok' : 'err'}`}>{teste.mensagem}</span>}
            {msg && <span className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.texto}</span>}
          </div>
        </form>
      </Card>

      <div className="stack">
        <Card titulo="Cota diária da API">
          <p className="muted">
            Cada chamada ao Sienge conta 1 requisição (a contagem zera todo dia). O botão "↻ Sienge" e a atualização automática consomem a cota.
          </p>
          <div className={`meter ${nivel}`}><i style={{ width: `${q.limite ? q.pct : 0}%` }} /></div>
          <Kpis>
            <Kpi cor={PALETA[0]} titulo="Usadas hoje" valor={q.usadas} sub={q.limite ? `de ${q.limite}` : 'limite não definido'} />
            <Kpi cor={PALETA[2]} titulo="Restantes" valor={q.restante ?? '—'} sub={q.limite ? `${q.pct}% consumido` : 'defina um limite ao lado'} />
            <Kpi cor={PALETA[7]} titulo="Erros hoje" valor={q.erros} sub="respostas com falha" />
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
      </div>
    </div>
  );
}
