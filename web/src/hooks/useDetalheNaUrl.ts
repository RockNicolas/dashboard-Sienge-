import { useSearchParams } from 'react-router-dom';

/**
 * Item aberto em modal guardado no endereço (?material=id, ?fornecedor=id, ?obra=id):
 * Voltar do navegador fecha, F5 mantém aberto e dá para mandar o link.
 */
export function useDetalheNaUrl(nome: string) {
  const [params, setParams] = useSearchParams();
  const id = params.get(nome);
  const abrir = (valor: string) => setParams(p => { const n = new URLSearchParams(p); n.set(nome, valor); return n; });
  const fechar = () => setParams(p => { const n = new URLSearchParams(p); n.delete(nome); return n; }, { replace: true });
  return { id, abrir, fechar };
}
