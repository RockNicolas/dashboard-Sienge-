import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DashboardResponse } from '@server/types';
import { api, NaoAutenticado, type FiltrosUI } from '../api/client';

interface Estado {
  dados: DashboardResponse | null;
  carregando: boolean;
  erro: string | null;
  filtros: FiltrosUI;
  aplicar: (f: FiltrosUI) => void;
  atualizar: () => void;
}

const Ctx = createContext<Estado | null>(null);

/** Controller do painel: guarda filtros, busca o dashboard e trata sessão expirada. */
export function DashboardProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [filtros, setFiltros] = useState<FiltrosUI>({ from: '', to: '', obra: '' });
  const [dados, setDados] = useState<DashboardResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (f: FiltrosUI, forcar = false) => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await api.dashboard(f, forcar));
    } catch (e) {
      if (e instanceof NaoAutenticado) nav('/login', { replace: true });
      else setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [nav]);

  useEffect(() => { void carregar(filtros); }, [filtros, carregar]);

  return (
    <Ctx.Provider value={{ dados, carregando, erro, filtros, aplicar: setFiltros, atualizar: () => void carregar(filtros, true) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDashboard(): Estado {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDashboard fora do DashboardProvider');
  return c;
}

/** Atalho para páginas: só renderiza quando há dados. */
export function useDados(): DashboardResponse | null {
  return useDashboard().dados;
}
