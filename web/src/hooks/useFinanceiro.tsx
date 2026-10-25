import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Agrupamento, FinanceiroResponse } from '@server/types';
import { api, NaoAutenticado } from '../api/client';
import { useDashboard } from './useDashboard';

const CHAVE = 'painel.agrupar';
const lerAgrupar = (): Agrupamento => {
  try { return localStorage.getItem(CHAVE) === 'semana' ? 'semana' : 'mes'; } catch { return 'mes'; }
};

/** Dados do módulo financeiro com os filtros globais (período e obra) + agrupamento mensal/semanal. */
export function useFinanceiro() {
  const nav = useNavigate();
  const { filtros, versao } = useDashboard();
  const [agrupar, setAgruparEstado] = useState<Agrupamento>(lerAgrupar);
  const [dados, setDados] = useState<FinanceiroResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const versaoVista = useRef(versao);

  useEffect(() => {
    const forcar = versao !== versaoVista.current; // "↻ Sienge" clicado
    versaoVista.current = versao;
    let vivo = true;
    setErro(null);
    api.financeiro(filtros, agrupar, forcar)
      .then(d => { if (vivo) setDados(d); })
      .catch(e => {
        if (e instanceof NaoAutenticado) nav('/login', { replace: true });
        else if (vivo) setErro((e as Error).message);
      });
    return () => { vivo = false; };
  }, [filtros, agrupar, versao, nav]);

  const setAgrupar = (a: Agrupamento) => {
    setAgruparEstado(a);
    try { localStorage.setItem(CHAVE, a); } catch { /* sem storage: só não lembra */ }
  };

  return { dados, erro, agrupar, setAgrupar };
}
