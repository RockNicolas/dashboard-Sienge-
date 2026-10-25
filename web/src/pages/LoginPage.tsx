import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import './login.css';

// ---------- utilidades ----------
const CHAVE_LEMBRAR = 'lg-usuario';
const lerLembrado = () => { try { return localStorage.getItem(CHAVE_LEMBRAR) ?? ''; } catch { return ''; } };
const gravarLembrado = (v: string | null) => {
  try { if (v) localStorage.setItem(CHAVE_LEMBRAR, v); else localStorage.removeItem(CHAVE_LEMBRAR); } catch { /* sem storage */ }
};
const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/** Conta de 0 até `alvo` com desaceleração (easeOutCubic). */
function useContador(alvo: number, ms = 1600, atraso = 0): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (semMovimento()) { setV(alvo); return; }
    let raf = 0;
    const t0 = performance.now() + atraso;
    const passo = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / ms));
      setV(alvo * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ms, atraso]);
  return v;
}

// ---------- ícones ----------
const I = {
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  bars: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  truck: 'M1 6h13v10H1zM14 9h4l3 3v4h-7M6 19.5a1.5 1.5 0 1 0 .01 0M18 19.5a1.5 1.5 0 1 0 .01 0',
  compare: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
};
const Ico = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d={d} /></svg>
);

// ---------- cenário: skyline com janelas acendendo + guindaste ----------
function Skyline() {
  const predios = useMemo(() => {
    const r = rng(11);
    const out: { x: number; w: number; h: number; jan: { x: number; y: number; d: number; t: number }[] }[] = [];
    for (let x = -10; x < 1440;) {
      const w = 46 + r() * 74;
      const h = 70 + r() * 150;
      const jan: { x: number; y: number; d: number; t: number }[] = [];
      for (let jy = 240 - h + 14; jy < 228; jy += 17)
        for (let jx = x + 9; jx < x + w - 12; jx += 13)
          if (r() < 0.32) jan.push({ x: jx, y: jy, d: r() * 9, t: 3 + r() * 7 });
      out.push({ x, w, h, jan });
      x += w + 5 + r() * 12;
    }
    return out;
  }, []);
  return (
    <svg className="lg-skyline" viewBox="0 0 1440 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="lg-predio" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2b4a" />
          <stop offset="1" stopColor="#0c1424" />
        </linearGradient>
      </defs>
      {predios.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={240 - p.h} width={p.w} height={p.h} fill="url(#lg-predio)" stroke="rgba(134,182,239,.12)" />
          {p.jan.map((j, k) => (
            <rect key={k} className="lg-janela" x={j.x} y={j.y} width="6" height="8" rx="1"
              style={{ animationDelay: `${j.d}s`, animationDuration: `${j.t}s` }} />
          ))}
        </g>
      ))}
      {/* guindaste */}
      <g className="lg-guindaste" stroke="#86b6ef" strokeWidth="2" fill="none">
        <path d="M1060 240V34M1052 240V34M1052 60l8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12" strokeWidth="1.2" />
        <g className="lg-lanca">
          <path d="M960 34h230M960 44h230M1056 34l-96 10M1056 34l134 10" strokeWidth="1.4" />
          <rect x="962" y="36" width="22" height="16" fill="#86b6ef" fillOpacity=".25" />
          <g className="lg-carro">
            <rect x="1120" y="42" width="12" height="6" fill="#86b6ef" />
            <g className="lg-gancho">
              <path d="M1126 48v62" strokeWidth="1" />
              <rect x="1112" y="110" width="28" height="12" rx="1.5" fill="#eda100" fillOpacity=".85" stroke="none" />
            </g>
          </g>
        </g>
        <circle className="lg-farol" cx="1056" cy="30" r="3" fill="#e34948" stroke="none" />
      </g>
    </svg>
  );
}

