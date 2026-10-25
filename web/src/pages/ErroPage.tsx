import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

/** Mostra uma mensagem amigável quando uma tela falha, em vez de deixar a página em branco. */
export default function ErroPage() {
  const erro = useRouteError();
  const texto = isRouteErrorResponse(erro) ? `${erro.status} ${erro.statusText}` : (erro as Error)?.message ?? 'Erro inesperado';
  return (
    <div className="login-wrap">
      <div className="card login">
        <h2>Algo deu errado nesta tela</h2>
        <div className="erro">{texto}</div>
        <p className="muted">Os dados continuam salvos. Recarregue a página ou volte para o início.</p>
        <Link to="/"><button type="button">Voltar ao início</button></Link>
      </div>
    </div>
  );
}
