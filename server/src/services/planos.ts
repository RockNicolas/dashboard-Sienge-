// Planos (pacotes) da API do Sienge e requisições por dia de cada um.
// Fonte: https://api.sienge.com.br/docs/general-information.html — REST e BULK têm cotas separadas.
import type { PlanoSienge } from '../types';

export const PLANOS: PlanoSienge[] = [
  { id: 'free', nome: 'Free', rest: 100, bulk: 10 },
  { id: 'start', nome: 'Start', rest: 1_000, bulk: 20 },
  { id: 'special', nome: 'Special', rest: 2_500, bulk: 50 },
  { id: 'essencial', nome: 'Essencial', rest: 5_000, bulk: 100 },
  { id: 'enterprise', nome: 'Enterprise', rest: 10_000, bulk: 200 },
  { id: 'business', nome: 'Business', rest: 30_000, bulk: 600 },
  { id: 'ultimate', nome: 'Ultimate', rest: 75_000, bulk: 28_800 },
  { id: 'infinity', nome: 'Infinity', rest: 200_000, bulk: 40_000 },
];

export const planoPorId = (id: string | null | undefined) => PLANOS.find(p => p.id === id) ?? null;

/** Plano cujo limite diário REST é igual ao informado pela API. */
export const planoPorLimite = (limite: number | null | undefined) => PLANOS.find(p => p.rest === limite) ?? null;

/** Limite diário REST informado pelo Sienge nos cabeçalhos de rate limit (null se não veio). */
export function limiteDaApi(headers: Record<string, string> | null): number | null {
  const n = Number(headers?.['x-ratelimit-limit-day']);
  return Number.isFinite(n) && n > 0 ? n : null;
}