// ---------- prévia do painel (decorativa) ----------
const BARRAS = [62, 48, 71, 80, 58, 52, 66, 74, 60, 86];
function Previa() {
  const consumo = useContador(75, 1800, 900);
  const fornecedores = useContador(128, 1800, 1100);
  const classeA = useContador(80, 1800, 1300);
  const pontos = BARRAS.map((v, i) => [24 + i * 32 + 11, 132 - v * 0.82 - 10] as const);
  const linha = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const anel = 2 * Math.PI * 15;

  return (
    <div className="lg-palco" aria-hidden="true">
      <div className="lg-previa">
        <div className="lg-previa-topo">
          <span className="lg-pontos"><i /><i /><i /></span>
          <b>Comprado × Consumido</b>
          <span className="lg-vivo"><i />ao vivo</span>
        </div>
        <svg viewBox="0 0 360 140" className="lg-grafico">
          {[30, 60, 90, 120].map(y => <line key={y} x1="16" x2="350" y1={y} y2={y} className="lg-grade" />)}
          {BARRAS.map((v, i) => (
            <g key={i}>
              <rect className="lg-barra" x={24 + i * 32} y={132 - v} width="10" height={v} rx="3" style={{ animationDelay: `${0.7 + i * 0.07}s` }} />
              <rect className="lg-barra b2" x={36 + i * 32} y={132 - v * 0.74} width="10" height={v * 0.74} rx="3" style={{ animationDelay: `${0.75 + i * 0.07}s` }} />
            </g>
          ))}
          <path d={linha} className="lg-linha" />
          <circle cx={pontos[pontos.length - 1][0]} cy={pontos[pontos.length - 1][1]} r="4" className="lg-ponto" />
        </svg>
      </div>

      <div className="lg-chip c1">
        <svg viewBox="0 0 36 36" className="lg-anel">
          <circle cx="18" cy="18" r="15" />
          <circle cx="18" cy="18" r="15" className="v" strokeDasharray={anel} strokeDashoffset={anel * (1 - consumo / 100)} />
        </svg>
        <div><small>Consumido nas obras</small><b>{Math.round(consumo)}%</b></div>
      </div>
      <div className="lg-chip c2">
        <Ico d={I.truck} className="lg-chip-ico" />
        <div><small>Fornecedores no ranking</small><b>{Math.round(fornecedores)}</b></div>
      </div>
      <div className="lg-chip c3">
        <span className="lg-tag-a">A</span>
        <div><small>Curva ABC</small><b>{Math.round(classeA)}% do gasto</b></div>
      </div>
    </div>
  );
}

const TITULO: [string, boolean][] = [
  ['Compras', false], ['e', false], ['consumo', true], ['das', false], ['suas', false], ['obras,', false],
  ['em', false], ['um', true], ['só', true], ['painel.', true],
];

