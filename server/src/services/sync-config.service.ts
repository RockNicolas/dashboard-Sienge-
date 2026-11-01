// O que puxar do Sienge, escolhido ao cadastrar o usuário de API: período, obras e módulos.
// O período vira a "janela" da sincronização: o Sienge só é consultado dentro dela (e só nas obras escolhidas);
// o filtro de período das telas olha o que já veio, sem gastar cota a cada troca.
import { ConfigModel } from '../models/ConfigModel';
import type { ConfigSync, JanelaSync, PeriodoSync } from '../types';

export const PERIODOS_SYNC: { id: PeriodoSync; nome: string }[] = [
  { id: 'mes', nome: 'Este mês' },
  { id: 'mes-passado', nome: 'Mês passado' },
  { id: '3m', nome: 'Últimos 3 meses' },
  { id: '6m', nome: 'Últimos 6 meses' },
  { id: 'ano', nome: 'Desde o começo do ano' },
  { id: '12m', nome: 'Últimos 12 meses' },
  { id: 'personalizado', nome: 'Personalizado' },
];

const CHAVE = 'sincronizacao';
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ID_OBRA = /^[\w-]{1,30}$/;
/** Data local AAAA-MM-DD (toISOString usaria UTC e viraria o dia depois das 21h). */
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const invalido = (msg: string) => Object.assign(new Error(msg), { status: 400 });

/** Datas (data do pedido) que o período representa hoje. Os atalhos andam com o calendário. */
export function janelaSync(c: Pick<ConfigSync, 'periodo' | 'de' | 'ate'>, hoje = new Date()): JanelaSync {
  const [a, m] = [hoje.getFullYear(), hoje.getMonth()];
  const ate = dia(hoje);
  switch (c.periodo) {
    case 'mes': return { de: dia(new Date(a, m, 1)), ate };
    case 'mes-passado': return { de: dia(new Date(a, m - 1, 1)), ate: dia(new Date(a, m, 0)) };
    case '3m': return { de: dia(new Date(a, m - 2, 1)), ate };
    case '6m': return { de: dia(new Date(a, m - 5, 1)), ate };
    case 'ano': return { de: dia(new Date(a, 0, 1)), ate };
    case '12m': return { de: dia(new Date(a, m - 11, 1)), ate };
    default: return { de: c.de, ate: c.ate || ate };
  }
}

/** Valida o que veio da tela (lança erro 400 com a mensagem para o usuário). */
export function lerConfigSync(corpo: unknown): ConfigSync {
  const o = (corpo ?? {}) as Record<string, unknown>;
  const periodo = PERIODOS_SYNC.find(p => p.id === o.periodo)?.id;
  if (!periodo) throw invalido('Escolha o período a puxar do Sienge.');
  const de = typeof o.de === 'string' ? o.de : '';
  const ate = typeof o.ate === 'string' ? o.ate : '';
  if (periodo === 'personalizado') {
    if (!DATA.test(de)) throw invalido('Informe a data inicial do período.');
    if (ate && !DATA.test(ate)) throw invalido('Data final no formato AAAA-MM-DD.');
    if (ate && ate < de) throw invalido('A data final é antes da inicial.');
    if (de > dia(new Date())) throw invalido('A data inicial é depois de hoje.');
  }
  let obras: string[] | null = null;
  if (Array.isArray(o.obras)) {
    obras = [...new Set(o.obras.filter((x): x is string => typeof x === 'string' && ID_OBRA.test(x)))];
    if (!obras.length) throw invalido('Escolha ao menos uma obra (ou "todas as obras").');
  }
  const sim = (v: unknown) => (typeof v === 'boolean' ? v : true);
  return {
    periodo,
    de: periodo === 'personalizado' ? de : '',
    ate: periodo === 'personalizado' ? ate : '',
    obras,
    fornecedores: sim(o.fornecedores),
    insumosObra: sim(o.insumosObra),
    financeiro: sim(o.financeiro),
  };
}

export const SyncConfigService = {
  /** Escolha salva (null = ainda não escolheu: o painel segue o filtro de período das telas, como antes). */
  obter(): ConfigSync | null {
    const s = ConfigModel.obter(CHAVE);
    if (!s) return null;
    try { return lerConfigSync(JSON.parse(s)); } catch { return null; }
  },

  salvar(c: ConfigSync): void {
    ConfigModel.definir(CHAVE, JSON.stringify(c));
  },

  limpar(): void {
    ConfigModel.remover(CHAVE);
  },

  /** Janela atual da escolha salva (null sem escolha). */
  janela(hoje = new Date()): (JanelaSync & { periodo: PeriodoSync }) | null {
    const c = SyncConfigService.obter();
    return c ? { ...janelaSync(c, hoje), periodo: c.periodo } : null;
  },
};
