// Períodos do filtro (barra do topo e diálogo de exportação).

/** Data local AAAA-MM-DD (toISOString usaria UTC e viraria o dia depois das 21h). */
export const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface Atalho { id: string; nome: string; from: string; to: string }

/** Atalhos de período. '' = padrão do servidor (últimos 12 meses). */
export function atalhosPeriodo(hoje = new Date()): Atalho[] {
  const [a, m] = [hoje.getFullYear(), hoje.getMonth()];
  return [
    { id: '12m', nome: 'Últimos 12 meses', from: '', to: '' },
    { id: 'mes', nome: 'Este mês', from: diaLocal(new Date(a, m, 1)), to: diaLocal(hoje) },
    { id: 'mes-passado', nome: 'Mês passado', from: diaLocal(new Date(a, m - 1, 1)), to: diaLocal(new Date(a, m, 0)) },
    { id: 'ano', nome: 'Este ano', from: diaLocal(new Date(a, 0, 1)), to: diaLocal(hoje) },
  ];
}

/** Id do atalho que corresponde ao período, ou 'outro' (personalizado). */
export const atalhoDe = (atalhos: Atalho[], from: string, to: string) =>
  atalhos.find(p => p.from === from && p.to === to)?.id ?? 'outro';