// ---------- página ----------
export default function LoginPage() {
  const nav = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const [usuario, setUsuario] = useState(lerLembrado);
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(() => !!lerLembrado());
  const [verSenha, setVerSenha] = useState(false);
  const [caps, setCaps] = useState(false);
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'ok'>('livre');
  const [erro, setErro] = useState('');
  const [tremer, setTremer] = useState(false);

  // já logado? vai direto para o painel
  useEffect(() => {
    void fetch('/api/me').then(r => { if (r.ok) nav('/', { replace: true }); }).catch(() => {});
  }, [nav]);

  const mover = (e: MouseEvent<HTMLElement>) => {
    const el = heroRef.current;
    if (!el || semMovimento()) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
    el.style.setProperty('--tx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--ty', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const sair = () => { heroRef.current?.style.setProperty('--tx', '0'); heroRef.current?.style.setProperty('--ty', '0'); };

  const verCaps = (e: KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    if (estado !== 'livre') return;
    setErro('');
    setEstado('enviando');
    try {
      await api.login(usuario.trim(), senha);
      gravarLembrado(lembrar ? usuario.trim() : null);
      setEstado('ok');
      setTimeout(() => nav('/', { replace: true }), semMovimento() ? 0 : 750);
    } catch (err) {
      setEstado('livre');
      setErro((err as Error).message || 'Não foi possível entrar.');
      setTremer(false);
      requestAnimationFrame(() => setTremer(true));
    }
  };

  return (
    <div className={`lg-root ${estado === 'ok' ? 'lg-saindo' : ''}`}>
      <section className="lg-hero" ref={heroRef} onMouseMove={mover} onMouseLeave={sair}>
        <span className="lg-orbe o1" /><span className="lg-orbe o2" /><span className="lg-orbe o3" />

        <div className="lg-marca">
          <span className="lg-logo">S</span>
          <span>Compras &amp; Consumo<small>Painel Sienge</small></span>
        </div>

        <div className="lg-centro">
          <h1 className="lg-titulo">
            {TITULO.map(([p, g], i) => (
              <span key={i} className={`lg-w ${g ? 'lg-grad' : ''}`} style={{ '--i': i } as React.CSSProperties}>{p}&nbsp;</span>
            ))}
          </h1>
          <p className="lg-sub">Do pedido de compra à apropriação na obra: veja quanto foi comprado, quanto cada obra usou e onde está o dinheiro.</p>
          <ul className="lg-feats">
            <li style={{ '--i': 0 } as React.CSSProperties}><Ico d={I.compare} />Comprado × consumido por obra</li>
            <li style={{ '--i': 1 } as React.CSSProperties}><Ico d={I.truck} />Ranking de fornecedores</li>
            <li style={{ '--i': 2 } as React.CSSProperties}><Ico d={I.bars} />Curva ABC e preços</li>
          </ul>
          <Previa />
        </div>

        <Skyline />
      </section>

      <main className="lg-lado">
        <form className={`lg-card ${tremer ? 'lg-treme' : ''}`} onSubmit={entrar} onAnimationEnd={() => setTremer(false)} noValidate>
          <div className="lg-marca lg-marca-mobile"><span className="lg-logo">S</span><span>Compras &amp; Consumo<small>Painel Sienge</small></span></div>
          <h2>Bem-vindo de volta</h2>
          <p className="lg-desc">Entre para acompanhar compras, consumo e fornecedores das suas obras.</p>

          <div className={`lg-campo ${erro ? 'invalido' : ''}`}>
            <input id="lg-usuario" value={usuario} onChange={e => { setUsuario(e.target.value); setErro(''); }}
              placeholder=" " autoComplete="username" autoFocus={!usuario} required spellCheck={false} />
            <label htmlFor="lg-usuario">Usuário</label>
            <Ico d={I.user} className="lg-ico" />
          </div>

          <div className={`lg-campo ${erro ? 'invalido' : ''}`}>
            <input id="lg-senha" type={verSenha ? 'text' : 'password'} value={senha}
              onChange={e => { setSenha(e.target.value); setErro(''); }} onKeyUp={verCaps} onKeyDown={verCaps}
              placeholder=" " autoComplete="current-password" autoFocus={!!usuario} required />
            <label htmlFor="lg-senha">Senha</label>
            <Ico d={I.lock} className="lg-ico" />
            <button type="button" className="lg-olho" onClick={() => setVerSenha(v => !v)}
              aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'} title={verSenha ? 'Ocultar senha' : 'Mostrar senha'}>
              <Ico d={verSenha ? I.eyeOff : I.eye} />
            </button>
          </div>

          <div className={`lg-caps ${caps ? 'on' : ''}`} aria-live="polite">
            <Ico d={I.alert} />Caps Lock está ativado
          </div>

          <label className="lg-lembrar">
            <input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)} />
            <span className="lg-switch" />
            Lembrar meu usuário neste computador
          </label>

          <div className="lg-erro-area" aria-live="assertive">
            {erro && <div className="lg-erro"><Ico d={I.alert} />{erro}</div>}
          </div>

          <button className={`lg-btn ${estado}`} disabled={estado !== 'livre' || !usuario.trim() || !senha}>
            <span className="lg-btn-txt">
              {estado === 'livre' && <>Entrar <Ico d={I.arrow} className="lg-seta" /></>}
              {estado === 'enviando' && <><span className="lg-spin" />Entrando…</>}
              {estado === 'ok' && <><Ico d={I.check} className="lg-ok" />Tudo certo!</>}
            </span>
          </button>

          <p className="lg-rodape"><Ico d={I.shield} />Acesso restrito · a sessão expira em 12 horas</p>
        </form>
      </main>
    </div>
  );
}
