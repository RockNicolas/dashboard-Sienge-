// Períodos do filtro (barra do topo e diálogo de exportação) e do que puxar do Sienge (Configurações).
import type { PeriodoSync } from '@server/types';

/** Data local AAAA-MM-DD (toISOString usaria UTC e viraria o dia depois das 21h). */
export const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface Atalho { id: string; nome: string; from: string; to: string }

/** Períodos que dá para puxar do Sienge (os atalhos andam com o calendário). Mesmo conjunto do servidor. */
export const PERIODOS_SYNC: { id: PeriodoSync; nome: string }[] = [
  { id: 'mes', nome: 'Este mês' },
  { id: 'mes-passado', nome: 'Mês passado' },
  { id: '3m', nome: 'Últimos 3 meses' },
  { id: '6m', nome: 'Últimos 6 meses' },
  { id: 'ano', nome: 'Desde o começo do ano' },
  { id: '12m', nome: 'Últimos 12 meses' },
  { id: 'personalizado', nome: 'Personalizado' },
];
export const nomePeriodoSync = (p: PeriodoSync) => PERIODOS_SYNC.find(x => x.id === p)?.nome ?? p;

/**
 * Atalhos de período. '' = padrão do servidor: o período escolhido em Configurações (`sincronizado`) ou,
 * sem escolha, os últimos 12 meses.
 */
export function atalhosPeriodo(hoje = new Date(), sincronizado = false): Atalho[] {
  const [a, m] = [hoje.getFullYear(), hoje.getMonth()];
  const doze = { id: '12m', nome: 'Últimos 12 meses', from: '', to: '' };
  return [
    ...(sincronizado
      ? [{ id: 'padrao', nome: 'Período sincronizado', from: '', to: '' }, { ...doze, from: diaLocal(new Date(a, m - 11, 1)), to: diaLocal(hoje) }]
      : [doze]),
    { id: 'mes', nome: 'Este mês', from: diaLocal(new Date(a, m, 1)), to: diaLocal(hoje) },
    { id: 'mes-passado', nome: 'Mês passado', from: diaLocal(new Date(a, m - 1, 1)), to: diaLocal(new Date(a, m, 0)) },
    { id: 'ano', nome: 'Este ano', from: diaLocal(new Date(a, 0, 1)), to: diaLocal(hoje) },
  ];
}

/** Id do atalho que corresponde ao período, ou 'outro' (personalizado). */
export const atalhoDe = (atalhos: Atalho[], from: string, to: string) =>
  atalhos.find(p => p.from === from && p.to === to)?.id ?? 'outro';
