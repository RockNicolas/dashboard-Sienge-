import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function LoginPage() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      await api.login(usuario, senha);
      nav('/', { replace: true });
    } catch (err) {
      setErro((err as Error).message);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login card" onSubmit={entrar}>
        <div className="brand"><i>S</i><span>Compras &amp; Consumo<small>Painel Sienge · acesso restrito</small></span></div>
        <label>Usuário <input value={usuario} onChange={e => setUsuario(e.target.value)} autoComplete="username" required autoFocus /></label>
        <label>Senha <input type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" required /></label>
        {erro && <div className="erro">{erro}</div>}
        <button>Entrar</button>
      </form>
    </div>
  );
}
