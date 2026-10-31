import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CustosObraResponse } from '@server/types';
import { api, NaoAutenticado } from '../api/client';
import { useDashboard } from './useDashboard';

/** Custos por obra (Insumos da Obra do Sienge) com os filtros globais de período e obra. */
export function useCustosObra() {
  const nav = useNavigate();
  const { filtros, versao } = useDashboard();
  const [dados, setDados] = useState<CustosObraResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const versaoVista = useRef(versao);

  useEffect(() => {
    const forcar = versao !== versaoVista.current; // "↻ Sienge" clicado
    versaoVista.current = versao;
    let vivo = true;
    setErro(null);
    setCarregando(true);
    api.custosObra(filtros, forcar)
      .then(d => { if (vivo) setDados(d); })
      .catch(e => {
        if (e instanceof NaoAutenticado) nav('/login', { replace: true });
        else if (vivo) setErro((e as Error).message);
      })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [filtros, versao, nav]);

  return { dados, erro, carregando };
}
