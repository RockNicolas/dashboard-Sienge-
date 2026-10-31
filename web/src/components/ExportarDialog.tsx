import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, NaoAutenticado, type FiltrosUI } from '../api/client';
import { useDashboard } from '../hooks/useDashboard';
import { nomeDoArquivo, salvarArquivo } from '../lib/arquivo';
import { atalhoDe, atalhosPeriodo } from '../lib/periodo';

type Formato = 'pdf' | 'excel' | 'dashboard';

const FORMATOS: { id: Formato; nome: string; desc: string }[] = [
  { id: 'pdf', nome: 'PDF', desc: 'Relatório para apresentar ou imprimir: indicadores, gráficos e tabelas.' },
  { id: 'excel', nome: 'Excel', desc: 'Dados em tabelas com filtro em cada coluna, uma aba por seção.' },
  { id: 'dashboard', nome: 'Excel com dashboard', desc: 'As tabelas + uma aba Dashboard com indicadores e gráficos do Excel.' },
];

const SECOES = [
  { id: 'geral', nome: 'Visão geral' },
  { id: 'compras', nome: 'Histórico de compras' },
  { id: 'fornecedores', nome: 'Fornecedores' },
  { id: 'custos', nome: 'Custos por obra' },
  { id: 'resultado', nome: 'Resultado da obra' },
] as const;
type SecaoId = (typeof SECOES)[number]['id'];

/** Exportação do relatório: formato, filtros (começam iguais aos da tela) e seções. */
export default function ExportarDialog({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const nav = useNavigate();
  const { dados, filtros } = useDashboard();
  const [formato, setFormato] = useState<Formato>('dashboard');
  const [f, setF] = useState<FiltrosUI>(filtros);
  const [secoes, setSecoes] = useState<SecaoId[]>(SECOES.map(s => s.id));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  // abre/fecha o <dialog> nativo (Esc e foco já tratados pelo navegador); ao abrir, copia os filtros da tela
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) { setF(filtros); setErro(''); d.showModal(); }
    if (!aberto && d.open) d.close();
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const atalhos = atalhosPeriodo();
  const atalho = atalhoDe(atalhos, f.from, f.to);
  const alternar = (s: SecaoId) => setSecoes(l => (l.includes(s) ? l.filter(x => x !== s) : SECOES.map(x => x.id).filter(x => x === s || l.includes(x))));
  const obraNome = dados?.obrasDisponiveis.find(o => o.id === f.obra)?.nome ?? 'todas as obras';

  const gerar = async () => {
    setGerando(true);
    setErro('');
    try {
      if (formato === 'pdf') {
        const { gerarPdf } = await import('../lib/relatorio-pdf'); // jsPDF só carrega quando precisa
        const { blob, nome } = await gerarPdf({ filtros: f, secoes, obraNome });
        salvarArquivo(blob, nome);
      } else {
        const { blob, cabecalho } = await api.exportarExcel(f, secoes, formato === 'dashboard');
        salvarArquivo(blob, nomeDoArquivo(cabecalho, 'relatorio-suprimentos.xlsx'));
      }
      fechar();
    } catch (e) {
      if (e instanceof NaoAutenticado) nav('/login', { replace: true });
      else setErro((e as Error).message || 'Não foi possível gerar o arquivo.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <dialog ref={ref} className="dialogo" onClose={fechar} onClick={e => { if (e.target === ref.current && !gerando) fechar(); }}
      aria-labelledby="exportar-titulo">
      <div className="dialogo-caixa">
        <header className="dialogo-topo">
          <h2 id="exportar-titulo">Exportar relatório</h2>
          <button type="button" className="sec fechar" onClick={fechar} aria-label="Fechar" disabled={gerando}>✕</button>
        </header>

        <div className="dialogo-corpo">
          <fieldset>
            <legend>Formato</legend>
            <div className="formatos" role="radiogroup">
              {FORMATOS.map(x => (
                <button key={x.id} type="button" role="radio" aria-checked={formato === x.id}
                  className={`formato ${formato === x.id ? 'on' : ''}`} onClick={() => setFormato(x.id)}>
                  <b>{x.nome}</b><small>{x.desc}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Filtros da exportação</legend>
            <div className="campos">
              <label>Período
                <select value={atalho} onChange={e => { const p = atalhos.find(x => x.id === e.target.value); if (p) setF({ ...f, from: p.from, to: p.to }); }}>
                  {atalhos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  {atalho === 'outro' && <option value="outro">Personalizado</option>}
                </select>
              </label>
              <label>De <input type="date" value={f.from || dados?.de || ''} onChange={e => setF({ ...f, from: e.target.value })} /></label>
              <label>Até <input type="date" value={f.to || dados?.ate || ''} onChange={e => setF({ ...f, to: e.target.value })} /></label>
              <label>Obra
                <select value={f.obra} onChange={e => setF({ ...f, obra: e.target.value })}>
                  <option value="">Todas as obras</option>
                  {dados?.obrasDisponiveis.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Conteúdo</legend>
            <div className="secoes">
              {SECOES.map(s => (
                <label key={s.id} className={secoes.includes(s.id) ? 'on' : ''}>
                  <input type="checkbox" checked={secoes.includes(s.id)} onChange={() => alternar(s.id)} />{s.nome}
                </label>
              ))}
            </div>
            {formato !== 'pdf' && <p className="muted">No Excel cada seção vira uma ou mais abas, com filtro em todas as colunas.</p>}
          </fieldset>

          {erro && <div className="erro">{erro}</div>}
        </div>

        <footer className="dialogo-acoes">
          <span className="muted">{obraNome}</span>
          <button type="button" className="sec" onClick={fechar} disabled={gerando}>Cancelar</button>
          <button type="button" onClick={gerar} disabled={gerando || !secoes.length}>
            {gerando ? <><span className="girando" aria-hidden="true" />Gerando…</> : `Gerar ${FORMATOS.find(x => x.id === formato)!.nome}`}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
