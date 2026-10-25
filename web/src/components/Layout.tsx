import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { DashboardProvider, useDashboard } from '../hooks/useDashboard';
import { dataHora } from '../lib/format';
import { aplicarTema, escuro, lerTema, type Tema } from '../lib/tema';
import { MENU } from '../routes';

const ICONES: Record<string, string> = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  compare: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v9',
  truck: 'M1 6h13v10H1zM14 9h4l3 3v4h-7M6 19.5a1.5 1.5 0 1 0 .01 0M18 19.5a1.5 1.5 0 1 0 .01 0',
  building: 'M4 21V3h10v18M14 9h6v12M8 7h2M8 11h2M8 15h2M2 21h20',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  tag: 'M20 13l-7 7-9-9V4h7zM8 8h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

const Icone = ({ nome }: { nome: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONES[nome]} /></svg>
);

function PilulaCota({ q }: { q: { usadas: number; limite: number; pct: number } }) {
  const nivel = q.limite && q.pct >= 90 ? 'neg' : q.limite && q.pct >= 70 ? 'warn' : '';
  return (
    <Link to="/configuracoes" className={`cota-pill ${nivel}`} title="Cota diária de requisições à API do Sienge">
      <span>API hoje</span><b>{q.usadas}{q.limite ? ` / ${q.limite}` : ''}</b>
      {q.limite > 0 && <i style={{ width: `${q.pct}%` }} />}
    </Link>
  );
}

function Topo() {
  const { pathname } = useLocation();
  const { dados, filtros, aplicar, atualizar, carregando } = useDashboard();
  const [f, setF] = useState(filtros);
  useEffect(() => setF(filtros), [filtros]);
  const titulo = MENU.find(m => (m.end ? pathname === m.to : pathname.startsWith(m.to)))?.label ?? '';

  return (
    <header className="top">
      <div>
        <h1>{titulo}</h1>
        <span className="muted status">
          <i className={`dot ${dados?.mock ? 'demo' : ''}`} />
          {carregando ? 'Atualizando…' : dados && `${dados.mock ? 'Dados de demonstração · ' : ''}atualizado ${dataHora(dados.atualizado)}`}
        </span>
      </div>
      <div className="filtros">
        <label>De <input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></label>
        <label>Até <input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></label>
        <label>Obra
          <select value={f.obra} onChange={e => setF({ ...f, obra: e.target.value })}>
            <option value="">Todas</option>
            {dados?.obrasDisponiveis.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <button onClick={() => aplicar(f)}>Aplicar</button>
        <button className="sec" onClick={atualizar} title="Recarrega do Sienge">↻ Sienge</button>
        <button className="sec" onClick={() => window.print()}>PDF</button>
        {dados && <PilulaCota q={dados.quota} />}
      </div>
    </header>
  );
}

function Conteudo() {
  const nav = useNavigate();
  const { dados, erro } = useDashboard();
  const [tema, setTema] = useState<Tema>(lerTema);
  const [, forcar] = useState(0);

  // acompanha o tema do sistema quando em "auto"
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const h = () => { if (tema === 'auto') { aplicarTema('auto'); forcar(n => n + 1); } };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [tema]);

  const alternar = () => {
    const prox: Tema = escuro(tema) ? 'light' : 'dark';
    aplicarTema(prox);
    setTema(prox);
  };
  const sair = async () => { await api.logout(); nav('/login'); };

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><i>S</i><span>Compras &amp; Consumo<small>Painel Sienge</small></span></div>
        <nav>
          {MENU.map(m => (
            <NavLink key={m.to} to={m.to} end={m.end} title={m.label} className={({ isActive }) => (isActive ? 'on' : '')}>
              <Icone nome={m.icone} />{m.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="user"><span className="avatar">{dados?.usuario?.[0] ?? '?'}</span><span>{dados?.usuario}</span></div>
          <button onClick={alternar} title="Alternar tema"><span>{escuro(tema) ? '☀' : '☾'}</span> <span className="txt">{escuro(tema) ? 'Tema claro' : 'Tema escuro'}</span></button>
          <button onClick={sair} title="Sair"><span>⎋</span> <span className="txt">Sair</span></button>
        </div>
      </aside>
      <div className="content">
        <Topo />
        <main key={`${tema}-${escuro(tema)}`}>
          {erro && <div className="erro">Erro: {erro}</div>}
          {dados ? <Outlet /> : !erro && <p className="muted">Carregando…</p>}
        </main>
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <DashboardProvider>
      <Conteudo />
    </DashboardProvider>
  );
}
