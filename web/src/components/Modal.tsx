import { useEffect, useRef, type ReactNode } from 'react';
import { cliqueFora } from '../lib/dialogo';

/**
 * Modal grande (dialog nativo): Esc, ✕, botão Fechar e clique fora fecham; o foco fica preso dentro dela.
 * Ocupa quase a tela toda (no celular, toda). O rodapé separa a área que rola dos cantos arredondados,
 * para as setas da barra de rolagem ficarem inteiras e clicáveis.
 * O conteúdo só é montado aberto (gráficos precisam de tamanho para desenhar).
 */
export default function Modal({ aberto, fechar, titulo, subtitulo, children }: {
  aberto: boolean; fechar: () => void; titulo: ReactNode; subtitulo?: ReactNode; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog ref={ref} className="dialogo grande" aria-labelledby="modal-titulo"
      onClose={() => { if (aberto) fechar(); }} onClick={e => { if (cliqueFora(e)) fechar(); }}>
      <div className="dialogo-caixa">
        <header className="dialogo-topo">
          <div className="dialogo-titulos">
            <h2 id="modal-titulo">{titulo}</h2>
            {subtitulo && <p className="muted">{subtitulo}</p>}
          </div>
          <button type="button" className="sec fechar" onClick={fechar} aria-label="Fechar">✕</button>
        </header>
        <div className="dialogo-corpo">{aberto && children}</div>
        <footer className="dialogo-rodape">
          <span className="muted">Esc ou clique fora para fechar</span>
          <button type="button" className="sec" onClick={fechar}>Fechar</button>
        </footer>
      </div>
    </dialog>
  );
}
